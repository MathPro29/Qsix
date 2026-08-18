// ดึงข้อมูลเพลง + ลิงก์สตรีมจาก URL หลาย platform ผ่าน yt-dlp
const { execFile } = require('child_process');
const path = require('path');
const https = require('https');

const PY = process.platform === 'win32'
  ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
  : path.join(__dirname, '..', 'venv', 'bin', 'python');

// กลุ่ม platform ที่รู้จัก -> ไอคอน/ป้าย
const PLATFORMS = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  mixcloud: 'Mixcloud',
};

function platformName(extractorKey) {
  const key = (extractorKey || '').toLowerCase();
  for (const [k, label] of Object.entries(PLATFORMS)) {
    if (key.startsWith(k)) return label;
  }
  return extractorKey || 'อื่นๆ';
}

const MIME = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  webm: 'audio/webm',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
};

function mimeFor(ext) {
  return MIME[(ext || '').toLowerCase()] || 'audio/mpeg';
}

// client=android ให้ลิงก์สตรีม YouTube ที่ถูกบล็อกน้อยกว่า (ได้ URL ที่โหลดได้จริง)
const YT_ARGS = ['--extractor-args', 'youtube:player_client=android'];

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(
      PY,
      ['-m', 'yt_dlp', '--no-playlist', '--skip-download', '--no-warnings', ...YT_ARGS, ...args],
      { maxBuffer: 128 * 1024 * 1024, windowsHide: true, timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || '').trim().split('\n').filter(Boolean).pop() || 'ไม่สามารถดึงข้อมูลได้';
          reject(new Error(msg.replace(/^ERROR:\s*/, '')));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

function toTrack(info, originalUrl) {
  const ext = info.ext || (info.acodec === 'none' ? info.container : 'm4a');
  return {
    id: null, // กำหนดโดย queue
    url: originalUrl || info.webpage_url || info.original_url,
    platform: platformName(info.extractor_key),
    extractor: info.extractor_key || '',
    title: info.title || info.fulltitle || 'ไม่ทราบชื่อเพลง',
    artist: info.artist || info.uploader || info.creator || '',
    duration: Number(info.duration) || 0,
    thumbnail: info.thumbnail || '',
    mime: mimeFor(ext),
    streamUrl: info.url || null,
    error: null,
  };
}

// แก้ URL ให้เป็นลิงก์โดยตรงที่เล่นได้
async function resolveUrl(url) {
  // Spotify โดนตัดออกจาก yt-dlp (DRM) -> ใช้ oEmbed หาชื่อเพลง แล้วค้นหาใน YouTube แทน
  if (/spotify\.com/i.test(url)) {
    return resolveSpotify(url);
  }
  const stdout = await runYtDlp([
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best',
    '--dump-single-json',
    url,
  ]);
  let info;
  try {
    info = JSON.parse(stdout);
  } catch (e) {
    throw new Error('รูปแบบข้อมูลไม่ถูกต้องจาก yt-dlp');
  }
  return toTrack(info, url);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 QueueSong/1.0' } }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('ข้อมูลจาก Spotify ไม่ถูกต้อง'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
  });
}

async function searchOne(query) {
  const stdout = await runYtDlp([
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best',
    '--dump-single-json',
    `ytsearch1:${query}`,
  ]);
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (e) {
    throw new Error('ค้นหาบน YouTube ไม่สำเร็จ');
  }
  const first = Array.isArray(data.entries) ? data.entries[0] : data;
  if (!first) throw new Error('ไม่พบเพลงนี้บน YouTube');
  return toTrack(first, first.webpage_url);
}

// Spotify: oEmbed -> "ศิลปิน - ชื่อเพลง" -> ค้นหา YouTube
async function resolveSpotify(url) {
  const info = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  const title = info.title || '';
  const artist = info.author_name || '';
  const query = [artist, title].filter(Boolean).join(' - ') || 'spotify';
  const track = await searchOne(query);
  track.platform = 'Spotify'; // แสดงป้าย Spotify แม้จะเล่นจาก YouTube
  track.url = url;
  track.originalUrl = url;
  return track;
}

// ค้นหาเพลงจาก YouTube (ใช้เมื่อไม่มีลิงก์)
async function searchTracks(query, limit = 5) {
  const stdout = await runYtDlp([
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best',
    '--dump-single-json',
    `ytsearch${limit}:${query}`,
  ]);
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (e) {
    throw new Error('รูปแบบข้อมูลไม่ถูกต้องจาก yt-dlp');
  }
  const entries = Array.isArray(data.entries) ? data.entries : [data];
  return entries.filter(Boolean).map((e) => toTrack(e, e.webpage_url));
}

module.exports = { resolveUrl, searchTracks, platformName, mimeFor };
