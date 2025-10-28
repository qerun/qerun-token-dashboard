import React, { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Paper, Typography, Box, Button, TextField, Stack, Alert, Chip, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG } from '../config';

interface RegistryEntry {
  id: string;
  label: string;
  value: string;
  valueType: number;
  requiredRole: string;
  isImmutable: boolean;
}

interface RegistryManagerProps {
  hasWallet: boolean;
}

const RegistryManager: React.FC<RegistryManagerProps> = ({ hasWallet }) => {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadRegistry = useCallback(async () => {
    if (!window.ethereum) {
      setStatus('Wallet not detected. Connect to load registry.');
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi.abi, provider);

      // Known registry IDs
      const knownIds = [
        { id: ethers.id('MAIN_CONTRACT'), label: 'QER Token' },
        { id: ethers.id('TREASURY'), label: 'Treasury' },
        { id: ethers.id('PRIMARY_QUOTE'), label: 'Primary Quote' },
        { id: ethers.id('SWAP_CONTRACT'), label: 'Swap Contract' },
        { id: ethers.id('SWAP_FEE_BPS'), label: 'Swap Fee (bps)' },
        { id: ethers.id('TREASURY_APPLY_GOVERNANCE'), label: 'Treasury Apply Governance' },
      ];

      const loadedEntries: RegistryEntry[] = [];

      for (const { id, label } of knownIds) {
        try {
          const has = await stateManager.has(id);
          if (!has) continue;

          const metadata = await stateManager.getMetadata(id);
          const valueType = metadata[0];
          const requiredRole = metadata[1];

          let value: string;
          const getAddress = stateManager.getFunction('getAddress(bytes32)');
          const getUint = stateManager.getFunction('getUint(bytes32)');
          const getBool = stateManager.getFunction('getBool(bytes32)');
          const getBytes32 = stateManager.getFunction('getBytes32(bytes32)');

          switch (valueType) {
            case 1: // ADDRESS
              value = await getAddress(id);
              break;
            case 2: // UINT256
              const uintValue = await getUint(id);
              value = uintValue.toString();
              break;
            case 3: // BOOL
              const boolValue = await getBool(id);
              value = boolValue ? 'true' : 'false';
              break;
            case 4: // BYTES32
              const bytesValue = await getBytes32(id);
              value = bytesValue;
              break;
            default:
              value = 'Unknown type';
          }

          const isImmutable = requiredRole === ethers.keccak256(ethers.toUtf8Bytes('IMMUTABLE'));

          loadedEntries.push({
            id,
            label,
            value,
            valueType,
            requiredRole,
            isImmutable,
          });
        } catch (err) {
          console.warn(`Failed to load registry entry ${label}:`, err);
        }
      }

      setEntries(loadedEntries);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load registry: ${message}`);
      setEntries([]);
    }
  }, []);

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
    if (!window.ethereum) {
      setStatus('Connect a wallet with admin access to update registry.');
      return;
    }

    setLoading(true);
    setStatus('Updating registry entry...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi.abi, signer);

      let tx;
      switch (entry.valueType) {
        case 1: // ADDRESS
          if (!ethers.isAddress(editValue)) {
            throw new Error('Invalid Ethereum address');
          }
          tx = await stateManager.setAddress(entry.id, editValue, entry.requiredRole);
          break;
        case 2: // UINT256
          const uintValue = BigInt(editValue);
          tx = await stateManager.setUint(entry.id, uintValue, entry.requiredRole);
          break;
        case 3: // BOOL
          const boolValue = editValue.toLowerCase() === 'true';
          tx = await stateManager.setBool(entry.id, boolValue, entry.requiredRole);
          break;
        case 4: // BYTES32
          let bytes32Value: string;
          if (ethers.isHexString(editValue) && editValue.length === 66) {
            bytes32Value = editValue;
          } else {
            bytes32Value = ethers.id(editValue);
          }
          tx = await stateManager.setBytes32(entry.id, bytes32Value, entry.requiredRole);
          break;
        default:
          throw new Error('Unsupported value type');
      }

      await tx.wait();
      setStatus('Registry entry updated successfully.');
      setEditingId(null);
      setEditValue('');
      await loadRegistry(); // Refresh the data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to update registry: ${message}`);
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
    if (valueType === 1 && ethers.isAddress(value)) {
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

      {!hasWallet && (
        <Alert severity="warning" sx={{ mb: 2 }}>No wallet detected. Connect with an admin account to edit registry entries.</Alert>
      )}

      <Stack spacing={2}>
        {entries.map((entry) => (
          <Box key={entry.id} sx={{ p: 2, borderRadius: 1, border: '1px solid var(--qerun-gold-alpha-18)', background: 'var(--qerun-card-secondary)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{entry.label}</Typography>
                <Chip
                  label={getValueTypeLabel(entry.valueType)}
                  size="small"
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
                {entry.isImmutable && (
                  <Chip
                    label="Immutable"
                    size="small"
                    color="error"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
              </Box>
              {!entry.isImmutable && editingId !== entry.id && (
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => handleEdit(entry)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
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
              >
                {formatValue(entry.value, entry.valueType)}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>

      {entries.length === 0 && !status && (
        <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', textAlign: 'center', py: 4 }}>
          No registry entries found.
        </Typography>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" variant="outlined" onClick={loadRegistry}>
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