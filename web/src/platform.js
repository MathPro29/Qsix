export const PLATFORM_COLORS = {
  YouTube: { color: '#ff4e45', bg: 'rgba(255, 78, 69, 0.14)' },
  Spotify: { color: '#1db954', bg: 'rgba(29, 185, 84, 0.14)' },
  SoundCloud: { color: '#ff7700', bg: 'rgba(255, 119, 0, 0.14)' },
  Bandcamp: { color: '#1da0c3', bg: 'rgba(29, 160, 195, 0.14)' },
  default: { color: '#a6a3c3', bg: 'rgba(166, 163, 195, 0.14)' },
};

export function platformStyle(name) {
  return PLATFORM_COLORS[name] || PLATFORM_COLORS.default;
}

// ระบุ platform จากลิงก์เบื้องต้น (ค่าจริงมาจากเซิร์ฟเวอร์หลังโหลดข้อมูล)
export function detectPlatform(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/youtube\.com|youtu\.be$/.test(h)) return 'YouTube';
    if (/spotify\.com$/.test(h)) return 'Spotify';
    if (/soundcloud\.com$/.test(h)) return 'SoundCloud';
    if (/bandcamp\.com$/.test(h)) return 'Bandcamp';
  } catch {}
  return '';
}

export function fmt(s) {
  if (!s || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
