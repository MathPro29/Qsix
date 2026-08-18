import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#8b5cf6', light: '#a78bfa', dark: '#6d28d9' },
    secondary: { main: '#ec4899' },
    background: { default: '#0d0d18', paper: '#171728' },
    divider: '#2a2a44',
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    text: { primary: '#f2f1f9', secondary: '#a6a3c3' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Roboto","Noto Sans Thai","Segoe UI",Tahoma,system-ui,sans-serif',
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: '1px solid #2a2a44' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});
