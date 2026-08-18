import {
  Alert,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { Cast, Refresh, StopCircle, Tv } from '@mui/icons-material';

export default function CastPanel({ devices, cast, searching, onRefresh, onStart, onStop }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          ต่อออกทีวี / ลำโพง
        </Typography>
        <Tooltip title="ค้นหาอุปกรณ์บนเครือข่าย">
          <IconButton size="small" onClick={onRefresh} disabled={searching}>
            <Refresh className={searching ? 'spin' : ''} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        หาอุปกรณ์ DLNA ในเครือข่ายเดียวกัน (สมาร์ททีวี, soundbar, ลำโพง Wi-Fi)
      </Typography>

      {devices.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
          <Tv sx={{ fontSize: 36, opacity: 0.35 }} />
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            ยังไม่พบอุปกรณ์ — กดปุ่มค้นหา แล้วตรวจว่าเปิด DLNA ไว้
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {devices.map((d) => {
            const active = cast.active && cast.device && cast.device.id === d.id;
            return (
              <ListItem
                key={d.id}
                disableGutters
                sx={{ px: 1, py: 0.5, borderRadius: 2, bgcolor: 'background.default', mb: 0.5 }}
                secondaryAction={
                  <Button
                    size="small"
                    variant={active ? 'contained' : 'outlined'}
                    color={active ? 'success' : 'primary'}
                    onClick={() => onStart(d)}
                    disabled={active}
                    startIcon={<Cast />}
                  >
                    {active ? 'กำลังเล่น' : 'Cast'}
                  </Button>
                }
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  <Cast color={active ? 'success' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary={d.name} primaryTypographyProps={{ noWrap: true, fontWeight: 600 }} />
              </ListItem>
            );
          })}
        </List>
      )}

      {cast.active && (
        <Alert
          severity="success"
          action={
            <Button color="inherit" size="small" startIcon={<StopCircle />} onClick={onStop}>
              หยุด
            </Button>
          }
          sx={{ mt: 1 }}
        >
          กำลังเล่นที่ "{cast.device ? cast.device.name : 'อุปกรณ์'}"
        </Alert>
      )}
    </Paper>
  );
}
