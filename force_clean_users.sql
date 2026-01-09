-- ========================================================
-- 暴力清理方案：跳过所有约束直接修复数据
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 步骤 1: 查看当前表中的实际数据
SELECT id, email, name, role, created_at
FROM public.users
ORDER BY created_at;

-- 步骤 2: 禁用所有触发器
ALTER TABLE public.users DISABLE TRIGGER ALL;

-- 步骤 3: 删除所有约束（包括check约束）
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check_temp;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_role;

-- 步骤 4: 暴力更新所有非标准 role 为 visitor（没有约束限制）
UPDATE public.users 
SET role = 'visitor' 
WHERE role NOT IN ('owner', 'editor', 'viewer', 'visitor');

-- 步骤 5: 验证没有非法 role 了
SELECT role, COUNT(*) 
FROM public.users 
GROUP BY role;

-- 步骤 6: 现在安全地添加正确的约束
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 步骤 7: 清理 auth.users 的 metadata
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';

-- 步骤 8: 重新启用触发器
ALTER TABLE public.users ENABLE TRIGGER ALL;

-- 步骤 9: 最终验证
SELECT email, name, role 
FROM public.users 
ORDER BY role DESC, email;

-- 步骤 10: 测试更新
UPDATE public.users 
SET role = 'editor' 
WHERE email = 'zllljflying@126.com';

-- 步骤 11: 确认更新成功
SELECT email, name, role 
FROM public.users 
WHERE email = 'zllljflying@126.com';
