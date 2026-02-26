import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const getMonthBounds = (monthStr: string) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end = new Date(year, month, 1).toISOString().slice(0, 10);
  return { start, end };
};

// --- GET / (Cartes et Donut) ---
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

    // MASSE SALARIALE : AUTORISÉ POUR ADMIN ET ADMIN_LEVEL_1
    let totalPayrollValue = 0;
    if (role === 'admin' || role === 'admin_level_1') {
      const { data: employees } = await supabase.from('employees').select('salary, start_date');
      const now = new Date();
      
      employees?.forEach(emp => {
        const start = new Date(emp.start_date);
        if (monthStart && monthNext) {
          // Si on filtre par mois : on prend le salaire mensuel si l'employé était déjà là
          if (start < new Date(monthNext)) totalPayrollValue += Number(emp.salary);
        } else {
          // Si cumul global : somme historique (mois de présence x salaire)
          const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
          if (diff > 0) totalPayrollValue += Number(emp.salary) * diff;
        }
      });
    }

    // DÉPENSES : Filtrées seulement pour les simples collaborateurs
    let expQuery = supabase.from('expenses').select('amount, category:categories(name)').eq('status', 'approved');
    if (role !== 'admin' && role !== 'admin_level_1') {
      expQuery = expQuery.eq('user_id', userId);
    }
    if (monthStart && monthNext) expQuery = expQuery.gte('date', monthStart).lt('date', monthNext);

    const { data: expensesData } = await expQuery;
    const expensesByCategoryMap: Record<string, number> = {};
    expensesData?.forEach((e: any) => {
      const name = e.category?.name || 'Inconnu';
      expensesByCategoryMap[name] = (expensesByCategoryMap[name] || 0) + Number(e.amount);
    });

    res.json({
      expensesByCategory: Object.entries(expensesByCategoryMap).map(([name, total]) => ({ name, total })),
      totalExpenses: Object.values(expensesByCategoryMap).reduce((a, b) => a + b, 0),
      totalPayroll: totalPayrollValue,
    });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

// --- GET /comparison (LOGIQUE IDENTIQUE ADMIN & MANAGER) ---
router.get('/comparison', async (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  const { months, type, categories: categoryIds } = req.query;
  if (!months) return res.status(400).json({ error: 'Mois requis' });

  // Sécurité : Seul Admin et Manager peuvent voir la Payroll
  if (type === 'payroll' && role !== 'admin' && role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const monthList = (months as string).split(',');
  const results: any = {};

  try {
    const { data: employees } = await supabase.from('employees').select('salary, start_date');

    for (const m of monthList) {
      const { start, end } = getMonthBounds(m);
      const targetDate = new Date(end);

      // Payroll autorisée pour Admin et Level 1
      const monthlyPayroll = (role === 'admin' || role === 'admin_level_1')
        ? (employees?.filter(emp => new Date(emp.start_date) < targetDate).reduce((sum, emp) => sum + Number(emp.salary), 0) || 0)
        : 0;

      let query = supabase.from('expenses').select('amount, category:categories(name, id)').eq('status', 'approved').gte('date', start).lt('date', end);
      if (role !== 'admin' && role !== 'admin_level_1') query = query.eq('user_id', userId);
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