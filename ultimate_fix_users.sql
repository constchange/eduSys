-- ========================================================
-- 终极修复方案：处理 auth metadata 中的 guest 值
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 步骤 1: 查看所有触发器（可能有触发器在自动设置 role）
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.users'::regclass
  AND tgisinternal = false;

-- 步骤 2: 临时禁用所有 users 表的触发器
ALTER TABLE public.users DISABLE TRIGGER ALL;

-- 步骤 3: 临时修改约束以允许 guest
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor', 'guest'));

-- 步骤 4: 清空 public.users 表
TRUNCATE TABLE public.users CASCADE;

-- 步骤 5: 从 Auth 同步（保留原始 role，包括 guest）
INSERT INTO public.users (auth_id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    COALESCE(
        CASE 
            WHEN au.raw_user_meta_data->>'role' IN ('owner', 'editor', 'viewer', 'visitor') 
            THEN au.raw_user_meta_data->>'role'
            ELSE 'visitor'  -- guest 和其他无效值转为 visitor
        END,
        'visitor'
    )
FROM auth.users au;

-- 步骤 6: 将所有 guest 转为 visitor
UPDATE public.users SET role = 'visitor' WHERE role = 'guest';

-- 步骤 7: 恢复正确的约束（不包含 guest）
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 步骤 8: 设置你为 owner
UPDATE public.users 
SET role = 'owner' 
WHERE email = 'lixiaod25@mail.sysu.edu.cn';

-- 步骤 9: 重新启用触发器
ALTER TABLE public.users ENABLE TRIGGER ALL;

-- 步骤 10: 验证结果
SELECT auth_id, email, name, role, created_at 
FROM public.users 
ORDER BY role DESC, email;

-- 步骤 11: 显示统计
SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;
