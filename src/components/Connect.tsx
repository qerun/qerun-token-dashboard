import React, { useState, useEffect } from 'react';

const Connect: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
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
      (window.ethereum as any).on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setIsConnected(true);
          setAccount(accounts[0]);
        } else {
          setIsConnected(false);
          setAccount('');
        }
      });
    }

    return () => {
      if (window.ethereum) {
        (window.ethereum as any).removeListener('accountsChanged', () => {});
      }
    };
  }, []);

  const handleConnect = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setIsConnected(true);
          setAccount(accounts[0]);
        }
      } catch (err) {
        alert('Connection failed: ' + (err as Error).message);
      }
    } else {
      alert('No Ethereum wallet found. Please install MetaMask or another wallet.');
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAccount('');
    // Note: MetaMask doesn't have a disconnect method, but we can clear local state
  };

  return (
    <button
      onClick={isConnected ? handleDisconnect : handleConnect}
      style={{
        padding: '8px 16px',
        fontSize: '16px',
        borderRadius: '4px',
        border: 'none',
        background: isConnected ? '#f44336' : '#43a047',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {isConnected ? `Disconnect (${account.slice(0, 6)}...${account.slice(-4)})` : 'Connect Wallet'}
    </button>
  );
};

export default Connect;
