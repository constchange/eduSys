import { createClient } from '@supabase/supabase-js';

// CRITICAL FIX: Access environment variables DIRECTLY.
// Vite uses static analysis to replace 'import.meta.env.VITE_xxx' with the actual string value during build.
// Using intermediate variables (like const env = import.meta.env) breaks this replacement mechanism in production.

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

// Debugging: Log status to verify injection (showing partial key for safety)
console.log('Supabase Config Status:', { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseKey,
  urlSnippet: supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : 'undefined'
});

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

if (!isSupabaseConfigured) {
  console.warn("Supabase Warning: Missing Environment Variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_KEY are set in GitHub Secrets and injected via the workflow.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder',
  {
    auth: {
      // 保持自动刷新token的功能，但不触发onAuthStateChange
      autoRefreshToken: true,
      // 保持会话持久化
      persistSession: true,
      // 禁用自动检测存储变化（避免多标签页同步导致的重新渲染）
      detectSessionInUrl: true
    }
  }
);