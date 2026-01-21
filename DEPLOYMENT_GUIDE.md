# 负责人日程功能 - 部署指南与问题排查

## 🚨 重要提示

**必须先在 Supabase 中创建 `owner_schedules` 表，否则功能无法正常工作！**

## 前置条件
- 已有运行中的 EduSys 系统
- 有 Supabase 数据库的访问权限（需要 owner 或 admin 权限）
- 至少有一个 owner 角色的用户账号

## 部署步骤

### 1. 数据库部署（必须步骤）

#### 方法 1：使用 Supabase Dashboard（推荐）

1. 访问 [Supabase Dashboard](https://supabase.com)
2. 选择你的项目
3. 点击左侧的 **SQL Editor**
4. 点击 **New query**
5. 打开项目文件 `create_owner_schedules.sql`
6. **复制文件中的全部内容**
7. 粘贴到 SQL Editor
8. 点击 **Run** 按钮执行

#### 方法 2：使用 Supabase CLI

```bash
supabase db push create_owner_schedules.sql
```

#### 验证数据库表创建成功

在 SQL Editor 中运行以下查询：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'owner_schedules';

-- 检查表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'owner_schedules'
ORDER BY ordinal_position;

-- 检查 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'owner_schedules';

-- 检查索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'owner_schedules';
```

**预期结果：**
- 表存在查询应返回 `owner_schedules`
- 表结构应显示所有字段（id, user_id, start_datetime, end_datetime, type, title, location, notes, created_at, updated_at）
- RLS 策略应显示 "Owners can manage their own schedules"
- 应有 4 个索引

### 2. 前端代码部署

所有代码已经更新，包括：
- ✅ types.ts - 添加类型定义
- ✅ store.tsx - 添加 CRUD 操作
- ✅ App.tsx - 添加路由
- ✅ components/OwnerScheduleManager.tsx - 新组件
- ✅ components/ScheduleStats.tsx - 集成日程显示

**构建和部署：**
```bash
# 安装依赖（如果有新的）
npm install

# 构建生产版本
npm run build

# 部署到您的托管服务
# 例如 Vercel:
vercel --prod

# 或 Netlify:
netlify deploy --prod
```

### 3. 测试验证

#### 3.1 权限测试
1. 使用 owner 账号登录
   - ✅ 侧边栏应显示"Owner Schedule"菜单
   - ✅ 点击进入应能看到日程管理界面

2. 使用 editor 账号登录
   - ✅ 侧边栏不应显示"Owner Schedule"菜单
   - ✅ 直接访问路由应被拒绝

3. 使用 viewer 账号登录
   - ✅ 侧边栏不应显示"Owner Schedule"菜单
   - ✅ Schedule & Stats 中不应显示"同时显示负责人日程"选项

#### 3.2 功能测试

**日程管理测试：**
1. 创建单日日程
   - 填写所有必填字段
   - 保存后应在列表中看到

2. 创建跨日日程
   - 设置跨越多天的时间范围
   - 应提示确认拆分
   - 确认后应创建多条记录

3. 编辑日程
   - 点击编辑按钮
   - 修改信息后保存
   - 应立即更新

4. 删除日程
   - 点击删除按钮
   - 确认删除
   - 应从列表中移除

**日历集成测试：**
1. 进入 Schedule & Stats 页面
2. 勾选"同时显示负责人日程"
3. 在日历中应能看到：
   - 课节：彩色卡片
   - 负责人日程：紫色卡片
4. 取消勾选应只显示课节

#### 3.3 数据持久化测试
1. 创建几条日程
2. 刷新页面
3. 日程应仍然存在
4. 在另一个浏览器/设备登录
5. 应能看到相同的日程

## 🐛 Bug 修复说明

### Bug 1: 日程登出后消失（已修复）

**问题描述：**
- 用户创建的日程在登出后重新登入时消失

**原因分析：**
1. `owner_schedules` 表可能未在 Supabase 中创建
2. 数据保存时可能出现错误但未被捕获
3. RLS 策略可能阻止了数据访问

**修复方案：**
1. 增强了错误日志和调试信息
2. 添加了数据加载验证
3. 在保存失败时弹出提示

**验证修复：**
```javascript
// 打开浏览器控制台（F12），查找以下日志：
// [Store] Loaded owner schedules: [...]
// [addOwnerSchedule] Successfully saved: [...]
```

如果看到错误信息，说明表未创建或 RLS 策略有问题。

### Bug 2: 新类型不保存（已修复）

**问题描述：**
- 新添加的日程类型在下次创建日程时不显示

**原因：**
- 类型列表仅存在于组件 state 中，未持久化

**修复方案：**
- 现在类型列表从现有日程数据中动态提取
- 任何保存过的类型都会自动出现在下拉列表中
- 无需额外的类型表

**工作原理：**
```typescript
const scheduleTypes = React.useMemo(() => {
  const defaultTypes = ['会议', '出差', '培训', '其他'];
  const existingTypes = Array.from(new Set(ownerSchedules.map(s => s.type).filter(Boolean)));
  return Array.from(new Set([...defaultTypes, ...existingTypes])).sort();
}, [ownerSchedules]);
```

## 调试指南

### 启用详细日志

打开浏览器开发者工具（F12），在控制台中查看：

**数据加载日志：**
```
[Store] Owner schedules loaded: X
[Store] Loaded owner schedules: [...]
```

**数据保存日志：**
```
[addOwnerSchedule] Adding schedule: {...}
[addOwnerSchedule] Sanitized payload: {...}
[addOwnerSchedule] Successfully saved: [...]
```

**组件渲染日志：**
```
[OwnerScheduleManager] Current user: {...}
[OwnerScheduleManager] Owner schedules: [...]
```

### 检查数据库

在 Supabase Dashboard 的 SQL Editor 中：

```sql
-- 查看当前用户的所有日程
SELECT * FROM owner_schedules WHERE user_id = auth.uid();

-- 查看所有日程（需要 service_role 权限）
SELECT 
  os.*,
  u.email,
  u.name,
  u.role
FROM owner_schedules os
LEFT JOIN users u ON os.user_id = u.id;

-- 检查是否有孤立的日程（user_id 不存在）
SELECT os.*
FROM owner_schedules os
LEFT JOIN auth.users u ON os.user_id = u.id
WHERE u.id IS NULL;
```

### 常见错误代码

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| 42P01 | 表不存在 | 执行 create_owner_schedules.sql |
| 42501 | 权限不足 | 检查 RLS 策略和用户角色 |
| 23503 | 外键约束违反 | 确保 user_id 在 auth.users 中存在 |
| 23505 | 唯一约束违反 | ID 冲突，通常不应发生 |

## 常见问题排查

### 问题 1: 看不到 Owner Schedule 菜单
**原因：**
- 当前用户不是 owner 角色
- 前端代码未正确部署

**解决：**
```sql
-- 在 Supabase SQL Editor 中检查用户角色
SELECT * FROM users WHERE email = 'your-email@example.com';

-- 如需修改角色为 owner
UPDATE users SET role = 'owner' WHERE email = 'your-email@example.com';
```

### 问题 2: 无法创建日程（权限错误）
**原因：**
- RLS 策略未正确设置
- user_id 不匹配

**解决：**
```sql
-- 检查 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'owner_schedules';

-- 重新执行 create_owner_schedules.sql
```

### 问题 3: 日历中不显示日程
**原因：**
- 未勾选"同时显示负责人日程"
- 日期范围不匹配
- 数据格式问题

**解决：**
1. 确认勾选了显示选项
2. 检查日程的日期是否在选定月份范围内
3. 在浏览器控制台检查是否有错误

### 问题 4: 跨日拆分不工作
**原因：**
- 时间格式不正确
- 时区问题

**解决：**
- 确保使用 datetime-local 格式
- 检查浏览器时区设置
- 查看控制台错误日志

## 性能优化建议

1. **数据库索引**
   - 已创建的索引应足够，如有性能问题可添加：
   ```sql
   CREATE INDEX idx_owner_schedules_datetime_range 
   ON owner_schedules USING btree (start_datetime, end_datetime);
   ```

2. **前端优化**
   - 日程数据较大时考虑分页
   - 日历显示时只加载可见月份的数据

3. **缓存策略**
   - 考虑在 store 中添加缓存机制
   - 减少不必要的数据库查询

## 回滚步骤

如需回滚此功能：

1. **数据库回滚**
```sql
-- 删除表（注意：会丢失所有日程数据）
DROP TABLE IF EXISTS owner_schedules CASCADE;
```

2. **代码回滚**
```bash
# 使用 Git 回滚到功能添加前的提交
git revert <commit-hash>

# 重新构建和部署
npm run build
```

## 后续扩展建议

1. **导出功能**
   - 添加导出日程为 iCal/CSV 格式
   - 与日历应用同步

2. **提醒功能**
   - 添加邮件/推送提醒
   - 设置提前提醒时间

3. **共享功能**
   - 允许负责人共享特定日程给其他用户
   - 创建公开日程视图

4. **重复日程**
   - 支持设置重复规则（每日/每周/每月）
   - 批量创建重复日程

5. **颜色标记**
   - 允许为不同类型设置不同颜色
   - 提高视觉识别度

## 联系支持

如遇到问题或需要帮助：
1. 检查浏览器控制台错误日志
2. 查看 Supabase 日志
3. 参考 OWNER_SCHEDULE_FEATURE.md 文档
