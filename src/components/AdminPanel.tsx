import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import styles from '../styles/qerunTheme.module.css';
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
    <section className={`${styles.qerunCard} ${styles.qerunNetworkCardSpacing}`}>
      <h3 className={`${styles.qerunCardTitle} ${styles.qerunMarginTop0}`}>Admin Controls</h3>
      <p className={styles.qerunCardSubtitle}>
        Manage the list of quote tokens that the swap contract recognises. The list you submit replaces the on-chain
        whitelist, so include every token you want to keep active.
      </p>
      {treasuryAddress && (
        <div className={`${styles.qerunMetricsPanel} ${styles.qerunMarginBottom16} ${styles.qerunFontSize14}`}>
          <div><b>Treasury:</b> {treasuryAddress}</div>
          <div><b>QER Token:</b> {qerTokenAddress}</div>
          <div><b>Treasury QER Balance:</b> {treasuryQerBalance ?? '—'}</div>
        </div>
      )}
      {!hasWallet && (
        <p className={`${styles.qerunTextError} ${styles.qerunMarginBottom16}`}>
          No wallet detected. Connect with an admin account to fetch or update pairs.
        </p>
      )}
      <div className={`${styles.qerunButtonContainer} ${styles.qerunMarginBottom12}`}>
        <input
          type="text"
          value={inputAddress}
          onChange={event => setInputAddress(event.target.value)}
          placeholder="0x quote token address"
        />
        <button type="button" onClick={handleAdd}>
          Add
        </button>
      </div>
      <div className={`${styles.qerunButtonContainer} ${styles.qerunMarginBottom16}`}>
                <button type="button" onClick={handleIncludeDefault} className={styles.qerunButton__small} disabled={!defaultQuote}>
          Include USD token
        </button>
        <button type="button" onClick={handleReset} className={styles.qerunButton__small}>
          Reset
        </button>
        <button type="button" onClick={loadPairs} className={styles.qerunButton__small}>
          Refresh
        </button>
      </div>
      <div className={styles.qerunMarginBottom16}>
        <strong>Draft pair list ({draftPairs.length}):</strong>
        {draftPairs.length === 0 ? (
          <p className={styles.qerunMarginTop8}>No tokens selected yet.</p>
        ) : (
          <ul>
            {draftPairs.map(address => (
              <li key={address}>
                <code>{address}</code>{' '}
                <button
                  type="button"
                  onClick={() => handleRemove(address)}
                  className={styles.qerunButton__danger}
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
        className={styles.qerunButton__large}
      >
        {loading ? 'Submitting…' : 'Submit updatePairs'}
      </button>
      {status && (
        <p className={`${styles.qerunAlert} ${status.includes('failed') ? styles.qerunAlert__error : styles.qerunAlert__success}`}>
          {status}
        </p>
      )}
      <div className={styles.qerunMarginTop24}>
        <strong>Current on-chain pairs ({currentPairs.length}):</strong>
        {currentPairs.length === 0 ? (
          <p className={styles.qerunMarginTop8}>No pairs registered yet.</p>
        ) : (
          <ul>
            {currentPairs.map(address => (
              <li key={address}>
                <code>{address}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
      {configEntries.length > 0 && (
        <div className={styles.qerunMarginTop24}>
          <strong>StateManager Registry:</strong>
          <ul>
            {configEntries.map(entry => (
              <li key={entry.label}>
                <b>{entry.label}:</b> <code>{entry.value}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default AdminPanel;
