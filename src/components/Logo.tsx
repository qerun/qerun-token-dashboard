import React from 'react';
import { Box } from '@mui/material';

const Logo: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: { xs: 16, md: 20 },
        left: { xs: 16, md: 20 },
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        zIndex: 1001,
      }}
    >
      <Box
        component="img"
        src="/logo.png"
        alt="Qerun crown logo"
        width={{ xs: 48, md: 96 }}
        height={{ xs: 48, md: 96 }}
        sx={{ filter: 'drop-shadow(0 4px 12px var(--qerun-gold-alpha-35))' }}
      />
    </Box>
  );
};

export default Logo;
