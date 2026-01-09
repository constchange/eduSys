-- 查看触发器函数的定义
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'normalize_user_role';

-- 也查看另一个函数
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'sync_user_roles_cache';

-- 测试更新：将 zllljflying@126.com 改为 editor
UPDATE public.users 
SET role = 'editor' 
WHERE email = 'zllljflying@126.com';

-- 验证更新结果
SELECT id, email, name, role 
FROM public.users 
WHERE email = 'zllljflying@126.com';

-- 再测试改为 viewer
UPDATE public.users 
SET role = 'viewer' 
WHERE email = 'zllljflying@126.com';

-- 再次验证
SELECT id, email, name, role 
FROM public.users 
WHERE email = 'zllljflying@126.com';
