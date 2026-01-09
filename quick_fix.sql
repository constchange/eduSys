-- ======================================
-- 快速修复脚本（仅包含关键步骤）
-- 在 Supabase SQL Editor 中执行
-- ======================================

-- 1. 删除所有可能的旧约束
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_role;

-- 2. 清理无效数据
UPDATE public.users 
SET role = 'visitor' 
WHERE role NOT IN ('owner', 'editor', 'viewer', 'visitor');

-- 3. 添加新约束
ALTER TABLE public.users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 4. 验证（应该返回一行结果）
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_role_check' 
  AND conrelid = 'public.users'::regclass;
