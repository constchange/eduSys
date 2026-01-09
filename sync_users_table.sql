-- ========================================================
-- 完全清理并重建 users 表（与 Supabase Auth 同步）
-- ⚠️ 警告：这会删除所有旧的 users 表数据
-- 在 Supabase SQL Editor 中执行
-- ========================================================

-- 步骤 1: 查看当前约束（诊断）
DO $$ 
BEGIN
    RAISE NOTICE '=== 查看当前约束 ===';
END $$;

SELECT 
    con.conname as constraint_name, 
    pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
  AND con.contype = 'c';

-- 步骤 2: 查看当前 users 表中的数据
DO $$ 
BEGIN
    RAISE NOTICE '=== 当前 users 表数据（将被清理）===';
END $$;

SELECT id, email, name, role, auth_id 
FROM public.users 
ORDER BY created_at DESC;

-- 步骤 3: 查看 Supabase Auth 中的实际用户
DO $$ 
BEGIN
    RAISE NOTICE '=== Supabase Auth 中的实际用户 ===';
END $$;

SELECT id, email, created_at, raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- 步骤 4: 备份旧数据（可选，以防万一）
DROP TABLE IF EXISTS public.users_backup;
CREATE TABLE public.users_backup AS 
SELECT * FROM public.users;

DO $$ 
BEGIN
    RAISE NOTICE '=== 旧数据已备份到 users_backup 表 ===';
END $$;

-- 步骤 5: 删除旧的 users 表并重建
DROP TABLE IF EXISTS public.users CASCADE;

DO $$ 
BEGIN
    RAISE NOTICE '=== 旧 users 表已删除，开始重建 ===';
END $$;

-- 步骤 6: 创建新的 users 表
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    phone text,
    role text NOT NULL DEFAULT 'visitor' CHECK (role IN ('owner', 'editor', 'viewer', 'visitor')),
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 启用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    RAISE NOTICE '=== 新 users 表已创建 ===';
END $$;

-- 步骤 7: 从 Supabase Auth 同步当前活跃用户
INSERT INTO public.users (auth_id, email, name, role)
SELECT 
    au.id as auth_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)) as name,
    'visitor' as role  -- 默认设为 visitor，owner 需要手动设置
FROM auth.users au
ON CONFLICT (auth_id) DO NOTHING;

DO $$ 
BEGIN
    RAISE NOTICE '=== 已从 Auth 同步用户，默认角色为 visitor ===';
END $$;

-- 步骤 8: 显示同步后的用户
SELECT id, auth_id, email, name, role, created_at 
FROM public.users 
ORDER BY created_at DESC;

DO $$ 
BEGIN
    RAISE NOTICE '=== 同步完成！请手动将需要的用户设为 owner ===';
    RAISE NOTICE '=== 使用以下语句设置 owner（替换 email）：';
    RAISE NOTICE '=== UPDATE public.users SET role = ''owner'' WHERE email = ''your@email.com''; ===';
END $$;

-- 步骤 9: 重建 RLS 策略
-- Owner 完全访问
DROP POLICY IF EXISTS users_owner_full_access ON public.users;
CREATE POLICY users_owner_full_access ON public.users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.auth_id = auth.uid() 
            AND u.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.auth_id = auth.uid() 
            AND u.role = 'owner'
        )
    );

-- 用户可以查看自己
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
    FOR SELECT
    USING (auth_id = auth.uid());

-- 用户可以更新自己（但不能改 role）
DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
    FOR UPDATE
    USING (auth_id = auth.uid())
    WITH CHECK (
        auth_id = auth.uid() 
        AND role = (SELECT role FROM public.users WHERE auth_id = auth.uid())
    );

DO $$ 
BEGIN
    RAISE NOTICE '=== RLS 策略已重建 ===';
    RAISE NOTICE '=== ⚠️ 重要：现在所有用户都是 visitor，请设置至少一个 owner！ ===';
END $$;
