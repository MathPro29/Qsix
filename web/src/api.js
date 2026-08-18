export async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 502) {
      throw new Error('502 Bad Gateway — หากเปิดผ่าน Tunnel กรุณากดปุ่ม Click to Continue หรือย้ำเปิดลิงก์ในเบราว์เซอร์มือถือ 1 ครั้งแรก');
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
