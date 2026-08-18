import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Devices, Edit, GraphicEq, VolumeUp } from '@mui/icons-material';

export default function SourcePanel({ clients, masterId, myId, myName, onSetMaster, onSetName }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(myName);

  const saveName = () => {
    setEditing(false);
    const v = draft.trim();
    if (v) onSetName(v);
    else setDraft(myName);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        อุปกรณ์ในห้อง & เลือก Source เสียง
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        คุณสามารถเปลี่ยน Source เสียงไปให้อุปกรณ์ไหนออกเสียงก็ได้ที่ Join อยู่
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
        {editing ? (
          <TextField
            size="small"
            fullWidth
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            onBlur={saveName}
            placeholder="ตั้งชื่อเครื่องนี้"
          />
        ) : (
          <>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              เครื่องนี้: <b>{myName}</b>
            </Typography>
            <Tooltip title="เปลี่ยนชื่อเครื่องนี้">
              <IconButton
                size="small"
                onClick={() => {
                  setDraft(myName);
                  setEditing(true);
                }}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {clients.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5 }}>
          ยังไม่มีเครื่องอื่นเชื่อมต่อ
        </Typography>
      ) : (
        <List dense disablePadding>
          {clients.map((c) => {
            const isSelf = c.id === myId;
            const isMaster = c.id === masterId;
            return (
              <ListItem
                key={c.id}
                disableGutters
                sx={{
                  px: 1,
                  py: 0.75,
                  borderRadius: 2,
                  mb: 0.75,
                  bgcolor: isMaster
                    ? (isSelf ? 'rgba(34, 197, 94, 0.15)' : 'rgba(124, 58, 237, 0.15)')
                    : 'background.default',
                  border: 1,
                  borderColor: isMaster
                    ? (isSelf ? 'success.main' : 'primary.main')
                    : 'divider',
                  cursor: isMaster ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: isMaster
                      ? undefined
                      : 'action.hover',
                  },
                }}
                onClick={() => {
                  if (!isMaster && onSetMaster) onSetMaster(c.id);
                }}
                secondaryAction={
                  isMaster ? (
                    <Chip
                      icon={<VolumeUp />}
                      label={isSelf ? "แหล่งเสียงหลัก (เครื่องนี้)" : "แหล่งเสียงหลัก"}
                      color={isSelf ? "success" : "primary"}
                      size="small"
                      variant="filled"
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<GraphicEq />}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSetMaster) onSetMaster(c.id);
                      }}
                      sx={{ borderRadius: 2 }}
                    >
                      เลือกเป็น Source เสียง
                    </Button>
                  )
                }
              >
                <ListItemIcon sx={{ minWidth: 34, color: isMaster ? (isSelf ? 'success.main' : 'primary.main') : 'text.secondary' }}>
                  <Devices />
                </ListItemIcon>
                <ListItemText
                  primary={c.name + (isSelf ? ' (เครื่องนี้)' : '')}
                  primaryTypographyProps={{
                    noWrap: true,
                    fontWeight: isMaster ? 700 : 500,
                    color: isMaster ? 'text.primary' : 'text.secondary',
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
