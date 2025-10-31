import React from 'react';
import { Button, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { switchToNetwork, getNetworkName } from '../utils/wallet';
import { CONTRACT_CONFIG, REGISTRY_IDS } from '../config';
import { ethers } from 'ethers';
import StateManagerAbi from '../abi/StateManager.json';
import TokenAbi from '../abi/Token.json';

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

  

  const handleFundMeUSDQ = async () => {
    // Send/mint 200 USDQ to the connected wallet using the Token.mint function.
    if (!CONTRACT_CONFIG.stateManager) {
      alert('StateManager is not configured for this build. Cannot resolve PRIMARY_QUOTE.');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum as any);
      const sm = new ethers.Contract(CONTRACT_CONFIG.stateManager as string, StateManagerAbi.abi, provider as any);
      const has = await sm.has(REGISTRY_IDS.PRIMARY_QUOTE);
      if (!has) {
        alert("Couldn't find the quote address in StateManager");
        return;
      }
      const quoteAddr = await sm.addressOf(REGISTRY_IDS.PRIMARY_QUOTE);
      if (!quoteAddr || quoteAddr === ethers.ZeroAddress) {
        alert("Couldn't find the quote address in StateManager");
        return;
      }

      const { decimals } = await fetchTokenMetadata(quoteAddr, provider);

      // Get signer and user address
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Create Token contract connected to signer
      const token = new ethers.Contract(quoteAddr, TokenAbi.abi, signer as any);

      // Calculate amount: 200 * 10^decimals
      const amount = BigInt(200) * (BigInt(10) ** BigInt(decimals));

      const tx = await token.mint(userAddress, amount);
      // wait for confirmation if available
      if (tx && typeof tx.wait === 'function') await tx.wait();

      alert('200 USDQ has been minted to your wallet (test only).');
    } catch (err) {
      console.error('Failed to mint USDQ to wallet', err);
      alert('Failed to fund wallet with USDQ');
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

  const theme = useTheme();

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
        onClick={handleFundMeUSDQ}
        sx={{
          borderRadius: 'var(--qerun-radius-xl, 16px)',
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.getContrastText(theme.palette.primary.main),
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
          },
        }}
      >
        Fund me 200 USDQ (test)
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={() => window.open('https://faucet.quicknode.com/binance-smart-chain/bnb-testnet', '_blank')}
        sx={{
          borderRadius: 'var(--qerun-radius-xl, 16px)',
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.getContrastText(theme.palette.primary.main),
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
          },
        }}
      >
        Get BNB (faucet)
      </Button>
    </Stack>
  );
};

export default NetworkManager;
