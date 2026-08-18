import { Alert, Avatar, Box, Button, Chip, IconButton, Paper, Slider, Stack, Tooltip, Typography } from '@mui/material';
import {
  CastConnected,
  MusicNote,
  PauseRounded,
  PlayArrowRounded,
  SkipNext,
  SkipPrevious,
  Speaker,
  StopRounded,
  VolumeOff,
  VolumeUp,
} from '@mui/icons-material';
import { fmt } from '../platform';

export default function Player({
  item,
  playing,
  curTime,
  dur,
  volume,
  castActive,
  isMaster,
  masterName,
  muted,
  onUnmute,
  onClaimMaster,
  dragValue,
  onSeekChange,
  onSeekCommit,
  onToggle,
  onNext,
  onPrev,
  onStop,
  onVolume,
}) {
  const seekVal = dragValue != null ? dragValue : dur ? Math.round((curTime / dur) * 1000) : 0;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">
          กำลังเล่น
        </Typography>
        {isMaster ? (
          <Chip icon={<VolumeUp />} label="ออกเสียงที่เครื่องนี้" color="success" size="small" variant="filled" />
        ) : (
          <Chip
            icon={<VolumeOff />}
            label={masterName ? `ออกเสียงที่: ${masterName}` : 'ไม่ได้ออกเสียงที่เครื่องนี้'}
            color="warning"
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      {!item ? (
        <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
          <MusicNote sx={{ fontSize: 40, opacity: 0.35 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            ยังไม่มีเพลงเล่น
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Avatar variant="rounded" src={item.thumbnail || undefined} sx={{ width: 64, height: 64, bgcolor: 'action.hover' }}>
              <MusicNote />
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" noWrap fontWeight={700}>
                {item.title}
              </Typography>
              <Typography variant="body2" noWrap color="text.secondary">
                {item.artist || item.platform}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 34, textAlign: 'right' }}>
              {fmt(dragValue != null ? (dragValue / 1000) * (dur || 1) : curTime)}
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1000}
              value={seekVal}
              onChange={(_, v) => onSeekChange(v)}
              onChangeCommitted={(_, v) => onSeekCommit(v)}
              disabled={!dur}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ width: 34 }}>
              {fmt(dur)}
            </Typography>
          </Box>

          <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 1 }}>
            <Tooltip title="เพลงก่อนหน้า">
              <IconButton onClick={onPrev}>
                <SkipPrevious />
              </IconButton>
            </Tooltip>
            <Tooltip title={playing ? 'หยุดชั่วคราว' : 'เล่น'}>
              <IconButton
                color="primary"
                onClick={onToggle}
                sx={{ fontSize: 52, '& svg': { fontSize: 52 }, p: 0 }}
              >
                {playing ? <PauseRounded /> : <PlayArrowRounded />}
              </IconButton>
            </Tooltip>
            <Tooltip title="ข้ามเพลง">
              <IconButton onClick={onNext}>
                <SkipNext />
              </IconButton>
            </Tooltip>
            <Tooltip title="หยุด">
              <IconButton onClick={onStop}>
                <StopRounded />
              </IconButton>
            </Tooltip>
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
            <VolumeUp fontSize="small" sx={{ color: 'text.secondary' }} />
            <Slider
              size="small"
              min={0}
              max={100}
              value={volume}
              onChange={(_, v) => onVolume(v)}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ width: 28 }}>
              {volume}
            </Typography>
          </Box>
        </>
      )}

      {!isMaster && onClaimMaster && (
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<VolumeUp />}
          onClick={onClaimMaster}
          sx={{ mt: 1.5, borderRadius: 2 }}
        >
          เปลี่ยนมาฟัง / ออกเสียงที่เครื่องนี้
        </Button>
      )}

      {castActive && (
        <Alert severity="success" icon={<CastConnected />} sx={{ mt: 1.5 }}>
          กำลังออกเสียงไปที่ทีวี/ลำโพง (หยุดเล่นในหน้านี้)
        </Alert>
      )}

      {muted && (
        <Alert
          severity="warning"
          icon={<VolumeOff />}
          sx={{ mt: 1.5, '& .MuiAlert-action': { alignItems: 'center' } }}
          action={
            <Button color="inherit" size="small" variant="contained" onClick={onUnmute}>
              เปิดเสียง
            </Button>
          }
        >
          กำลังเล่นแบบเงียบ (เบราว์เซอร์บล็อกเสียงอัตโนมัติ) — แตะที่หน้าเว็บหรือกดปุ่มเพื่อเปิดเสียง
        </Alert>
      )}
    </Paper>
  );
}
