import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowDownward,
  ArrowUpward,
  ClearAll,
  DeleteOutline,
  ErrorOutline,
  GraphicEq,
  HourglassTop,
  MusicNote,
  PlayArrow,
} from '@mui/icons-material';
import { fmt, platformStyle } from '../platform';

export default function QueueList({ items, currentId, onRemove, onMove, onPlayNow, onClear }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          คิวเพลง
          <Chip label={items.length} size="small" color="primary" sx={{ ml: 1 }} />
        </Typography>
        <Button size="small" color="error" startIcon={<ClearAll />} onClick={onClear} disabled={!items.length}>
          ล้างคิว
        </Button>
      </Box>

      {items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
          <MusicNote sx={{ fontSize: 44, opacity: 0.4 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            คิวว่าง — เพิ่มลิงก์เพลงด้านบนเลย
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {items.map((it, idx) => {
            const isPlaying = it.id === currentId;
            const pStyle = platformStyle(it.platform);
            const resolving = it.status === 'resolving';
            const failed = it.status === 'error';
            return (
              <ListItem
                key={it.id}
                disableGutters
                sx={{
                  px: 1.5,
                  py: 0.75,
                  mb: 0.75,
                  borderRadius: 2.5,
                  bgcolor: isPlaying ? 'rgba(139, 92, 246, 0.12)' : 'background.default',
                  border: 1,
                  borderColor: isPlaying ? 'primary.main' : 'transparent',
                  opacity: it.status === 'done' ? 0.55 : 1,
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="เล่นเลย">
                      <span>
                        <IconButton size="small" onClick={() => onPlayNow(it.id)} disabled={resolving || failed}>
                          <PlayArrow fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="เลื่อนขึ้น">
                      <span>
                        <IconButton size="small" onClick={() => onMove(it.id, -1)} disabled={idx === 0}>
                          <ArrowUpward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="เลื่อนลง">
                      <span>
                        <IconButton size="small" onClick={() => onMove(it.id, 1)} disabled={idx === items.length - 1}>
                          <ArrowDownward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton size="small" onClick={() => onRemove(it.id)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    variant="rounded"
                    src={it.thumbnail || undefined}
                    sx={{ bgcolor: 'action.hover', width: 46, height: 46 }}
                  >
                    {isPlaying ? (
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.35, color: 'secondary.main' }}>
                        <Bar d={0} />
                        <Bar d={0.2} />
                        <Bar d={0.4} />
                      </Box>
                    ) : (
                      <MusicNote fontSize="small" />
                    )}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {isPlaying && <GraphicEq sx={{ fontSize: 16, color: 'secondary.main' }} />}
                      <Typography variant="body2" noWrap component="span">
                        {it.title}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ fontWeight: 600 }}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.25 }}>
                      <Chip
                        label={it.platform}
                        sx={{ color: pStyle.color, bgcolor: pStyle.bg, height: 20, fontSize: 11 }}
                      />
                      {it.artist && (
                        <Typography variant="caption" component="span" color="text.secondary">
                          {it.artist}
                        </Typography>
                      )}
                      {!!it.duration && (
                        <Typography variant="caption" component="span" color="text.secondary">
                          {fmt(it.duration)}
                        </Typography>
                      )}
                      {resolving && (
                        <Chip icon={<HourglassTop fontSize="inherit" />} label="กำลังโหลด" color="warning" variant="outlined" />
                      )}
                      {failed && (
                        <Chip
                          icon={<ErrorOutline fontSize="inherit" />}
                          label={it.error || 'โหลดไม่ได้'}
                          color="error"
                          variant="outlined"
                          sx={{ maxWidth: 260 }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}

function Bar({ d }) {
  return (
    <Box
      sx={{
        width: 3,
        borderRadius: 2,
        animation: 'eq 1s infinite ease-in-out',
        animationDelay: `${d}s`,
        '@keyframes eq': {
          '0%, 100%': { height: 5 },
          '50%': { height: 18 },
        },
        height: 5,
        bgcolor: 'secondary.main',
      }}
    />
  );
}
