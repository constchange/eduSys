// Supabase Edge Function (Deno) - /platform-sync
// Enhanced ClassIn adapter with retry, idempotency support (via returning existing remote id if present),
// and robust error handling. If CLASSIN_BASE_URL/KEY/SECRET are not provided, function returns empty results (no-op).

const DEFAULT_RETRY = 2;

async function fetchWithRetry(url: string, opts: RequestInit, retries = DEFAULT_RETRY) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, opts);
      const text = await r.text();
      let parsed: any = text;
      try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
      return { ok: r.ok, status: r.status, data: parsed };
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(res => setTimeout(res, 200 * Math.pow(2, i))); // backoff
    }
  }
}

export default async function (req: Request) {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const payload = await req.json().catch(() => null);
    if (!payload) return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const { action, objectType, data } = payload;
    if (!action || !objectType || !data) return new Response(JSON.stringify({ error: 'missing action/objectType/data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const results: any[] = [];
    const now = new Date().toISOString();

    const CLASSIN_BASE = ((globalThis as any).Deno && (globalThis as any).Deno.env && (globalThis as any).Deno.env.get('CLASSIN_BASE_URL')) || '';
    const CLASSIN_API_KEY = ((globalThis as any).Deno && (globalThis as any).Deno.env && (globalThis as any).Deno.env.get('CLASSIN_API_KEY')) || '';
    const CLASSIN_API_SECRET = ((globalThis as any).Deno && (globalThis as any).Deno.env && (globalThis as any).Deno.env.get('CLASSIN_API_SECRET')) || '';
    const CLASSIN_RETRY = Number(((globalThis as any).Deno && (globalThis as any).Deno.env && (globalThis as any).Deno.env.get('CLASSIN_RETRY_COUNT')) || DEFAULT_RETRY);

    // If not configured for ClassIn, return empty results so frontend treats as no-op.
    if (!CLASSIN_BASE || !CLASSIN_API_KEY || !CLASSIN_API_SECRET) {
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Basic auth/header building (adapt to actual ClassIn auth scheme if different)
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-KEY': CLASSIN_API_KEY,
      'X-API-SECRET': CLASSIN_API_SECRET
    };

    // Helper to call ClassIn API with retry
    const callClassIn = async (method: string, path: string, body?: any) => {
      const url = CLASSIN_BASE.replace(/\/$/, '') + path;
      return await fetchWithRetry(url, { method, headers: authHeaders, body: body ? JSON.stringify(body) : undefined }, CLASSIN_RETRY);
    };

    // Map course/session to ClassIn
    try {
      if (objectType === 'course') {
        if (action === 'create') {
          const body = {
            title: data.name,
            start_date: data.startDate,
            end_date: data.endDate,
            description: data.notes || ''
          };
          const resp = await callClassIn('POST', '/courses', body);
          if (resp && resp.ok) {
            // Accept several response shapes
            const remoteId = (resp.data && (resp.data.id || resp.data.course?.id)) || `classin-${data.id}`;
            results.push({ platform: 'classin', courseId: remoteId, status: 'ok', message: 'created', lastSyncedAt: now });
          } else {
            results.push({ platform: 'classin', status: 'error', message: JSON.stringify(resp?.data || resp), lastSyncedAt: now });
          }
        } else if (action === 'update') {
          const remoteId = data.platformMeta?.classin?.courseId || data.id;
          const body = { title: data.name, start_date: data.startDate, end_date: data.endDate, description: data.notes || '' };
          const resp = await callClassIn('PUT', `/courses/${remoteId}`, body);
          if (resp && resp.ok) results.push({ platform: 'classin', courseId: remoteId, status: 'ok', message: 'updated', lastSyncedAt: now });
          else results.push({ platform: 'classin', status: 'error', message: JSON.stringify(resp?.data || resp), lastSyncedAt: now });
        }
      } else if (objectType === 'session') {
        if (action === 'create') {
          const body = {
            title: data.topic,
            date: data.date,
            start_time: data.startTime,
            end_time: data.endTime,
            course_id: data.courseId
          };
          const resp = await callClassIn('POST', '/sessions', body);
          if (resp && resp.ok) {
            const remoteId = (resp.data && (resp.data.id || resp.data.session?.id)) || `classin-session-${data.id}`;
            results.push({ platform: 'classin', sessionId: remoteId, status: 'ok', message: 'created', lastSyncedAt: now });
          } else {
            results.push({ platform: 'classin', status: 'error', message: JSON.stringify(resp?.data || resp), lastSyncedAt: now });
          }
        } else if (action === 'update') {
          const remoteId = data.platformMeta?.classin?.sessionId || data.id;
          const body = { title: data.topic, date: data.date, start_time: data.startTime, end_time: data.endTime };
          const resp = await callClassIn('PUT', `/sessions/${remoteId}`, body);
          if (resp && resp.ok) results.push({ platform: 'classin', sessionId: remoteId, status: 'ok', message: 'updated', lastSyncedAt: now });
          else results.push({ platform: 'classin', status: 'error', message: JSON.stringify(resp?.data || resp), lastSyncedAt: now });
        }
      }
    } catch (e) {
      results.push({ platform: 'classin', status: 'error', message: String(e), lastSyncedAt: now });
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
