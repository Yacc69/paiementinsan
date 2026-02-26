import express from 'express';
import db from '../db.js';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all categories with their sub-categories
router.get('/', (req: AuthRequest, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all() as any[];
  
  for (const category of categories) {
    category.subCategories = db.prepare('SELECT * FROM sub_categories WHERE category_id = ? ORDER BY name ASC').all(category.id);
  }
  
  res.json(categories);
});

// Add category (admin only)
router.post('/', requireAdmin, (req: AuthRequest, res) => {
  const { name } = req.body;

  try {
    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    res.status(400).json({ error: 'Category already exists' });
  }
});

// Add sub-category (admin only)
router.post('/sub', requireAdmin, (req: AuthRequest, res) => {
  const { category_id, name } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ error: 'Category ID and name are required' });
  }

  try {
    const result = db.prepare('INSERT INTO sub_categories (category_id, name) VALUES (?, ?)').run(category_id, name);
    res.status(201).json({ id: result.lastInsertRowid, category_id, name });
  } catch (error) {
    res.status(400).json({ error: 'Sub-category already exists for this category' });
  }
});

export default router;
