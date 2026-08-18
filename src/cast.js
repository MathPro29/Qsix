// จัดการการ cast ไปยังทีวี/ลำโพงผ่าน DLNA — เล่นต่อเนื่องจนจบคิว
const dlna = require('./dlna');

const POLL_MS = 5000;

class CastManager {
  constructor(getStreamUrlFn) {
    this.getStreamUrl = getStreamUrlFn; // (item) => url ที่ renderer ดึงได้
    this.device = null;
    this.itemId = null;
    this.startedAt = 0;
    this.endAt = 0;
    this.timer = null;
    this.advancing = false;
    this.playing = false;
    this.stateListeners = [];
  }

  onChange(fn) {
    this.stateListeners.push(fn);
  }

  emit() {
    for (const fn of this.stateListeners) fn(this.state());
  }

  state() {
    return {
      active: this.playing,
      device: this.device ? { id: this.device.id, name: this.device.name } : null,
      itemId: this.itemId,
      startedAt: this.startedAt,
      endAt: this.endAt,
    };
  }

  async start(device, queue) {
    this.stopTimers();
    this.device = device;
    this.playing = true;
    // หาเพลงที่จะเล่น: เพลงปัจจุบัน หรือเพลงถัดไป
    let item = queue.current();
    if (!item || item.status === 'done') item = queue.next();
    if (!item) {
      this.playing = false;
      this.emit();
      return { ok: false, error: 'คิวว่าง — เพิ่มเพลงก่อน cast' };
    }
    try {
      await this.castItem(item);
      this.emit();
      return { ok: true, item: { id: item.id, title: item.title } };
    } catch (e) {
      this.playing = false;
      this.emit();
      return { ok: false, error: `cast ไม่สำเร็จ: ${e.message}` };
    }
  }

  async castItem(item) {
    this.itemId = item.id;
    const uri = this.getStreamUrl(item);
    await dlna.castTrack(this.device, {
      uri,
      title: item.title,
      artist: item.artist,
      mime: item.mime || 'audio/mpeg',
    });
    const now = Date.now();
    this.startedAt = now;
    this.endAt = now + Math.max((item.duration || 0) * 1000, 30000); // เผื่อขั้นต่ำ 30 วิ
    this.playing = true;
    this.startTimers();
    this.emit();
  }

  async advance(queue) {
    if (this.advancing || !this.playing) return;
    this.advancing = true;
    try {
      const next = queue.next();
      if (!next) {
        await this.stop();
        return;
      }
      if (next.status === 'error' || !next.streamUrl) {
        // เพลงนี้ดึงสตรีมไม่ได้ -> ข้ามไป
        return this.advance(queue);
      }
      await this.castItem(next);
    } catch (e) {
      // ลองเพลงถัดไป
      try { await this.advance(queue); } catch {}
    } finally {
      this.advancing = false;
    }
  }

  startTimers() {
    this.stopTimers();
    this.timer = setInterval(() => this.checkState(), POLL_MS);
  }

  stopTimers() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async checkState() {
    if (!this.playing || !this.device) return;
    // 1) หมดเวลาตามความยาวเพลง
    if (this.endAt > 0 && Date.now() > this.endAt + 2000) {
      return this.advance();
    }
    // 2) ตรวจสอบสถานะจากอุปกรณ์
    const state = await dlna.getTransportState(this.device);
    if (state === 'STOPPED' || state === 'NO_MEDIA_PRESENT') {
      // กันกรณีเพิ่งตั้งค่าแล้วยังไม่เริ่มเล่น
      if (Date.now() - this.startedAt > 10000) {
        return this.advance();
      }
    }
  }

  async stop() {
    this.stopTimers();
    if (this.device) await dlna.stopCast(this.device);
    this.playing = false;
    this.itemId = null;
    this.emit();
  }

  async setVolume(v) {
    if (this.device) await dlna.setDeviceVolume(this.device, v);
  }
}

module.exports = CastManager;
