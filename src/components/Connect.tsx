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

interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  checkAvailability: () => boolean;
  connect: () => Promise<string[]>;
}

const Connect: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [walletConnectModal, setWalletConnectModal] = useState<WalletConnectModal | null>(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
                            window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize WalletConnect Modal
  useEffect(() => {
    // Delay WalletConnect initialization to avoid immediate API calls
    const timer = setTimeout(() => {
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
    }, 1000); // Delay by 1 second

    return () => clearTimeout(timer);
  }, []);

  // Define available wallet providers
  const walletProviders: WalletProvider[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      checkAvailability: () => !!window.ethereum?.isMetaMask,
      connect: async () => {
        if (!window.ethereum) throw new Error('MetaMask not found');
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        return window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>;
      }
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: '📱',
      checkAvailability: () => !!window.ethereum?.isCoinbaseWallet,
      connect: async () => {
        if (!window.ethereum) throw new Error('Coinbase Wallet not found');
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        return window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>;
      }
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: '🔒',
      checkAvailability: () => !!window.ethereum?.isTrust,
      connect: async () => {
        if (!window.ethereum) throw new Error('Trust Wallet not found');
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        return window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>;
      }
    },
    {
      id: 'generic',
      name: 'Browser Wallet',
      icon: '🌐',
      checkAvailability: () => !!window.ethereum && !window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet && !window.ethereum.isTrust,
      connect: async () => {
        if (!window.ethereum) throw new Error('No Ethereum wallet found');
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        return window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>;
      }
    }
  ];

  // Mobile wallet apps (for guidance)
  const mobileWalletApps = [
    {
      id: 'metamask-mobile',
      name: 'MetaMask Mobile',
      icon: '🦊',
      url: 'https://metamask.app.link/dapp/' + window.location.href
    },
    {
      id: 'coinbase-mobile',
      name: 'Coinbase Wallet',
      icon: '📱',
      url: 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(window.location.href)
    },
    {
      id: 'trust-mobile',
      name: 'Trust Wallet',
      icon: '🔒',
      url: 'https://link.trustwallet.com/wc?uri=' + encodeURIComponent('wc:connect?uri=' + window.location.href)
    }
  ];

  useEffect(() => {
    // Check which wallets are available
    const available = walletProviders.filter(wallet => wallet.checkAvailability());
    setAvailableWallets(available);

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

  const handleWalletSelect = async (wallet: WalletProvider) => {
    try {
      const accounts = await wallet.connect();
      if (accounts && accounts.length > 0) {
        setIsConnected(true);
        setAccount(accounts[0]);
        setShowWalletModal(false);
      }
    } catch (err) {
      alert('Connection failed: ' + (err as Error).message);
    }
  };

  const handleWalletConnect = async () => {
    if (!walletConnectModal) {
      alert('WalletConnect is not initialized yet. Please try again.');
      return;
    }

    try {
      await walletConnectModal.openModal();
      // Note: Full WalletConnect integration would require additional setup
      // This is a basic implementation - you'd need to handle the connection result
      setShowWalletModal(false);
    } catch (error) {
      console.error('WalletConnect failed:', error);
      alert('WalletConnect connection failed. Please try again.');
    }
  };

  const handleConnect = () => {
    // Always show wallet selection modal for better UX
    // Users should see available options even if there's only one
    setShowWalletModal(true);
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
          className={`${styles.qerunConnectButton} ${isConnected ? styles.connected : ''}`}
        >
          {isConnected ? `Disconnect App (${account.slice(0, 6)}...${account.slice(-4)})` : 'Connect Wallet'}
        </button>
        {isConnected && (
          <p className={styles.connectHelpText}>
            💡 Disconnect removes app access only. Use your wallet to fully disconnect.
          </p>
        )}
      </div>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className={styles.walletModalOverlay} onClick={() => setShowWalletModal(false)}>
          <div className={styles.walletModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.walletModalTitle}>
              {isMobile ? 'Connect a Wallet' : 'Connect a Wallet'}
            </h3>
            <p className={styles.walletModalSubtitle}>
              {isMobile
                ? 'Choose your preferred wallet to connect to Qerun'
                : 'Choose your preferred wallet to connect to Qerun'
              }
            </p>

            <div className={styles.walletList}>
              {isMobile ? (
                // Mobile: Show both browser wallets and WalletConnect option
                <>
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      className={styles.walletOption}
                      onClick={() => handleWalletSelect(wallet)}
                    >
                      <span className={styles.walletIcon}>{wallet.icon}</span>
                      <span className={styles.walletName}>{wallet.name}</span>
                    </button>
                  ))}
                  {walletConnectModal && (
                    <button
                      className={styles.walletOption}
                      onClick={handleWalletConnect}
                    >
                      <span className={styles.walletIcon}>🔗</span>
                      <span className={styles.walletName}>WalletConnect</span>
                    </button>
                  )}
                  <div className={styles.walletDivider}>
                    <span>Or open in wallet app</span>
                  </div>
                  {mobileWalletApps.map((wallet) => (
                    <a
                      key={wallet.id}
                      href={wallet.url}
                      className={styles.walletOption}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.walletIcon}>{wallet.icon}</span>
                      <span className={styles.walletName}>{wallet.name}</span>
                      <span className={styles.externalLink}>↗</span>
                    </a>
                  ))}
                </>
              ) : (
                // Desktop: Show browser extensions
                availableWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    className={styles.walletOption}
                    onClick={() => handleWalletSelect(wallet)}
                  >
                    <span className={styles.walletIcon}>{wallet.icon}</span>
                    <span className={styles.walletName}>{wallet.name}</span>
                  </button>
                ))
              )}
            </div>

            {isMobile && availableWallets.length === 0 && (
              <p className={styles.mobileHelpText}>
                💡 Don't have a wallet? Get MetaMask, Coinbase Wallet, or use WalletConnect.
              </p>
            )}

            <button
              className={styles.walletModalClose}
              onClick={() => setShowWalletModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Connect;
