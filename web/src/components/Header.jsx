import { AppBar, Box, Chip, Toolbar, Typography } from '@mui/material';
import { QueueMusic, Wifi, WifiOff } from '@mui/icons-material';

export default function Header({ connected }) {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ bgcolor: 'rgba(23, 23, 40, 0.8)', backdropFilter: 'blur(10px)', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
          }}
        >
          <QueueMusic />
        </Box>
        <Box>
          <Typography variant="h6" lineHeight={1.15}>
            คิวเพลง
          </Typography>
          <Typography variant="caption" color="text.secondary">
            รวมลิงก์จากทุกแพลตฟอร์ม เล่นต่อเนื่องจนจบคิว
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Chip
          icon={connected ? <Wifi /> : <WifiOff />}
          label={connected ? 'เชื่อมต่อแล้ว' : 'ตัดการเชื่อมต่อ'}
          color={connected ? 'success' : 'error'}
          variant="outlined"
        />
      </Toolbar>
    </AppBar>
  );
}
