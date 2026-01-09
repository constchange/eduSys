-- ========================================
-- 诊断和修复用户角色问题的终极脚本
-- ========================================

-- 第1步：查看 auth.users 的元数据
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as metadata_role,
    raw_user_meta_data
FROM auth.users
ORDER BY email;

-- 第2步：查看 public.users 的当前状态
SELECT id, email, name, role, auth_id
FROM public.users
ORDER BY email;

-- 第3步：查看所有触发器
SELECT 
    tgname as trigger_name,
    tgtype,
    tgenabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.users'::regclass;

-- ========================================
-- 修复步骤开始
-- ========================================

-- 第4步：禁用所有触发器
ALTER TABLE public.users DISABLE TRIGGER ALL;

-- 第5步：删除约束
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 第6步：直接强制更新（不经过任何触发器或约束）
-- 将所有非 owner 的角色设置为 visitor
UPDATE public.users 
SET role = 'visitor'
WHERE role != 'owner' OR role IS NULL;

-- 第7步：重新添加正确的约束
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 第8步：清理 auth.users 的元数据（移除 role 字段）
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';

-- 第9步：重新启用触发器
ALTER TABLE public.users ENABLE TRIGGER ALL;

-- ========================================
-- 验证修复结果
-- ========================================

-- 第10步：再次查看 public.users
SELECT id, email, name, role, auth_id
FROM public.users
ORDER BY email;

-- 第11步：验证约束
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
AND conname LIKE '%role%';

-- 第12步：测试更新（将一个visitor改为editor）
-- 取消下面的注释来测试（记得改成实际的用户ID）
-- UPDATE public.users SET role = 'editor' WHERE email = 'zllljflying@126.com';
