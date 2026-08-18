// Music Queue — เซิร์ฟเวอร์หลัก
// API: คิวเพลง, สตรีมเสียง (proxy แบบ Range), cast ไปทีวี/ลำโพง (DLNA), อีเวนต์สด (SSE)
const express = require('express');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const fs = require('fs');

const queue = require('./src/queue');
const resolver = require('./src/resolver');
const dlna = require('./src/dlna');
const CastManager = require('./src/cast');
const clients = require('./src/clients');

const PORT = Number(process.env.PORT) || 5173;
const app = express();
app.use(express.json({ limit: '1mb' }));

// หน้าเว็บ: ใช้ผล build ของ MUI (web/dist) ถ้ามี ไม่เช่นนั้นใช้ public/ เดิม
const webDist = path.join(__dirname, 'web', 'dist');
const frontendDir = fs.existsSync(webDist) ? webDist : path.join(__dirname, 'public');
app.use(express.static(frontendDir));

// --- helpers ---
function allLanIPs() {
  const ifs = os.networkInterfaces();
  const ips = [];
  for (const [name, list] of Object.entries(ifs)) {
    const isVirtual = /vEthernet|WSL|VirtualBox|VMware|vbox|docker/i.test(name);
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) {
        ips.push({ name, address: i.address, isVirtual });
      }
    }
  }
  return ips;
}

function lanIP() {
  const ips = allLanIPs();
  const physical = ips.find((x) => !x.isVirtual);
  if (physical) return physical.address;
  return ips[0]?.address || '127.0.0.1';
}

const cast = new CastManager((item) => `http://${lanIP()}:${PORT}/api/stream/${item.id}`);
let volume = 80;

