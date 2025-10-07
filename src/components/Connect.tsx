import React from 'react';

const Connect: React.FC = () => {
  const handleConnect = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        alert('Wallet connected!');
      } catch (err) {
        alert('Connection failed: ' + (err as Error).message);
      }
    } else {
      alert('No Ethereum wallet found. Please install MetaMask or another wallet.');
    }
  };

  return (
    <button
      onClick={handleConnect}
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        padding: '8px 16px',
        fontSize: '16px',
        borderRadius: '4px',
        border: 'none',
        background: '#43a047',
        color: '#fff',
        cursor: 'pointer',
        zIndex: 10,
      }}
    >
      Connect Wallet
    </button>
  );
};

export default Connect;
