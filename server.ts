import express from 'express';
import path from 'path';

// Importation des routes
import authRoutes from './server/routes/auth.js';
import expensesRoutes from './server/routes/expenses.js';
import employeesRoutes from './server/routes/employees.js';
import categoriesRoutes from './server/routes/categories.js';
import dashboardRoutes from './server/routes/dashboard.js';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- Logique de démarrage ---
if (process.env.NODE_ENV !== 'production') {
  // ON DYNAMISE L'IMPORT DE VITE : C'est le secret pour éviter ton erreur !
  import('vite').then(async (viteModule) => {
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.listen(3000, () => {
      console.log(`🚀 Mode LOCAL : http://localhost:3000`);
    });
  });
} else {
  // En production sur Vercel, on sert juste le dossier dist
  app.use(express.static('dist'));
}

export default app;