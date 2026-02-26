import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all expenses (admin sees all, requester sees own)
router.get('/', async (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  
  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:categories(name),
      sub_category:sub_categories(name),
      user:users!expenses_user_id_fkey(email),
      approver:users!expenses_approved_by_fkey(email)
    `);

  if (role !== 'admin') {
    query = query.eq('user_id', id);
  }

  const { data: expenses, error } = await query.order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Format response to match expected frontend structure
  const formattedExpenses = expenses.map(e => ({
    ...e,
    category_name: e.category?.name,
    sub_category_name: e.sub_category?.name,
    user_email: e.user?.email,
    approved_by_email: e.approver?.email
  }));

  res.json(formattedExpenses);
});

// Create expense request
router.post('/', async (req: AuthRequest, res) => {
  const { category_id, sub_category_id, amount, description, date, attachment } = req.body;
  const user_id = req.user!.id;

  const { data, error } = await supabase
    .from('expenses')
    .insert([{ 
      user_id, 
      category_id, 
      sub_category_id: sub_category_id || null, 
      amount, 
      description, 
      date, 
      attachment: attachment || null 
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ id: data.id, status: 'pending' });
});

// Update expense status (admin only)
router.patch('/:id/status', async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  
  const { status } = req.body;
  const { id } = req.params;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const approved_by = status === 'approved' ? req.user!.id : null;

  const { error } = await supabase
    .from('expenses')
    .update({ status, approved_by })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Delete expense (admin or owner if pending)
router.delete('/:id', async (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  const { id } = req.params;

  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !expense) return res.status(404).json({ error: 'Expense not found' });

  if (role === 'admin' || role === 'admin_level_1' || (expense.user_id === userId && expense.status === 'pending')) {
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
      
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    return res.json({ success: true });
  }

  res.status(403).json({ error: 'Unauthorized' });
});

export default router;
