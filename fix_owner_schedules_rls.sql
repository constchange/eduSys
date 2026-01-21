-- 修复 owner_schedules 表的 RLS 策略
-- 如果遇到页面一直转圈的问题，请执行此脚本

-- 1. 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Owners can manage their own schedules" ON owner_schedules;

-- 2. 创建新的优化策略
-- 策略1: 允许用户查看自己的日程
CREATE POLICY "Owners can view their own schedules" ON owner_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

-- 策略2: 允许用户插入自己的日程
CREATE POLICY "Owners can insert their own schedules" ON owner_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略3: 允许用户更新自己的日程
CREATE POLICY "Owners can update their own schedules" ON owner_schedules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 策略4: 允许用户删除自己的日程
CREATE POLICY "Owners can delete their own schedules" ON owner_schedules
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3. 验证策略
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
WHERE tablename = 'owner_schedules';

-- 应该看到4个策略：
-- - Owners can view their own schedules (SELECT)
-- - Owners can insert their own schedules (INSERT)
-- - Owners can update their own schedules (UPDATE)
-- - Owners can delete their own schedules (DELETE)
