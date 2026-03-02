import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Applique l'authentification à toutes les routes de ce fichier
router.use(authenticateToken);

/**
 * FONCTION DE NOTIFICATION SYSTÉMATIQUE AUX ADMINS
 */
async function notifyAllAdmins(title: string, message: string) {
  try {
    // 1. On récupère les IDs de tous les admins
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, role');

    if (fetchError) return;

    // 2. On filtre pour ne garder que les admins
    const adminList = users.filter(u => u.role === 'admin' || u.role === 'admin_level_1');

    if (adminList.length > 0) {
      const notifications = adminList.map(adm => ({
        user_id: adm.id,
        title: title,
        message: message,
        type: 'warning',
        is_read: false
      }));

      // 3. Insertion en masse dans la table notifications
      await supabase.from('notifications').insert(notifications);
      console.log(`✅ Notification Salarié envoyée à ${adminList.length} admins.`);
    }
  } catch (err) {
    console.error("❌ Erreur notification employees:", err);
  }
}

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

  if (month && typeof month === 'string') {
    const [year, m] = month.split('-').map(Number);
    const nextMonthLimit = new Date(year, m, 1).toISOString().slice(0, 10);
    query = query.lt('start_date', nextMonthLimit);
  }

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
 * POST / - Ajouter un salarié + Notification
 */
router.post('/', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { first_name, last_name, salary, start_date } = req.body;
  const added_by = req.user!.id; 
  const admin_email = req.user!.email;

  const { data, error } = await supabase
    .from('employees')
    .insert([{ 
      first_name, 
      last_name, 
      salary: Number(salary), 
      start_date, 
      added_by 
    }])
    .select()
    .single();

  if (error) {
    console.error("Erreur insertion salarié:", error);
    return res.status(400).json({ error: error.message });
  }

  // --- NOTIFICATION POUR TOUS LES ADMINS ---
  await notifyAllAdmins(
    "👤 Nouveau salarié ajouté",
    `L'admin ${admin_email} a ajouté ${first_name} ${last_name} au personnel (Salaire: ${salary}€).`
  );

  res.status(201).json(data);
});

/**
 * DELETE /:id - Supprimer un salarié + Notification
 */
router.delete('/:id', requireSuperAdmin, async (req: AuthRequest, res) => {
  const admin_email = req.user!.email;
  const { id } = req.params;

  // 1. Récupérer les infos du salarié avant suppression pour la notification
  const { data: employee, error: fetchError } = await supabase
    .from('employees')
    .select('first_name, last_name')
    .eq('id', id)
    .single();

  if (fetchError || !employee) {
    return res.status(404).json({ error: "Salarié introuvable" });
  }

  // 2. Supprimer le salarié
  const { error: deleteError } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return res.status(500).json({ error: deleteError.message });
  }

  // 3. Envoyer la notification de suppression aux admins
  await notifyAllAdmins(
    "🗑️ Salarié supprimé",
    `L'admin ${admin_email} a supprimé ${employee.first_name} ${employee.last_name} de la liste du personnel.`
  );

  res.json({ success: true, message: "Salarié supprimé avec succès" });
});

/**
 * GET /payroll - Calcul de la masse salariale (Mensuelle ou Cumulative)
 */
router.get('/payroll', requireSuperAdmin, async (req: AuthRequest, res) => {
  const { month } = req.query;
  
  if (month && typeof month === 'string') {
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
      const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 
                         + (now.getMonth() - start.getMonth()) 
                         + 1;

      if (diffMonths > 0) {
        totalCumulative += Number(emp.salary) * diffMonths;
      }
    });

    res.json({ total_payroll: totalCumulative });
  }
});

/**
 * PATCH /:id - Modifier un salarié + Notification
 */
router.patch('/:id', requireSuperAdmin, async (req: AuthRequest, res) => {
  const admin_email = req.user!.email;
  const { id } = req.params;
  const { first_name, last_name, salary, start_date } = req.body;

  // 1. Récupérer les anciennes valeurs pour une notification précise
  const { data: oldData } = await supabase
    .from('employees')
    .select('first_name, last_name, salary')
    .eq('id', id)
    .single();

  // 2. Mise à jour
  const { data, error } = await supabase
    .from('employees')
    .update({ 
      first_name, 
      last_name, 
      salary: Number(salary), 
      start_date 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // 3. Notification détaillée
  const changeMsg = oldData?.salary !== Number(salary) 
    ? `(Salaire modifié : ${oldData?.salary}€ ➡️ ${salary}€)` 
    : "";

  await notifyAllAdmins(
    "✏️ Salarié modifié",
    `L'admin ${admin_email} a mis à jour la fiche de ${first_name} ${last_name}. ${changeMsg}`
  );

  res.json(data);
});

export default router;