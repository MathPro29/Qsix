import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Container, Grid, Link, Typography } from '@mui/material';
import { api } from './api';
import Header from './components/Header';
import AddBar from './components/AddBar';
import QueueList from './components/QueueList';
import Player from './components/Player';
import CastPanel from './components/CastPanel';
import SpeakerPanel from './components/SpeakerPanel';
import SourcePanel from './components/SourcePanel';

// ชื่อเริ่มต้นของเครื่อง ตามเบราว์เซอร์/ระบบปฏิบัติการ
function defaultDeviceName() {
  const ua = navigator.userAgent || '';
  let os = 'อุปกรณ์';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iPhone/iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'PC Windows';
  else if (/Macintosh/.test(ua)) os = 'Mac';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  return browser ? `${os} (${browser})` : os;
}

export default function App() {
  // --- ตัวตนของเครื่องนี้ (ID เก็บใน localStorage เพื่อให้สถานะแหล่งเสียงคงเดิมข้ามการรีเฟรช) ---
  const myIdRef = useRef(null);
  if (!myIdRef.current) {
    let id = localStorage.getItem('qsClientId');
    if (!id) {
      id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('qsClientId', id);
    }
    myIdRef.current = id;
  }
  const myId = myIdRef.current;
  const [myName, setMyName] = useState(() => localStorage.getItem('qsClientName') || defaultDeviceName());
  const myNameRef = useRef(myName);
  myNameRef.current = myName;

  const [clients, setClients] = useState([]);
  const [masterId, setMasterId] = useState(null);
  const masterIdRef = useRef(masterId);
  masterIdRef.current = masterId;
  const isMaster = masterId === myId;
  const [displayTime, setDisplayTime] = useState(0);

  // --- สถานะจากเซิร์ฟเวอร์ (SSE) ---
  const [queue, setQueue] = useState({ items: [], cursor: -1, currentId: null });
  const [cast, setCast] = useState({ active: false, device: null, itemId: null });
  const [volume, setVolume] = useState(80);
  const [connected, setConnected] = useState(false);

  // --- สถานะ UI ---
  const [mode, setMode] = useState('link');
  const [msg, setMsgState] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searching, setSearching] = useState(false);
  const [speakers, setSpeakers] = useState(undefined); // undefined=ยังไม่รู้, null=ไม่รองรับ
  const [speakerId, setSpeakerId] = useState('');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [startedMuted, setStartedMuted] = useState(false); // เริ่มเล่นแบบเงียบ (รอผู้ใช้แตะเปิดเสียง)

  // --- สถานะการเล่น ---
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [dragValue, setDragValue] = useState(null);

  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current;

  const loadedIdRef = useRef(null);
  const queueRef = useRef(queue);
  const castRef = useRef(cast);
  queueRef.current = queue;
  castRef.current = cast;

  const setMsg = useCallback((text, severity = 'info') => {
    setMsgState(text ? { text, severity } : null);
  }, []);

  const findItem = (id) => queueRef.current.items.find((x) => x.id === id) || null;

  // เล่นเสียงโดยจัดการ Autoplay Policy:
  // 1) ลองเล่นมีเสียงปกติ 2) ถ้าโดนบล็อก (NotAllowed/Abort) -> เล่นแบบ muted แทน (อนุญาตเสมอ)
  //    แล้วให้ผู้ใช้แตะเปิดเสียงทีหลัง ไม่มีแบนเนอร์เตือน 3) กรณีอื่น -> แจ้งบล็อกจริง
  const playAudio = useCallback(() => {
    return new Promise((resolve) => {
      audio.play().then(() => {
        if (audio.muted) audio.muted = false;
        setStartedMuted(false);
        setAutoplayBlocked(false);
        resolve(true);
      }).catch((e) => {
        if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
          // โดน Autoplay Policy บล็อก หรือถูกเรียกเล่นซ้ำ — ลองแบบ muted (ไม่ต้องใช้ gesture)
          audio.muted = true;
          audio.play().then(() => {
            setStartedMuted(true);
            setAutoplayBlocked(false);
            resolve(true);
          }).catch(() => {
            setAutoplayBlocked(true);
            resolve(false);
          });
        } else {
          setAutoplayBlocked(true);
          resolve(false);
        }
      });
    });
  }, [audio]);

  // โหลดเพลงเข้าตัวเล่น (autoplay=true -> พยายามเล่นทันที)
  const loadAndPlay = useCallback((id, autoplay) => {
    const it = findItem(id);
    if (!it || it.status === 'resolving') return false;
    loadedIdRef.current = id;
    audio.src = `/api/stream/${id}`;
    setDur(it.duration || 0);
    if (autoplay) {
      setPlaying(true);
      playAudio();
    } else {
      setPlaying(false);
    }
    return true;
  }, [audio, playAudio]);

  const handleNext = useCallback(async () => {
    try {
      const curId = queueRef.current.currentId;
      const r = await api('/api/control', { method: 'POST', body: { action: 'next', clientId: myId, currentId: curId } });
      if (r && r.item) {
        loadAndPlay(r.item.id, true);
      } else {
        loadedIdRef.current = null;
        setPlaying(false);
        setMsg('จบคิวแล้ว', 'success');
      }
    } catch (e) {
      setMsg(e.message, 'error');
    }
  }, [loadAndPlay, setMsg, myId]);

  const startCurrent = useCallback(async () => {
    try {
      const r = await api('/api/control', { method: 'POST', body: { action: 'play', clientId: myId } });
      if (r && r.item) loadAndPlay(r.item.id, true);
    } catch (e) {
      setMsg(e.message, 'error');
    }
  }, [loadAndPlay, setMsg, myId]);

  // --- SSE ---
  useEffect(() => {
    const es = new EventSource(`/api/events?clientId=${encodeURIComponent(myId)}&name=${encodeURIComponent(myNameRef.current)}`);
    es.onopen = () => {
      setConnected(true);
      // ยืนยันชื่อเครื่องปัจจุบันทุกครั้งที่ (re)connect
      api('/api/clients/name', { method: 'POST', body: { clientId: myId, name: myNameRef.current } }).catch(() => {});
    };
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setQueue(data.queue);
        setCast(data.cast);
        setVolume(data.volume);
        setClients(data.clients || []);
        setMasterId(data.masterId || null);
      } catch {}
    };
    return () => es.close();
  }, [myId]);

  // ปลดล็อก Autoplay: ทุกครั้งที่ผู้ใช้แตะ/คลิก/กดแป้น
  //  - ถ้าเซิร์ฟเวอร์สั่งให้เล่น (isPlaying) แต่เครื่องนี้ยังเงียบ -> เล่นทันที
  //  - prime element แบบเงียบ 1 ครั้งแรก เพื่อให้ autoplay ครั้งถัดไปผ่าน (สำคัญกับ iOS)
  const primedRef = useRef(false);
  useEffect(() => {
    const tryResume = () => {
      const a = audioRef.current;
      if (!a) return;
      // กำลังเล่นแบบเงียบอยู่ -> แตะตรงไหนก็เปิดเสียงทันที
      if (!a.paused && a.muted) {
        a.muted = false;
        setStartedMuted(false);
        setAutoplayBlocked(false);
        return;
      }
      const wantPlay = !!queueRef.current.isPlaying && !!a.src;
      if (!primedRef.current) {
        if (!a.src || !a.paused) return; // ยังไม่มีเพลง หรือเล่นอยู่แล้ว — ลองครั้งถัดไป
        primedRef.current = true;
        const wasMuted = a.muted;
        a.muted = true;
        a.play()
          .then(() => {
            a.muted = wasMuted;
            if (!wantPlay) a.pause();
            setAutoplayBlocked(false);
          })
          .catch(() => { a.muted = wasMuted; });
        return;
      }
      if (wantPlay && a.paused) {
        a.play().then(() => { if (a.muted) a.muted = false; setAutoplayBlocked(false); }).catch(() => {});
      }
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((ev) => window.addEventListener(ev, tryResume, { capture: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, tryResume, { capture: true }));
  }, []);

  // --- ซิงก์กับคิว: เปลี่ยนเพลงเมื่อ currentId เปลี่ยน / จัดการตอน cast / ซิงก์เวลาเล่นตามเซิร์ฟเวอร์ ---
  useEffect(() => {
    if (cast.active) {
      if (!audio.paused) audio.pause();
      setPlaying(false);
      return;
    }

    // ไม่ใช่เครื่องเล่นหลัก -> หยุดเสียงทันที ไม่โหลด/เล่นอะไร
    if (!isMaster) {
      if (!audio.paused) audio.pause();
      if (loadedIdRef.current) {
        loadedIdRef.current = null;
        audio.removeAttribute('src');
      }
      setPlaying(false);
      return;
    }

    // === จากจุดนี้ = isMaster=true ===
    const curId = queue.currentId;
    if (curId && curId !== loadedIdRef.current) {
      // เพลงแรกที่เพิ่งเพิ่ม หรือเปลี่ยนเพลง -> โหลดเพลงใหม่
      loadAndPlay(curId, queue.isPlaying);
    } else if (!curId && loadedIdRef.current) {
      loadedIdRef.current = null;
      audio.pause();
      audio.removeAttribute('src');
      setPlaying(false);
      setCurTime(0);
      setDur(0);
    }

    // ซิงก์การ เล่น/หยุดชั่วคราว และ เวลา (Time Sync)
    if (curId && curId === loadedIdRef.current) {
      if (queue.isPlaying) {
        // คำนวณเวลาที่สอดคล้องตาม timestamp ล่าสุด
        let targetTime = queue.seekPosition || 0;
        if (queue.seekTimestamp) {
          const elapsed = (Date.now() - queue.seekTimestamp) / 1000;
          targetTime += elapsed;
        }
        // ปรับตำแหน่งเล่นถ้าเหลื่อมกันมากกว่า 1.5 วินาที
        if (Math.abs(audio.currentTime - targetTime) > 1.5) {
          audio.currentTime = Math.min(targetTime, audio.duration || targetTime);
        }
        if (audio.paused && !autoplayBlocked) {
          setPlaying(true);
          playAudio();
        }
      } else {
        if (!audio.paused) {
          audio.pause();
          setPlaying(false);
        }
        if (queue.seekPosition !== undefined && Math.abs(audio.currentTime - queue.seekPosition) > 1.5) {
          audio.currentTime = queue.seekPosition;
        }
      }
    }
  }, [queue, cast, audio, loadAndPlay, autoplayBlocked, playAudio, isMaster]);

  // กรณีถูกบล็อกแบบเต็มขั้น — ลองเล่นแบบ muted ซ้ำทุก 2 วินาทีให้เพลงเดินต่อ
  useEffect(() => {
    if (!autoplayBlocked || !isMaster || (cast && cast.active)) return;
    const t = setInterval(() => {
      const a = audioRef.current;
      if (queueRef.current.isPlaying && a && a.src && a.paused) {
        a.muted = true;
        a.play().then(() => {
          setStartedMuted(true);
          setAutoplayBlocked(false);
        }).catch(() => {});
      }
    }, 2000);
    return () => clearInterval(t);
  }, [autoplayBlocked, isMaster, cast]);

  // --- เหตุการณ์ของตัวเล่นเสียง (ติดตั้งครั้งเดียว) ---
  useEffect(() => {
    const onTime = () => {
      if (dragValue != null) return;
      setCurTime(audio.currentTime || 0);
    };
    const onMeta = () => setDur(audio.duration || 0);
    const onEnded = () => handleNext();
    const onError = () => {
      setMsg('เกิดข้อผิดพลาดในการเล่นเพลงนี้ — ข้ามไปเพลงถัดไป', 'warning');
      handleNext();
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // ส่งเวลาปัจจุบันไปยังเซิร์ฟเวอร์ทุกๆ 5 วินาทีขณะเล่น เพื่อให้เครื่องอื่นตรงกันเสมอนำโดย master client
    const syncInterval = setInterval(() => {
      if (masterIdRef.current === myId && !audio.paused && loadedIdRef.current && !castRef.current.active) {
        api('/api/control', { method: 'POST', body: { action: 'seek', time: audio.currentTime || 0, clientId: myId } }).catch(() => {});
      }
    }, 5000);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      clearInterval(syncInterval);
    };
  }, [audio, handleNext, setMsg, dragValue]);

  // แสดงเวลาตามเซิร์ฟเวอร์
  useEffect(() => {
    if (!queue.isPlaying) {
      setDisplayTime(queue.seekPosition || 0);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - (queue.seekTimestamp || Date.now())) / 1000;
      setDisplayTime((queue.seekPosition || 0) + elapsed);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [queue.isPlaying, queue.seekPosition, queue.seekTimestamp]);

  // --- ความดัง: โหลดจาก localStorage ---
  useEffect(() => {
    const saved = Number(localStorage.getItem('qsVolume'));
    if (!Number.isNaN(saved) && saved >= 0 && saved <= 100) {
      audio.volume = saved / 100;
      setVolume(saved);
    } else {
      audio.volume = 0.8;
      setVolume(80);
    }
  }, [audio]);

  // --- คำสั่งเครื่องเล่น ---
  const onVolume = (v) => {
    audio.volume = v / 100;
    setVolume(v);
    localStorage.setItem('qsVolume', v);
    if (castRef.current.active) {
      api('/api/cast', { method: 'POST', body: { action: 'volume', volume: v } }).catch(() => {});
    }
  };

  const togglePlay = async () => {
    if (castRef.current.active) return;
    if (!isMaster) {
      handleSetMaster(myId);
    }
    if (audio.paused) {
      if (!audio.src) {
        startCurrent();
        return;
      }
      setPlaying(true);
      playAudio();
      try {
        await api('/api/control', { method: 'POST', body: { action: 'play', time: audio.currentTime || 0, clientId: myId } });
      } catch (e) {
        setMsg(e.message, 'error');
      }
    } else {
      audio.pause();
      setPlaying(false);
      try {
        await api('/api/control', { method: 'POST', body: { action: 'pause', time: audio.currentTime || 0, clientId: myId } });
      } catch (e) {
        setMsg(e.message, 'error');
      }
    }
  };

  const stopLocal = async () => {
    try {
      await api('/api/control', { method: 'POST', body: { action: 'stop' } });
    } catch {}
    loadedIdRef.current = null;
    audio.pause();
    audio.removeAttribute('src');
    setPlaying(false);
    setCurTime(0);
    setDur(0);
  };

  const onPrev = async () => {
    try {
      const r = await api('/api/control', { method: 'POST', body: { action: 'prev', clientId: myId } });
      if (r && r.item) loadAndPlay(r.item.id, true);
    } catch (e) {
      setMsg(e.message, 'error');
    }
  };

  // --- เพิ่มเพลง / ค้นหา ---
  const addUrl = async (url, playNow) => {
    const wasEmpty = queueRef.current.items.length === 0;
    setMsg('กำลังเพิ่มเพลง…');
    try {
      const r = await api('/api/queue', { method: 'POST', body: { url, playNow: !!playNow } });
      if (r && r.ok) {
        setMsg('เพิ่มเพลงเข้ารอแล้ว', 'success');
        if (playNow || wasEmpty) {
          startCurrent();
        }
      }
    } catch (e) {
      setMsg(e.message, 'error');
    }
  };

  const onSearch = async (q) => {
    setMsg('กำลังค้นหา…');
    setSearchResults([]);
    try {
      const r = await api('/api/search', { method: 'POST', body: { q } });
      setSearchResults(r.tracks || []);
      setMsg(null);
    } catch (e) {
      setMsg(e.message, 'error');
    }
  };

  const onAddResult = (url) => {
    addUrl(url, false);
    setSearchResults([]);
  };

  // --- จัดการคิว ---
  const removeItem = async (id) => {
    try { await api(`/api/queue/${id}`, { method: 'DELETE' }); } catch (e) { setMsg(e.message, 'error'); }
  };
  const moveItem = async (id, dir) => {
    try { await api(`/api/queue/${id}/move`, { method: 'POST', body: { dir } }); } catch (e) { setMsg(e.message, 'error'); }
  };
  const playNowItem = async (id) => {
    try {
      await api(`/api/queue/${id}/play-now`, { method: 'POST' });
      startCurrent();
    } catch (e) { setMsg(e.message, 'error'); }
  };
  const clearQueue = async () => {
    if (!window.confirm('ล้างคิวทั้งหมด?')) return;
    try { await api('/api/queue', { method: 'DELETE' }); } catch (e) { setMsg(e.message, 'error'); }
  };

  // --- cast ---
  const loadDevices = async () => {
    setSearching(true);
    try {
      const r = await api('/api/devices?refresh=1');
      setDevices(r.devices || []);
    } catch (e) {
      setMsg(e.message, 'error');
    } finally {
      setSearching(false);
    }
  };
  const startCast = async (d) => {
    try {
      const r = await api('/api/cast', { method: 'POST', body: { deviceId: d.id, action: 'start' } });
      if (r && r.ok) setMsg(`กำลัง cast ไปที่ "${d.name}"`, 'success');
      else setMsg((r && r.error) || 'cast ไม่สำเร็จ', 'error');
    } catch (e) {
      setMsg(e.message, 'error');
    }
    loadDevices();
  };
  const stopCast = async () => {
    try { await api('/api/cast', { method: 'POST', body: { action: 'stop' } }); } catch {}
    loadDevices();
  };

  // --- ลำโพงเครื่องนี้ (setSinkId) ---
  useEffect(() => {
    if (!('sinkId' in HTMLMediaElement.prototype) || !navigator.mediaDevices) {
      setSpeakers(null);
      return;
    }
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        const devs = await navigator.mediaDevices.enumerateDevices();
        const outs = devs.filter((d) => d.kind === 'audiooutput');
        setSpeakers(outs);
        if (outs.length) {
          const def = outs.find((d) => d.deviceId === 'default');
          const id = def ? def.deviceId : outs[0].deviceId;
          setSpeakerId(id);
          try { await audio.setSinkId(id); } catch {}
        }
      } catch {
        setSpeakers([]);
      }
    })();
  }, [audio]);

  const onSpeakerChange = async (id) => {
    setSpeakerId(id);
    try {
      await audio.setSinkId(id);
      setMsg('เปลี่ยนลำโพงแล้ว', 'success');
    } catch {
      setMsg('เปลี่ยนลำโพงไม่สำเร็จ (ลอง Chrome/Edge)', 'error');
    }
  };

  const enableAudio = () => {
    setAutoplayBlocked(false);
    audio.muted = false;
    setStartedMuted(false);
    if (queue.currentId) {
      if (!audio.src) audio.src = `/api/stream/${queue.currentId}`;
      audio.play().then(() => {
        setPlaying(true);
      }).catch(() => {});
    }
  };

  const unmute = () => {
    audio.muted = false;
    setStartedMuted(false);
    setAutoplayBlocked(false);
  };

  const currentItem = queue.items.find((x) => x.id === queue.currentId) || null;

  const handleSetMaster = useCallback(async (id) => {
    // === ส่วนที่ 1: เล่นเสียงทันทีในจังหวะคลิก (user gesture context) ===
    if (id === myId) {
      const curId = queueRef.current?.currentId;
      if (curId) {
        loadedIdRef.current = curId;
        audio.src = `/api/stream/${curId}`;
        const targetTime = queueRef.current.seekPosition || 0;
        if (targetTime) audio.currentTime = targetTime;
        audio.play().then(() => {
          if (audio.muted) audio.muted = false;
          setPlaying(true);
          setStartedMuted(false);
          setAutoplayBlocked(false);
        }).catch(() => {
          // โดน Autoplay บล็อก -> เล่นแบบ muted สำรอง
          audio.muted = true;
          audio.play().then(() => {
            setPlaying(true);
            setStartedMuted(true);
          }).catch(() => setAutoplayBlocked(true));
        });
      }
    }
    // === ส่วนที่ 2: แจ้งเซิร์ฟเวอร์เปลี่ยน masterId ===
    try {
      const r = await api('/api/clients/master', { method: 'POST', body: { clientId: id } });
      if (r && r.ok) {
        if (id === myId) setMsg('เครื่องนี้เป็น Source เสียงแล้ว', 'success');
        else {
          const targetClient = clients.find((c) => c.id === id);
          setMsg(`เปลี่ยน Source เสียงไปที่ "${targetClient?.name || 'อุปกรณ์อื่น'}" แล้ว`, 'info');
        }
      }
    } catch (e) {
      setMsg(e.message, 'error');
    }
  }, [myId, audio, clients, setMsg]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header connected={connected} />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {autoplayBlocked && (
          <Alert
            severity="warning"
            sx={{ mb: 2, alignItems: 'center' }}
            action={
              <Button color="inherit" size="small" variant="contained" onClick={enableAudio}>
                แตะเพื่อเปิดเสียง
              </Button>
            }
          >
            เบราว์เซอร์บล็อกการเล่นเสียงอัตโนมัติ — กดปุ่มด้านขวาเพื่อเริ่มฟังเพลงร่วมกับเครื่องอื่น
          </Alert>
        )}
        <AddBar
          mode={mode}
          setMode={setMode}
          onAdd={addUrl}
          onSearch={onSearch}
          searchResults={searchResults}
          onAddResult={onAddResult}
          msg={msg ? { ...msg, clear: () => setMsg(null) } : null}
        />

        <Grid container spacing={2.5} sx={{ mt: 0.25 }} alignItems="start">
          <Grid item xs={12} md={8}>
            <QueueList
              items={queue.items}
              currentId={queue.currentId}
              onRemove={removeItem}
              onMove={moveItem}
              onPlayNow={playNowItem}
              onClear={clearQueue}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Player
                item={currentItem}
                playing={playing}
                curTime={isMaster ? curTime : displayTime}
                dur={dur}
                volume={volume}
                castActive={cast.active}
                isMaster={isMaster}
                masterName={masterId ? (clients.find((c) => c.id === masterId) || {}).name || '' : ''}
                muted={startedMuted}
                onUnmute={unmute}
                onClaimMaster={() => handleSetMaster(myId)}
                dragValue={dragValue}
                onSeekChange={(v) => {
                  setDragValue(v);
                  const d = audio.duration || 0;
                  if (d) audio.currentTime = (v / 1000) * d;
                }}
                onSeekCommit={async (v) => {
                  const d = audio.duration || 0;
                  const newTime = (v / 1000) * d;
                  if (d) audio.currentTime = newTime;
                  setDragValue(null);
                  try {
                    await api('/api/control', { method: 'POST', body: { action: 'seek', time: newTime } });
                  } catch {}
                }}
                onToggle={togglePlay}
                onNext={handleNext}
                onPrev={onPrev}
                onStop={stopLocal}
                onVolume={onVolume}
              />
              <CastPanel
                devices={devices}
                cast={cast}
                searching={searching}
                onRefresh={loadDevices}
                onStart={startCast}
                onStop={stopCast}
              />
              <SourcePanel
                clients={clients}
                masterId={masterId}
                myId={myId}
                myName={myName}
                onSetMaster={handleSetMaster}
                onSetName={async (name) => {
                  setMyName(name);
                  localStorage.setItem('qsClientName', name);
                  try {
                    await api('/api/clients/name', { method: 'POST', body: { clientId: myId, name } });
                  } catch {}
                }}
              />
              <SpeakerPanel speakers={speakers} value={speakerId} onChange={onSpeakerChange} />
            </Box>
          </Grid>
        </Grid>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
          Music Queue · รันบนเครื่องของคุณเอง ·{' '}
          <Link href="/api/state" target="_blank" color="primary">
            API
          </Link>
        </Typography>
      </Container>
    </Box>
  );
}
