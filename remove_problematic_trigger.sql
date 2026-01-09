-- 查看完整的函数定义（使用不同的方法）
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
WHERE p.proname IN ('normalize_user_role', 'sync_user_roles_cache');

-- 如果上面看不到完整代码，尝试从 prosrc 查看
SELECT 
    proname,
    prosrc as source_code
FROM pg_proc
WHERE proname = 'normalize_user_role';

-- ========================================
-- 解决方案：删除有问题的触发器
-- ========================================

-- 步骤1：删除触发器（保留函数，以防其他地方用到）
DROP TRIGGER IF EXISTS normalize_user_role_before ON public.users;

-- 步骤2：验证触发器已被删除
SELECT 
    tgname as trigger_name,
    tgenabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.users'::regclass;

-- 步骤3：测试更新
UPDATE public.users 
SET role = 'editor' 
WHERE email = 'zllljflying@126.com';

-- 步骤4：验证更新成功
SELECT id, email, name, role 
FROM public.users 
WHERE email = 'zllljflying@126.com';

-- 步骤5：再测试改回 visitor
UPDATE public.users 
SET role = 'visitor' 
WHERE email = 'zllljflying@126.com';

-- 步骤6：最终验证
SELECT id, email, name, role 
FROM public.users 
ORDER BY email;
