import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// Importation des routes (un seul import par fichier)
import authRoutes from './server/routes/auth.js';
import expensesRoutes from './server/routes/expenses.js';
import employeesRoutes from './server/routes/employees.js';
import categoriesRoutes from './server/routes/categories.js';
import dashboardRoutes from './server/routes/dashboard.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configuration Body-parser
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --- API Routes ---
  app.use('/api/auth', authRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // --- Middleware de développement (Vite) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Mode Production
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur opérationnel sur http://localhost:${PORT}`);
  });
}

startServer();