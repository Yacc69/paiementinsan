import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Applique l'authentification à toutes les routes de ce fichier
router.use(authenticateToken);

/**
 * GET / - Liste des salariés avec filtres
 */
router.get('/', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { month, search } = req.query;
  
  let query = supabase
    .from('employees')
    .select(`
      *,
      added_by_user:users(email)
    `);

  // Filtre par mois (tous les employés dont la date de début est <= au mois sélectionné)
  if (month && typeof month === 'string') {
    const [year, m] = month.split('-').map(Number);
    // On prend le 1er jour du mois SUIVANT pour utiliser l'opérateur "inférieur à" (lt)
    // C'est la méthode la plus sûre pour gérer 28, 29, 30 ou 31 jours.
    const nextMonthLimit = new Date(year, m, 1).toISOString().slice(0, 10);
    query = query.lt('start_date', nextMonthLimit);
  }

  // Filtre de recherche par nom/prénom
  if (search && typeof search === 'string') {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data: employees, error } = await query.order('start_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  const formattedEmployees = employees.map(e => ({
    ...e,
    added_by_email: (e as any).added_by_user?.email
  }));

  res.json(formattedEmployees);
});

/**
 * POST / - Ajouter un salarié
 */
router.post('/', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { first_name, last_name, salary, start_date } = req.body;
  const added_by = req.user!.id; // UUID de l'admin connecté

  const { data, error } = await supabase
    .from('employees')
    .insert([{ 
      first_name, 
      last_name, 
      salary: Number(salary), // S'assurer que c'est un nombre
      start_date, 
      added_by 
    }])
    .select()
    .single();

  if (error) {
    console.error("Erreur insertion salarié:", error);
    return res.status(400).json({ error: error.message });
  }
  res.status(201).json(data);
});

/**
 * GET /payroll - Calcul de la masse salariale (Mensuelle ou Cumulative)
 */
router.get('/payroll', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { month } = req.query;
  
  if (month && typeof month === 'string') {
    // --- 1. Calcul pour un mois spécifique ---
    const [year, m] = month.split('-').map(Number);
    const nextMonthLimit = new Date(year, m, 1).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('employees')
      .select('salary')
      .lt('start_date', nextMonthLimit);

    if (error) return res.status(500).json({ error: error.message });
    
    const total = data?.reduce((sum, e) => sum + Number(e.salary), 0) || 0;
    return res.json({ total_payroll: total });

  } else {
    // --- 2. Calcul CUMULATIF (Optimisé : 1 seule requête SQL) ---
    // Au lieu de boucler mois par mois, on récupère tout et on calcule le prorata en JS
    const { data: employees, error } = await supabase
      .from('employees')
      .select('salary, start_date')
      .order('start_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    if (!employees || employees.length === 0) return res.json({ total_payroll: 0 });

    const now = new Date();
    let totalCumulative = 0;

    employees.forEach(emp => {
      const start = new Date(emp.start_date);
      // Calcul du nombre de mois payés (du début à aujourd'hui)
      const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 
                         + (now.getMonth() - start.getMonth()) 
                         + 1; // +1 pour inclure le mois en cours

      if (diffMonths > 0) {
        totalCumulative += Number(emp.salary) * diffMonths;
      }
    });

    res.json({ total_payroll: totalCumulative });
  }
});

export default router;