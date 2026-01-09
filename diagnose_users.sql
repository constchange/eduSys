-- ========================================================
-- 诊断当前 users 表状态
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 1. 查看所有用户及其实际 role 值
SELECT id, email, name, role, auth_id, created_at 
FROM public.users 
ORDER BY role, email;

-- 2. 查看 role 分布（实际数据库值）
SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- 3. 查看当前的 role 约束
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'users_role_check' 
  AND conrelid = 'public.users'::regclass;

-- 4. 查看所有约束
SELECT 
    con.conname as constraint_name, 
    pg_get_constraintdef(con.oid) as definition,
    con.contype as type
FROM pg_constraint con
WHERE con.conrelid = 'public.users'::regclass
ORDER BY con.conname;

-- 5. 查看所有 RLS 策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 6. 测试：手动尝试更新一个用户为 editor（替换实际 ID）
-- UPDATE public.users SET role = 'editor' WHERE email = 'zllljflying@126.com';
-- SELECT email, role FROM public.users WHERE email = 'zllljflying@126.com';
