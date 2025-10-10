import React, { useState, useEffect } from 'react';
import { WalletConnectModal } from '@walletconnect/modal';
import styles from '../styles/qerunTheme.module.css';

interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  request: (args: { method: string; params?: any }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const Connect: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [walletConnectModal, setWalletConnectModal] = useState<WalletConnectModal | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initialize WalletConnect Modal
  useEffect(() => {
    // Initialize WalletConnect immediately to avoid delays
    try {
      // Using a demo project ID for development - replace with your own from WalletConnect Cloud
      const modal = new WalletConnectModal({
        projectId: 'd9f61ed66163e5f8c12e1c7d633792a6', // Replace with your actual project ID from https://cloud.walletconnect.com
        chains: ['eip155:1'],
        themeMode: 'dark'
      });
      setWalletConnectModal(modal);
    } catch (error) {
      console.error('Failed to initialize WalletConnect:', error);
      // Fallback: set modal to null so the UI still works without WalletConnect
      setWalletConnectModal(null);
    }
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            setIsConnected(true);
            setAccount(accounts[0]);
          }
        } catch (err) {
          console.error('Error checking connection:', err);
        }
      }
    };

    checkConnection();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: unknown) => {
        const accountArray = accounts as string[];
        if (accountArray && accountArray.length > 0) {
          setIsConnected(true);
          setAccount(accountArray[0]);
        } else {
          setIsConnected(false);
          setAccount('');
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, []);

  const handleWalletConnect = async () => {
    if (!walletConnectModal || isModalOpen) {
      return;
    }

    setIsModalOpen(true);
    try {
      const result = await walletConnectModal.openModal();
      // Handle successful connection if needed
      console.log('WalletConnect result:', result);
      // Note: Full WalletConnect integration would require additional setup
      // This is a basic implementation - you'd need to handle the connection result
    } catch (error) {
      console.error('WalletConnect failed or cancelled:', error);
      // User cancelled or connection failed
    } finally {
      setIsModalOpen(false);
    }
  };

  const handleConnect = async () => {
    if (isModalOpen) return;
    await handleWalletConnect();
  };

  const handleDisconnect = () => {
    const confirmed = window.confirm(
      'This will disconnect your wallet from this app only. Your wallet will remain connected to the browser.\n\nTo fully disconnect, use your wallet extension.'
    );
    if (confirmed) {
      setIsConnected(false);
      setAccount('');
      // Clear any app-specific data if needed
    }
  };

  return (
    <>
      <div className={styles.connectContainer}>
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isModalOpen}
          className={`${styles.qerunConnectButton} ${isConnected ? styles.connected : ''} ${isModalOpen ? styles.disabled : ''}`}
        >
          {isModalOpen ? 'Connecting...' : isConnected ? `Disconnect App (${account.slice(0, 6)}...${account.slice(-4)})` : 'Connect Wallet'}
        </button>
        {isConnected && (
          <p className={styles.connectHelpText}>
            💡 Disconnect removes app access only. Use your wallet to fully disconnect.
          </p>
        )}
      </div>
    </>
  );
};

export default Connect;
