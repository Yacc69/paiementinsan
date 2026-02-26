import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Nouvelle clé admin

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
}

// Client standard pour les requêtes utilisateurs
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// Client Admin pour la création forcée d'utilisateurs (sans email de confirmation)
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '', // Utilisez la Service Role Key ici
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);