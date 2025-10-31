import React from 'react';
import { Button, Stack } from '@mui/material';
import { addTokenToWallet, switchToNetwork, getNetworkName } from '../utils/wallet';
import type { TokenInfo } from '../utils/wallet';
import { TOKENS } from '../config/tokens';
import { CONTRACT_CONFIG, REGISTRY_IDS } from '../config';
import { ethers } from 'ethers';
import StateManagerAbi from '../abi/StateManager.json';

type Props = {
  onAfterSwitch?: () => void;
};

const NetworkManager: React.FC<Props> = ({ onAfterSwitch }) => {
  const handleAddQER = async () => {
    // Resolve QER token address strictly from StateManager. Do not fall back to config.
    // Require StateManager to provide the MAIN_CONTRACT address. Do not fall back to config.
    if (!CONTRACT_CONFIG.stateManager) {
      alert('StateManager is not configured for this build. Cannot resolve MAIN_CONTRACT.')
      return
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum as any);
      const sm = new ethers.Contract(CONTRACT_CONFIG.stateManager as string, StateManagerAbi.abi, provider as any);
      const has = await sm.has(REGISTRY_IDS.MAIN_CONTRACT);
      if (!has) {
        alert('Could not find QER token address in StateManager')
        return
      }
      const addr = await sm.addressOf(REGISTRY_IDS.MAIN_CONTRACT);
      if (!addr || addr === ethers.ZeroAddress) {
        alert('Could not find QER token address in StateManager')
        return
      }

      const tokenToAdd: TokenInfo = {
        address: addr,
        symbol: TOKENS.QER.symbol,
        decimals: TOKENS.QER.decimals,
        image: TOKENS.QER.image,
      }

      const success = await addTokenToWallet(tokenToAdd);
      if (success) alert('QER token added to wallet!')
    } catch (err) {
      console.error('Failed to resolve QER address from StateManager', err)
      alert('Failed to resolve QER address from StateManager')
    }
  };

  const handleAddUSDQ = async () => {
    // Resolve USDQ (PRIMARY_QUOTE) strictly from StateManager. Do not fall back.
    // Require StateManager to provide the PRIMARY_QUOTE address. Do not fall back to config.
    if (!CONTRACT_CONFIG.stateManager) {
      alert('StateManager is not configured for this build. Cannot resolve PRIMARY_QUOTE.')
      return
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum as any);
      const sm = new ethers.Contract(CONTRACT_CONFIG.stateManager as string, StateManagerAbi.abi, provider as any);
      const has = await sm.has(REGISTRY_IDS.PRIMARY_QUOTE);
      if (!has) {
        alert("Couldn't find the quote address in StateManager")
        return
      }
      const quoteAddr = await sm.addressOf(REGISTRY_IDS.PRIMARY_QUOTE);
      if (!quoteAddr || quoteAddr === ethers.ZeroAddress) {
        alert("Couldn't find the quote address in StateManager")
        return
      }

      const tokenToAdd: TokenInfo = {
        address: quoteAddr,
        symbol: TOKENS.USDQ.symbol,
        decimals: TOKENS.USDQ.decimals,
        image: TOKENS.USDQ.image,
      }

      const success = await addTokenToWallet(tokenToAdd);
      if (success) alert('USDQ token added to wallet!')
    } catch (err) {
      console.error('Failed to resolve PRIMARY_QUOTE from StateManager', err)
      alert('Failed to resolve PRIMARY_QUOTE from StateManager')
    }
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
