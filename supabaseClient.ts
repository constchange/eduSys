import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
// Vite will replace import.meta.env.VITE_SUPABASE_URL with the actual string during build
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

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
