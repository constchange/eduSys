/* Simple test helper to call the Edge Function /platform-sync
   Usage: node scripts/test-platform-sync.js
   Configure PLATFORM_SYNC_URL env var if needed, otherwise defaults to http://localhost:54321/platform-sync
*/

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

(async () => {
  const url = process.env.PLATFORM_SYNC_URL || 'http://localhost:54321/platform-sync';
  const payload = {
    action: 'create',
    objectType: 'course',
    data: { id: 'local-test-1', name: 'Test Course', startDate: '2025-01-01', endDate: '2025-06-01', notes: 'Test via script' }
  };

  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('status', res.status);
    const body = await res.text();
    console.log('response:', body);
  } catch (e) {
    console.error('call failed:', e.message || e);
    process.exit(1);
  }
})();