import React, { useState } from 'react';

const Swap: React.FC = () => {
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');

  const handleSwap = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Swapping ${amount} ${fromToken} to ${toToken}`);
  };

  return (
    <form
      onSubmit={handleSwap}
      style={{
        maxWidth: 400,
        margin: '40px auto',
        padding: 24,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <h2>Token Swap</h2>
      <label>
        From Token
        <input
          type="text"
          placeholder="From Token"
          value={fromToken}
          onChange={e => setFromToken(e.target.value)}
          style={{ padding: 8, fontSize: 16, marginTop: 4 }}
        />
      </label>
      <label>
        To Token
        <input
          type="text"
          placeholder="To Token"
          value={toToken}
          onChange={e => setToToken(e.target.value)}
          style={{ padding: 8, fontSize: 16, marginTop: 4 }}
        />
      </label>
      <label>
        Amount
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ padding: 8, fontSize: 16, marginTop: 4 }}
        />
      </label>
      <button
        type="submit"
        style={{
          padding: '10px 20px',
          fontSize: 16,
          borderRadius: 4,
          border: 'none',
          background: '#1976d2',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Swap
      </button>
    </form>
  );
};

export default Swap;
