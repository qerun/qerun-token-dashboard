import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, TextField, Typography, Alert } from '@mui/material';

const ERC20_MINTER_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function mint(address to, uint256 amount)',
];

const TokenMinter: React.FC = () => {
  const [tokenAddr, setTokenAddr] = useState('');
  const [toAddr, setToAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [decimals, setDecimals] = useState<number | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDecimals(null);
    setSymbol(null);
    setStatus(null);
    if (!tokenAddr) return;
    let checksum: string;
    try {
      checksum = ethers.getAddress(tokenAddr);
    } catch {
      return;
    }
    (async () => {
      try {
        if (!window.ethereum) return;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const token = new ethers.Contract(checksum, ERC20_MINTER_ABI, provider);
        const d = await token.decimals();
        const s = await token.symbol();
        setDecimals(Number(d));
        setSymbol(s);
      } catch (err) {
        // ignore errors fetching metadata
        setDecimals(null);
        setSymbol(null);
      }
    })();
  }, [tokenAddr]);

  const handleMint = async () => {
    setStatus(null);
    if (!window.ethereum) {
      setStatus('No web3 provider available.');
      return;
    }
    let tokenChecksum: string;
    let toChecksum: string;
    try {
      tokenChecksum = ethers.getAddress(tokenAddr);
    } catch {
      setStatus('Invalid token address');
      return;
    }
    try {
      toChecksum = ethers.getAddress(toAddr);
    } catch {
      setStatus('Invalid recipient address');
      return;
    }
    if (!amount) {
      setStatus('Enter amount to mint');
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(tokenChecksum, ERC20_MINTER_ABI, signer);
      const useDecimals = decimals ?? 18;
      const parsed = ethers.parseUnits(amount, useDecimals);
      const tx = await token.mint(toChecksum, parsed);
      setStatus('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      setStatus(`Minted ${amount}${symbol ? ' ' + symbol : ''} to ${toChecksum}`);
      setAmount('');
      setToAddr('');
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || String(err);
      setStatus(`Mint failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid var(--qerun-gold-alpha-18)', mb: 2 }}>
      <Typography variant="h6" sx={{ color: 'var(--qerun-gold)', fontWeight: 600, mb: 1 }}>Token Minter</Typography>
      <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)', mb: 2 }}>
        Provide a token contract address that exposes a public mint(address,uint256) and call mint.
      </Typography>

      <TextField
        fullWidth
        label="Token address"
        placeholder="0x..."
        value={tokenAddr}
        onChange={(e) => setTokenAddr(e.target.value)}
        sx={{ mb: 1 }}
      />
      <TextField
        fullWidth
        label="Recipient address"
        placeholder="0x..."
        value={toAddr}
        onChange={(e) => setToAddr(e.target.value)}
        sx={{ mb: 1 }}
      />
      <TextField
        fullWidth
        label={`Amount ${symbol ? `(${symbol})` : ''}`}
        placeholder="1.5"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        sx={{ mb: 1 }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={handleMint} disabled={loading}>
          {loading ? 'Minting…' : 'Mint'}
        </Button>
      </Box>

      {decimals !== null && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          Decimals: {decimals}
        </Typography>
      )}

      {status && (
        <Alert sx={{ mt: 2 }} severity={status.startsWith('Minted') ? 'success' : 'info'}>{status}</Alert>
      )}
    </Box>
  );
};

export default TokenMinter;
