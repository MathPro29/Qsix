// คิวเพลง (เก็บในหน่วยความจำ) — เพิ่ม/ลบ/เรียง/เล่นต่อเนื่อง + ส่งอีเวนต์เมื่อมีการเปลี่ยนแปลง
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { resolveUrl } = require('./resolver');

class Queue extends EventEmitter {
  constructor() {
    super();
    this.items = []; // { id, url, platform, title, artist, duration, thumbnail, mime, streamUrl, error, status, addedAt }
    this.cursor = -1; // ดัชนีเพลงที่กำลังเล่น
    this.history = []; // ไอดีที่เล่นไปแล้ว (เรียงเก่า -> ใหม่)
    this.isPlaying = false; // สถานะเล่น / หยุดชั่วคราว
    this.seekPosition = 0; // เวลาล่าสุดที่เล่น (วินาที)
    this.seekTimestamp = Date.now(); // เวลา timestamp ของเครื่องแม่ขณะอัปเดต seekPosition
  }

  snapshot() {
    return {
      items: this.items.map((it) => ({
        id: it.id,
        url: it.url,
        platform: it.platform,
        title: it.title,
        artist: it.artist,
        duration: it.duration,
        thumbnail: it.thumbnail,
        mime: it.mime,
        error: it.error,
        status: it.status,
        addedAt: it.addedAt,
      })),
      cursor: this.cursor,
      currentId: this.cursor >= 0 && this.cursor < this.items.length ? this.items[this.cursor].id : null,
      history: this.history.slice(),
      isPlaying: this.isPlaying,
      seekPosition: this.seekPosition,
      seekTimestamp: this.seekTimestamp,
    };
  }

  setPlaybackState(isPlaying, seekPosition = null) {
    this.isPlaying = !!isPlaying;
    if (seekPosition !== null && !isNaN(seekPosition)) {
      this.seekPosition = Math.max(0, Number(seekPosition));
      this.seekTimestamp = Date.now();
    }
    this.emitChange();
  }

  emitChange() {
    this.emit('change', this.snapshot());
  }

  // เพิ่มลิงก์เข้าคิว (ดึงข้อมูลแบบ async แล้วอัปเดต)
  add(url, { playNow = false, silent = false } = {}) {
    const id = crypto.randomBytes(6).toString('hex');
    const item = {
      id,
      url,
      platform: 'กำลังระบุ...',
      extractor: '',
      title: 'กำลังโหลดข้อมูลเพลง…',
      artist: '',
      duration: 0,
      thumbnail: '',
      mime: 'audio/mpeg',
      streamUrl: null,
      error: null,
      status: 'resolving',
      addedAt: Date.now(),
    };
    this.items.push(item);

    if (playNow) {
      // ถ้าเพิ่งเริ่มเล่น ให้เพลงนี้เป็นเพลงแรก
      if (this.cursor === -1) {
        this.cursor = this.items.length - 1;
      } else {
        // เอาขึ้นไปเล่นต่อจากเพลงปัจจุบัน
        const idx = this.items.indexOf(item);
        this.items.splice(idx, 1);
        this.items.splice(this.cursor + 1, 0, item);
        this.cursor += 1;
      }
    } else if (this.cursor === -1) {
      // คิวว่าง -> เพลงแรกเป็นเพลงปัจจุบัน (พร้อมเล่น)
      this.cursor = 0;
    }

    resolveUrl(url)
      .then((track) => {
        const it = this.items.find((x) => x.id === id);
        if (!it) return;
        Object.assign(it, track, { id, status: 'ready' });
        this.emitChange();
      })
      .catch((err) => {
        const it = this.items.find((x) => x.id === id);
        if (!it) return;
        it.status = 'error';
        it.error = String(err.message || err).slice(0, 300);
        this.emitChange();
      });

    this.emitChange();
    return item;
  }

