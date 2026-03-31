import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * FONCTION DE NOTIFICATION SYSTÉMATIQUE
 */
async function notifyAllAdmins(title: string, message: string) {
  try {
    const { data: admins, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .limit(100000);

    if (fetchError) {
      console.error("❌ Erreur lors de la récupération des admins:", fetchError.message);
      return;
    }

    const adminList = admins?.filter(u => u.role === 'admin' || u.role === 'admin_level_1') || [];
    
    if (adminList.length > 0) {
      const notifications = adminList.map(adm => ({
        user_id: adm.id,
        title: title,
        message: message,
        type: 'warning',
        is_read: false
      }));

      const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
      if (insertError) {
        console.error("❌ Erreur lors de l'insertion des notifications admins:", insertError.message);
      }
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
  
  let query = supabaseAdmin
    .from('expenses')
    .select(`
      *,
      category:categories(name),
      sub_category:sub_categories(name),
      user:users!expenses_user_id_fkey(email, first_name, last_name),
      approver:users!expenses_approved_by_fkey(email)
    `)
    .limit(100000);

  if (role !== 'admin' && role !== 'admin_level_1') {
    query = query.eq('user_id', id);
  }

  const { data: expenses, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const formattedExpenses = expenses?.map(e => {
    const firstName = e.user?.first_name || '';
    const lastName = e.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      ...e,
      category_name: e.category?.name,
      sub_category_name: e.sub_category?.name,
      user_email: e.user?.email,
      user_full_name: fullName || null,
      approved_by_email: e.approver?.email
    };
  }) || [];

  res.json(formattedExpenses);
});

/**
 * POST / - Création d'une dépense + Alerte Admins
 */
router.post('/', async (req: AuthRequest, res) => {
  const { category_id, sub_category_id, amount, description, date, attachment } = req.body;
  const user_id = req.user!.id;
  const user_email = req.user!.email;

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .insert([{ 
      user_id, category_id, 
      sub_category_id: sub_category_id || null, 
      amount, description, date, 
      attachment: attachment || null 
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await notifyAllAdmins(
    "🚨 Nouvelle dépense",
    `L'employé ${user_email} a soumis une demande de ${amount}€.`
  );

  res.status(201).json({ id: data.id, status: 'pending' });
});

/**
 * PATCH /:id/status - Validation/Rejet + Alerte Admins + Motif
 */
router.patch('/:id/status', async (req: AuthRequest, res) => {
  const { role, id: adminId, email: adminEmail } = req.user!;
  if (role !== 'admin' && role !== 'admin_level_1') return res.status(403).json({ error: 'Interdit' });
  
  const { status, rejection_comment } = req.body;
  const { id } = req.params;

  const { data: expense } = await supabaseAdmin.from('expenses').select('user_id, amount').eq('id', id).single();
  
  // On prépare les données à mettre à jour
  const updateData: any = { status, approved_by: adminId };
  if (status === 'rejected' && rejection_comment) {
    updateData.rejection_comment = rejection_comment; // On enregistre le motif
  } else if (status === 'approved') {
    updateData.rejection_comment = null; // On efface le motif si finalement on accepte
  }

  const { error } = await supabaseAdmin.from('expenses').update(updateData).eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  if (expense) {
    const etat = status === 'approved' ? 'acceptée' : 'refusée';
    let messageNotif = `Votre demande de ${expense.amount}€ a été ${etat}.`;
    
    // Si c'est refusé avec un motif, on l'ajoute à la notification de l'employé !
    if (status === 'rejected' && rejection_comment) {
      messageNotif += ` Motif : "${rejection_comment}"`;
    }

    await supabaseAdmin.from('notifications').insert([{
      user_id: expense.user_id,
      title: `Dépense ${etat}`,
      message: messageNotif,
      type: status === 'approved' ? 'success' : 'error',
      is_read: false
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
  const { role, email: userEmail } = req.user!;
  const { id } = req.params;

  const { data: expense } = await supabaseAdmin.from('expenses').select('amount').eq('id', id).single();

  if (expense) {
    const { error: deleteError } = await supabaseAdmin.from('expenses').delete().eq('id', id);
    if (deleteError) return res.status(500).json({ error: deleteError.message });

    await notifyAllAdmins(
      "🗑️ Dépense supprimée",
      `Une dépense de ${expense.amount}€ a été supprimée par ${userEmail}.`
    );
    return res.json({ success: true });
  }

  res.status(404).json({ error: 'Dépense introuvable' });
});

/**
 * PATCH /:id - Admin modifie une dépense (Montant, Famille, Sous-famille)
 */
router.patch('/:id', async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Action réservée aux admins' });
  }

  const { id } = req.params;
  const { amount, category_id, sub_category_id, description } = req.body;

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .update({ 
      amount: Number(amount), 
      category_id, 
      sub_category_id: sub_category_id || null,
      description 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
/**
 * PATCH /:id/lend-card - Indiquer que la carte est prêtée
 */
router.patch('/:id/lend-card', async (req: AuthRequest, res) => {
  const { role } = req.user!;
  if (role !== 'admin' && role !== 'admin_level_1') return res.status(403).json({ error: 'Interdit' });

  const { id } = req.params;
  const { card_lent_to } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('expenses')
      .update({ card_lent_to })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
/**
 * PATCH /:id/pay - Confirmer le paiement avec preuve + Notification Employé
 */
router.patch('/:id/pay', async (req: AuthRequest, res) => {
  const { role, email: adminEmail } = req.user!;
  if (role !== 'admin' && role !== 'admin_level_1') return res.status(403).json({ error: 'Interdit' });

  const { id } = req.params;
  const { payment_proof } = req.body;

  try {
    const { data: expense, error: fetchErr } = await supabaseAdmin
      .from('expenses')
      .select('user_id, amount, description')
      .eq('id', id)
      .single();

    if (fetchErr || !expense) return res.status(404).json({ error: "Dépense introuvable" });

    const { error: updErr } = await supabaseAdmin
      .from('expenses')
      .update({ status: 'paid', payment_proof })
      .eq('id', id);

    if (updErr) return res.status(400).json({ error: updErr.message });

    const { error: notifErr } = await supabaseAdmin.from('notifications').insert([{
      user_id: expense.user_id,
      title: 'Virement effectué 💸',
      message: `Le virement pour votre dépense de ${expense.amount}€ a été réalisé.`,
      type: 'success', 
      is_read: false
    }]);

    if (notifErr) {
      console.error("❌ ERREUR NOTIFICATION SUPABASE:", notifErr.message);
    }

    await notifyAllAdmins("✅ Paiement confirmé", `Paiement de ${expense.amount}€ validé par ${adminEmail}.`);

    res.json({ success: true });
  } catch (err: any) {
    console.error("❌ ERREUR SYSTÈME:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /:id/reimburse - Marquer comme remboursé (Paiement manuel)
 */
router.patch('/:id/reimburse', async (req: AuthRequest, res) => {
  const { role, email: adminEmail } = req.user!;
  if (role !== 'admin' && role !== 'admin_level_1') return res.status(403).json({ error: 'Interdit' });

  const { id } = req.params;
  const { reimbursement_comment, payment_method } = req.body;

  if (!reimbursement_comment || !payment_method) {
    return res.status(400).json({ error: 'Commentaire et moyen de paiement obligatoires' });
  }

  try {
    const { data: expense, error: fetchErr } = await supabaseAdmin
      .from('expenses')
      .select('user_id, amount')
      .eq('id', id)
      .single();

    if (fetchErr || !expense) return res.status(404).json({ error: "Dépense introuvable" });

    const { error: updErr } = await supabaseAdmin
      .from('expenses')
      .update({ 
        status: 'paid', 
        reimbursement_comment, 
        payment_method 
      })
      .eq('id', id);

    if (updErr) throw updErr;

    // Notification pour l'employé
    await supabaseAdmin.from('notifications').insert([{
      user_id: expense.user_id,
      title: 'Remboursement effectué 💰',
      message: `Votre dépense de ${expense.amount}€ a été remboursée par ${payment_method}. Note : ${reimbursement_comment}`,
      type: 'success',
      is_read: false
    }]);

    await notifyAllAdmins("💰 Remboursement validé", `Remboursement de ${expense.amount}€ effectué par ${adminEmail} (${payment_method}).`);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;