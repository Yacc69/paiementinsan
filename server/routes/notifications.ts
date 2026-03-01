import express from 'express';
import { supabase } from '../supabase.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Protection de la route : il faut être connecté
router.use(authenticateToken);

/**
 * GET /api/notifications
 * Récupère les 20 dernières notifications de l'utilisateur connecté
 */
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

/**
 * PATCH /api/notifications/:id/read
 * Marque une notification spécifique comme lue
 */
router.patch('/:id/read', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId); // Sécurité : vérifie que la notif appartient bien à l'utilisateur

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

/**
 * PATCH /api/notifications/read-all
 * Marque toutes les notifications de l'utilisateur comme lues
 */
router.patch('/read-all', async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

export default router;