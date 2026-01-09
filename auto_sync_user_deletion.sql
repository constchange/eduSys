-- ========================================
-- 创建触发器：自动同步删除用户
-- ========================================
-- 当 auth.users 的用户被删除时，自动删除 public.users 对应记录

-- 创建触发器函数
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    -- 删除 public.users 中对应的记录
    DELETE FROM public.users WHERE auth_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_user_deleted();

-- 验证触发器已创建
SELECT 
    tgname as trigger_name,
    tgenabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
AND tgname = 'on_auth_user_deleted';
