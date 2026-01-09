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

注意：注册/邀请用户时需要填写 **手机号（唯一）**，用于与第三方平台（如腾讯会议）账号对接。请在 Supabase `users` 表中为每位用户填写并维护手机号。
2. 在服务端部署一个同步接口（建议使用 Supabase Edge Function 或自建后台）：
   - 路径：`POST /api/platform-sync`
   - 入参示例：{ action: 'create'|'update', objectType: 'course'|'session', data: {...} }
   - 返回：{ results: [{ platform: 'tencent'|'classin', courseId?, sessionId?, status?, message? }] }
3. 在服务端配置平台 API Key/Secret（请使用 Supabase Secrets 或环境变量管理，不要把密钥放在前端）。
4. 若没有后端实现，前端会忽略同步请求（不会阻塞正常保存）。

数据库变更（请在 Supabase Console 或迁移脚本中执行）：

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS platform_meta jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS platform_meta jsonb;

注意：当前版本仅提供客户端与本地开关的实现以及同步接口调用点，生产环境请实现后端平台适配并做好授权与重试策略。