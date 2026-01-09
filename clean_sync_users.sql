-- ========================================================
-- 完全清理版本：先删除所有旧数据，再从 Auth 同步
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 1. 查看 Auth 中的真实用户（诊断）
SELECT id, email, created_at, 
       raw_user_meta_data->>'name' as metadata_name,
       raw_user_meta_data->>'role' as metadata_role
FROM auth.users
ORDER BY created_at;

-- 2. 删除 public.users 表中的所有数据（清空）
TRUNCATE TABLE public.users CASCADE;

-- 3. 从 Auth 重新同步所有用户（全部设为 visitor）
INSERT INTO public.users (auth_id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'visitor'  -- 所有用户初始化为 visitor
FROM auth.users au;

-- 4. 设置你的账号为 owner（⚠️ 请替换为你的实际邮箱）
UPDATE public.users 
SET role = 'owner' 
WHERE email IN (
    'lixiaod25@mail.sysu.edu.cn'
    -- 如果有多个管理员，可以添加更多邮箱
    -- ,'other@example.com'
);

-- 5. 验证结果
SELECT auth_id, email, name, role, created_at 
FROM public.users 
ORDER BY role DESC, email;

-- 6. 显示统计
SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;
