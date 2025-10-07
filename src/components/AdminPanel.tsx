import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import QerunSwapAbi from '../abi/QerunSwap.json';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG, QERUN_IDS } from '../config';

const AdminPanel: React.FC = () => {
  const [swapAddress, setSwapAddress] = useState<string | null>(null);
  const [defaultQuote, setDefaultQuote] = useState<string | null>(null);
  const [currentPairs, setCurrentPairs] = useState<string[]>([]);
  const [draftPairs, setDraftPairs] = useState<string[]>([]);
  const [inputAddress, setInputAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasWallet = useMemo(() => Boolean(window.ethereum), []);

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
      const getAddress = stateManager.getFunction('getAddress');
      const [swapAddr, quoteAddr] = await Promise.all([
        getAddress(QERUN_IDS.SWAP_CONTRACT),
        getAddress(QERUN_IDS.PRIMARY_QUOTE),
      ]);
      if (!swapAddr || swapAddr === ethers.ZeroAddress) {
        throw new Error('StateManager missing swap contract address');
      }
      if (!quoteAddr || quoteAddr === ethers.ZeroAddress) {
        throw new Error('StateManager missing quote token address');
      }
      setSwapAddress(swapAddr);
      setDefaultQuote(quoteAddr);

      const contract = new ethers.Contract(swapAddr, QerunSwapAbi, provider);
      const pairs: string[] = await contract.allPairs();
      const normalised = pairs.map(addr => ethers.getAddress(addr));
      setCurrentPairs(normalised);
      setDraftPairs(normalised);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load pairs: ${message}`);
    }
  }, [swapAddress]);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);

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
      const contract = new ethers.Contract(swapAddress, QerunSwapAbi, signer);
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

  return (
    <section
      style={{
        maxWidth: 520,
        margin: '24px auto 80px',
        padding: 24,
        borderRadius: 8,
        background: '#f7f9fc',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Admin Controls</h3>
      <p style={{ marginBottom: 16 }}>
        Manage the list of quote tokens that the swap contract recognises. The list you submit replaces the on-chain
        whitelist, so include every token you want to keep active.
      </p>
      {!hasWallet && (
        <p style={{ color: '#d32f2f', fontWeight: 500 }}>
          No wallet detected. Connect with an admin account to fetch or update pairs.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={inputAddress}
          onChange={event => setInputAddress(event.target.value)}
          placeholder="0x quote token address"
          style={{ flex: 1, padding: '8px 10px', fontSize: 14 }}
        />
        <button type="button" onClick={handleAdd} style={{ padding: '8px 12px' }}>
          Add
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={handleIncludeDefault} style={{ padding: '6px 12px' }} disabled={!defaultQuote}>
          Include USD token
        </button>
        <button type="button" onClick={handleReset} style={{ padding: '6px 12px' }}>
          Reset to on-chain list
        </button>
        <button type="button" onClick={loadPairs} style={{ padding: '6px 12px' }}>
          Refresh
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <strong>Draft pair list ({draftPairs.length}):</strong>
        {draftPairs.length === 0 ? (
          <p style={{ marginTop: 8 }}>No tokens selected yet.</p>
        ) : (
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {draftPairs.map(address => (
              <li key={address} style={{ marginBottom: 6 }}>
                <code>{address}</code>{' '}
                <button
                  type="button"
                  onClick={() => handleRemove(address)}
                  style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        style={{
          padding: '10px 18px',
          fontSize: 15,
          borderRadius: 4,
          border: 'none',
          background: loading ? '#90caf9' : '#1976d2',
          color: '#fff',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Submitting…' : 'Submit updatePairs'}
      </button>
      {status && (
        <p style={{ marginTop: 12, color: status.includes('failed') ? '#d32f2f' : '#1b5e20' }}>
          {status}
        </p>
      )}
      <div style={{ marginTop: 24 }}>
        <strong>Current on-chain pairs ({currentPairs.length}):</strong>
        {currentPairs.length === 0 ? (
          <p style={{ marginTop: 8 }}>No pairs registered yet.</p>
        ) : (
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {currentPairs.map(address => (
              <li key={address}>
                <code>{address}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default AdminPanel;
