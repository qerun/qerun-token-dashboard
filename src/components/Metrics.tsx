import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export type MetricsData = {
  swapUsdBalance: string;
  swapQerBalance: string;
  usdTotalSupply: string;
  qerTotalSupply: string;
};

type Props = MetricsData;

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, background: 'var(--qerun-card)' }}>
    <Typography variant="caption" sx={{ color: 'var(--qerun-gold)' }}>{label}</Typography>
    <Typography variant="h6" sx={{ m: 0, color: 'var(--qerun-text-light)' }}>{value}</Typography>
  </Paper>
);

const Metrics: React.FC<Props> = ({ swapUsdBalance, swapQerBalance, usdTotalSupply, qerTotalSupply }) => {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <MetricCard label="Swap USD Balance" value={`${swapUsdBalance} USD`} />
      <MetricCard label="Swap QER Balance" value={`${swapQerBalance} QER`} />
      <MetricCard label="USDQ Total Supply" value={usdTotalSupply} />
      <MetricCard label="QER Total Supply" value={qerTotalSupply} />
    </Box>
  );
};

export default Metrics;
