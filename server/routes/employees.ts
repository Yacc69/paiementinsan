import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all employees (Super Admin only)
router.get('/', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { month, search } = req.query;
  
  let query = supabase
    .from('employees')
    .select(`
      *,
      added_by_user:users!employees_added_by_fkey(email)
    `);

  if (month) {
    query = query.lte('start_date', `${month}-31`);
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data: employees, error } = await query.order('start_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Format response to match expected frontend structure
  const formattedEmployees = employees.map(e => ({
    ...e,
    added_by_email: e.added_by_user?.email
  }));

  res.json(formattedEmployees);
});

// Add employee (Super Admin only)
router.post('/', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { first_name, last_name, salary, start_date } = req.body;
  const added_by = req.user!.id;

  const { data, error } = await supabase
    .from('employees')
    .insert([{ first_name, last_name, salary, start_date, added_by }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Get total monthly payroll (Super Admin only)
router.get('/payroll', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { month } = req.query;
  
  if (month) {
    // Single month cumulative payroll
    const { data, error } = await supabase
      .from('employees')
      .select('salary')
      .lte('start_date', `${month}-31`);

    if (error) return res.status(500).json({ error: error.message });
    
    const total = data.reduce((sum, e) => sum + Number(e.salary), 0);
    return res.json({ total_payroll: total });
  } else {
    // "All months" cumulative sum
    const { data: firstHire, error: hireError } = await supabase
      .from('employees')
      .select('start_date')
      .order('start_date', { ascending: true })
      .limit(1)
      .single();

    if (hireError || !firstHire) return res.json({ total_payroll: 0 });

    const startDate = new Date(firstHire.start_date);
    const endDate = new Date();
    let totalCumulative = 0;

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= endDate) {
      const monthStr = current.toISOString().slice(0, 7);
      const { data: monthlyData } = await supabase
        .from('employees')
        .select('salary')
        .lte('start_date', `${monthStr}-31`);
      
      const monthlyTotal = monthlyData?.reduce((sum, e) => sum + Number(e.salary), 0) || 0;
      totalCumulative += monthlyTotal;
      current.setMonth(current.getMonth() + 1);
    }

    res.json({ total_payroll: totalCumulative });
  }
});

export default router;
