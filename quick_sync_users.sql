-- ========================================================
-- 方案 A: 手动设置第一个 owner（推荐用于已有数据的情况）
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 1. 首先查看 Auth 中的所有用户
SELECT id, email, created_at, 
       raw_user_meta_data->>'name' as metadata_name
FROM auth.users
ORDER BY created_at;

-- 2. 查看当前 users 表（旧数据）
SELECT id, auth_id, email, name, role 
FROM public.users
ORDER BY created_at;

-- 3. 删除 users 表中不在 auth.users 中的旧数据
DELETE FROM public.users
WHERE auth_id NOT IN (SELECT id FROM auth.users)
   OR auth_id IS NULL;

-- 4. 为所有 Auth 用户创建或更新 users 记录
INSERT INTO public.users (auth_id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'visitor'
FROM auth.users au
ON CONFLICT (email) DO UPDATE 
SET auth_id = EXCLUDED.auth_id,
    name = EXCLUDED.name;

-- 5. 手动设置你的账号为 owner（⚠️ 请替换为你的实际邮箱）
UPDATE public.users 
SET role = 'owner' 
WHERE email = 'lixiaod25@mail.sysu.edu.cn';  -- 👈 替换为你的邮箱

-- 或者使用 auth_id 设置（如果你知道）
-- UPDATE public.users SET role = 'owner' WHERE auth_id = 'your-auth-id-here';

-- 6. 验证结果
SELECT auth_id, email, name, role, created_at 
FROM public.users 
ORDER BY role DESC, created_at;

-- 7. 确认约束正确
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_role_check' 
  AND conrelid = 'public.users'::regclass;
