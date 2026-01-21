# 🚨 紧急修复：页面一直转圈问题

## 问题原因
RLS（行级安全）策略中的子查询 `EXISTS (SELECT 1 FROM users ...)` 导致查询超时或失败。

## 立即修复步骤

### 方法 1：执行修复脚本（推荐）

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 打开并执行 `fix_owner_schedules_rls.sql` 文件
4. 刷新浏览器页面

### 方法 2：手动删除旧策略

在 Supabase SQL Editor 中执行：

```sql
-- 删除有问题的策略
DROP POLICY IF EXISTS "Owners can manage their own schedules" ON owner_schedules;

-- 创建新的简化策略
CREATE POLICY "Owners can view their own schedules" ON owner_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their own schedules" ON owner_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their own schedules" ON owner_schedules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their own schedules" ON owner_schedules
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 方法 3：临时禁用 RLS（仅用于测试）

⚠️ **警告：这会让所有用户都能访问日程数据，仅用于测试！**

```sql
-- 临时禁用 RLS
ALTER TABLE owner_schedules DISABLE ROW LEVEL SECURITY;
```

测试完成后记得重新启用：
```sql
ALTER TABLE owner_schedules ENABLE ROW LEVEL SECURITY;
```

## 验证修复

执行以下 SQL 查看策略是否正确：

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'owner_schedules';
```

应该看到 4 个策略：
- `Owners can view their own schedules` (SELECT)
- `Owners can insert their own schedules` (INSERT)
- `Owners can update their own schedules` (UPDATE)
- `Owners can delete their own schedules` (DELETE)

## 测试功能

1. 刷新浏览器（Ctrl + F5 / Cmd + Shift + R）
2. 清除浏览器缓存
3. 重新登录
4. 打开浏览器控制台（F12）查看日志

应该看到：
```
[Store] Loaded owner schedules: 0
```

如果还是一直转圈，查看控制台错误信息。

## 其他可能的问题

### 问题1: users 表不存在
如果看到 `relation "users" does not exist` 错误：

```sql
-- 检查 users 表
SELECT * FROM users LIMIT 1;
```

### 问题2: auth.uid() 返回 null
如果未登录或认证过期：
1. 登出
2. 重新登录
3. 刷新页面

### 问题3: 表权限问题
```sql
-- 检查表权限
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'owner_schedules';
```

## 彻底重建表（最后手段）

⚠️ **警告：会删除所有日程数据！**

```sql
-- 1. 删除表
DROP TABLE IF EXISTS owner_schedules CASCADE;

-- 2. 重新执行 create_owner_schedules.sql 的全部内容
-- （使用更新后的版本，没有 EXISTS 子查询）
```

## 需要帮助？

1. 打开浏览器控制台（F12）
2. 查看 Console 标签的错误信息
3. 查看 Network 标签，找到失败的请求
4. 在 Supabase Dashboard 的 Logs 中查看错误

提供这些信息可以更好地诊断问题。
