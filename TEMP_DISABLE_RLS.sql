-- 🚨 紧急修复：页面一直转圈的问题
-- 请在 Supabase SQL Editor 中执行此脚本

-- 临时方案：暂时禁用 owner_schedules 的 RLS
ALTER TABLE owner_schedules DISABLE ROW LEVEL SECURITY;

-- 验证 RLS 已禁用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'owner_schedules';
-- rowsecurity 应该显示 false

-- 测试查询是否正常
SELECT COUNT(*) FROM owner_schedules;

-- ⚠️ 注意：这是临时方案，测试完成后需要重新启用 RLS
-- 重新启用 RLS 的命令（稍后使用）：
-- ALTER TABLE owner_schedules ENABLE ROW LEVEL SECURITY;
