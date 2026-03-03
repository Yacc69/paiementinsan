import express from 'express';
import { supabase, supabaseAdmin } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /login
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return res.status(401).json({ error: 'Identifiants invalides' });

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, first_name, last_name')
      .eq('id', data.user.id)
      .single();

    if (profileError) console.error("Erreur profil:", profileError);

    res.json({ 
      token: data.session?.access_token, 
      user: { 
        id: data.user.id, 
        email: data.user.email, 
        role: profile?.role || 'requester',
        first_name: profile?.first_name,
        last_name: profile?.last_name
      } 
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

/**
 * POST /register - Création avec Nom et Prénom
 */
router.post('/register', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Accès réservé' });

  const { email, password, role, first_name, last_name } = req.body;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || 'requester', first_name, last_name }
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([{ 
          id: authData.user.id, 
          email, 
          role: role || 'requester',
          first_name,
          last_name 
        }]);
      
      if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw dbError;
      }
    }
    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /users - Liste complète
 */
router.get('/users', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'admin_level_1') return res.status(403).json({ error: 'Accès interdit' });
  const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

/**
 * PATCH /users/:id - Modifier rôle
 */
router.patch('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  const { role } = req.body;
  const { error } = await supabase.from('users').update({ role }).eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Rôle mis à jour' });
});

/**
 * DELETE /users/:id - Supprimer proprement
 */
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  try {
    await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    await supabase.from('users').delete().eq('id', req.params.id);
    res.json({ message: 'Supprimé avec succès' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', authenticateToken, (req: AuthRequest, res) => res.json({ user: req.user }));
router.post('/logout', async (req, res) => {
  await supabase.auth.signOut();
  res.json({ message: 'Déconnexion' });
});

router.patch('/update-profile', authenticateToken, async (req: AuthRequest, res) => {
  const { first_name, last_name } = req.body;
  const { data, error } = await supabase.from('users').update({ first_name, last_name }).eq('id', req.user!.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
* PATCH /users/:id/profile - Admin modifie le profil d'un utilisateur
 */
router.patch('/users/:id/profile', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Interdit' });
  
  const { first_name, last_name } = req.body;
  const { id } = req.params;

  const { data, error } = await supabase
    .from('users')
    .update({ first_name, last_name })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;