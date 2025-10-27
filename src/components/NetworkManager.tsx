import React from 'react';
import { Button, Stack } from '@mui/material';
import { addTokenToWallet, switchToLocalhost } from '../utils/wallet';
import { TOKENS } from '../config/tokens';

type Props = {
  onAfterSwitch?: () => void;
};

const NetworkManager: React.FC<Props> = ({ onAfterSwitch }) => {
  const handleAddQER = async () => {
    const success = await addTokenToWallet(TOKENS.QER);
    if (success) alert('QER token added to wallet!');
  };

  const handleAddUSDQ = async () => {
    const success = await addTokenToWallet(TOKENS.USDQ);
    if (success) alert('USDQ token added to wallet!');
  };

  const handleSwitchNetwork = async () => {
    await switchToLocalhost();
    onAfterSwitch?.();
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button
        color="primary"
        variant="contained"
        onClick={handleSwitchNetwork}
        sx={{ background: 'var(--qerun-button-bg)', color: 'var(--qerun-button-text)', borderRadius: 'var(--qerun-radius-xl, 16px)' }}
      >
        Switch to Sepolia
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={handleAddQER}
        sx={{ background: 'var(--qerun-button-bg)', color: 'var(--qerun-button-text)', borderRadius: 'var(--qerun-radius-xl, 16px)' }}
      >
        Add QER Token
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={handleAddUSDQ}
        sx={{ background: 'var(--qerun-button-bg)', color: 'var(--qerun-button-text)', borderRadius: 'var(--qerun-radius-xl, 16px)' }}
      >
        Add USDQ Token
      </Button>
    </Stack>
  );
};

export default NetworkManager;
