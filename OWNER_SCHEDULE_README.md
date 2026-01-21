# ⚠️ 重要：负责人日程功能使用前必读

## 🚨 在使用负责人日程功能之前，必须先创建数据库表！

### 快速开始（3 步完成）

#### 步骤 1：登录 Supabase
1. 访问 https://supabase.com
2. 登录并选择你的项目

#### 步骤 2：执行 SQL 脚本
1. 点击左侧的 **SQL Editor**
2. 点击 **New query**
3. 打开文件 `create_owner_schedules.sql`
4. 复制全部内容并粘贴到编辑器
5. 点击 **Run** 按钮

#### 步骤 3：验证创建成功
在 SQL Editor 中运行：
```sql
SELECT * FROM owner_schedules LIMIT 1;
```
如果没有错误提示，说明创建成功！

---

## 功能说明

### 谁可以使用？
- ✅ **仅负责人（owner）** 可以访问和管理日程
- ❌ 编辑者（editor）、查看者（viewer）无法看到此功能

### 在哪里使用？
1. **日程管理页面**：侧边栏 → Owner Schedule
   - 创建、编辑、删除日程
   - 列表视图和表格视图

2. **日历集成**：Schedule & Stats → 勾选"同时显示负责人日程"
   - 在课表中查看日程
   - 日程显示为紫色卡片

### 主要功能
- ✅ 新增、编辑、删除日程
- ✅ 跨日日程自动拆分
- ✅ 动态类型管理（类型会自动保存）
- ✅ 与课表同屏显示
- ✅ 数据持久化（登出后不丢失）

---

## 遇到问题？

### 问题：看不到 Owner Schedule 菜单
**解决**：确认你的账号角色是 owner
```sql
-- 在 Supabase SQL Editor 中查看角色
SELECT * FROM users WHERE email = '你的邮箱';

-- 修改角色为 owner
UPDATE users SET role = 'owner' WHERE email = '你的邮箱';
```

### 问题：日程保存后消失
**解决**：检查是否已创建 owner_schedules 表
1. 打开浏览器控制台（F12）
2. 查看是否有错误信息
3. 如果看到 "relation owner_schedules does not exist"，说明表未创建
4. 执行 `create_owner_schedules.sql` 脚本

### 问题：无法创建日程
**解决**：查看控制台错误信息
```javascript
// 打开浏览器控制台（F12），查找：
[addOwnerSchedule] ...
// 错误信息会告诉你具体原因
```

---

## 详细文档

- 📋 [功能说明](OWNER_SCHEDULE_FEATURE.md)
- 🚀 [部署指南](DEPLOYMENT_GUIDE.md)
- 🗄️ [SQL 脚本](create_owner_schedules.sql)

---

## 快速调试

```javascript
// 在浏览器控制台（F12）中查看日志：

// 1. 检查是否加载了日程数据
// 应该看到：[Store] Owner schedules loaded: X

// 2. 尝试创建日程后
// 应该看到：[addOwnerSchedule] Successfully saved: [...]

// 3. 如果看到错误
// 检查错误信息并参考 DEPLOYMENT_GUIDE.md
```

---

**记住：必须先在 Supabase 中执行 `create_owner_schedules.sql` 才能使用此功能！**
