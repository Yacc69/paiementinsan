import express from 'express';
import { supabaseAdmin } from '../supabase.js'; // <-- PASS VIP
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const getMonthBounds = (monthStr: string) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end = new Date(year, month, 1).toISOString().slice(0, 10);
  return { start, end };
};

// --- GET / (Cartes, Donut et Hiérarchie) ---
router.get('/', async (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  const { month } = req.query; 

  try {
    let monthStart: string | null = null;
    let monthNext: string | null = null;
    if (month && typeof month === 'string') {
      const bounds = getMonthBounds(month);
      monthStart = bounds.start;
      monthNext = bounds.end;
    }

    // MASSE SALARIALE
    let totalPayrollValue = 0;
    if (role === 'admin' || role === 'admin_level_1') {
      const { data: employees } = await supabaseAdmin.from('employees').select('salary, start_date');
      const now = new Date();
      
      employees?.forEach(emp => {
        const start = new Date(emp.start_date);
        if (monthStart && monthNext) {
          if (start < new Date(monthNext)) totalPayrollValue += Number(emp.salary);
        } else {
          const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
          if (diff > 0) totalPayrollValue += Number(emp.salary) * diff;
        }
      });
    }

    // DÉPENSES AVEC SOUS-CATÉGORIES
    let expQuery = supabaseAdmin
      .from('expenses')
      .select(`
        amount, 
        category:categories(name),
        sub_category:sub_categories(name)
      `)
      .in('status', ['approved', 'paid'])
      .limit(100000); // <-- CORRECTION : Plafond cassé pour TOUT LE MONDE

    // Filtrage pour les requesters (ils ne voient que leurs propres dépenses)
    if (role !== 'admin' && role !== 'admin_level_1' && role !== 'secretary') {
      expQuery = expQuery.eq('user_id', userId);
    }
    
    // Filtrage par date si un mois est sélectionné
    if (monthStart && monthNext) {
      expQuery = expQuery.gte('date', monthStart).lt('date', monthNext);
    }

    const { data: expensesData } = await expQuery;

    // --- LOGIQUE DE GROUPEMENT HIÉRARCHIQUE ---
    const categoriesMap: Record<string, any> = {};

    expensesData?.forEach((e: any) => {
      const catName = e.category?.name || 'Inconnu';
      const subName = e.sub_category?.name || 'Général';
      const amount = Number(e.amount);

      if (!categoriesMap[catName]) {
        categoriesMap[catName] = { 
          name: catName, 
          total: 0, 
          subFamilies: {} 
        };
      }

      categoriesMap[catName].total += amount;

      if (!categoriesMap[catName].subFamilies[subName]) {
        categoriesMap[catName].subFamilies[subName] = 0;
      }
      categoriesMap[catName].subFamilies[subName] += amount;
    });

    res.json({
      expensesByCategory: Object.values(categoriesMap),
      totalExpenses: expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
      totalPayroll: totalPayrollValue,
    });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

// --- GET /comparison ---
router.get('/comparison', async (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  const { months, type, categories: categoryIds } = req.query;
  if (!months) return res.status(400).json({ error: 'Mois requis' });

  if (type === 'payroll' && role !== 'admin' && role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const monthList = (months as string).split(',');
  const results: any = {};

  try {
    const { data: employees } = await supabaseAdmin.from('employees').select('salary, start_date');

    for (const m of monthList) {
      const { start, end } = getMonthBounds(m);
      const targetDate = new Date(end);

      const monthlyPayroll = (role === 'admin' || role === 'admin_level_1')
        ? (employees?.filter(emp => new Date(emp.start_date) < targetDate).reduce((sum, emp) => sum + Number(emp.salary), 0) || 0)
        : 0;

      // MODIFICATION ICI : supabaseAdmin + .limit(100000)
      let query = supabaseAdmin
        .from('expenses')
        .select('amount, category:categories(name, id)')
        .in('status', ['approved', 'paid']) 
        .gte('date', start)
        .lt('date', end)
        .limit(100000); // <-- CORRECTION : Plafond cassé ici aussi

      if (role !== 'admin' && role !== 'admin_level_1' && role !== 'secretary') query = query.eq('user_id', userId);
      if (categoryIds && type === 'category') query = query.in('category_id', (categoryIds as string).split(',').map(Number));

      const { data: expenses } = await query;
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      if (type === 'total') {
        results[m] = [{ label: 'Total Réel', total: totalExpenses + monthlyPayroll }];
      } else if (type === 'payroll') {
        results[m] = [{ label: 'Masse Salariale', total: monthlyPayroll }];
      } else {
        const grouped: Record<string, number> = {};
        expenses?.forEach((e: any) => {
          const name = e.category?.name || 'Inconnu';
          grouped[name] = (grouped[name] || 0) + Number(e.amount);
        });
        results[m] = Object.entries(grouped).map(([label, total]) => ({ label, total }));
      }
    }
    res.json(results);
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

export default router;