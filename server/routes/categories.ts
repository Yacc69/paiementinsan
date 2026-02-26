import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all categories with their sub-categories
router.get('/', async (req: AuthRequest, res) => {
  const { data: categories, error } = await supabase
    .from('categories')
    .select(`
      *,
      subCategories:sub_categories(*)
    `)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  
  res.json(categories);
});

// Add category (admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  const { name } = req.body;

  const { data, error } = await supabase
    .from('categories')
    .insert([{ name }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: 'Category already exists or invalid data' });
  res.status(201).json(data);
});

// Add sub-category (admin only)
router.post('/sub', requireAdmin, async (req: AuthRequest, res) => {
  const { category_id, name } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ error: 'Category ID and name are required' });
  }

  const { data, error } = await supabase
    .from('sub_categories')
    .insert([{ category_id, name }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: 'Sub-category already exists for this category or invalid data' });
  res.status(201).json(data);
});

export default router;
