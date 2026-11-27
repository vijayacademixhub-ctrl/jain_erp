import { createClient } from '@supabase/supabase-js';

// The publishable (anon) key is public by design; Row Level Security protects all data.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://prxfztbafgbnxnglqaje.supabase.co';
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_kHxKjsbAYyJjFLh0pawvrg_oEcQNDQM';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
