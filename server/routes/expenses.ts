import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /
 * Liste des dépenses : Admin et Admin_Level_1 voient tout. 
 * Les collaborateurs voient seulement leurs propres dépenses.
 */
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

  // SÉCURITÉ : Si l'utilisateur n'est pas Admin ou Manager, on filtre par son ID
  if (role !== 'admin' && role !== 'admin_level_1') {
    query = query.eq('user_id', id);
  }

  const { data: expenses, error } = await query.order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const formattedExpenses = expenses.map(e => ({
    ...e,
    category_name: e.category?.name,
    sub_category_name: e.sub_category?.name,
    user_email: e.user?.email,
    approved_by_email: e.approver?.email
  }));

  res.json(formattedExpenses);
});

/**
 * POST /
 * Création d'une demande de frais
 */
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

/**
 * PATCH /:id/status
 * Validation ou Rejet des frais.
 * Autorisé pour Admin ET Admin_Level_1
 */
router.patch('/:id/status', async (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  
  // SÉCURITÉ : Seuls les Admins ou Managers peuvent valider
  if (role !== 'admin' && role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Autorisation insuffisante' });
  }
  
  const { status } = req.body;
  const { id } = req.params;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const approved_by = (status === 'approved' || status === 'rejected') ? userId : null;

  const { error } = await supabase
    .from('expenses')
    .update({ status, approved_by })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/**
 * DELETE /:id
 * Suppression par l'Admin, le Manager, ou le propriétaire si la demande est en attente.
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  const { id } = req.params;

  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !expense) return res.status(404).json({ error: 'Dépense introuvable' });

  // Autorisation : Admin, Manager, ou propriétaire si statut 'pending'
  const isAuthorized = role === 'admin' || 
                       role === 'admin_level_1' || 
                       (expense.user_id === userId && expense.status === 'pending');

  if (isAuthorized) {
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
      
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    return res.json({ success: true });
  }

  res.status(403).json({ error: 'Non autorisé' });
});

export default router;