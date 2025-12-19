import { createClient } from '@supabase/supabase-js';

// Access import.meta as any to avoid "Property 'env' does not exist on type 'ImportMeta'" errors
const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL;
const supabaseKey = meta.env?.VITE_SUPABASE_KEY;

// Debugging: Log status (Not the actual key) to console
console.log('Supabase Config Status:', { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseKey,
  urlLength: supabaseUrl ? supabaseUrl.length : 0 
});

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

if (!isSupabaseConfigured) {
  console.warn("Supabase Warning: Missing Environment Variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_KEY.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);