// --- SSE (อีเวนต์สดให้ทุกหน้าจอ) ---
const sseClients = new Set();
function broadcast() {
  const payload = `data: ${JSON.stringify({ queue: queue.snapshot(), cast: cast.state(), volume, clients: clients.list(), masterId: clients.masterId })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}
queue.on('change', broadcast);
cast.onChange(broadcast);
clients.on('change', broadcast);
// clients.on('master-left') removed so room playback continues even if individual clients disconnect

app.get('/api/events', (req, res) => {
  const clientId = String(req.query.clientId || '').slice(0, 64);
  const clientName = String(req.query.name || '').slice(0, 60);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (clientId) clients.register(clientId, clientName);
  res.write(`data: ${JSON.stringify({ queue: queue.snapshot(), cast: cast.state(), volume, clients: clients.list(), masterId: clients.masterId })}\n\n`);
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
    if (clientId) clients.unregister(clientId);
  });
});

// --- คิวเพลง ---
app.get('/api/queue', (req, res) => res.json(queue.snapshot()));

app.post('/api/queue', (req, res) => {
  const { url, playNow } = req.body || {};
  const clean = String(url || '').trim();
  if (!/^https?:\/\//i.test(clean)) {
    return res.status(400).json({ error: 'กรุณาวางลิงก์เพลง (https://...)' });
  }
  const item = queue.add(clean, { playNow: !!playNow });
  res.json({ ok: true, item: { id: item.id } });
});

// ค้นหาเพลงจาก YouTube (รองรับตอนไม่มีลิงก์)
app.post('/api/search', async (req, res) => {
  const q = String((req.body || {}).q || '').trim();
  if (!q) return res.status(400).json({ error: 'ใส่คำค้นหาก่อน' });
  try {
    const tracks = await resolver.searchTracks(q, 5);
    res.json({ ok: true, tracks });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete('/api/queue', (req, res) => {
  queue.clear();
  res.json({ ok: true });
});

app.delete('/api/queue/:id', (req, res) => {
  queue.remove(req.params.id);
  res.json({ ok: true });
});

app.post('/api/queue/:id/move', (req, res) => {
  queue.move(req.params.id, Number((req.body || {}).dir) || 0);
  res.json({ ok: true });
});

app.post('/api/queue/:id/play-now', (req, res) => {
  queue.playNow(req.params.id);
  res.json({ ok: true, queue: queue.snapshot() });
});

// --- ควบคุมการเล่น ---
// action: play | pause | next | prev | stop | seek  (สำหรับเล่นในเบราว์เซอร์)
app.post('/api/control', (req, res) => {
  const { action, time } = req.body || {};
  if (action === 'next') {
    const { currentId } = req.body || {};
    const activeItem = queue.current();
    if (currentId && activeItem && activeItem.id !== currentId) {
      return res.json({ ok: true, item: publicItem(activeItem) });
    }
    const item = queue.next();
    if (!item) return res.json({ ok: true, ended: true, item: null });
    return res.json({ ok: true, item: publicItem(item) });
  }
  if (action === 'prev') {
    const item = queue.prev();
    return res.json({ ok: true, item: item ? publicItem(item) : null });
  }
  if (action === 'play') {
    // ยังไม่มีเครื่องเล่นหลัก -> เครื่องที่กดเล่นกลายเป็นแหล่งเสียง
    const { clientId } = req.body || {};
    if (clientId && !clients.masterId) clients.setMaster(String(clientId).slice(0, 64));
    const item = queue.current();
    queue.setPlaybackState(true, typeof time === 'number' ? time : queue.seekPosition);
    return res.json({ ok: true, item: item ? publicItem(item) : null });
  }
  if (action === 'pause') {
    queue.setPlaybackState(false, typeof time === 'number' ? time : queue.seekPosition);
    return res.json({ ok: true });
  }
  if (action === 'seek') {
    queue.setPlaybackState(queue.isPlaying, typeof time === 'number' ? time : queue.seekPosition);
    return res.json({ ok: true });
  }
  if (action === 'stop') {
    queue.markDone(queue.current()?.id);
    return res.json({ ok: true, item: null });
  }
  res.status(400).json({ error: 'action ไม่ถูกต้อง' });
});

function publicItem(item) {
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    duration: item.duration,
    thumbnail: item.thumbnail,
    mime: item.mime,
    streamUrl: `/api/stream/${item.id}`,
    status: item.status,
  };
}

// --- สตรีมเสียง (proxy รองรับ Range สำหรับ seek) ---
app.get('/api/stream/:id', async (req, res) => {
  const item = queue.items.find((x) => x.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'ไม่พบเพลงนี้ในคิว' });
  }

  // หากเพลงกำลังถอดรหัส URL ให้รอสูงสุด 15 วินาที ก่อนตอบกลับ แทนที่จะคืน 404 ทันที
  if (item.status === 'resolving' || !item.streamUrl) {
    let waited = 0;
    while ((item.status === 'resolving' || !item.streamUrl) && item.status !== 'error' && waited < 15000) {
      await new Promise((r) => setTimeout(r, 300));
      waited += 300;
    }
  }

  if (!item.streamUrl || item.status === 'error') {
    return res.status(404).json({ error: item.error || 'ยังไม่มีสตรีม (เพลงยังโหลดไม่เสร็จหรือเกิดข้อผิดพลาด)' });
  }

  try {
    await proxyStream(item.streamUrl, req, res);
  } catch (e) {
    // เริ่มส่งข้อมูลไปแล้ว -> ปล่อยจบ (เบราว์เซอร์จะข้ามเพลงเอง)
    if (res.headersSent) {
      res.destroy();
      return;
    }
    // ยังไม่เริ่มส่ง -> ลิงก์อาจหมดอายุ/ถูกบล็อก -> ลองดึงลิงก์ใหม่ครั้งเดียว
    try {
      const fresh = await resolver.resolveUrl(item.url);
      if (fresh.streamUrl) {
        item.streamUrl = fresh.streamUrl;
        await proxyStream(fresh.streamUrl, req, res);
        return;
      }
    } catch {}
    if (!res.headersSent) res.status(502).json({ error: 'ไม่สามารถเล่นสตรีมได้' });
  }
});

function proxyStream(upstreamUrl, req, res, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects'));
  }
  return new Promise((resolve, reject) => {
    let mod;
    try {
      mod = upstreamUrl.startsWith('https') ? https : http;
    } catch (err) {
      return reject(err);
    }
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };
    if (req.headers.range) headers.Range = req.headers.range;
    else headers.Range = 'bytes=0-';
    const upstream = mod.get(upstreamUrl, { headers }, (upRes) => {
      // จัดการ HTTP Redirect (301, 302, 303, 307, 308)
      if (upRes.statusCode >= 300 && upRes.statusCode < 400 && upRes.headers.location) {
        upRes.resume();
        try {
          const nextUrl = new URL(upRes.headers.location, upstreamUrl).href;
          return proxyStream(nextUrl, req, res, redirectCount + 1).then(resolve).catch(reject);
        } catch (err) {
          return reject(err);
        }
      }
      if (upRes.statusCode >= 400) {
        upRes.resume();
        return reject(new Error(`upstream ${upRes.statusCode}`));
      }
      const outHeaders = {
        'content-type': upRes.headers['content-type'] || 'audio/mpeg',
        'accept-ranges': 'bytes',
        'access-control-allow-origin': '*',
      };
      if (upRes.headers['content-length']) outHeaders['content-length'] = upRes.headers['content-length'];
      if (upRes.headers['content-range']) outHeaders['content-range'] = upRes.headers['content-range'];
      if (!res.headersSent) res.writeHead(upRes.statusCode, outHeaders);
      upRes.pipe(res);
      upRes.on('end', () => { if (!res.destroyed) res.end(); resolve(); });
      upRes.on('error', (e) => {
        if (!res.destroyed) res.destroy();
        reject(e);
      });
    });
    upstream.on('error', (e) => { reject(e); });
  });
}

// --- อุปกรณ์และ cast ---
let devicesCache = [];
let devicesUpdatedAt = 0;

app.get('/api/devices', async (req, res) => {
  const force = !!req.query.refresh;
  if (!force && devicesCache.length && Date.now() - devicesUpdatedAt < 15000) {
    return res.json({ ok: true, devices: devicesCache, cast: cast.state() });
  }
  try {
    devicesCache = await dlna.discoverDevices();
    devicesUpdatedAt = Date.now();
  } catch (e) {
    devicesCache = [];
  }
  res.json({ ok: true, devices: devicesCache, cast: cast.state() });
});

app.post('/api/cast', async (req, res) => {
  const { deviceId, action } = req.body || {};
  try {
    if (action === 'stop') {
      await cast.stop();
      return res.json({ ok: true });
    }
    if (action === 'volume') {
      volume = Math.max(0, Math.min(100, Number(req.body.volume) || 0));
      await cast.setVolume(volume);
      broadcast();
      return res.json({ ok: true });
    }
    if (action === 'start' || action === 'refresh') {
      if (!devicesCache.length) devicesCache = await dlna.discoverDevices();
      const device = devicesCache.find((d) => d.id === deviceId);
      if (!device) {
        devicesCache = await dlna.discoverDevices();
        const d2 = devicesCache.find((x) => x.id === deviceId);
        if (!d2) return res.status(404).json({ error: 'ไม่พบอุปกรณ์ — กดค้นหาอุปกรณ์ก่อน' });
        const r = await cast.start(d2, queue);
        return res.json(r);
      }
      const r = await cast.start(device, queue);
      return res.json(r);
    }
    res.status(400).json({ error: 'action ไม่ถูกต้อง' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// --- แหล่งเสียง (เครื่องที่ออกเสียง) ---
app.get('/api/clients', (req, res) => {
  res.json({ ok: true, clients: clients.list(), masterId: clients.masterId });
});

app.post('/api/clients/name', (req, res) => {
  const clientId = String((req.body || {}).clientId || '').slice(0, 64);
  const name = String((req.body || {}).name || '').slice(0, 60);
  const c = clients.setName(clientId, name);
  res.json({ ok: !!c });
});

app.post('/api/clients/master', (req, res) => {
  const clientId = String((req.body || {}).clientId || '').slice(0, 64);
  const ok = clients.setMaster(clientId);
  res.json({ ok, masterId: clients.masterId });
});

app.get('/api/state', (req, res) => {
  res.json({ queue: queue.snapshot(), cast: cast.state(), volume, lan: lanIP(), clients: clients.list(), masterId: clients.masterId });
});

// ป้องกันเซิร์ฟเวอร์ตายจาก error ที่ไม่คาดคิด (เช่น ต้นทางตัดสายกลาง)
process.on('uncaughtException', (e) => console.error('[crash-guard]', e.message));
process.on('unhandledRejection', (e) => console.error('[crash-guard]', (e && e.message) || e));

// --- สตาร์ทเซิร์ฟเวอร์ ---
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  Music Queue เปิดแล้ว!');
  console.log(`     บนเครื่องนี้ : http://localhost:${PORT}`);
  const ips = allLanIPs();
  ips.forEach(({ name, address, isVirtual }) => {
    console.log(`     บนเครือข่าย (${name}): http://${address}:${PORT} ${isVirtual ? '(Virtual/WSL)' : '(สำหรับ มือถือ/แท็บเล็ต)'}`);
  });
  console.log('   เพิ่มลิงก์เพลงเข้าคิว -> เล่นต่อเนื่องจนจบ -> cast ไปทีวี/ลำโพง DLNA');
  console.log('');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`พอร์ต ${PORT} ถูกใช้งานแล้ว — ใช้ PORT=xxxx npm start เพื่อเปลี่ยนพอร์ต`);
    process.exit(1);
  }
  throw e;
});
