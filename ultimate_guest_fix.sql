-- ========================================================
-- 终极解决方案：彻底清理 guest 并固化 visitor
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 步骤 1: 禁用所有触发器
ALTER TABLE public.users DISABLE TRIGGER ALL;

-- 步骤 2: 删除当前约束
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 步骤 3: 添加临时约束（允许 guest）
ALTER TABLE public.users ADD CONSTRAINT users_role_check_temp
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor', 'guest'));

-- 步骤 4: 将所有 guest 转为 visitor（如果有的话）
UPDATE public.users 
SET role = 'visitor' 
WHERE role = 'guest' OR role NOT IN ('owner', 'editor', 'viewer', 'visitor');

-- 步骤 5: 清理 auth.users 的 metadata 中的 role
UPDATE auth.users 
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data ? 'role' THEN raw_user_meta_data - 'role'
    ELSE raw_user_meta_data
  END;

-- 步骤 6: 删除临时约束
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check_temp;

-- 步骤 7: 添加正确的约束（不包含 guest）
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 步骤 8: 重新启用触发器
ALTER TABLE public.users ENABLE TRIGGER ALL;

-- 步骤 9: 验证所有用户
SELECT email, name, role 
FROM public.users 
ORDER BY role DESC, email;

-- 步骤 10: 验证约束
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_role_check' 
  AND conrelid = 'public.users'::regclass;

-- 步骤 11: 验证 auth.users 中没有 role metadata
SELECT email, 
       raw_user_meta_data ? 'role' as has_role_metadata,
       raw_user_meta_data->>'role' as role_value
FROM auth.users
ORDER BY email;

-- 步骤 12: 测试更新（应该成功）
UPDATE public.users 
SET role = 'editor' 
WHERE email = 'zllljflying@126.com';

SELECT email, role FROM public.users WHERE email = 'zllljflying@126.com';
