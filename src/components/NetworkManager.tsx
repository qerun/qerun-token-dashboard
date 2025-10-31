import React from 'react';
import { Button, Stack } from '@mui/material';
import { addTokenToWallet, switchToNetwork, getNetworkName } from '../utils/wallet';
import type { TokenInfo } from '../utils/wallet';
import { CONTRACT_CONFIG, REGISTRY_IDS } from '../config';
import { ethers } from 'ethers';
import StateManagerAbi from '../abi/StateManager.json';

type Props = {
  onAfterSwitch?: () => void;
};

const NetworkManager: React.FC<Props> = ({ onAfterSwitch }) => {
  // Helper to fetch on-chain token metadata
  const fetchTokenMetadata = async (tokenAddress: string, provider: any): Promise<{ symbol: string; decimals: number }> => {
    try {
      // Fetch symbol
      const symbolCallData = '0x' + '95d89b41'; // symbol()
      const symbolRes: string = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data: symbolCallData }, 'latest'],
      });
      let symbol = 'UNKNOWN';
      if (symbolRes && symbolRes !== '0x') {
        const hex = symbolRes.replace(/^0x/, '');
        const lenHex = hex.slice(64, 128);
        const len = parseInt(lenHex, 16);
        if (!Number.isNaN(len) && len > 0) {
          const dataHex = hex.slice(128, 128 + len * 2);
          const buf = Buffer.from(dataHex, 'hex');
          symbol = buf.toString('utf8');
        }
      }

      // Fetch decimals
      const decimalsCallData = '0x' + '313ce567'; // decimals()
      const decimalsRes: string = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data: decimalsCallData }, 'latest'],
      });
      let decimals = 18; // default
      if (decimalsRes && decimalsRes !== '0x') {
        decimals = parseInt(decimalsRes.replace(/^0x/, ''), 16);
        if (Number.isNaN(decimals)) decimals = 18;
      }

      return { symbol, decimals };
    } catch (err) {
      console.warn('Failed to fetch token metadata on-chain', err);
      return { symbol: 'UNKNOWN', decimals: 18 };
    }
  };

  const handleAddQER = async () => {
    // Resolve QER token address strictly from StateManager. Do not fall back to config.
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

      const { symbol, decimals } = await fetchTokenMetadata(addr, provider);

      const tokenToAdd: TokenInfo = {
        address: addr,
        symbol,
        decimals,
        image: undefined, // No image
      }

      const success = await addTokenToWallet(tokenToAdd);
      if (success) alert('QER token added to wallet!')
    } catch (err) {
      console.error('Failed to resolve QER address from StateManager', err)
      alert('Failed to resolve QER address from StateManager')
    }
  };

  const handleAddUSDQ = async () => {
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

      const { symbol, decimals } = await fetchTokenMetadata(quoteAddr, provider);

      const tokenToAdd: TokenInfo = {
        address: quoteAddr,
        symbol,
        decimals,
        image: undefined, // No image
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
