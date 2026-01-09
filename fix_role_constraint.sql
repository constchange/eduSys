-- ============================================
-- 强制修复 users 表的 role 约束
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 步骤 1: 查看所有当前约束（诊断用）
DO $$ 
BEGIN
    RAISE NOTICE '=== 当前 users 表的所有约束 ===';
END $$;

SELECT 
    con.conname as constraint_name, 
    pg_get_constraintdef(con.oid) as definition,
    con.contype as type
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
ORDER BY con.conname;

-- 步骤 2: 查看当前所有用户的 role 值（检查是否有无效值）
DO $$ 
BEGIN
    RAISE NOTICE '=== 当前用户的 role 值分布 ===';
END $$;

SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- 步骤 3: 强制删除所有可能的 role 相关约束
DO $$ 
BEGIN
    RAISE NOTICE '=== 删除旧约束 ===';
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_role;

-- 步骤 4: 清理任何无效的 role 值
DO $$ 
BEGIN
    RAISE NOTICE '=== 清理无效 role 值 ===';
END $$;

UPDATE public.users 
SET role = 'visitor' 
WHERE role IS NULL 
   OR role NOT IN ('owner', 'editor', 'viewer', 'visitor');

-- 步骤 5: 添加新的正确约束
DO $$ 
BEGIN
    RAISE NOTICE '=== 添加新约束 ===';
END $$;

ALTER TABLE public.users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 步骤 6: 验证修复成功
DO $$ 
BEGIN
    RAISE NOTICE '=== 验证新约束 ===';
END $$;

SELECT 
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
  AND con.contype = 'c'
  AND con.conname = 'users_role_check';

-- 步骤 7: 测试约束（应该成功）
DO $$ 
BEGIN
    RAISE NOTICE '=== 测试约束 - 尝试插入有效值 ===';
    
    -- 这个测试会失败因为 email 冲突，但不会因为 role 约束失败
    BEGIN
        INSERT INTO public.users (email, name, role) 
        VALUES ('test_constraint_check@example.com', 'Test User Constraint', 'editor');
        
        RAISE NOTICE '测试插入成功，删除测试数据...';
        DELETE FROM public.users WHERE email = 'test_constraint_check@example.com';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '测试插入失败（如果是 email 冲突则正常）: %', SQLERRM;
    END;
END $$;

DO $$ 
BEGIN
    RAISE NOTICE '=== 修复完成！请刷新应用并重试 ===';
END $$;
