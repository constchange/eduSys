import { Course, Session } from '../types';

export type Platform = 'tencent' | 'classin';

export interface PlatformResult {
  platform: Platform;
  courseId?: string;
  sessionId?: string;
  status?: 'ok' | 'error';
  message?: string;
}

const API_PATH = '/api/platform-sync'; // 后端实现位置（Supabase Edge Function 或自建服务）

const isEnabled = () => {
  try {
    return localStorage.getItem('autoPlatformSync') === '1';
  } catch (e) {
    return false;
  }
}

async function callBackend(payload: any) {
  if (!isEnabled()) return { results: [] };

  try {
    const res = await fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Platform sync failed: ${res.status} ${txt}`);
    }
    const body = await res.json();
    return body;
  } catch (err) {
    console.error('Platform sync backend error:', err);
    // 返回空结果以不阻塞主流程
    return { results: [] };
  }
}

export async function syncCourse(action: 'create' | 'update', course: Course): Promise<PlatformResult[]> {
  // payload should be minimal; backend will map fields to platform APIs
  const payload = { action, objectType: 'course', data: course };
  const body = await callBackend(payload);
  return body.results || [];
}

export async function syncSession(action: 'create' | 'update', session: Session): Promise<PlatformResult[]> {
  const payload = { action, objectType: 'session', data: session };
  const body = await callBackend(payload);
  return body.results || [];
}

// For local dev without a backend, provide a mock helper. This will be used only if API_PATH is not available.
export async function mockSyncCourse(action: 'create' | 'update', course: Course): Promise<PlatformResult[]> {
  return [
    { platform: 'tencent', courseId: `tencent-course-${course.id}`, status: 'ok' },
    { platform: 'classin', courseId: `classin-course-${course.id}`, status: 'ok' }
  ];
}

export async function mockSyncSession(action: 'create' | 'update', session: Session): Promise<PlatformResult[]> {
  return [
    { platform: 'tencent', sessionId: `tencent-session-${session.id}`, status: 'ok' },
    { platform: 'classin', sessionId: `classin-session-${session.id}`, status: 'ok' }
  ];
}
