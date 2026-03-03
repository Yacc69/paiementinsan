import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Applique l'authentification à toutes les routes de ce fichier
router.use(authenticateToken);

/**
 * GET /
 * Récupère toutes les catégories avec leurs sous-catégories
 * Accessible par tous les utilisateurs connectés
 */
router.get('/', async (req: AuthRequest, res) => {
  const { data: categories, error } = await supabase
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
    .order('name', { ascending: true });

  if (error) {
    console.error("Erreur récupération categories:", error);
    return res.status(500).json({ error: error.message });
  }
  
  res.json(categories);
});

/**
 * POST /
 * Ajouter une famille (catégorie)
 * Accessible par Admin et Admin_Level_1 via requireAdmin
 */
router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Le nom de la famille est requis' });
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    console.error("Erreur insertion catégorie:", error);
    return res.status(400).json({ error: 'La catégorie existe déjà ou les données sont invalides' });
  }

  res.status(201).json(data);
});

/**
 * POST /sub
 * Ajouter une sous-famille (sous-catégorie)
 * Accessible par Admin et Admin_Level_1 via requireAdmin
 */
router.post('/sub', requireAdmin, async (req: AuthRequest, res) => {
  const { category_id, name } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ error: 'L’ID de catégorie (famille) et le nom sont requis' });
  }

  const { data, error } = await supabase
    .from('sub_categories')
    .insert([{ category_id, name }])
    .select()
    .single();

  if (error) {
    console.error("Erreur insertion sous-catégorie:", error);
    return res.status(400).json({ error: 'La sous-catégorie existe déjà pour cette famille ou les données sont invalides' });
  }

  res.status(201).json(data);
});
/**
 * DELETE /:id - Supprimer une Famille
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  const { id } = req.params;

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return res.status(400).json({ error: "Impossible de supprimer : vérifiez que la famille est vide." });

  res.json({ success: true });
});

/**
 * DELETE /sub/:id - Supprimer une Sous-Famille
 */
router.delete('/sub/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  const { id } = req.params;

  const { error } = await supabase.from('sub_categories').delete().eq('id', id);
  if (error) return res.status(400).json({ error: "Erreur lors de la suppression." });

  res.json({ success: true });
});
export default router;