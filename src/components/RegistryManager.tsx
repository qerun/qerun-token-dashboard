import React, { useCallback, useState, useEffect } from 'react';
import { ethers, isAddress } from 'ethers';
import { Paper, Typography, Box, Button, TextField, Stack, Alert, Chip, IconButton, Tooltip, MenuItem, Switch, FormControlLabel, Checkbox } from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG } from '../config';

interface RegistryEntry {
  id: string;
  value: string;
  valueType: number;
  requiredRole: string;
  isImmutable: boolean;
  isContract?: boolean;
  hasStateManagerSetter?: boolean;
  isGovernanceEnabled?: boolean;
  contractStateManager?: string | null;
  loading?: boolean;
}

interface RegistryManagerProps {
  hasWallet: boolean;
}

const RegistryManager: React.FC<RegistryManagerProps> = ({ hasWallet }) => {
  // Precompute role hashes for stable comparisons (use keccak256 UTF-8 of the role name)
  const IMMUTABLE_ROLE = ethers.id('IMMUTABLE');
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editImmutable, setEditImmutable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntryId, setNewEntryId] = useState('');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [newEntryType, setNewEntryType] = useState<number>(1); // Default to address

  // Helper function to detect if address is a contract and has setStateManager function
  // Wrapped in useCallback so its identity is stable and doesn't force loadRegistry to be recreated on every render.
  const detectContractCapabilities = React.useCallback(async (address: string, provider: ethers.BrowserProvider): Promise<{isContract: boolean, hasStateManagerSetter?: boolean, isGovernanceEnabled?: boolean, contractStateManager?: string | null}> => {
    try {
      const code = await provider.getCode(address);
      if (code === '0x') {
        return { isContract: false };
      }

      let hasStateManagerSetter = false;
      let isGovernanceEnabled = undefined as boolean | undefined;
      let contractStateManager: string | null | undefined = undefined;

      // Check if contract has setStateManager function by looking for the selector in runtime bytecode
      try {
        const selector = ethers.keccak256(ethers.toUtf8Bytes('setStateManager(address)')).slice(2, 10); // first 4 bytes
        if (code && code.includes(selector)) {
          hasStateManagerSetter = true;
        }
      } catch {
        // ignore selector check failures
      }

      // Try to read a public stateManager() getter if present
      try {
        const contract = new ethers.Contract(address, ['function stateManager() view returns (address)'], provider);
        contractStateManager = await contract.stateManager();
      } catch (err) {
        contractStateManager = null; // not present or failed
      }

      // Check if the contract exposes isGovernanceEnabled() — if so, read it.
      try {
        const contract2 = new ethers.Contract(address, ['function isGovernanceEnabled() view returns (bool)'], provider);
        // call; if function doesn't exist this will throw
        isGovernanceEnabled = await contract2.isGovernanceEnabled();
      } catch (error: unknown) {
        // Contract doesn't implement governance toggle or call failed
        isGovernanceEnabled = undefined;
      }

      return { 
        isContract: true, 
        hasStateManagerSetter,
        isGovernanceEnabled,
        contractStateManager
      };
    } catch {
      return { isContract: false };
    }
  }, []);

  const loadRegistry = useCallback(async () => {

    if (!window.ethereum || !CONTRACT_CONFIG.stateManager) {
      setStatus('Wallet not detected or StateManager address not configured.');
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi.abi, provider);

      // Attempt to read DEFAULT_ADMIN_ROLE grants from events to show current admin accounts
      try {
        if (typeof (stateManager as any).queryFilter === 'function') {
          const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

          // Helper: queryFilter in chunks to avoid providers that reject large eth_getLogs requests
          const queryFilterChunked = async (contract: any, filter: any, fromB: number | string, toB: number | string, step = 2000) => {
            const results: any[] = [];
            const latest = typeof toB === 'string' && toB === 'latest' ? await provider.getBlockNumber() : Number(toB);
            let start = Number(fromB ?? 0);
            // guard: if from is negative or NaN, start at 0
            if (!Number.isFinite(start) || start < 0) start = 0;

            // Safety caps to avoid hammering the provider
            const MAX_TOTAL_REQUESTS = 500; // absolute cap for this operation
            let totalRequests = 0;
            let consecutiveFailures = 0;
            const MAX_CONSECUTIVE_FAILURES = 10; // abort early if provider keeps failing

            const shouldAbort = () => totalRequests >= MAX_TOTAL_REQUESTS || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
            // Rate limiting: ensure we make at most one RPC request per second
            const REQUEST_INTERVAL_MS = 1000; // 1 request per second
            let lastRequestAt = 0;
            const ensureRateLimit = async () => {
              const now = Date.now();
              const since = now - lastRequestAt;
              if (since < REQUEST_INTERVAL_MS) {
                await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS - since));
              }
              lastRequestAt = Date.now();
            };

            while (start <= latest) {
              if (shouldAbort()) {
                console.warn('queryFilterChunked: aborting early due to too many requests or consecutive failures', { totalRequests, consecutiveFailures });
                setStatus && setStatus('Partial results returned: provider limited historical queries. Try a dedicated RPC or reduce range.');
                break;
              }

              const end = Math.min(latest, start + step - 1);
              try {
                // rate limit before making the request
                await ensureRateLimit();
                totalRequests++;
                // ethers.Contract.queryFilter(filter, fromBlock, toBlock)
                const chunk = await contract.queryFilter(filter, start, end);
                consecutiveFailures = 0;
                if (Array.isArray(chunk) && chunk.length > 0) results.push(...chunk);
              } catch (err) {
                consecutiveFailures++;
                // If a chunk still fails, try smaller chunks recursively. We allow shrinking down to single-block attempts.
                if (step > 1) {
                  const half = Math.max(1, Math.floor(step / 2));
                  const partial = await queryFilterChunked(contract, filter, start, end, half);
                  results.push(...partial);
                } else {
                  // step == 1: single-block attempts. Try each block individually with a couple retries and exponential backoff; otherwise skip the block and continue.
                  for (let b = start; b <= end; b++) {
                    if (shouldAbort()) break;
                    let retries = 3;
                    let succeeded = false;
                    let backoff = 200;
                    while (retries-- > 0 && !succeeded) {
                      try {
                        // rate limit before each per-block request
                        await ensureRateLimit();
                        totalRequests++;
                        const single = await contract.queryFilter(filter, b, b);
                        consecutiveFailures = 0;
                        if (Array.isArray(single) && single.length > 0) results.push(...single);
                        succeeded = true;
                      } catch (blockErr) {
                        consecutiveFailures++;
                        await new Promise((r) => setTimeout(r, backoff));
                        backoff = Math.min(2000, backoff * 2);
                      }
                    }
                    if (!succeeded) {
                      console.warn(`queryFilterChunked: skipping block ${b} due to repeated errors`);
                    }
                  }
                }
              }
              start = end + 1;
            }
            return results;
          };

          // Avoid scanning from block 0 to prevent huge historical queries.
          // Scan a recent window instead (configurable). Use a default of the last 50k blocks.
          const DEFAULT_SCAN_WINDOW = 50000;
          const currentBlock = await provider.getBlockNumber();
          const scanFrom = Math.max(0, currentBlock - DEFAULT_SCAN_WINDOW);

          const granted = await queryFilterChunked(stateManager, stateManager.filters.RoleGranted(DEFAULT_ADMIN_ROLE), scanFrom, 'latest');
          const revoked = await queryFilterChunked(stateManager, stateManager.filters.RoleRevoked(DEFAULT_ADMIN_ROLE), scanFrom, 'latest');

          const admins = new Set<string>();
          for (const ev of granted) {
            try {
              const account = (ev as any).args?.account ?? (ev as any).args?.[1] ?? null;
              if (account) admins.add(account);
            } catch {}
          }
          for (const ev of revoked) {
            try {
              const account = (ev as any).args?.account ?? (ev as any).args?.[1] ?? null;
              if (account) admins.delete(account);
            } catch {}
          }
          setAdminAccounts(Array.from(admins));
        }
      } catch (e) {
        // If event queries fail in test mocks or wallets, ignore gracefully
        console.warn('Failed to read admin Role events:', e);
        setAdminAccounts([]);
      }
      // Known registry IDs
      const knownIds = [
        'MAIN_CONTRACT',
        'TREASURY',
        'PRIMARY_QUOTE',
        'SWAP_CONTRACT',
        'SWAP_FEE_BPS',
        'TREASURY_APPLY_GOVERNANCE',
      ];

      // Initialize UI rows immediately so registry shows even when properties are loading
      const initialEntries: RegistryEntry[] = knownIds.map((id) => ({
        id,
        value: '…',
        valueType: 0,
        requiredRole: '',
        isImmutable: false,
        loading: true,
      }));
      setEntries(initialEntries);

      // Load each entry in parallel and update the entry when data becomes available
      await Promise.all(knownIds.map(async (id) => {
        try {
          const has = await stateManager.has(id);
          if (!has) {
            // mark as not set
            setEntries((prev) => prev.map((e) => e.id === id ? { ...e, value: 'not set', valueType: 0, loading: false } : e));
            return;
          }

          const metadata = await stateManager.getMetadata(id);
          const valueType = Number(metadata[0]);
          const requiredRole = metadata[1];

          let value: string = '';
          let isContract = false;
          let hasStateManagerSetter = false;
          let isGovernanceEnabled: boolean | undefined = undefined;
          let contractStateManager: string | null | undefined = undefined;

          switch (valueType) {
            case 1: { // ADDRESS
              value = await stateManager.addressOf(id);
              // Check capabilities but don't block UI
              try {
                const contractInfo = await detectContractCapabilities(value, provider);
                isContract = contractInfo.isContract;
                hasStateManagerSetter = contractInfo.hasStateManagerSetter || false;
                isGovernanceEnabled = contractInfo.isGovernanceEnabled;
                contractStateManager = contractInfo.contractStateManager ?? null;
              } catch (err) {
                // ignore capability errors
              }
              break;
            }
            case 2: { // UINT256
              try {
                const uintValue = await stateManager.getUint(id);
                value = uintValue.toString();
              } catch {
                value = 'error';
              }
              break;
            }
            case 3: { // BOOL
              try {
                const boolValue = await stateManager.getBool(id);
                value = boolValue ? 'true' : 'false';
              } catch {
                value = 'error';
              }
              break;
            }
            case 4: { // BYTES32
              try {
                const bytesValue = await stateManager.getBytes32(id);
                value = bytesValue;
              } catch {
                value = 'error';
              }
              break;
            }
            default:
              value = 'Unknown type';
          }

          // Normalize requiredRole into a hex string and compare to IMMUTABLE_ROLE robustly
          let roleHex: string;
          try {
            roleHex = ethers.hexlify(requiredRole as any);
          } catch {
            roleHex = String(requiredRole || '');
          }

          const isImmutable = roleHex.toLowerCase() === String(IMMUTABLE_ROLE).toLowerCase();

          // Update the entry in state (partial updates are OK)
          setEntries((prev) => prev.map((e) => e.id === id ? ({
            ...e,
            value,
            valueType,
            requiredRole,
            isImmutable,
            isContract,
            hasStateManagerSetter,
            isGovernanceEnabled,
            contractStateManager,
            loading: false,
          }) : e));
        } catch (err) {
          console.warn(`Failed to load registry entry ${id}:`, err);
          setEntries((prev) => prev.map((e) => e.id === id ? { ...e, value: 'error', loading: false } : e));
        }
      }));
      setStatus(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load registry: ${message}`);
      setEntries([]);
    }
  }, [detectContractCapabilities]);

  // Auto-load registry once on mount and when wallet connection status changes.
  // This keeps the UX friendly (shows entries immediately) while retaining
  // the rate-limit / chunking protections in `loadRegistry` to avoid RPC floods.
  useEffect(() => {
    // call but don't await here; loadRegistry manages its own state and errors
    try {
      loadRegistry();
    } catch (err) {
      // swallow - loadRegistry handles errors and status messages
    }
    // Intentionally depend on loadRegistry (stable via useCallback) and hasWallet
  }, [loadRegistry, hasWallet]);

  // Function to set StateManager for a contract
  const setContractStateManager = async (entry: RegistryEntry, newStateManagerAddress: string) => {
    if (!window.ethereum || !entry.isContract || !entry.hasStateManagerSetter) {
      setStatus('Cannot set StateManager for this contract.');
      return;
    }

    setLoading(true);
    setStatus('Setting StateManager address...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Create a generic contract interface to call setStateManager
      const contract = new ethers.Contract(entry.value, [
        'function setStateManager(address) external'
      ], signer);
      
      await contract.setStateManager(newStateManagerAddress);

      setStatus('StateManager address set successfully.');
      await loadRegistry(); // Refresh the data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to set StateManager: ${message}`);
    } finally {
      setLoading(false);
    }
  };

    // Function to toggle governance enabled/disabled for a contract
  const toggleGovernanceEnabled = async (entry: RegistryEntry, enabled: boolean) => {
    if (!window.ethereum || !entry.isContract || typeof entry.isGovernanceEnabled === 'undefined') {
      setStatus('Cannot toggle governance for this contract.');
      return;
    }

    setLoading(true);
    setStatus(`${enabled ? 'Enabling' : 'Disabling'} governance...`);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Call enableGovernance or disableGovernance on the contract itself
      const contract = new ethers.Contract(entry.value, [
        'function enableGovernance() external',
        'function disableGovernance() external'
      ], signer);
      
      if (enabled) {
        await contract.enableGovernance();
      } else {
        await contract.disableGovernance();
      }

      setStatus(`Governance ${enabled ? 'enabled' : 'disabled'} successfully.`);
      await loadRegistry(); // Refresh the data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to toggle governance: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // NOTE: Automatic registry polling disabled to avoid hammering RPC providers.
  // Use the "Refresh" button to load registry on demand.

  const handleEdit = (entry: RegistryEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.value);
    // initialize the immutable checkbox based on the current requiredRole
    try {
      const isImm = String(entry.requiredRole).toLowerCase() === String(IMMUTABLE_ROLE).toLowerCase();
      setEditImmutable(isImm);
    } catch {
      setEditImmutable(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
    setEditImmutable(false);
  };

  const handleSave = async (entry: RegistryEntry) => {
    if (!window.ethereum || !CONTRACT_CONFIG.stateManager) {
      setStatus('Connect a wallet with admin access to update registry.');
      return;
    }

    setLoading(true);
    setStatus('Updating registry entry...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager!, StateManagerAbi.abi, signer);

      let tx;
  // determine which requiredRole to pass when saving (immutable checkbox overrides)
  const requiredRoleToUse = editImmutable ? IMMUTABLE_ROLE : entry.requiredRole;

  switch (entry.valueType) {
        case 1: { // ADDRESS
          if (!ethers.isAddress(editValue)) {
            throw new Error('Invalid Ethereum address');
          }
          tx = await stateManager.setAddress(entry.id, editValue, requiredRoleToUse);
          break;
        }
        case 2: { // UINT256
          const uintValue = BigInt(editValue);
          tx = await stateManager.setUint(entry.id, uintValue, requiredRoleToUse);
          break;
        }
        case 3: { // BOOL
          const boolValue = editValue.toLowerCase() === 'true';
          tx = await stateManager.setBool(entry.id, boolValue, requiredRoleToUse);
          break;
        }
        case 4: { // BYTES32
          let bytes32Value: string;
          if (ethers.isHexString(editValue) && editValue.length === 66) {
            bytes32Value = editValue;
          } else {
            bytes32Value = ethers.id(editValue);
          }
          tx = await stateManager.setBytes32(entry.id, bytes32Value, requiredRoleToUse);
          break;
        }
        default:
          throw new Error('Unsupported value type');
      }

      await tx.wait();
      setStatus('Registry entry updated successfully.');
      setEditingId(null);
      setEditValue('');
      await loadRegistry(); // Refresh the data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to update registry: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!window.ethereum || !CONTRACT_CONFIG.stateManager || !newEntryId.trim() || !newEntryValue.trim()) {
      setStatus('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setStatus('Adding new registry entry...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi.abi, signer);

      let id: string;
      if (ethers.isHexString(newEntryId) && newEntryId.length === 66) {
        id = newEntryId;
      } else {
        id = newEntryId; // Use string directly
      }

      // Use DEFAULT_ADMIN_ROLE for new entries
      const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

      let tx;
      switch (newEntryType) {
        case 1: { // ADDRESS
          if (!ethers.isAddress(newEntryValue)) {
            throw new Error('Invalid Ethereum address');
          }
          tx = await stateManager.setAddress(id, newEntryValue, DEFAULT_ADMIN_ROLE);
          break;
        }
        case 2: { // UINT256
          const uintValue = BigInt(newEntryValue);
          tx = await stateManager.setUint(id, uintValue, DEFAULT_ADMIN_ROLE);
          break;
        }
        case 3: { // BOOL
          const boolValue = newEntryValue.toLowerCase() === 'true';
          tx = await stateManager.setBool(id, boolValue, DEFAULT_ADMIN_ROLE);
          break;
        }
        case 4: { // BYTES32
          let bytes32Value: string;
          if (ethers.isHexString(newEntryValue) && newEntryValue.length === 66) {
            bytes32Value = newEntryValue;
          } else {
            bytes32Value = ethers.id(newEntryValue);
          }
          tx = await stateManager.setBytes32(id, bytes32Value, DEFAULT_ADMIN_ROLE);
          break;
        }
        default:
          throw new Error('Unsupported value type');
      }

      await tx.wait();
      setStatus('New registry entry added successfully.');
      setShowAddForm(false);
      setNewEntryId('');
      setNewEntryValue('');
      setNewEntryType(1);
      await loadRegistry(); // Refresh the data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to add registry entry: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const getValueTypeLabel = (valueType: number) => {
    switch (valueType) {
      case 1: return 'Address';
      case 2: return 'Number';
      case 3: return 'Boolean';
      case 4: return 'Bytes32';
      default: return 'Unknown';
    }
  };

  const formatValue = (value: string, valueType: number) => {
    if (valueType === 1 && isAddress(value)) {
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    }
    return value;
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 'var(--qerun-radius-xl)', border: '1px solid var(--qerun-gold-alpha-25)', backdropFilter: 'blur(10px)', background: 'var(--qerun-card)' }}>
      <Typography variant="h6" sx={{ color: 'var(--qerun-gold)', fontWeight: 600, mb: 2 }}>StateManager Registry</Typography>
      <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', mb: 3 }}>
        View and edit registry entries. Immutable entries cannot be modified.
      </Typography>

      {true && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', mr: 1 }}>Admins:</Typography>
          <Stack direction="row" spacing={1}>
            {adminAccounts.map((addr) => (
              <Tooltip key={addr} title={addr}>
                <Chip
                  label={`${addr.slice(0, 6)}...${addr.slice(-4)}`}
                  size="small"
                  sx={{ fontSize: '0.75rem', height: 24 }}
                />
              </Tooltip>
            ))}
          </Stack>
        </Box>
      )}

      {!hasWallet && (
        <>
          <Alert severity="warning" sx={{ mb: 2 }}>No wallet detected. Connect with an admin account to edit registry entries.</Alert>
          <Box sx={{ mb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => window.open('https://faucet.quicknode.com/binance-smart-chain/bnb-testnet', '_blank')}
            >
              Get BNB (BNB Testnet Faucet)
            </Button>
          </Box>
        </>
      )}

      <Stack spacing={2}>
        {entries.map((entry) => (
          <Box key={entry.id} sx={{ p: 2, borderRadius: 1, border: '1px solid var(--qerun-gold-alpha-18)', background: 'var(--qerun-card-secondary)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{entry.id}</Typography>
                <Chip
                  label={getValueTypeLabel(entry.valueType)}
                  size="small"
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
                {entry.requiredRole && (
                  <Chip
                    label={entry.requiredRole && entry.requiredRole.length > 0 ? `${entry.requiredRole.slice(0, 6)}...${entry.requiredRole.slice(-4)}` : 'Role'}
                    size="small"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {entry.isImmutable && (
                  <Chip
                    label="Immutable"
                    size="small"
                    color="error"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {entry.isContract && (
                  <Chip
                    label="CONTRACT"
                    size="small"
                    color="primary"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {typeof entry.isGovernanceEnabled !== 'undefined' && (
                  <Chip
                    label={entry.isGovernanceEnabled ? "GOVERNANCE ENABLED" : "GOVERNANCE DISABLED"}
                    size="small"
                    color={entry.isGovernanceEnabled ? "success" : "default"}
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!entry.isImmutable && editingId !== entry.id && (
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEdit(entry)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {entry.hasStateManagerSetter && (
                  <Tooltip title="Set StateManager">
                    <IconButton 
                      size="small" 
                      aria-label="Set StateManager"
                      onClick={() => {
                        const newAddress = prompt('Enter new StateManager address:');
                        if (newAddress && ethers.isAddress(newAddress)) {
                          setContractStateManager(entry, newAddress);
                        } else if (newAddress) {
                          setStatus('Invalid Ethereum address');
                        }
                      }}
                      disabled={loading}
                    >
                      ⚙️
                    </IconButton>
                  </Tooltip>
                )}
                {typeof entry.isGovernanceEnabled !== 'undefined' && (
                  <Tooltip title={entry.isGovernanceEnabled ? 'Governance is enabled - Click to disable' : 'Governance is disabled - Click to enable'}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={!!entry.isGovernanceEnabled}
                          onChange={() => toggleGovernanceEnabled(entry, !entry.isGovernanceEnabled)}
                          disabled={loading}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: 'var(--qerun-gold)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 215, 0, 0.08)',
                              },
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: 'var(--qerun-gold)',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'var(--qerun-text-muted)' }}>
                          {entry.isGovernanceEnabled ? 'Enabled' : 'Disabled'}
                        </Typography>
                      }
                      sx={{ mx: 0 }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Box>

            {editingId === entry.id ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={entry.valueType === 1 ? '0x...' : entry.valueType === 4 ? 'text or 0x...' : 'value'}
                  helperText={
                    entry.valueType === 1 ? 'Ethereum address' :
                    entry.valueType === 2 ? 'Number (uint256)' :
                    entry.valueType === 3 ? 'true or false' :
                    entry.valueType === 4 ? 'Text (will be hashed) or hex bytes32' :
                    'Value'
                  }
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={editImmutable} onChange={(e) => setEditImmutable(e.target.checked)} />}
                  label={<Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Immutable</Typography>}
                  sx={{ ml: 1 }}
                />
                <Tooltip title="Save">
                  <IconButton size="small" onClick={() => handleSave(entry)} disabled={loading}>
                    <SaveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton size="small" onClick={handleCancel} disabled={loading}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  wordBreak: 'break-all',
                  color: 'var(--qerun-text-muted)'
                }}
                title={entry.value}
              >
                {formatValue(entry.value, entry.valueType)}
              </Typography>
            )}

            {/* Show detected contract state manager address when available */}
            {entry.contractStateManager && ethers.isAddress(entry.contractStateManager) && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'var(--qerun-text-muted)' }}>StateManager:</Typography>
                <Tooltip title={entry.contractStateManager}>
                  <Chip
                    label={`${entry.contractStateManager.slice(0, 6)}...${entry.contractStateManager.slice(-4)}`}
                    size="small"
                    sx={{ fontSize: '0.75rem', height: 24 }}
                  />
                </Tooltip>
                <Tooltip title="Copy address">
                  <IconButton
                    size="small"
                    onClick={async () => {
                      try {
                        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(entry.contractStateManager as string);
                          setStatus('StateManager address copied to clipboard');
                          setTimeout(() => setStatus(null), 2000);
                        } else {
                          setStatus('Clipboard not available in this environment');
                          setTimeout(() => setStatus(null), 2000);
                        }
                      } catch (err) {
                        setStatus('Failed to copy address');
                        setTimeout(() => setStatus(null), 2000);
                      }
                    }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        ))}
      </Stack>

      {showAddForm && (
        <Box sx={{ mt: 3, p: 2, borderRadius: 1, border: '1px solid var(--qerun-gold-alpha-18)', background: 'var(--qerun-card-secondary)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Add New Registry Entry</Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="Entry ID"
              placeholder="SWAP_CONTRACT"
              value={newEntryId}
              onChange={(e) => setNewEntryId(e.target.value)}
              helperText="Human-readable identifier for the entry"
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                select
                size="small"
                label="Value Type"
                value={newEntryType}
                onChange={(e) => setNewEntryType(Number(e.target.value))}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value={1}>Address</MenuItem>
                <MenuItem value={2}>Number</MenuItem>
                <MenuItem value={3}>Boolean</MenuItem>
                <MenuItem value={4}>Bytes32</MenuItem>
              </TextField>
              <TextField
                fullWidth
                size="small"
                label="Value"
                placeholder={newEntryType === 1 ? '0x...' : newEntryType === 4 ? 'text or 0x...' : 'value'}
                value={newEntryValue}
                onChange={(e) => setNewEntryValue(e.target.value)}
                helperText={
                  newEntryType === 1 ? 'Ethereum address' :
                  newEntryType === 2 ? 'Number (uint256)' :
                  newEntryType === 3 ? 'true or false' :
                  newEntryType === 4 ? 'Text (will be hashed) or hex bytes32' :
                  'Value'
                }
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" variant="contained" onClick={() => setShowAddForm(false)} disabled={loading}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleAddEntry} disabled={loading || !newEntryId.trim() || !newEntryValue.trim()}>
                {loading ? 'Adding...' : 'Add Entry'}
              </Button>
            </Box>
          </Stack>
        </Box>
      )}

      {entries.length === 0 && !status && (
        <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', textAlign: 'center', py: 4 }}>
          No registry entries found.
        </Typography>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button size="small" variant="contained" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel Add' : '+ Add New Entry'}
        </Button>
        <Button size="small" variant="contained" onClick={loadRegistry}>
          Refresh
        </Button>
      </Box>

      {status && (
        <Alert sx={{ mt: 2 }} severity={status.includes('Failed') || status.includes('not detected') ? 'error' : 'success'}>
          {status}
        </Alert>
      )}
    </Paper>
  );
};

export default RegistryManager;