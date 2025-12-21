<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1K3Vy1t348aPglTdyB27RHu-no6o27B6R

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## 第三方平台自动同步（实验性）

本项目新增了一个可选功能：在创建/更新课程或课节时，自动同步到线上教学平台（例如：腾讯会议、ClassIn）。

如何启用：

1. 在 `Admin` 页面中开启“自动平台同步”（该设置保存在浏览器 `localStorage`，只是前端开关）。
2. 在服务端部署一个同步接口（推荐使用 Supabase Edge Function 或自建后台）。本仓库包含一个 *Edge Function* 示例实现： `supabase/functions/platform-sync`（默认实现优先集成 ClassIn，需根据实际 ClassIn API 适配）。

   - 路径（示例）：`POST /api/platform-sync`
   - 入参示例：
     {
       action: 'create' | 'update',
       objectType: 'course' | 'session',
       data: { ... }
     }
   - 返回示例：
     {
       results: [
         { platform: 'classin', courseId?: string, sessionId?: string, status: 'ok'|'error', message?: string, lastSyncedAt?: string }
       ]
     }

3. ClassIn Edge Function 部署与 Secrets（Supabase）示例：

   - 在本地安装并登录 supabase CLI: `npm i -g supabase`，`supabase login`
   - 创建函数：`supabase functions new platform-sync`
   - 将 `supabase/functions/platform-sync` 的代码复制到生成的函数目录并根据实际 ClassIn API 调整实现
   - 设置 Secrets（例）：
     `supabase secrets set CLASSIN_API_KEY=yourkey CLASSIN_API_SECRET=yoursecret CLASSIN_BASE_URL=https://api.classin.com`
   - 部署：`supabase functions deploy platform-sync`
   - 访问（示例）：`POST https://<project>.functions.supabase.co/platform-sync`

4. 在服务端配置平台 API Key/Secret（请使用 Supabase Secrets 或环境变量管理，不要把密钥放在前端）。
5. 若没有后端实现，前端会忽略同步请求（不会阻塞正常保存）。

测试与本地 Mock:

- 项目内包含一个简单的 ClassIn Mock Server：`scripts/mock-classin-server.cjs`，用于本地测试。
- 运行 Mock Server：`npm run mock-classin`（默认监听 http://localhost:4000）。
- 使用 Supabase CLI 在本地运行 Edge Function（示例）：
  - 在项目根创建 `.env` 并设置：
    ```
    CLASSIN_BASE_URL=http://localhost:4000
    CLASSIN_API_KEY=localkey
    CLASSIN_API_SECRET=localsecret
    ```
  - 启动本地函数：`supabase functions serve platform-sync --env-file .env`
  - 发送测试请求（可用 `npm run test-platform-sync`，或用 curl）：
    ```bash
    curl -X POST http://localhost:54321/platform-sync -H "Content-Type: application/json" -d '{"action":"create","objectType":"course","data":{"id":"abc","name":"Demo","startDate":"2025-01-01","endDate":"2025-06-01"}}'
    ```

数据库变更（请在 Supabase Console 或迁移脚本中执行）：

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text UNIQUE;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS platform_meta jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS platform_meta jsonb;

注意：`phone` 字段要求在 `users` 表中唯一，用于后续与 ClassIn 的用户映射。

注意：当前版本仅提供客户端与本地开关的实现以及同步接口调用点，生产环境请实现后端平台适配并做好授权与重试策略。