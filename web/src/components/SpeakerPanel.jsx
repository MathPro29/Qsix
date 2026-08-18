import { FormControl, InputLabel, MenuItem, Paper, Select, Typography } from '@mui/material';
import { Speaker } from '@mui/icons-material';

export default function SpeakerPanel({ speakers, value, onChange }) {
  // speakers เป็น null/undefined -> เบราว์เซอร์ไม่รองรับ หรือยังโหลดไม่เสร็จ
  if (!speakers) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        ลำโพง (เครื่องนี้)
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        เลือกอุปกรณ์เสียงที่เครื่องเล่นนี้ใช้ (ต้องใช้ Chrome/Edge)
      </Typography>
      <FormControl fullWidth size="small" disabled={!speakers.length}>
        <InputLabel id="speaker-label">
          <Speaker fontSize="small" /> อุปกรณ์เสียง
        </InputLabel>
        <Select
          labelId="speaker-label"
          label="อุปกรณ์เสียง"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {speakers.map((d) => (
            <MenuItem key={d.deviceId} value={d.deviceId}>
              {d.label || 'อุปกรณ์เสียง'}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );
}
