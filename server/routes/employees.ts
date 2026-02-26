import express from 'express';
import db from '../db.js';
import { authenticateToken, AuthRequest, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all employees (Super Admin only)
router.get('/', requireSuperAdmin, (req: AuthRequest, res) => {
  const { month, search } = req.query;
  let query = `
    SELECT e.*, u.email as added_by_email
    FROM employees e
    LEFT JOIN users u ON e.added_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (month) {
    query += ` AND strftime('%Y-%m', e.start_date) <= ?`;
    params.push(month);
  }

  if (search) {
    query += ` AND (e.first_name LIKE ? OR e.last_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY e.start_date DESC`;
  
  const employees = db.prepare(query).all(...params);
  res.json(employees);
});

// Add employee (Super Admin only)
router.post('/', requireSuperAdmin, (req: AuthRequest, res) => {
  const { first_name, last_name, salary, start_date } = req.body;
  const added_by = req.user!.id;

  try {
    const result = db.prepare(`
      INSERT INTO employees (first_name, last_name, salary, start_date, added_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(first_name, last_name, salary, start_date, added_by);
    
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Get total monthly payroll (Super Admin only)
router.get('/payroll', requireSuperAdmin, (req: AuthRequest, res) => {
  const { month } = req.query;
  
  if (month) {
    // Single month cumulative payroll (sum of salaries of all employees hired by then)
    const total = db.prepare(`
      SELECT SUM(salary) as total_payroll 
      FROM employees 
      WHERE strftime('%Y-%m', start_date) <= ?
    `).get(month) as { total_payroll: number };
    
    return res.json({ total_payroll: total.total_payroll || 0 });
  } else {
    // "All months" cumulative sum: sum of (monthly payroll) for every month from first hire to now
    const firstHire = db.prepare("SELECT MIN(start_date) as first FROM employees").get() as { first: string };
    if (!firstHire.first) return res.json({ total_payroll: 0 });

    const startDate = new Date(firstHire.first);
    const endDate = new Date();
    let totalCumulative = 0;

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= endDate) {
      const monthStr = current.toISOString().slice(0, 7);
      const monthlyTotal = db.prepare(`
        SELECT SUM(salary) as total 
        FROM employees 
        WHERE strftime('%Y-%m', start_date) <= ?
      `).get(monthStr) as { total: number };
      
      totalCumulative += (monthlyTotal.total || 0);
      current.setMonth(current.getMonth() + 1);
    }

    res.json({ total_payroll: totalCumulative });
  }
});

export default router;
