// ใช้ทดสอบ: เปิดเป็น "เครื่องที่ 2" ที่เชื่อมต่อกับเซิร์ฟเวอร์ผ่าน SSE (อยู่ได้ตามเวลา timeout)
// ตัวอย่าง: node scripts/fake-client.js fake_phone "iPhone ของโต" 20
const http = require('http');

const clientId = process.argv[2] || 'fake_device';
const name = process.argv[3] || 'อุปกรณ์ทดสอบ';
const seconds = Number(process.argv[4]) || 15;

const url = `http://localhost:5173/api/events?clientId=${encodeURIComponent(clientId)}&name=${encodeURIComponent(name)}`;
console.log(`[fake-client] ${name} (${clientId}) เชื่อมต่อ SSE ${seconds} วินาที`);

const req = http.get(url, (res) => {
  console.log(`[fake-client] เชื่อมต่อแล้ว (HTTP ${res.statusCode})`);
  res.on('data', () => {});
  res.on('end', () => console.log('[fake-client] เซิร์ฟเวอร์ปิดการเชื่อมต่อ'));
});
req.on('error', (e) => console.error('[fake-client] error:', e.message));

setTimeout(() => {
  console.log('[fake-client] หมดเวลา — ปิดการเชื่อมต่อ');
  req.destroy();
  process.exit(0);
}, seconds * 1000);
