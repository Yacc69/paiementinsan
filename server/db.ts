import { supabase } from './supabase';

/**
 * Note : On n'utilise plus "better-sqlite3". 
 * Les tables ont déjà été créées via le SQL Editor de Supabase.
 * Ce fichier sert maintenant à centraliser nos appels si besoin.
 */

// Fonction utilitaire pour vérifier si l'admin existe au démarrage
// (Optionnel : tu peux aussi créer l'admin directement dans l'interface Supabase)
export const seedAdminIfNeeded = async () => {
  const adminEmail = 'admin@example.com';

  // On vérifie si l'utilisateur existe dans la table publique
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', adminEmail)
    .single();

  if (!user) {
    console.log("L'admin n'existe pas. Créez-le via l'onglet Authentication de Supabase.");
    // Note : Pour créer un utilisateur avec mot de passe, 
    // il vaut mieux passer par supabase.auth.signUp()
  }
};

export default supabase;