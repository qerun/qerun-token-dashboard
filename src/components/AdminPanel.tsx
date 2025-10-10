import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { Paper, Typography, Stack, Box, Button, TextField, Chip, Alert } from '@mui/material';
import SwapAbi from '../abi/Swap.json';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG, REGISTRY_IDS } from '../config';
import { useAccount } from 'wagmi';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const AdminPanel: React.FC = () => {
  const { address: activeAccount, isConnected } = useAccount();
  const [swapAddress, setSwapAddress] = useState<string | null>(null);
  const [defaultQuote, setDefaultQuote] = useState<string | null>(null);
  const [currentPairs, setCurrentPairs] = useState<string[]>([]);
  const [draftPairs, setDraftPairs] = useState<string[]>([]);
  const [inputAddress, setInputAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [treasuryAddress, setTreasuryAddress] = useState<string | null>(null);
  const [treasuryQerBalance, setTreasuryQerBalance] = useState<string | null>(null);
  const [qerTokenAddress, setQerTokenAddress] = useState<string | null>(null);
  const [configEntries, setConfigEntries] = useState<Array<{ id: string; label: string; value: string }>>([]);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean>(false);

  const hasWallet = useMemo(() => Boolean(window.ethereum), []);

  const checkAdminAccess = useCallback(async () => {
    if (!window.ethereum || !activeAccount || !isConnected) {
      setHasAdminAccess(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi, provider);

      // Check if user is the owner/admin of the StateManager contract
      const owner = await stateManager.owner();
      const isOwner = owner.toLowerCase() === activeAccount.toLowerCase();

      setHasAdminAccess(isOwner);
    } catch (err) {
      console.error('Failed to check admin access:', err);
      setHasAdminAccess(false);
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
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi, provider);
      const getAddress = stateManager.getFunction('getAddress(bytes32)');
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
          return await getAddress(id);
        } catch {
          throw new Error(label);
        }
      };

      const swapAddr = await requireAddress(REGISTRY_IDS.SWAP_CONTRACT, 'StateManager missing swap contract address');
      const quoteAddr = await requireAddress(REGISTRY_IDS.PRIMARY_QUOTE, 'StateManager missing quote token address');
      const qerAddr = await requireAddress(REGISTRY_IDS.MAIN_CONTRACT, 'StateManager missing QER token address');
      const treasuryAddr = await requireAddress(REGISTRY_IDS.TREASURY, 'StateManager missing treasury address');

      const entries: Array<{ id: string; label: string; value: string }> = [];
      const appendEntry = (label: string, value: string) => {
        entries.push({ id: label, label, value });
      };
      appendEntry('QER Token', qerAddr);
      appendEntry('Treasury', treasuryAddr);
      appendEntry('Primary Quote', quoteAddr);
      appendEntry('Swap', swapAddr);
      appendEntry('Swap Fee (bps)', (await stateManager.getUint(REGISTRY_IDS.SWAP_FEE_BPS)).toString());
      setConfigEntries(entries);

      setSwapAddress(swapAddr);
      setDefaultQuote(quoteAddr);
      setQerTokenAddress(qerAddr);
      setTreasuryAddress(treasuryAddr);

      try {
        const qerToken = new ethers.Contract(qerAddr, ERC20_ABI, provider);
        const balance = await qerToken.balanceOf(treasuryAddr);
        setTreasuryQerBalance(ethers.formatUnits(balance, 18));
      } catch {
        setTreasuryQerBalance(null);
      }

      const contract = new ethers.Contract(swapAddr, SwapAbi, provider);
      const pairs: string[] = await contract.allPairs();
      const normalised = pairs.map(addr => ethers.getAddress(addr));
      setCurrentPairs(normalised);
      setDraftPairs(normalised);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load pairs: ${message}`);
      setConfigEntries([]);
      setTreasuryAddress(null);
      setTreasuryQerBalance(null);
      setQerTokenAddress(null);
      setSwapAddress(null);
      setDefaultQuote(null);
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

  const handleIncludeDefault = () => {
    const checksummed = normaliseAddress(defaultQuote ?? '');
    if (!checksummed) return;
    if (!draftPairs.includes(checksummed)) {
      setDraftPairs(prev => [...prev, checksummed]);
    }
  };

  const handleSubmit = async () => {
    if (!window.ethereum) {
      setStatus('Connect a wallet with admin access to update pairs.');
      return;
    }
    if (draftPairs.length === 0) {
      setStatus('At least one quote token address is required.');
      return;
    }
    if (!swapAddress) {
      setStatus('Swap contract address not available yet.');
      return;
    }

    setLoading(true);
    setStatus('Submitting transaction...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(swapAddress, SwapAbi, signer);
      const tx = await contract.updatePairs(draftPairs);
      await tx.wait();
      setStatus('Pairs updated successfully.');
      setCurrentPairs(draftPairs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Update failed: ${message}`);
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
        <Button size="small" variant="outlined" onClick={handleIncludeDefault} disabled={!defaultQuote}>Include USD token</Button>
        <Button size="small" variant="outlined" onClick={handleReset}>Reset</Button>
        <Button size="small" variant="outlined" onClick={loadPairs}>Refresh</Button>
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
              <Box component="li" key={address}><code>{address}</code></Box>
            ))}
          </Stack>
        )}
      </Box>

      {configEntries.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2">StateManager Registry:</Typography>
          <Stack component="ul" sx={{ pl: 2, mt: 1 }}>
            {configEntries.map((entry) => (
              <Box component="li" key={entry.label}>
                <b>{entry.label}:</b> <code>{entry.value}</code>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
};

export default AdminPanel;
