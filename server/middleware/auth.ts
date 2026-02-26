import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabase.js';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

/**
 * Middleware de base : Vérifie si l'utilisateur est connecté
 * Utilise la méthode native Supabase pour valider le JWT
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    // 1. On demande à Supabase de vérifier le token directement
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ error: 'Session invalide ou expirée' });
    }

    // 2. On récupère le rôle stocké dans la table publique 'users'
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    // 3. On attache les infos à la requête pour les middlewares suivants
    req.user = {
      id: user.id,
      email: user.email || '',
      role: profile?.role || 'requester'
    };

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur interne lors de l\'authentification' });
  }
};

/**
 * requireAdmin : Autorise Admin ET Manager (admin_level_1)
 * Utile pour : Voir le Dashboard complet, gérer les Familles/Sous-familles
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  
  if (req.user.role !== 'admin' && req.user.role !== 'admin_level_1') {
    return res.status(403).json({ error: 'Accès Admin ou Manager requis' });
  }
  next();
};

/**
 * requireSuperAdmin : Autorise UNIQUEMENT l'Admin Suprême
 * Utile pour : Créer/Supprimer des utilisateurs, accès critique
 */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès Super Admin requis' });
  }
  next();
};