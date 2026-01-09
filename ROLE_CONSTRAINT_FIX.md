# 用户权限修改错误修复指南

## 错误信息
```
修改用户权限失败: new row for relation "users" violates check constraint "users_role_check"
```

## 原因分析
这个错误表明 Supabase 数据库中的 `users_role_check` 约束与代码不匹配。可能是：
1. 数据库约束定义了错误的角色值
2. 或者约束没有包含所有需要的角色（owner, editor, viewer, visitor）

## 解决方案

### 方法一：在 Supabase SQL Editor 中执行修复脚本

1. 登录你的 Supabase Dashboard
2. 进入 **SQL Editor**
3. 点击 **New Query**
4. 复制并粘贴以下 SQL 代码：

```sql
-- 修复 users 表的 role 约束

-- 步骤 1: 查看当前约束（可选，用于诊断）
SELECT con.conname, pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
  AND con.contype = 'c';

-- 步骤 2: 删除旧的 role 约束
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 步骤 3: 添加正确的 role 约束
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));

-- 步骤 4: 验证修复成功
SELECT con.conname, pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND nsp.nspname = 'public'
  AND con.contype = 'c'
  AND con.conname = 'users_role_check';
```

5. 点击 **Run** 执行
6. 检查结果，确保最后一个查询返回正确的约束定义

### 方法二：检查现有用户数据

如果上述方法仍然失败，可能是因为数据库中已有的用户记录包含了无效的 role 值。

在 Supabase SQL Editor 中运行：

```sql
-- 查看所有用户及其 role 值
SELECT id, email, name, role 
FROM public.users 
ORDER BY role;

-- 查找包含无效 role 值的用户
SELECT id, email, name, role 
FROM public.users 
WHERE role NOT IN ('owner', 'editor', 'viewer', 'visitor');
```

如果发现无效的 role 值（例如 'admin', 'guest' 等），需要先更新这些记录：

```sql
-- 将无效的 role 值更新为 'visitor'
UPDATE public.users 
SET role = 'visitor' 
WHERE role NOT IN ('owner', 'editor', 'viewer', 'visitor');
```

然后再执行方法一中的约束修复脚本。

### 方法三：完全重建约束

如果仍有问题，完全重建约束：

```sql
-- 1. 临时禁用约束检查（谨慎使用）
ALTER TABLE public.users ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. 修复所有无效数据
UPDATE public.users SET role = 'visitor' 
WHERE role IS NULL OR role NOT IN ('owner', 'editor', 'viewer', 'visitor');

-- 3. 重新添加约束
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'visitor';
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'editor', 'viewer', 'visitor'));
```

## 验证修复

修复后，在应用中测试：

1. 刷新浏览器页面
2. 以 owner 身份登录
3. 进入 User Management 页面
4. 尝试修改一个用户的权限（例如将 owner 改为 editor）
5. 确认修改成功且没有错误

## 预防措施

为避免将来出现类似问题：

1. 始终使用 `supabase_schema.sql` 文件作为唯一的真实来源
2. 在修改 schema 时，确保在 Supabase 中完整运行整个脚本
3. 在本地开发时，使用 Supabase CLI 进行数据库迁移管理

## 调试信息

如果问题持续存在，请检查浏览器控制台（F12）中的日志：
- 查找 `[updateUserRole]` 前缀的日志
- 确认传递的 role 值和类型
- 检查是否有其他 JavaScript 错误

## 需要帮助？

如果以上方法都无法解决问题，请提供：
1. Supabase SQL Editor 中第一个查询（查看当前约束）的输出
2. 浏览器控制台中的完整错误日志
3. 你尝试修改的用户当前的 role 值和目标 role 值
