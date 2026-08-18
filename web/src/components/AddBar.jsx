import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Add, Forward, Link, MusicNote, PlaylistAdd, Search } from '@mui/icons-material';
import { detectPlatform, fmt, platformStyle } from '../platform';

export default function AddBar({ mode, setMode, onAdd, onSearch, searchResults, onAddResult, msg }) {
  const [text, setText] = useState('');

  const platform = mode === 'link' ? detectPlatform(text) : '';
  const style = platformStyle(platform);

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    if (mode === 'search' || !/^https?:\/\//i.test(v)) {
      // โหมดค้นหา หรือพิมพ์คำที่ไม่ใช่ลิงก์ -> ค้นหา
      if (mode !== 'search') setMode('search');
      onSearch(v);
    } else {
      onAdd(v, false);
      setText('');
    }
  };

  const addNow = () => {
    const v = text.trim();
    if (!v || !/^https?:\/\//i.test(v)) return;
    onAdd(v, true);
    setText('');
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, v) => v && setMode(v)}
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="link" startIcon={<Link fontSize="small" />}>
          ลิงก์
        </ToggleButton>
        <ToggleButton value="search" startIcon={<Search fontSize="small" />}>
          ค้นหา
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {platform && (
          <Chip label={platform} sx={{ color: style.color, bgcolor: style.bg, mt: 1.4 }} />
        )}
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          sx={{ flex: 1, minWidth: 240 }}
          placeholder={
            mode === 'link'
              ? 'วางลิงก์เพลง (YouTube / Spotify / SoundCloud / …)'
              : 'พิมพ์ชื่อเพลงหรือศิลปิน แล้วกดค้นหา'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button variant="contained" startIcon={<PlaylistAdd />} onClick={submit} sx={{ mt: 0.5 }}>
          เพิ่มเข้ารอ
        </Button>
        <Button variant="outlined" startIcon={<Forward />} onClick={addNow} title="เพิ่มแล้วเล่นเลย" sx={{ mt: 0.5 }}>
          เล่นเลย
        </Button>
      </Box>

      {searchResults.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 1.5, overflow: 'hidden' }}>
          <List dense disablePadding>
            {searchResults.map((t, i) => (
              <ListItem key={i} divider secondaryAction={
                <Button size="small" startIcon={<Add />} onClick={() => onAddResult(t.url)}>
                  เพิ่ม
                </Button>
              }>
                <ListItemAvatar>
                  <Avatar variant="rounded" src={t.thumbnail} sx={{ bgcolor: 'action.hover' }}>
                    <MusicNote />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={t.title}
                  primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
                  secondary={`${t.artist || ''} · ${fmt(t.duration)}`}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {msg && (
        <Alert severity={msg.severity || 'info'} sx={{ mt: 1.5 }} onClose={() => msg.clear?.()}>
          <Typography variant="body2">{msg.text}</Typography>
        </Alert>
      )}
    </Paper>
  );
}
