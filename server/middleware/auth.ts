import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabase.js';

export interface AuthRequest extends Request {
  // Changement : id devient string car Supabase utilise des UUID
  user?: { id: string; email: string; role: string };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token manquant' });

  // 1. On demande à Supabase de vérifier le token
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(403).json({ error: 'Session invalide ou expirée' });
  }

  // 2. On récupère le rôle stocké dans ton profil public (table 'users')
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  // 3. On attache les infos à la requête
  req.user = {
    id: user.id,
    email: user.email || '',
    role: profile?.role || 'requester'
  };

  next();
};

// Les fonctions de vérification de rôle restent quasiment identiques
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Accès Admin requis' });
  }
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès Super Admin requis' });
  }
  next();
};