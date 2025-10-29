import React from 'react';
import { Button, Stack } from '@mui/material';
import { addTokenToWallet, switchToNetwork, getNetworkName } from '../utils/wallet';
import { TOKENS } from '../config/tokens';
import { CONTRACT_CONFIG } from '../config';

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
    if (!CONTRACT_CONFIG.chainId) {
      alert('No chain ID configured');
      return;
    }
    try {
      await switchToNetwork(CONTRACT_CONFIG.chainId);
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
    onAfterSwitch?.();
  };

  const networkName = CONTRACT_CONFIG.chainId ? getNetworkName(CONTRACT_CONFIG.chainId) : 'Configured Network';

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button
        color="primary"
        variant="contained"
        onClick={handleSwitchNetwork}
        sx={{
          borderRadius: 'var(--qerun-radius-xl, 16px)'
        }}
      >
        Switch to {networkName}
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={handleAddQER}
        sx={{
          borderRadius: 'var(--qerun-radius-xl, 16px)'
        }}
      >
        Add QER Token
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={handleAddUSDQ}
        sx={{
          borderRadius: 'var(--qerun-radius-xl, 16px)'
        }}
      >
        Add USDQ Token
      </Button>
    </Stack>
  );
};

export default NetworkManager;
