import { createClient } from '@supabase/supabase-js';

// Access import.meta as any to avoid "Property 'env' does not exist on type 'ImportMeta'" errors
// when vite/client types are not found.
const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL;
const supabaseKey = meta.env?.VITE_SUPABASE_KEY;

// 在生产环境中，如果没有配置环境变量，控制台会报错，防止使用错误的数据库
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase Error: Missing Environment Variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_KEY in your deployment settings.");
}

// 使用空字符串作为回退防止应用直接崩溃，但在未配置Key的情况下网络请求会失败（符合预期）
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);