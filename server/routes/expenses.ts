import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * FONCTION DE NOTIFICATION SYSTÉMATIQUE
 * Elle cherche tous les admins et leur envoie une notification
 */
async function notifyAllAdmins(title: string, message: string) {
  try {
    const { data: admins, error: fetchError } = await supabase
      .from('users')
      .select('id, role');

    if (fetchError) {
      console.error("❌ Erreur lors de la récupération des admins:", fetchError.message);
      return;
    }

    const adminList = admins.filter(u => u.role === 'admin' || u.role === 'admin_level_1');
    
    console.log(`🔍 Tentative d'envoi à ${adminList.length} admins trouvés.`);

    if (adminList.length > 0) {
      const notifications = adminList.map(adm => ({
        user_id: adm.id,
        title: title,
        message: message,
        type: 'warning',
        is_read: false
      }));

      const { error: insertError } = await supabase.from('notifications').insert(notifications);
      if (insertError) {
        console.error("❌ Erreur lors de l'insertion des notifications:", insertError.message);
      } else {
        console.log("✅ Notifications envoyées avec succès aux admins.");
      }
    } else {
      console.log("⚠️ Aucun admin trouvé dans la base avec les rôles 'admin' ou 'admin_level_1'.");
    }
  } catch (err) {
    console.error("❌ Erreur système notification:", err);
  }
}

/**
 * GET / - Liste des dépenses
 */
router.get('/', async (req: AuthRequest, res) => {
  const { role, id } = req.user!;
  
  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:categories(name),
      sub_category:sub_categories(name),
      user:users!expenses_user_id_fkey(email, first_name, last_name),
      approver:users!expenses_approved_by_fkey(email)
    `);

  if (role !== 'admin' && role !== 'admin_level_1') {
    query = query.eq('user_id', id);
  }

  const { data: expenses, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error("Erreur backend expenses:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const formattedExpenses = expenses.map(e => {
    // Construction sécurisée du nom complet
    const firstName = e.user?.first_name || '';
    const lastName = e.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      ...e,
      category_name: e.category?.name,
      sub_category_name: e.sub_category?.name,
      user_email: e.user?.email,
      user_full_name: fullName || null, // Sera nul si profil non rempli
      approved_by_email: e.approver?.email
    };
  });

  res.json(formattedExpenses);
});

/**
 * POST / - Création d'une dépense + Alerte Admins
 */
router.post('/', async (req: AuthRequest, res) => {
  const { category_id, sub_category_id, amount, description, date, attachment } = req.body;
  const user_id = req.user!.id;
  const user_email = req.user!.email;

  const { data, error } = await supabase
    .from('expenses')
    .insert([{ 
      user_id, category_id, 
      sub_category_id: sub_category_id || null, 
      amount, description, date, 
      attachment: attachment || null 
    }])
    .select().single();

  if (error) return res.status(400).json({ error: error.message });

  await notifyAllAdmins(
    "🚨 Nouvelle dépense",
    `L'employé ${user_email} a soumis une demande de ${amount}€.`
  );

  res.status(201).json({ id: data.id, status: 'pending' });
});

/**
 * PATCH /:id/status - Validation/Rejet + Alerte Admins
 */
router.patch('/:id/status', async (req: AuthRequest, res) => {
  const { role, id: adminId, email: adminEmail } = req.user!;
  if (role !== 'admin' && role !== 'admin_level_1') return res.status(403).json({ error: 'Interdit' });
  
  const { status } = req.body;
  const { id } = req.params;

  const { data: expense } = await supabase.from('expenses').select('user_id, amount').eq('id', id).single();

  const { error } = await supabase.from('expenses').update({ status, approved_by: adminId }).eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  if (expense) {
    const etat = status === 'approved' ? 'acceptée' : 'refusée';
    await supabase.from('notifications').insert([{
      user_id: expense.user_id,
      title: `Dépense ${etat}`,
      message: `Votre demande de ${expense.amount}€ a été ${etat}.`,
      type: status === 'approved' ? 'success' : 'error'
    }]);

    await notifyAllAdmins(
      `Statut Dépense : ${etat}`,
      `La demande de ${expense.amount}€ a été traitée par ${adminEmail}.`
    );
  }

  res.json({ success: true });
});

/**
 * DELETE /:id - Suppression + Alerte Admins
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  const { role, id: userId, email: userEmail } = req.user!;
  const { id } = req.params;

  const { data: expense } = await supabase.from('expenses').select('amount').eq('id', id).single();

  if (expense) {
    const { error: deleteError } = await supabase.from('expenses').delete().eq('id', id);
    if (deleteError) return res.status(500).json({ error: deleteError.message });

    await notifyAllAdmins(
      "🗑️ Dépense supprimée",
      `Une dépense de ${expense.amount}€ a été supprimée par ${userEmail}.`
    );
    return res.json({ success: true });
  }

  res.status(404).json({ error: 'Dépense introuvable' });
});

export default router;