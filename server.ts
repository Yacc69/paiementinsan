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

// --- Logique de démarrage ---
async function start() {
  // SI ON EST EN LOCAL : On lance Vite et le serveur .listen()
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Mode LOCAL : http://localhost:${PORT}`);
    });
  } else {
    // SI ON EST EN PRODUCTION (Vercel ou autre)
    // On sert les fichiers statiques du dossier dist
    app.use(express.static('dist'));
  }
}

// On n'exécute la fonction start() qu'en local
if (process.env.NODE_ENV !== 'production') {
  start();
}

// INDISPENSABLE POUR VERCEL
export default app;