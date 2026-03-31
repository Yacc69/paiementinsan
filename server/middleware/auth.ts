import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Accès refusé, token manquant' });

  try {
    // 1. On vérifie que le badge est un vrai badge Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) throw new Error('Token invalide');

    // 2. 🛡️ L'ARME SECRÈTE : On va chercher ton VRAI rôle en direct dans la base de données
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error("Erreur lecture profil dans le middleware:", profileError.message);
    }

    // 3. On écrase le rôle du badge par le rôle absolu de la base de données
    req.user = {
      id: user.id,
      email: user.email || '',
      role: profile?.role || 'requester', // La Base de Données a TOUJOURS le dernier mot
      first_name: profile?.first_name,
      last_name: profile?.last_name
    };

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Session expirée ou invalide' });
  }
};

// --- RÈGLES DE SÉCURITÉ SUPPLÉMENTAIRES ---

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'admin_level_1' && req.user?.role !== 'secretary') {
    return res.status(403).json({ error: 'Action réservée aux administrateurs' });
  }
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Ici, on accepte admin et admin_level_1 (Manager). 
  // Si tu veux que ce soit QUE 'admin' (Suprême), retire le "&& req.user?.role !== 'admin_level_1'"
  if (req.user?.role !== 'admin' && req.user?.role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Action réservée à la direction' });
  }
  next();
};