import express from 'express';
import { supabase, supabaseAdmin } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /login
 * Authentifie l'utilisateur et récupère son profil public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError) console.error("Erreur profil:", profileError);

    res.json({ 
      token: data.session?.access_token, 
      user: { 
        id: data.user.id, 
        email: data.user.email, 
        role: profile?.role || 'requester' 
      } 
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

/**
 * POST /register
 * Création d'un utilisateur par un Admin (Utilise l'API Admin de Supabase)
 * Bypass la confirmation par email pour une création immédiate.
 */
router.post('/register', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }

  const { email, password, role } = req.body;

  try {
    // 1. Création forcée via supabaseAdmin (évite l'envoi de mail de confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirme le compte immédiatement
      user_metadata: { role: role || 'requester' }
    });

    if (authError) throw authError;

    // 2. Insertion dans la table public.users
    if (authData.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([{ 
          id: authData.user.id, 
          email, 
          role: role || 'requester' 
        }]);
      
      if (dbError) {
        // Nettoyage si la base publique échoue
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw dbError;
      }
    }

    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (error: any) {
    console.error("Erreur creation:", error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /users
 * Liste complète des utilisateurs pour l'Admin
 */
router.get('/users', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Accès interdit' });
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

/**
 * PATCH /users/:id
 * Met à jour le rôle d'un utilisateur
 */
router.patch('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Action non autorisée' });
  }

  const { role } = req.body;
  const { id } = req.params;

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Rôle mis à jour' });
});

/**
 * DELETE /users/:id
 * Supprime un utilisateur proprement (Auth + Table Publique)
 */
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Action non autorisée' });
  }

  const { id } = req.params;

  try {
    // 1. Suppression du compte Auth (via Admin API)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    // 2. Suppression dans la table publique (si pas de cascade configurée)
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /me
 */
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

/**
 * POST /logout
 */
router.post('/logout', async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Déconnexion réussie' });
});

export default router;