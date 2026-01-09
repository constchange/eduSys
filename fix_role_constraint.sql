-- 修复 users 表的 role 约束
-- 在 Supabase SQL Editor 中运行此脚本

-- 1. 首先查看当前的约束（可选，用于诊断）
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
  AND con.contype = 'c';

-- 2. 删除旧的 role 约束（如果存在）
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 3. 添加正确的 role 约束
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 4. 验证约束已正确创建
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
  AND con.contype = 'c'
  AND con.conname = 'users_role_check';
