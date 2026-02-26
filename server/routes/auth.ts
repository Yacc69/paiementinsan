import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// --- LOGIN ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. On utilise la méthode native de Supabase pour vérifier l'email et le mot de passe
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  // 2. On récupère le rôle stocké dans notre table 'public.users'
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  // 3. Supabase gère déjà le JWT dans data.session.access_token
  res.json({ 
    token: data.session?.access_token, 
    user: { 
      id: data.user.id, 
      email: data.user.email, 
      role: profile?.role || 'requester' 
    } 
  });
});

// --- REGISTER (Création par un admin) ---
router.post('/register', authenticateToken, async (req: AuthRequest, res) => {
  // Vérification du rôle admin (ton middleware actuel devrait fonctionner)
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Seuls les admins peuvent créer des utilisateurs' });
  }

  const { email, password, role } = req.body;

  try {
    // 1. Création du compte dans Supabase Auth (gestion interne des mots de passe)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: role || 'requester' } // On peut stocker le rôle dans les metadata
      }
    });

    if (authError) throw authError;

    // 2. On insère dans notre table 'public.users' pour nos jointures SQL (salariés, dépenses)
    // Note: L'ID doit être le même que celui d'auth.users
    if (authData.user) {
        const { error: dbError } = await supabase
          .from('users')
          .insert([{ 
            id: authData.user.id, 
            email, 
            role: role || 'requester' 
            // password_hash n'est plus nécessaire ici, Supabase le gère en interne
          }]);
        
        if (dbError) throw dbError;
    }

    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
    
  }
});

router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// 2. LA LIGNE INDISPENSABLE :
export default router;