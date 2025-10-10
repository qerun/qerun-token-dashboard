import { useEffect, useState } from 'react';
import './styles/qerunTheme.module.css';
import Swap from './components/Swap';
import AdminPanel from './components/AdminPanel';
import Connect from './components/Connect';
import Logo from './components/Logo';
import NetworkManager from './components/NetworkManager';
import Metrics, { type MetricsData } from './components/Metrics';
import { ThemeProvider, createTheme, CssBaseline, Container, Paper, Typography, Box, Stack } from '@mui/material';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [metrics, setMetrics] = useState<MetricsData>({
    swapUsdBalance: '0',
    swapQerBalance: '0',
    usdTotalSupply: '0',
    qerTotalSupply: '0',
  });
  // Build a theme that pulls your CSS variable colors
  const readVar = (name: string, fallback: string) => {
    if (typeof document === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  const makeTheme = () => {
    const gold = readVar('--qerun-gold', '#f7d976');
    const accent = readVar('--qerun-accent', '#8b5800');
    const bg = readVar('--qerun-bg', '#120806');
    const card = readVar('--qerun-card', 'rgba(255,255,255,0.08)');
    const text = readVar('--qerun-text', '#fff1d0');
    const textMuted = readVar('--qerun-text-muted', '#ffefc9');
    const divider = readVar('--qerun-gold-alpha-25', 'rgba(247,217,118,0.25)');
    const btnText = readVar('--qerun-button-text', '#2d0e0e');

    return createTheme({
      palette: {
        mode: 'dark',
        primary: { main: gold, contrastText: btnText },
        secondary: { main: accent },
        background: { default: bg, paper: card },
        text: { primary: text, secondary: textMuted },
        divider,
      },
      shape: { borderRadius: 16 },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              background: card,
              border: `1px solid ${divider}`,
              backdropFilter: 'blur(10px)'
            }
          }
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 'var(--qerun-radius-xl, 16px)',
              boxShadow: '0 8px 24px 0 #f7d97699',
            },
            containedPrimary: {
              boxShadow: '0 8px 24px 0 #f7d97699',
              '&:hover': { boxShadow: '0 12px 28px 0 #f7d976aa' }
            }
          }
        }
      }
    });
  };

  const [theme, setTheme] = useState(() => makeTheme());
  useEffect(() => { setTheme(makeTheme()); }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at 20% -10%, var(--qerun-gold-alpha-45), transparent 55%),\n             radial-gradient(circle at 80% 0%, var(--qerun-accent-alpha-40), transparent 60%), var(--qerun-bg)',
          color: 'var(--qerun-text)'
        }}
      >
        <Logo />
        <Container maxWidth={false} disableGutters sx={{ py: { xs: 4, md: 8 } }}>
          <Box sx={{
            width: { xs: '100vw', md: 'auto' },
            maxWidth: { xs: '100%', md: 1200 },
            mx: 'auto',
            px: { xs: 2, md: 0 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 4,
            alignItems: 'stretch'
          }}>
            <Box>
              <Swap refreshKey={refreshKey} onMetricsUpdate={setMetrics} />
            </Box>
            <Box>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 'var(--qerun-radius-xl)', border: '1px solid var(--qerun-gold-alpha-25)', backdropFilter: 'blur(10px)', background: 'var(--qerun-card)' }}>
                <Stack spacing={2}>
                  <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
                    <Connect />
                  </Box>
                  <Typography variant="h5" sx={{ color: 'var(--qerun-gold)', fontWeight: 700 }}>Network & Status</Typography>
                  <Metrics {...metrics} />
                  <NetworkManager onAfterSwitch={() => setRefreshKey((v) => v + 1)} />
                </Stack>
              </Paper>
            </Box>
          </Box>

          <Box sx={{ mt: 4 }}>
            <AdminPanel />
          </Box>

          {/* Floating connect button only on desktop/tablet to avoid overlap on mobile */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'fixed', right: 20, bottom: 20 }}>
            <Connect />
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App
