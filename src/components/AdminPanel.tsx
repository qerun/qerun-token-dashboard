import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { Paper, Typography, Stack, Box, Button, TextField, Chip, Alert } from '@mui/material';
import SwapAbi from '../abi/Swap.json';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG, REGISTRY_IDS } from '../config';
import { useAccount } from 'wagmi';
import RegistryManager from './RegistryManager';
import TokenMinter from './TokenMinter';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const AdminPanel: React.FC = () => {
  const { address: activeAccount, isConnected } = useAccount();
  const [currentPairs, setCurrentPairs] = useState<string[]>([]);
  const [draftPairs, setDraftPairs] = useState<string[]>([]);
  const [inputAddress, setInputAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [treasuryAddress, setTreasuryAddress] = useState<string | null>(null);
  const [treasuryQerBalance, setTreasuryQerBalance] = useState<string | null>(null);
  const [treasuryUsdBalance, setTreasuryUsdBalance] = useState<string | null>(null);
  const [qerTokenAddress, setQerTokenAddress] = useState<string | null>(null);
  const [govTargetAddress, setGovTargetAddress] = useState('');
  const [govOperation, setGovOperation] = useState('');
  const [govModuleAddress, setGovModuleAddress] = useState('');
  const [govStatus, setGovStatus] = useState<string | null>(null);
  const [govLoading, setGovLoading] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean>(false);

  const hasWallet = useMemo(() => Boolean(window.ethereum), []);

  const checkAdminAccess = useCallback(async () => {
    if (!window.ethereum || !activeAccount || !isConnected) {
      setHasAdminAccess(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);

      const smAddress = CONTRACT_CONFIG.stateManager as string | undefined;
      if (!smAddress) {
        setHasAdminAccess(false);
        setStatus('StateManager is not configured for this build.');
        return;
      }

      // Defensive: ensure a contract exists at the configured address on the connected provider
      // Some test environments or providers (mocked BrowserProvider) may not implement getCode.
      if (typeof (provider as any).getCode === 'function') {
        try {
          const code = await (provider as any).getCode(smAddress);
          if (!code || code === '0x') {
            setHasAdminAccess(false);
            setStatus('No StateManager contract found on the connected network. Please switch networks in your wallet.');
            return;
          }
        } catch (getCodeErr) {
          console.error('getCode error:', getCodeErr);
          setHasAdminAccess(false);
          setStatus('Unable to verify StateManager bytecode on the connected network.');
          return;
        }
      } else {
        // Provider doesn't support getCode (likely test mocks). Skip bytecode check.
        // Proceed to hasRole call which tests may mock.
      }

      const stateManager = new ethers.Contract(smAddress, StateManagerAbi.abi, provider);

      // Check if user has the DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      try {
        const hasAdminRole = await stateManager.hasRole(DEFAULT_ADMIN_ROLE, activeAccount);
        setHasAdminAccess(hasAdminRole);
      } catch (callErr) {
        console.error('hasRole call failed:', callErr);
        setHasAdminAccess(false);
        setStatus('Failed to check admin role via the connected wallet provider. Try switching network or using a different RPC/wallet.');
      }
    } catch (err) {
      console.error('Failed to check admin access:', err);
      setHasAdminAccess(false);
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }, [activeAccount, isConnected]);

  const normaliseAddress = (value: string) => {
    try {
      return ethers.getAddress(value.trim());
    } catch {
      return null;
    }
  };

  const loadPairs = useCallback(async () => {
    if (!window.ethereum) {
      setStatus('Wallet not detected. Connect to load existing pairs.');
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager!, StateManagerAbi.abi, provider);
  const addressOf = stateManager.getFunction('addressOf(string)');
      const hasEntry = (() => {
        try {
          return stateManager.getFunction('has(bytes32)');
        } catch {
          return undefined;
        }
      })();

      const requireAddress = async (id: string, label: string) => {
        if (hasEntry) {
          try {
            const has = await hasEntry(id);
            if (!has) throw new Error(label);
          } catch {
            throw new Error(label);
          }
        }
        try {
          return await addressOf(id);
        } catch {
          throw new Error(label);
        }
      };

      const swapAddr = await requireAddress(REGISTRY_IDS.SWAP_CONTRACT, 'StateManager missing swap contract address');
      const quoteAddr = await requireAddress(REGISTRY_IDS.PRIMARY_QUOTE, 'StateManager missing quote token address');
      const qerAddr = await requireAddress(REGISTRY_IDS.MAIN_CONTRACT, 'StateManager missing QER token address');
      const treasuryAddr = await requireAddress(REGISTRY_IDS.TREASURY, 'StateManager missing treasury address');

      setQerTokenAddress(qerAddr);
      setTreasuryAddress(treasuryAddr);

      try {
        const qerToken = new ethers.Contract(qerAddr, ERC20_ABI, provider);
        const balance = await qerToken.balanceOf(treasuryAddr);
        setTreasuryQerBalance(ethers.formatUnits(balance, 18));
      } catch {
        setTreasuryQerBalance(null);
      }

      try {
        const usdToken = new ethers.Contract(quoteAddr, ERC20_ABI, provider);
        const balance = await usdToken.balanceOf(treasuryAddr);
        setTreasuryUsdBalance(ethers.formatUnits(balance, 6)); // USD token has 6 decimals
      } catch {
        setTreasuryUsdBalance(null);
      }

      const contract = new ethers.Contract(swapAddr, SwapAbi.abi, provider);
      const pairs: string[] = await contract.allPairs();
      const normalised = pairs.map(addr => ethers.getAddress(addr));
      setCurrentPairs(normalised);
      setDraftPairs(normalised);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load pairs: ${message}`);
      setTreasuryAddress(null);
      setTreasuryQerBalance(null);
      setTreasuryUsdBalance(null);
      setQerTokenAddress(null);
    }
  }, []);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);

  useEffect(() => {
    checkAdminAccess();
  }, [checkAdminAccess]);

  const handleAdd = () => {
    const normalised = normaliseAddress(inputAddress);
    if (!normalised) {
      setStatus('Enter a valid Ethereum address.');
      return;
    }
    if (draftPairs.includes(normalised)) {
      setStatus('That address is already in the list.');
      return;
    }
    setDraftPairs(prev => [...prev, normalised]);
    setInputAddress('');
    setStatus(null);
  };

  const handleRemove = (address: string) => {
    setDraftPairs(prev => prev.filter(item => item !== address));
  };

  const handleReset = () => {
    setDraftPairs(currentPairs);
    setStatus(null);
  };

  const handleIncludeDefault = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager!, StateManagerAbi.abi, provider);
      const quoteAddr = await stateManager.addressOf(REGISTRY_IDS.PRIMARY_QUOTE);
      const checksummed = normaliseAddress(quoteAddr);
      if (!checksummed) return;
      if (!draftPairs.includes(checksummed)) {
        setDraftPairs(prev => [...prev, checksummed]);
      }
    } catch {
      // ignore
    }
  };

  const handleSetGovernanceModule = async () => {
    if (!window.ethereum) {
      setGovStatus('Connect a wallet with admin access to set governance modules.');
      return;
    }
    if (!govTargetAddress || !govModuleAddress) {
      setGovStatus('Target address and governance module address are required.');
      return;
    }

    const targetNormalised = normaliseAddress(govTargetAddress);
    const moduleNormalised = normaliseAddress(govModuleAddress);
    if (!targetNormalised || !moduleNormalised) {
      setGovStatus('Invalid Ethereum addresses provided.');
      return;
    }

    setGovLoading(true);
    setGovStatus('Submitting governance module transaction...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager!, StateManagerAbi.abi, signer);

      let tx;
      if (govOperation.trim()) {
        // Set governance module for specific operation
        const operationBytes32 = ethers.isHexString(govOperation) && govOperation.length === 66
          ? govOperation
          : ethers.id(govOperation);
        tx = await stateManager.setGovernanceModuleForOperation(targetNormalised, operationBytes32, moduleNormalised);
      } else {
        // Set global governance module for target
        tx = await stateManager.setGovernanceModule(targetNormalised, moduleNormalised);
      }

      await tx.wait();
      setGovStatus('Governance module set successfully.');
      setGovTargetAddress('');
      setGovOperation('');
      setGovModuleAddress('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGovStatus(`Failed to set governance module: ${message}`);
    } finally {
      setGovLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.ethereum) {
      setStatus('Connect a wallet with admin access to update pairs.');
      return;
    }

    setLoading(true);
    setStatus('Submitting pair update transaction...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager!, StateManagerAbi.abi, provider);
      const swapAddr = await stateManager.addressOf(REGISTRY_IDS.SWAP_CONTRACT);
      const contract = new ethers.Contract(swapAddr, SwapAbi.abi, signer);
      const tx = await contract.updatePairs(draftPairs);
      await tx.wait();
      setCurrentPairs(draftPairs);
      setStatus('Pairs updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to update pairs: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAdminAccess) {
    return null; // Don't render anything if user doesn't have admin access
  }

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 'var(--qerun-radius-xl)', border: '1px solid var(--qerun-gold-alpha-25)', backdropFilter: 'blur(10px)', background: 'var(--qerun-card)' }}>
      <Typography variant="h5" sx={{ color: 'var(--qerun-gold)', fontWeight: 700, m: 0 }}>Admin Controls</Typography>
      <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', mb: 2 }}>
        Manage the list of quote tokens that the swap contract recognises. The list you submit replaces the on-chain whitelist, so include every token you want to keep active.
      </Typography>

      {treasuryAddress && (
        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid var(--qerun-gold-alpha-18)', mb: 2 }}>
          <Typography variant="body2"><b>Treasury:</b> {treasuryAddress}</Typography>
          <Typography variant="body2"><b>QER Token:</b> {qerTokenAddress}</Typography>
          <Typography variant="body2"><b>Treasury QER Balance:</b> {treasuryQerBalance ?? '—'}</Typography>
          <Typography variant="body2"><b>Treasury USD Balance:</b> {treasuryUsdBalance ?? '—'}</Typography>
        </Box>
      )}

      {!hasWallet && (
        <Alert severity="warning" sx={{ mb: 2 }}>No wallet detected. Connect with an admin account to fetch or update pairs.</Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="0x quote token address"
          value={inputAddress}
          onChange={(e) => setInputAddress(e.target.value)}
        />
        <Button variant="contained" onClick={handleAdd}>Add</Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Button size="small" variant="contained" onClick={handleIncludeDefault}>Include USD token</Button>
        <Button size="small" variant="contained" onClick={handleReset}>Reset</Button>
        <Button size="small" variant="contained" onClick={loadPairs}>Refresh</Button>
      </Stack>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2">Draft pair list ({draftPairs.length}):</Typography>
        {draftPairs.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 1 }}>No tokens selected yet.</Typography>
        ) : (
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {draftPairs.map((address) => (
              <Chip key={address} label={address} onDelete={() => handleRemove(address)} variant="outlined" />
            ))}
          </Stack>
        )}
      </Box>

      <Button variant="contained" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Submitting…' : 'Submit updatePairs'}
      </Button>

      {status && (
        <Alert sx={{ mt: 2 }} severity={status.includes('failed') ? 'error' : 'success'}>{status}</Alert>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2">Current on-chain pairs ({currentPairs.length}):</Typography>
        {currentPairs.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 1 }}>No pairs registered yet.</Typography>
        ) : (
          <Stack component="ul" sx={{ pl: 2, mt: 1 }}>
            {currentPairs.map((address) => (
              <Box component="li" key={address} sx={{
                '& code': {
                  wordBreak: 'break-all',
                  whiteSpace: 'normal',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }
              }}>
                <code>{address}</code>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Box sx={{ mt: 3 }}>
        <RegistryManager hasWallet={hasWallet} />
      </Box>

      <Box sx={{ mt: 3 }}>
        <TokenMinter />
      </Box>

      <Box sx={{ mt: 3, p: 2, borderRadius: 2, border: '1px solid var(--qerun-gold-alpha-18)' }}>
        <Typography variant="h6" sx={{ color: 'var(--qerun-gold)', fontWeight: 600, mb: 2 }}>Governance Module Configuration</Typography>
        <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', mb: 2 }}>
          Configure governance modules for contracts. Leave operation empty for global governance, or specify an operation ID for operation-specific governance.
        </Typography>

        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Target Contract Address"
            placeholder="0x..."
            value={govTargetAddress}
            onChange={(e) => setGovTargetAddress(e.target.value)}
            helperText="The contract address to apply governance to"
          />
          <TextField
            fullWidth
            label="Operation ID (optional)"
            placeholder="swap, transfer, etc. or 0x..."
            value={govOperation}
            onChange={(e) => setGovOperation(e.target.value)}
            helperText="Leave empty for global governance, or specify operation (will be hashed to bytes32)"
          />
          <TextField
            fullWidth
            label="Governance Module Address"
            placeholder="0x..."
            value={govModuleAddress}
            onChange={(e) => setGovModuleAddress(e.target.value)}
            helperText="The governance module contract address"
          />
          <Button
            variant="contained"
            onClick={handleSetGovernanceModule}
            disabled={govLoading || !govTargetAddress || !govModuleAddress}
            sx={{ alignSelf: 'flex-start' }}
          >
            {govLoading ? 'Setting...' : 'Set Governance Module'}
          </Button>
        </Stack>

        {govStatus && (
          <Alert sx={{ mt: 2 }} severity={govStatus.includes('Failed') ? 'error' : 'success'}>
            {govStatus}
          </Alert>
        )}
      </Box>
    </Paper>
  );
};

export default AdminPanel;
