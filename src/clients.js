// ทะเบียนเครื่องที่เชื่อมต่อ (ผ่าน SSE) + เครื่องเล่นหลัก (แหล่งเสียง)
const { EventEmitter } = require('events');

class ClientRegistry extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // id -> { id, name, connectedAt, lastSeen }
    this.masterId = null; // id ของเครื่องที่ออกเสียง
  }

  register(id, name) {
    const now = Date.now();
    let c = this.clients.get(id);
    if (c) {
      c.lastSeen = now;
      // อัปเดตชื่อเมื่อระบุมา (ชื่อใหม่จากผู้ใช้จะถูกยืนยันผ่าน POST /api/clients/name)
      if (name && !c.nameEdited) c.name = name;
    } else {
      c = { id, name: name || 'อุปกรณ์', connectedAt: now, lastSeen: now, nameEdited: false };
      this.clients.set(id, c);
    }
    // เครื่องแรกที่เชื่อมต่อกลายเป็นแหล่งเสียง (ถ้ายังไม่มี หรือ masterId ปัจจุบันไม่ได้อยู่แล้ว)
    if (!this.masterId || !this.clients.has(this.masterId)) {
      this.masterId = id;
    }
    this.emit('change');
    return c;
  }

  unregister(id) {
    const wasMaster = this.masterId === id;
    this.clients.delete(id);
    if (wasMaster) {
      const nextClient = this.clients.keys().next().value;
      this.masterId = nextClient || null;
      this.emit('master-left');
    }
    this.emit('change');
  }

  setName(id, name) {
    const c = this.clients.get(id);
    if (!c) return null;
    c.name = name;
    c.nameEdited = true;
    this.emit('change');
    return c;
  }

  setMaster(id) {
    if (!this.clients.has(id)) return false;
    this.masterId = id;
    this.emit('change');
    return true;
  }

  list() {
    return [...this.clients.values()].map(({ id, name, connectedAt }) => ({ id, name, connectedAt }));
  }
}

module.exports = new ClientRegistry();
