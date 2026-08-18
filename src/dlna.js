// DLNA / UPnP — ค้นหาอุปกรณ์ MediaRenderer (TV, soundbar, ลำโพง) และสั่งให้เล่นเพลง
const dgram = require('dgram');
const http = require('http');
const https = require('https');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const SEARCH_TARGET = 'urn:schemas-upnp-org:device:MediaRenderer:1';

function fetchText(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { Accept: '*/*' } }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

function resolveUrl(base, maybeRelative) {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function soapRequest(url, service, action, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const payload = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${service}">${body}</u:${action}>
  </s:Body>
</s:Envelope>`;
    const u = new URL(url);
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (url.startsWith('https') ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPACTION: `"${service}#${action}"`,
          'Content-Length': Buffer.byteLength(payload),
          Connection: 'close',
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    req.write(payload);
    req.end();
  });
}

function parseFault(xml) {
  try {
    const doc = parser.parse(xml);
    const fault = doc?.['s:Envelope']?.['s:Body']?.['s:Fault'] || doc?.Envelope?.Body?.Fault;
    if (fault) return fault.detail?.UPnPError?.errorDescription || 'UPnP error';
  } catch {}
  return null;
}

async function sendAction(device, service, action, body) {
  if (!device.controlUrl) throw new Error('อุปกรณ์ไม่มีบริการ AVTransport');
  const res = await soapRequest(device.controlUrl, service, action, body);
  if (res.status >= 300) {
    const detail = parseFault(res.body);
    throw new Error(detail || `อุปกรณ์ตอบกลับ HTTP ${res.status}`);
  }
  return res.body;
}

// ค้นหาอุปกรณ์ MediaRenderer บนเครือข่าย (LAN)
function discoverDevices(timeoutMs = 4000) {
  return new Promise((resolvePromise) => {
    const found = new Map(); // usn -> device
    const socket = dgram.createSocket('udp4');

    const finish = () => {
      try { socket.close(); } catch {}
      resolvePromise([...found.values()]);
    };
    const timer = setTimeout(finish, timeoutMs + 1500);

    socket.on('error', () => clearTimeout(timer));

    socket.on('message', async (msg) => {
      const text = msg.toString();
      if (!text.includes('200 OK')) return;
      const location = /LOCATION:\s*(\S+)/i.exec(text);
      const usn = /USN:\s*(\S+)/i.exec(text);
      if (!location) return;
      const usnKey = usn ? usn[1] : location[1];
      if (found.has(usnKey)) return;
      try {
        const desc = await fetchText(location[1]);
        const xml = parser.parse(desc);
        const root = xml.root || xml;
        const dev = root.device;
        const name = dev?.friendlyName || dev?.modelName || usnKey;

        // หาบริการ AVTransport + RenderingControl
        let avUrl = null;
        let rcUrl = null;
        let udn = dev?.UDN || usnKey;
        const collect = (svc) => {
          const list = Array.isArray(svc) ? svc : svc ? [svc] : [];
          for (const s of list) {
            const type = s.serviceType || '';
            const ctrl = resolveUrl(location[1], s.controlURL);
            if (type.includes('AVTransport')) avUrl = avUrl || ctrl;
            if (type.includes('RenderingControl')) rcUrl = rcUrl || ctrl;
            if (s.UDN) udn = s.UDN;
          }
        };
        collect(root?.deviceList?.device);
        collect(dev?.serviceList?.service);
        collect(root?.serviceList?.service);

        if (!avUrl) return; // ไม่ใช่ renderer ที่สั่งเล่นได้
        found.set(usnKey, {
          id: usnKey,
          usn: usnKey,
          udn,
          name: String(name),
          location: location[1],
          controlUrl: avUrl,
          renderingControlUrl: rcUrl,
          icon: dev?.iconList?.icon?.url || '',
        });
      } catch (e) {
        // ข้ามอุปกรณ์ที่อ่านข้อมูลไม่ได้
      }
    });

    socket.bind(0, () => {
      socket.setBroadcast(true);
      const search = `M-SEARCH * HTTP/1.1\r\nHOST: ${SSDP_ADDR}:${SSDP_PORT}\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${SEARCH_TARGET}\r\n\r\n`;
      for (const target of [SSDP_ADDR, '255.255.255.255']) {
        try {
          socket.send(search, 0, search.length, SSDP_PORT, target);
        } catch {}
      }
      try { socket.addMembership(SSDP_ADDR); } catch {}
    });

    // ตัดเวลาให้สั้นกว่า timeout เผื่อ socket ยังไม่ปิด
    socket.setTimeout(timeoutMs + 4000, () => {
      clearTimeout(timer);
      finish();
    });
  });
}

function didlMeta(title, artist, uri, mime) {
  const safe = (s) => String(s || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
  return `<?xml version="1.0" encoding="utf-8"?>
<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
  <item id="0" parentID="0" restricted="1">
    <dc:title>${safe(title)}</dc:title>
    <dc:creator>${safe(artist || '')}</dc:creator>
    <upnp:class>object.item.audioItem.musicTrack</upnp:class>
    <res protocolInfo="http-get:*:${mime || 'audio/mpeg'}:*">${safe(uri)}</res>
  </item>
</DIDL-Lite>`;
}

// --- คำสั่งควบคุมอุปกรณ์ ---
const AV = 'urn:schemas-upnp-org:service:AVTransport:1';
const RC = 'urn:schemas-upnp-org:service:RenderingControl:1';

async function castTrack(device, { uri, title, artist, mime }) {
  const meta = didlMeta(title, artist, uri, mime);
  await sendAction(device, AV, 'SetAVTransportURI', `<InstanceID>0</InstanceID><CurrentURI>${uri}</CurrentURI><CurrentURIMetaData>${meta.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</CurrentURIMetaData>`);
  await sendAction(device, AV, 'Play', '<InstanceID>0</InstanceID><Speed>1</Speed>');
}

async function stopCast(device) {
  try { await sendAction(device, AV, 'Stop', '<InstanceID>0</InstanceID>'); } catch {}
}

async function getTransportState(device) {
  try {
    const body = await sendAction(device, AV, 'GetTransportInfo', '<InstanceID>0</InstanceID>');
    const doc = parser.parse(body);
    const env = doc['s:Envelope'] || doc.Envelope;
    const res = env?.['s:Body']?.['u:GetTransportInfoResponse'] || env?.Body?.GetTransportInfoResponse;
    return res?.CurrentTransportState || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

async function setDeviceVolume(device, volume) {
  if (!device.renderingControlUrl) return;
  try {
    await sendAction(device, RC, 'SetVolume', `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${Math.round(volume)}</DesiredVolume>`);
  } catch {}
}

module.exports = { discoverDevices, castTrack, stopCast, getTransportState, setDeviceVolume };
