import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get dashboard stats
router.get('/', async (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  const { month } = req.query; // Optional month filter 'YYYY-MM'
  
  const monthFilter = month ? `${month}-01` : null;
  const monthEnd = month ? `${month}-31` : null;

  try {
    // 1. Expenses by category
    let expQuery = supabase
      .from('expenses')
      .select('amount, category:categories(name)')
      .eq('status', 'approved');

    if (role !== 'admin' && role !== 'admin_level_1') {
      expQuery = expQuery.eq('user_id', id);
    }
    if (month) {
      expQuery = expQuery.gte('date', monthFilter).lte('date', monthEnd);
    }

    const { data: expensesData } = await expQuery;
    
    const expensesByCategoryMap: Record<string, number> = {};
    expensesData?.forEach((e: any) => {
      const name = e.category?.name || 'Unknown';
      expensesByCategoryMap[name] = (expensesByCategoryMap[name] || 0) + Number(e.amount);
    });

    const expensesByCategory = Object.entries(expensesByCategoryMap).map(([name, total]) => ({ name, total }));
    const totalExpenses = expensesByCategory.reduce((sum, e) => sum + e.total, 0);

    // 2. Recent expenses
    let recentQuery = supabase
      .from('expenses')
      .select(`
        *,
        category:categories(name),
        sub_category:sub_categories(name),
        user:users!expenses_user_id_fkey(email)
      `);

    if (role !== 'admin' && role !== 'admin_level_1') {
      recentQuery = recentQuery.eq('user_id', id);
    }
    if (month) {
      recentQuery = recentQuery.gte('date', monthFilter).lte('date', monthEnd);
    }

    const { data: recentExpensesRaw } = await recentQuery.order('created_at', { ascending: false }).limit(10);
    const recentExpenses = recentExpensesRaw?.map(e => ({
      ...e,
      category_name: e.category?.name,
      sub_category_name: e.sub_category?.name,
      user_email: e.user?.email
    })) || [];

    // 3. Stats counts
    let statsQuery = supabase
      .from('expenses')
      .select('status');

    if (role !== 'admin' && role !== 'admin_level_1') {
      statsQuery = statsQuery.eq('user_id', id);
    }
    if (month) {
      statsQuery = statsQuery.gte('date', monthFilter).lte('date', monthEnd);
    }

    const { data: statsRaw } = await statsQuery;
    const stats = {
      pending: statsRaw?.filter(s => s.status === 'pending').length || 0,
      rejected: statsRaw?.filter(s => s.status === 'rejected').length || 0,
      approved: statsRaw?.filter(s => s.status === 'approved').length || 0
    };

    // 4. Payroll
    let totalPayrollValue = 0;
    if (month) {
      const { data: payrollData } = await supabase
        .from('employees')
        .select('salary')
        .lte('start_date', monthEnd);
      totalPayrollValue = payrollData?.reduce((sum, e) => sum + Number(e.salary), 0) || 0;
    } else {
      const { data: firstHire } = await supabase
        .from('employees')
        .select('start_date')
        .order('start_date', { ascending: true })
        .limit(1)
        .single();

      if (firstHire) {
        const startDate = new Date(firstHire.start_date);
        const endDate = new Date();
        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        while (current <= endDate) {
          const monthStr = current.toISOString().slice(0, 7);
          const { data: monthlyData } = await supabase
            .from('employees')
            .select('salary')
            .lte('start_date', `${monthStr}-31`);
          totalPayrollValue += monthlyData?.reduce((sum, e) => sum + Number(e.salary), 0) || 0;
          current.setMonth(current.getMonth() + 1);
        }
      }
    }

    res.json({
      expensesByCategory,
      totalExpenses,
      recentExpenses,
      totalPayroll: totalPayrollValue,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get comparison data between months
router.get('/comparison', async (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  const { months, type, categories: categoryIds } = req.query;
  
  if (!months) return res.status(400).json({ error: 'Months required' });
  
  const monthList = (months as string).split(',');
  const results: any = {};

  try {
    for (const month of monthList) {
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;

      let query: any;
      if (type === 'total') {
        query = supabase
          .from('expenses')
          .select('amount')
          .eq('status', 'approved')
          .gte('date', monthStart)
          .lte('date', monthEnd);
      } else if (type === 'subcategory') {
        query = supabase
          .from('expenses')
          .select('amount, sub_category:sub_categories(name)')
          .eq('status', 'approved')
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .not('sub_category_id', 'is', null);
      } else {
        query = supabase
          .from('expenses')
          .select('amount, category:categories(name)')
          .eq('status', 'approved')
          .gte('date', monthStart)
          .lte('date', monthEnd);
      }

      if (categoryIds && (type === 'category' || type === 'subcategory')) {
        const ids = (categoryIds as string).split(',').map(Number);
        query = query.in('category_id', ids);
      }

      if (role !== 'admin' && role !== 'admin_level_1') {
        query = query.eq('user_id', id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (type === 'total') {
        const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
        results[month] = [{ label: 'Total', total }];
      } else {
        const grouped: Record<string, number> = {};
        data.forEach((e: any) => {
          const label = type === 'subcategory' ? e.sub_category?.name : e.category?.name;
          if (label) {
            grouped[label] = (grouped[label] || 0) + Number(e.amount);
          }
        });
        results[month] = Object.entries(grouped).map(([label, total]) => ({ label, total }));
      }
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
