-- ========================================
-- 清理孤立的用户记录（auth.users已删除但public.users仍存在）
-- ========================================

-- 步骤1：查看哪些 public.users 记录是孤立的（auth_id 对应的 auth.users 已被删除）
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.auth_id,
    'ORPHANED - auth.users deleted' as status
FROM public.users u
LEFT JOIN auth.users a ON u.auth_id = a.id
WHERE a.id IS NULL;

-- 步骤2：查看当前仍有效的用户（auth.users 存在）
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.auth_id,
    'ACTIVE' as status
FROM public.users u
INNER JOIN auth.users a ON u.auth_id = a.id;

-- 步骤3：删除孤立的记录
DELETE FROM public.users
WHERE auth_id NOT IN (
    SELECT id FROM auth.users
);

-- 步骤4：验证清理结果
SELECT id, email, name, role, auth_id
FROM public.users
ORDER BY email;

-- 步骤5：验证 auth.users 中的所有用户
SELECT id, email, raw_user_meta_data->>'name' as name
FROM auth.users
ORDER BY email;
