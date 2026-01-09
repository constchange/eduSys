-- ========================================================
-- 最终修复方案：移除 name 的 unique 约束
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 步骤 1: 禁用所有触发器
ALTER TABLE public.users DISABLE TRIGGER ALL;

-- 步骤 2: 移除 name 的 unique 约束（name 不应该是唯一的）
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_name_key;

-- 步骤 3: 临时修改 role 约束以允许 guest
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor', 'guest'));

-- 步骤 4: 清空表
TRUNCATE TABLE public.users CASCADE;

-- 步骤 5: 同步用户（确保 name 和 role 都正确）
INSERT INTO public.users (auth_id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(
        NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),  -- 去除空白和空字符串
        split_part(au.email, '@', 1)  -- 如果 name 为空，使用 email 前缀
    ),
    CASE 
        WHEN au.raw_user_meta_data->>'role' IN ('owner', 'editor', 'viewer', 'visitor') 
        THEN au.raw_user_meta_data->>'role'
        ELSE 'visitor'  -- guest 和其他无效值转为 visitor
    END
FROM auth.users au;

-- 步骤 6: 确保没有 guest 残留
UPDATE public.users SET role = 'visitor' WHERE role = 'guest';

-- 步骤 7: 恢复正确的 role 约束（不包含 guest）
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

-- 步骤 11: 显示名字重复情况（如果有的话）
SELECT name, COUNT(*) as count
FROM public.users
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 步骤 12: 显示角色统计
SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;
