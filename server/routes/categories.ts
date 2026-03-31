import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Applique l'authentification à toutes les routes de ce fichier
router.use(authenticateToken);

/**
 * GET / - Récupère toutes les catégories avec leurs sous-catégories
 */
router.get('/', async (req: AuthRequest, res) => {
  const { data: categories, error } = await supabaseAdmin
    .from('categories')
    .select(`
      id,
      name,
      sub_categories (
        id,
        name,
        category_id
      )
    `)
    .order('name', { ascending: true })
    .limit(1000);

  if (error) return res.status(500).json({ error: error.message });
  res.json(categories);
});

/**
 * POST / - Ajouter une famille (Admin, Manager, Secrétaire)
 */
router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis' });

  const { data, error } = await supabaseAdmin.from('categories').insert([{ name }]).select().single();
  if (error) return res.status(400).json({ error: 'La catégorie existe déjà.' });
  res.status(201).json(data);
});

/**
 * POST /sub - Ajouter une sous-famille
 */
router.post('/sub', requireAdmin, async (req: AuthRequest, res) => {
  const { category_id, name } = req.body;
  if (!category_id || !name) return res.status(400).json({ error: 'ID et nom requis' });

  const { data, error } = await supabaseAdmin.from('sub_categories').insert([{ category_id, name }]).select().single();
  if (error) return res.status(400).json({ error: 'La sous-catégorie existe déjà.' });
  res.status(201).json(data);
});

/**
 * PATCH /:id - Modifier une Famille
 */
router.patch('/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const { data, error } = await supabaseAdmin.from('categories').update({ name }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: "Erreur lors de la modification." });
  res.json(data);
});

/**
 * PATCH /sub/:id - Modifier une Sous-Famille
 */
router.patch('/sub/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, category_id } = req.body;

  const { data, error } = await supabaseAdmin.from('sub_categories').update({ name, category_id }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: "Erreur lors de la modification." });
  res.json(data);
});

/**
 * DELETE /:id - Supprimer une Famille
 */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', id);
  if (error) return res.status(400).json({ error: "Impossible de supprimer : vérifiez que la famille est vide." });
  res.json({ success: true });
});

/**
 * DELETE /sub/:id - Supprimer une Sous-Famille
 */
router.delete('/sub/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from('sub_categories').delete().eq('id', id);
  if (error) return res.status(400).json({ error: "Erreur lors de la suppression." });
  res.json({ success: true });
});

export default router;