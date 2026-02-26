import express from 'express';
import db from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get dashboard stats
router.get('/', (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  const { month } = req.query; // Optional month filter 'YYYY-MM'
  
  let expensesByCategory;
  let totalExpenses;
  let recentExpenses;
  let pendingCount;
  let rejectedCount;
  let approvedCount;

  const monthFilter = month ? `AND e.date LIKE '${month}%'` : '';

  if (role === 'admin' || role === 'admin_level_1') {
    expensesByCategory = db.prepare(`
      SELECT c.name, SUM(e.amount) as total
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE e.status = 'approved' ${monthFilter}
      GROUP BY c.id
    `).all();

    totalExpenses = db.prepare(`SELECT SUM(amount) as total FROM expenses e WHERE status = 'approved' ${monthFilter}`).get() as { total: number };
    
    recentExpenses = db.prepare(`
      SELECT e.*, c.name as category_name, sc.name as sub_category_name, u.email as user_email
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN sub_categories sc ON e.sub_category_id = sc.id
      JOIN users u ON e.user_id = u.id
      WHERE 1=1 ${monthFilter}
      ORDER BY e.created_at DESC
      LIMIT 10
    `).all();

    pendingCount = db.prepare(`SELECT COUNT(*) as count FROM expenses e WHERE status = 'pending' ${monthFilter}`).get() as { count: number };
    rejectedCount = db.prepare(`SELECT COUNT(*) as count FROM expenses e WHERE status = 'rejected' ${monthFilter}`).get() as { count: number };
    approvedCount = db.prepare(`SELECT COUNT(*) as count FROM expenses e WHERE status = 'approved' ${monthFilter}`).get() as { count: number };
  } else {
    expensesByCategory = db.prepare(`
      SELECT c.name, SUM(e.amount) as total
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ? AND e.status = 'approved' ${monthFilter}
      GROUP BY c.id
    `).all(id);

    totalExpenses = db.prepare(`SELECT SUM(amount) as total FROM expenses e WHERE user_id = ? AND status = 'approved' ${monthFilter}`).get(id) as { total: number };
    
    recentExpenses = db.prepare(`
      SELECT e.*, c.name as category_name, sc.name as sub_category_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN sub_categories sc ON e.sub_category_id = sc.id
      WHERE e.user_id = ? ${monthFilter}
      ORDER BY e.created_at DESC
      LIMIT 10
    `).all(id);

    pendingCount = db.prepare(`SELECT COUNT(*) as count FROM expenses e WHERE user_id = ? AND status = 'pending' ${monthFilter}`).get(id) as { count: number };
    rejectedCount = db.prepare(`SELECT COUNT(*) as count FROM expenses e WHERE user_id = ? AND status = 'rejected' ${monthFilter}`).get(id) as { count: number };
    approvedCount = db.prepare(`SELECT COUNT(*) as count FROM expenses e WHERE user_id = ? AND status = 'approved' ${monthFilter}`).get(id) as { count: number };
  }

  let totalPayrollValue = 0;
  if (month) {
    const tp = db.prepare(`
      SELECT SUM(salary) as total_payroll 
      FROM employees 
      WHERE strftime('%Y-%m', start_date) <= ?
    `).get(month) as { total_payroll: number };
    totalPayrollValue = tp.total_payroll || 0;
  } else {
    const firstHire = db.prepare("SELECT MIN(start_date) as first FROM employees").get() as { first: string };
    if (firstHire.first) {
      const startDate = new Date(firstHire.first);
      const endDate = new Date();
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (current <= endDate) {
        const monthStr = current.toISOString().slice(0, 7);
        const monthlyTotal = db.prepare(`
          SELECT SUM(salary) as total 
          FROM employees 
          WHERE strftime('%Y-%m', start_date) <= ?
        `).get(monthStr) as { total: number };
        totalPayrollValue += (monthlyTotal.total || 0);
        current.setMonth(current.getMonth() + 1);
      }
    }
  }

  res.json({
    expensesByCategory,
    totalExpenses: totalExpenses.total || 0,
    recentExpenses,
    totalPayroll: totalPayrollValue,
    stats: {
      pending: pendingCount.count,
      rejected: rejectedCount.count,
      approved: approvedCount.count
    }
  });
});

// Get comparison data between months (including sub-categories and total)
router.get('/comparison', (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  const { months, type, categories: categoryIds } = req.query; // type can be 'category', 'subcategory', or 'total'
  
  if (!months) return res.status(400).json({ error: 'Months required' });
  
  const monthList = (months as string).split(',');
  const results: any = {};

  for (const month of monthList) {
    let query = '';
    let params: any[] = [month];

    if (type === 'total') {
      query = `
        SELECT 'Total' as label, SUM(e.amount) as total
        FROM expenses e
        WHERE e.date LIKE ? || '%' AND e.status = 'approved'
      `;
    } else if (type === 'subcategory') {
      query = `
        SELECT sc.name as label, SUM(e.amount) as total
        FROM expenses e
        JOIN sub_categories sc ON e.sub_category_id = sc.id
        WHERE e.date LIKE ? || '%' AND e.status = 'approved'
      `;
    } else {
      query = `
        SELECT c.name as label, SUM(e.amount) as total
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE e.date LIKE ? || '%' AND e.status = 'approved'
      `;
    }
    
    // Add category filter if provided
    if (categoryIds && (type === 'category' || type === 'subcategory')) {
      const ids = (categoryIds as string).split(',');
      const placeholders = ids.map(() => '?').join(',');
      query += ` AND e.category_id IN (${placeholders})`;
      params.push(...ids);
    }
    
    if (role !== 'admin' && role !== 'admin_level_1') {
      query += ` AND e.user_id = ?`;
      params.push(id);
    }
    
    if (type === 'subcategory') {
      query += ` GROUP BY sc.id`;
    } else if (type === 'category') {
      query += ` GROUP BY c.id`;
    }
    
    const data = db.prepare(query).all(...params);
    results[month] = data;
  }

  res.json(results);
});

export default router;
