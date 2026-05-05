import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
});

// Helper functions for Raportet table
export const saveToRaportet = async (reportData) => {
  return supabase.from('Raportet').insert([reportData]);
};

export const updateRaportet = async (id, reportData) => {
  return supabase.from('Raportet').update(reportData).eq('id', id);
};

export const deleteRaportet = async (id) => {
  return supabase.from('Raportet').delete().eq('id', id);
};