  remove(id) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const wasCurrent = idx === this.cursor;
    this.items.splice(idx, 1);
    if (wasCurrent) {
      // ลบเพลงที่กำลังเล่น -> เลื่อนไปเพลงถัดไป (ถ้ามี)
      this.cursor = this.items.length === 0 ? -1 : Math.min(idx, this.items.length - 1);
    } else if (this.cursor > idx) {
      this.cursor -= 1;
    }
    this.history = this.history.filter((h) => h !== id);
    this.emitChange();
  }

  move(id, dir) {
    const idx = this.items.findIndex((x) => x.id === id);
    const to = idx + dir;
    if (idx === -1 || to < 0 || to >= this.items.length) return;
    const [it] = this.items.splice(idx, 1);
    this.items.splice(to, 0, it);
    if (this.cursor === idx) this.cursor = to;
    else if (this.cursor === to) this.cursor = idx;
    this.emitChange();
  }

  playNow(id) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const [it] = this.items.splice(idx, 1);
    const insertAt = this.cursor < 0 ? 0 : this.cursor + 1;
    this.items.splice(insertAt, 0, it);
    this.cursor = insertAt;
    if (this.items.some((x) => x.status === 'playing')) {
      for (const x of this.items) if (x.status === 'playing') x.status = 'done';
    }
    this.isPlaying = true;
    this.seekPosition = 0;
    this.seekTimestamp = Date.now();
    this.emitChange();
  }

  clear() {
    this.items = [];
    this.cursor = -1;
    this.history = [];
    this.isPlaying = false;
    this.seekPosition = 0;
    this.seekTimestamp = Date.now();
    this.emitChange();
  }

  // เลื่อนไปเพลงถัดไปในคิว (ข้ามเพลงที่โหลดไม่ได้/กำลังโหลด)
  next() {
    if (this.items.length === 0) return null;
    let idx = this.cursor < 0 ? 0 : this.cursor + 1;
    let guard = 0;
    while (idx < this.items.length && guard++ <= this.items.length) {
      const it = this.items[idx];
      if (it.status === 'ready' || it.status === 'done' || it.status === 'playing') break;
      idx++;
    }
    if (idx >= this.items.length) {
      // หมดคิว
      this.cursor = this.items.length; // เกินขอบ -> สถานะจบ
      this.isPlaying = false;
      this.seekPosition = 0;
      this.seekTimestamp = Date.now();
      this.emitChange();
      return null;
    }
    this.cursor = idx;
    for (const x of this.items) {
      if (x.status === 'playing') x.status = 'done';
    }
    const it = this.items[idx];
    it.status = 'playing';
    this.history.push(it.id);
    this.isPlaying = true;
    this.seekPosition = 0;
    this.seekTimestamp = Date.now();
    this.emitChange();
    return it;
  }

  prev() {
    if (this.history.length < 2) return null;
    this.history.pop(); // เพลงปัจจุบัน
    const prevId = this.history[this.history.length - 1];
    const idx = this.items.findIndex((x) => x.id === prevId);
    if (idx === -1) return null;
    this.cursor = idx;
    for (const x of this.items) if (x.status === 'playing') x.status = 'done';
    const it = this.items[idx];
    it.status = 'playing';
    this.isPlaying = true;
    this.seekPosition = 0;
    this.seekTimestamp = Date.now();
    this.emitChange();
    return it;
  }

  current() {
    if (this.cursor < 0 || this.cursor >= this.items.length) {
      // หมดคิว -> คืนเพลงสุดท้าย เพื่อให้กดเล่นซ้ำได้
      if (this.cursor >= this.items.length && this.items.length) {
        const last = this.items[this.items.length - 1];
        if (last.status !== 'playing') last.status = 'playing';
        return last;
      }
      return null;
    }
    const it = this.items[this.cursor];
    if (it.status !== 'playing') it.status = 'playing';
    return it;
  }

  markDone(id) {
    const it = this.items.find((x) => x.id === id);
    if (it) it.status = 'done';
    this.isPlaying = false;
    this.seekPosition = 0;
    this.seekTimestamp = Date.now();
    this.emitChange();
  }
}

module.exports = new Queue();
