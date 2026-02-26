import express from 'express';
import db from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all expenses (admin sees all, requester sees own)
router.get('/', (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  let expenses;
  if (role === 'admin') {
    expenses = db.prepare(`
      SELECT e.*, c.name as category_name, sc.name as sub_category_name, u.email as user_email, a.email as approved_by_email
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN sub_categories sc ON e.sub_category_id = sc.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN users a ON e.approved_by = a.id
      ORDER BY e.created_at DESC
    `).all();
  } else {
    expenses = db.prepare(`
      SELECT e.*, c.name as category_name, sc.name as sub_category_name, a.email as approved_by_email
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN sub_categories sc ON e.sub_category_id = sc.id
      LEFT JOIN users a ON e.approved_by = a.id
      WHERE e.user_id = ?
      ORDER BY e.created_at DESC
    `).all(id);
  }
  res.json(expenses);
});

// Create expense request
router.post('/', (req: AuthRequest, res) => {
  const { category_id, sub_category_id, amount, description, date, attachment } = req.body;
  const user_id = req.user!.id;

  try {
    const result = db.prepare(`
      INSERT INTO expenses (user_id, category_id, sub_category_id, amount, description, date, attachment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, category_id, sub_category_id || null, amount, description, date, attachment || null);
    
    res.status(201).json({ id: result.lastInsertRowid, status: 'pending' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Update expense status (admin only)
router.patch('/:id/status', (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  
  const { status } = req.body;
  const { id } = req.params;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const approved_by = status === 'approved' ? req.user!.id : null;

  db.prepare('UPDATE expenses SET status = ?, approved_by = ? WHERE id = ?').run(status, approved_by, id);
  res.json({ success: true });
});

// Delete expense (admin or owner if pending)
router.delete('/:id', (req: AuthRequest, res) => {
  const { role, id: userId } = req.user!;
  const { id } = req.params;
  console.log(`Delete request for expense ${id} by user ${userId} (role: ${role})`);

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
  if (!expense) {
    console.log(`Expense ${id} not found`);
    return res.status(404).json({ error: 'Expense not found' });
  }

  if (role === 'admin' || role === 'admin_level_1' || (expense.user_id === userId && expense.status === 'pending')) {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    console.log(`Expense ${id} deleted successfully`);
    return res.json({ success: true });
  }

  console.log(`User ${userId} unauthorized to delete expense ${id}`);
  res.status(403).json({ error: 'Unauthorized' });
});

export default router;
