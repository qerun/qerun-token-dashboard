import React, { useCallback, useEffect, useState } from 'react';
import { ethers, isAddress } from 'ethers';
import { Paper, Typography, Box, Button, TextField, Stack, Alert, Chip, IconButton, Tooltip, MenuItem, Switch, FormControlLabel } from '@mui/material';
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
}

interface RegistryManagerProps {
  hasWallet: boolean;
}

const RegistryManager: React.FC<RegistryManagerProps> = ({ hasWallet }) => {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntryId, setNewEntryId] = useState('');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [newEntryType, setNewEntryType] = useState<number>(1); // Default to address

  // Helper function to detect if address is a contract and has setStateManager function
  const detectContractCapabilities = async (address: string, provider: ethers.BrowserProvider): Promise<{isContract: boolean, hasStateManagerSetter?: boolean, isGovernanceEnabled?: boolean, contractStateManager?: string | null}> => {
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
  };

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
          const granted = await (stateManager as any).queryFilter(stateManager.filters.RoleGranted(DEFAULT_ADMIN_ROLE), 0, 'latest');
          const revoked = await (stateManager as any).queryFilter(stateManager.filters.RoleRevoked(DEFAULT_ADMIN_ROLE), 0, 'latest');
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

      const loadedEntries: RegistryEntry[] = [];

      for (const id of knownIds) {
        try {
          const has = await stateManager.has(id);
          if (!has) continue;

          const metadata = await stateManager.getMetadata(id);
          const valueType = Number(metadata[0]);
          const requiredRole = metadata[1];

          let value: string;
          let isContract = false;
          let hasStateManagerSetter = false;
          let isGovernanceEnabled: boolean | undefined = undefined;
          let contractStateManager: string | null | undefined = undefined;

          switch (valueType) {
            case 1: { // ADDRESS
              value = await stateManager.addressOf(id);
              // Check if this address is a contract and has setStateManager function
              const contractInfo = await detectContractCapabilities(value, provider);
              isContract = contractInfo.isContract;
              hasStateManagerSetter = contractInfo.hasStateManagerSetter || false;
              isGovernanceEnabled = contractInfo.isGovernanceEnabled;
              contractStateManager = contractInfo.contractStateManager ?? null;
              // Debug: log detected capability for developer verification
              // eslint-disable-next-line no-console
              console.debug(`RegistryManager: ${id} -> isContract=${isContract}, hasStateManagerSetter=${hasStateManagerSetter}, isGovernanceEnabled=${String(isGovernanceEnabled)}`);
              break;
            }
            case 2: { // UINT256
              const uintValue = await stateManager.getUint(id);
              value = uintValue.toString();
              break;
            }
            case 3: { // BOOL
              const boolValue = await stateManager.getBool(id);
              value = boolValue ? 'true' : 'false';
              break;
            }
            case 4: { // BYTES32
              const bytesValue = await stateManager.getBytes32(id);
              value = bytesValue;
              break;
            }
            default:
              value = 'Unknown type';
          }

          const isImmutable = requiredRole === ethers.keccak256(ethers.toUtf8Bytes('IMMUTABLE'));

          loadedEntries.push({
            id,
            value,
            valueType,
            requiredRole,
            isImmutable,
            isContract,
            hasStateManagerSetter,
            isGovernanceEnabled,
            contractStateManager,
          });
        } catch (err) {
          console.warn(`Failed to load registry entry ${id}:`, err);
        }
      }

      setEntries(loadedEntries);
      setStatus(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load registry: ${message}`);
      setEntries([]);
    }
  }, [detectContractCapabilities]);

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

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  const handleEdit = (entry: RegistryEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.value);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
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
      switch (entry.valueType) {
        case 1: { // ADDRESS
          if (!ethers.isAddress(editValue)) {
            throw new Error('Invalid Ethereum address');
          }
          tx = await stateManager.setAddress(entry.id, editValue, entry.requiredRole);
          break;
        }
        case 2: { // UINT256
          const uintValue = BigInt(editValue);
          tx = await stateManager.setUint(entry.id, uintValue, entry.requiredRole);
          break;
        }
        case 3: { // BOOL
          const boolValue = editValue.toLowerCase() === 'true';
          tx = await stateManager.setBool(entry.id, boolValue, entry.requiredRole);
          break;
        }
        case 4: { // BYTES32
          let bytes32Value: string;
          if (ethers.isHexString(editValue) && editValue.length === 66) {
            bytes32Value = editValue;
          } else {
            bytes32Value = ethers.id(editValue);
          }
          tx = await stateManager.setBytes32(entry.id, bytes32Value, entry.requiredRole);
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
        <Alert severity="warning" sx={{ mb: 2 }}>No wallet detected. Connect with an admin account to edit registry entries.</Alert>
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