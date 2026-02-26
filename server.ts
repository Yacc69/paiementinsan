import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// Importation des routes
import authRoutes from './server/routes/auth.js';
import expensesRoutes from './server/routes/expenses.js';
import employeesRoutes from './server/routes/employees.js';
import categoriesRoutes from './server/routes/categories.js';
import dashboardRoutes from './server/routes/dashboard.js';

const app = express();

// Configuration Body-parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- Logique Serveur / Vite ---
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mode développement (Vite)
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serveur local sur http://localhost:${PORT}`);
    });
  } else {
    // Mode Production (Vercel gère le statique différemment, 
    // mais on garde ceci pour la compatibilité)
    app.use(express.static('dist'));
    // On ne met pas de app.get('*') ici car Vercel utilise son propre système de routing
  }
}

// Lancement uniquement en local
if (process.env.NODE_ENV !== 'production') {
  setupServer();
}

// CRUCIAL POUR VERCEL
export default app;