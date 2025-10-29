import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CONTRACT_CONFIG, REGISTRY_IDS, DEFAULT_DECIMALS } from '../config';
import StateManagerAbi from '../abi/StateManager.json';
import SwapAbi from '../abi/Swap.json';
// Wallet helpers are handled in NetworkManager
import { useAccount, useBlockNumber } from 'wagmi';
import type { MetricsData } from './Metrics';

type SwapProps = {
    refreshKey?: number;
    onMetricsUpdate?: (m: MetricsData) => void;
};

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
];

interface ResolvedAddresses {
    qer: string;
    usd: string;
    swap: string;
}

const BPS = 10000n;

const Swap: React.FC<SwapProps> = ({ refreshKey, onMetricsUpdate }) => {
    const { address: connectedAddress, chainId: connectedChainId } = useAccount();
    const { data: blockNumber } = useBlockNumber({ watch: true });
    const [addresses, setAddresses] = useState<ResolvedAddresses | null>(null);
    // Metrics are lifted to App via onMetricsUpdate
    const [rate, setRate] = useState('Loading...');
    const [networkWarning, setNetworkWarning] = useState<string | null>(null);
    const [feeBps, setFeeBps] = useState<bigint>(0n);
    const [availablePairs, setAvailablePairs] = useState<string[]>([]);
    const [fromToken, setFromToken] = useState<string>('');
    const [toToken, setToToken] = useState<string>('');
    const [availableTokens, setAvailableTokens] = useState<{address: string, symbol: string}[]>([]);
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [decimals, setDecimals] = useState<Record<string, number>>({});
    const [pairReserves, setPairReserves] = useState<Record<string, {reserveQer: bigint, reserveQuote: bigint}>>({});
    const loadState = useCallback(async () => {
        if (!window.ethereum) return;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const chainId = network?.chainId?.toString();

        if (chainId !== CONTRACT_CONFIG.chainId) {
            const warn = `Connected network ${chainId ?? 'unknown'} is wrong. Please switch to chain ${CONTRACT_CONFIG.chainId}.`;
            setNetworkWarning(warn);
            setAddresses(null);
            setAvailableTokens([]);
            setBalances({});
            setDecimals({});
            setPairReserves({});
            // metrics cleared via callback above
            setRate('Wrong network');
            setAvailablePairs([]);
            onMetricsUpdate?.({
                swapUsdBalance: '0',
                swapQerBalance: '0',
                usdTotalSupply: '0',
                qerTotalSupply: '0',
            });
            return;
        }

        setNetworkWarning(null);

        const activeAccount = connectedAddress;

        let resolved: ResolvedAddresses;
        try {
            const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager!, StateManagerAbi.abi, provider);
            const addressOf = stateManager.getFunction('addressOf');
            const hasEntry = (() => {
                try {
                    return stateManager.getFunction('has');
                } catch {
                    return undefined;
                }
            })();
            const requireAddress = async (id: string): Promise<string> => {
                if (hasEntry) {
                    try {
                        const has = await hasEntry(id);
                        if (!has) throw new Error('missing');
                    } catch {
                        throw new Error('missing');
                    }
                }
                try {
                    return await addressOf(id);
                } catch {
                    throw new Error('missing');
                }
            };

            const [qerFromState, usdFromState, swapFromState] = await Promise.all([
                requireAddress(REGISTRY_IDS.MAIN_CONTRACT),
                requireAddress(REGISTRY_IDS.PRIMARY_QUOTE),
                requireAddress(REGISTRY_IDS.SWAP_CONTRACT),
            ]);

            if (
                !qerFromState ||
                qerFromState === ethers.ZeroAddress ||
                !usdFromState ||
                usdFromState === ethers.ZeroAddress ||
                !swapFromState ||
                swapFromState === ethers.ZeroAddress
            ) {
                throw new Error('StateManager missing required contract addresses');
            }

            resolved = {
                qer: qerFromState,
                usd: usdFromState,
                swap: swapFromState,
            };
            setAddresses(resolved);
        } catch (error) {
            console.error('Failed to resolve contract addresses from StateManager', error);
            setAddresses(null);
            setNetworkWarning('Unable to load contract addresses from StateManager. Check deployment configuration.');
            setAvailablePairs([]);
            setAvailableTokens([]);
            setBalances({});
            setDecimals({});
            setPairReserves({});
            return;
        }

        const { swap: swapAddress, usd: usdTokenAddress, qer: qerTokenAddress } = resolved;
        const usdToken = new ethers.Contract(usdTokenAddress, ERC20_ABI, provider);
        const qerToken = new ethers.Contract(qerTokenAddress, ERC20_ABI, provider);

        const [usdDecRaw, qerDecRaw] = await Promise.all([
            usdToken.decimals().catch(() => DEFAULT_DECIMALS.usd),
            qerToken.decimals().catch(() => DEFAULT_DECIMALS.qer),
        ]);
        const usdDec = Number(usdDecRaw);
        const qerDec = Number(qerDecRaw);

        // Fetch symbols
        const qerSymbol = await qerToken.symbol().catch(() => 'QER');
        const usdSymbol = await usdToken.symbol().catch(() => 'USD');

        const tokens = [{address: qerTokenAddress, symbol: qerSymbol}, {address: usdTokenAddress, symbol: usdSymbol}];
        for (const pairAddr of availablePairs) {
            if (pairAddr === usdTokenAddress) continue;
            const token = new ethers.Contract(pairAddr, ERC20_ABI, provider);
            const symbol = await token.symbol().catch(() => pairAddr.slice(0,6) + '...');
            tokens.push({address: pairAddr, symbol});
        }
        setAvailableTokens(tokens);

        // Set initial from/to
        setFromToken(qerTokenAddress);
        setToToken(usdTokenAddress);

        // Fetch decimals
        const decs: Record<string, number> = {};
        decs[qerTokenAddress] = qerDec;
        decs[usdTokenAddress] = usdDec;
        for (const token of tokens) {
            if (!decs[token.address]) {
                const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
                decs[token.address] = Number(await contract.decimals().catch(() => 18));
            }
        }
        setDecimals(decs);

        // Fetch balances
        if (activeAccount) {
            const bals: Record<string, string> = {};
            for (const token of tokens) {
                const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
                const balance = await contract.balanceOf(activeAccount);
                bals[token.address] = ethers.formatUnits(balance, decs[token.address]);
            }
            setBalances(bals);
        } else {
            setBalances({});
        }

        const [swapUsd, swapQer, usdSupply, qerSupply] = await Promise.all([
            usdToken.balanceOf(swapAddress),
            qerToken.balanceOf(swapAddress),
            usdToken.totalSupply(),
            qerToken.totalSupply(),
        ]);
        const nextSwapUsd = ethers.formatUnits(swapUsd, usdDec);
        const nextSwapQer = ethers.formatUnits(swapQer, qerDec);
        const nextUsdSupply = ethers.formatUnits(usdSupply, usdDec);
        const nextQerSupply = ethers.formatUnits(qerSupply, qerDec);
        // metrics managed by parent

        if (activeAccount) {
            const [usd, qer] = await Promise.all([
                usdToken.balanceOf(activeAccount),
                qerToken.balanceOf(activeAccount),
            ]);
            // balances already set in the loop
        }

        const swap = new ethers.Contract(swapAddress, SwapAbi.abi, provider);
        let nextRate = 'N/A';
        try {
            const [reserveQerRaw, reserveUsdRaw]: [bigint, bigint] = await swap.getReserves(usdTokenAddress);
            const currentFeeBps: bigint = await swap.feeBps();
            setFeeBps(currentFeeBps);
            if (reserveQerRaw > 0n && reserveUsdRaw > 0n) {
                const usdPerQer =
                    Number(ethers.formatUnits(reserveUsdRaw, usdDec)) /
                    Number(ethers.formatUnits(reserveQerRaw, qerDec));
                const qerPerUsd =
                    Number(ethers.formatUnits(reserveQerRaw, qerDec)) /
                    Number(ethers.formatUnits(reserveUsdRaw, usdDec));
                nextRate = `1 QER = ${usdPerQer.toFixed(4)} USD | 1 USD = ${qerPerUsd.toFixed(4)} QER`;
                setRate(nextRate);
            } else {
                nextRate = 'N/A';
                setRate(nextRate);
            }
        } catch {
            nextRate = 'Pair data unavailable';
            setRate(nextRate);
            setFeeBps(0n);
        }

        try {
            const pairs: string[] = await swap.allPairs();
            const normalised = pairs.map(addr => ethers.getAddress(addr));
            setAvailablePairs(normalised);
        } catch {
            setAvailablePairs([]);
        }

        // Fetch pair reserves
        const reserves: Record<string, {reserveQer: bigint, reserveQuote: bigint}> = {};
        for (const pairAddr of availablePairs) {
            try {
                const [reserveQerRaw, reserveQuoteRaw]: [bigint, bigint] = await swap.getReserves(pairAddr);
                reserves[pairAddr] = {reserveQer: reserveQerRaw, reserveQuote: reserveQuoteRaw};
            } catch {
                reserves[pairAddr] = {reserveQer: 0n, reserveQuote: 0n};
            }
        }
        setPairReserves(reserves);

        onMetricsUpdate?.({
            swapUsdBalance: nextSwapUsd,
            swapQerBalance: nextSwapQer,
            usdTotalSupply: nextUsdSupply,
            qerTotalSupply: nextQerSupply,
        });
    }, [connectedAddress, connectedChainId]);

    useEffect(() => {
        // refresh on every new block and on hook mount
        void loadState();
    }, [blockNumber, loadState, refreshKey]);

    const estimateAmountOut = useCallback(
        (inputAmount: bigint, fromAddress: string, toAddress: string): bigint => {
            if (inputAmount === 0n) return 0n;
            const effectiveFee = feeBps > BPS ? BPS : feeBps;
            const amountInWithFee = (inputAmount * (BPS - effectiveFee)) / BPS;
            if (amountInWithFee === 0n) return 0n;
            if (fromAddress === addresses?.qer && pairReserves[toAddress]) {
                const res = pairReserves[toAddress];
                if (res.reserveQer === 0n || res.reserveQuote === 0n) return 0n;
                return (amountInWithFee * res.reserveQuote) / (res.reserveQer + amountInWithFee);
            } else if (toAddress === addresses?.qer && pairReserves[fromAddress]) {
                const res = pairReserves[fromAddress];
                if (res.reserveQer === 0n || res.reserveQuote === 0n) return 0n;
                return (amountInWithFee * res.reserveQer) / (res.reserveQuote + amountInWithFee);
            } else {
                return 0n;
            }
        },
        [feeBps, addresses?.qer, pairReserves],
    );

    const handleFromTokenChange = (value: string) => {
        setFromToken(value);
        if (toToken === value) {
            const other = availableTokens.find(t => t.address !== value);
            setToToken(other ? other.address : '');
        }
    };

    const handleToTokenChange = (value: string) => {
        setToToken(value);
        if (fromToken === value) {
            const other = availableTokens.find(t => t.address !== value);
            setFromToken(other ? other.address : '');
        }
    };


    const [amount, setAmount] = useState('');
    const [isSwapping, setIsSwapping] = useState(false);

    // Check if user has sufficient balance for the swap
    const hasInsufficientBalance = useMemo(() => {
        if (!amount || !fromToken) return false;

        const swapAmount = parseFloat(amount);
        if (isNaN(swapAmount) || swapAmount <= 0) return false;

        const userBalance = parseFloat(balances[fromToken] || '0');
        return userBalance < swapAmount;
    }, [amount, fromToken, balances]);

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSwapping) return;
        if (!window.ethereum) {
            alert('No wallet found');
            return;
        }
        if (!amount || Number(amount) <= 0) {
            alert('Enter an amount greater than zero');
            return;
        }

        try {
            setIsSwapping(true);
            if (!addresses) {
                alert('Contract addresses not loaded yet');
                return;
            }
            const { swap: swapAddress } = addresses;
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(swapAddress, SwapAbi.abi, signer);
            const fromDecimals = decimals[fromToken] || 18;
            const amountIn = ethers.parseUnits(amount, fromDecimals);
            const expectedOut = estimateAmountOut(amountIn, fromToken, toToken);
            const minAmountOut = expectedOut > 0n ? (expectedOut * 98n) / 100n : 0n;

            const tx = await contract.swap(fromToken, toToken, amountIn, minAmountOut);
            await tx.wait?.();

            alert('Swap confirmed on-chain. Balances updated.');
            setAmount('');
            await loadState();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            alert('Swap failed: ' + message);
        } finally {
            setIsSwapping(false);
        }
    };

    return (
      <Paper
        component="form"
        onSubmit={handleSwap}
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 'var(--qerun-radius-xl)',
          border: '1px solid var(--qerun-gold-alpha-25)',
          backdropFilter: 'blur(10px)',
          background: 'var(--qerun-card)',
          color: 'var(--qerun-text)'
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ color: 'var(--qerun-gold)', fontWeight: 700 }}>
              Swap tokens
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--qerun-text-muted)' }}>
              Choose the direction, enter an amount, and confirm with your wallet.
              Price impact is calculated as used by the governance module.
            </Typography>
          </Box>

          {networkWarning && (
            <Alert severity="warning" variant="outlined">{networkWarning}</Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2, background: 'var(--qerun-card)' }}>
            <Typography variant="caption" sx={{ color: 'var(--qerun-gold)' }}>Current Rate</Typography>
            <Typography variant="h6" sx={{ m: 0, color: 'var(--qerun-text-light)' }}>{rate}</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, background: 'var(--qerun-card)' }}>
            <Typography variant="caption" sx={{ color: 'var(--qerun-gold)' }}>Available Pairs ({availablePairs.length})</Typography>
            {availablePairs.length === 0 ? (
              <Typography variant="body2" sx={{ mt: 1, color: 'var(--qerun-text-muted)' }}>No pairs registered yet.</Typography>
            ) : (
              <Stack component="ul" sx={{ pl: 2, mt: 1 }}>
                {availablePairs.map((address) => (
                  <Box component="li" key={address} sx={{
                    '& code': {
                      wordBreak: 'break-all',
                      whiteSpace: 'normal',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '0.875rem',
                      color: 'var(--qerun-text-light)'
                    }
                  }}>
                    <code>{address}</code>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="from-token-label">From token</InputLabel>
              <Select
                labelId="from-token-label"
                label="From token"
                value={fromToken}
                onChange={(e) => handleFromTokenChange(e.target.value)}
              >
                {availableTokens.map(token => (
                  <MenuItem key={token.address} value={token.address}>{token.symbol}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="to-token-label">To token</InputLabel>
              <Select
                labelId="to-token-label"
                label="To token"
                value={toToken}
                onChange={(e) => handleToTokenChange(e.target.value)}
              >
                {availableTokens.map(token => (
                  <MenuItem key={token.address} value={token.address}>{token.symbol}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="number"
              label={`Amount in ${availableTokens.find(t => t.address === fromToken)?.symbol || 'token'}`}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0, step: 'any' }}
              fullWidth
            />
            <Typography variant="caption" align="right" sx={{ color: 'var(--qerun-text-muted)' }}>
              Balance: {balances[fromToken] || '0'} {availableTokens.find(t => t.address === fromToken)?.symbol || ''}
            </Typography>

            {amount && parseFloat(amount) > 0 && (
              <Box sx={{ color: 'var(--qerun-text-muted)', fontSize: 14 }}>
                Estimated: {(() => {
                  const numAmount = parseFloat(amount);
                  const inputDecimals = decimals[fromToken] || 18;
                  const outputDecimals = decimals[toToken] || 18;
                  const estimatedBigInt = estimateAmountOut(ethers.parseUnits(numAmount.toString(), inputDecimals), fromToken, toToken);
                  return ethers.formatUnits(estimatedBigInt, outputDecimals);
                })()} {availableTokens.find(t => t.address === toToken)?.symbol || ''}
                <br />
                Min received: {(() => {
                  const numAmount = parseFloat(amount);
                  const inputDecimals = decimals[fromToken] || 18;
                  const outputDecimals = decimals[toToken] || 18;
                  const estimatedBigInt = estimateAmountOut(ethers.parseUnits(numAmount.toString(), inputDecimals), fromToken, toToken);
                  const minBigInt = estimatedBigInt > 0n ? (estimatedBigInt * 98n) / 100n : 0n;
                  return ethers.formatUnits(minBigInt, outputDecimals);
                })()} {availableTokens.find(t => t.address === toToken)?.symbol || ''} (2% slippage)
                <br />
                Price impact: {(() => {
                  const numAmount = parseFloat(amount);
                  if (numAmount <= 0) return '0.00%';
                  const inputDecimals = decimals[fromToken] || 18;
                  const inputAmount = ethers.parseUnits(numAmount.toString(), inputDecimals);
                  
                  // Contract-style price impact calculation: (amountIn * BPS) / (reserve + amountIn)
                  const BPS = 10000n;
                  let impact: number;
                  if (fromToken === addresses?.qer && pairReserves[toToken]) {
                    const res = pairReserves[toToken];
                    impact = Number((inputAmount * BPS) / (res.reserveQer + inputAmount));
                  } else if (toToken === addresses?.qer && pairReserves[fromToken]) {
                    const res = pairReserves[fromToken];
                    impact = Number((inputAmount * BPS) / (res.reserveQuote + inputAmount));
                  } else {
                    impact = 0;
                  }
                  
                  const impactPercent = impact / 100;
                  const willBeBlocked = fromToken === addresses?.qer && impactPercent > 0.5;
                  
                  return impactPercent.toFixed(2) + '% ' + (willBeBlocked ? '(BLOCKED by governance)' : '');
                })()}
              </Box>
            )}

            {hasInsufficientBalance && (
              <Alert severity="error">
                Insufficient {availableTokens.find(t => t.address === fromToken)?.symbol || 'token'} balance. You have {balances[fromToken] || '0'} {availableTokens.find(t => t.address === fromToken)?.symbol || 'token'}.
              </Alert>
            )}
          </Stack>

          <Box>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSwapping || !amount || parseFloat(amount) <= 0 || hasInsufficientBalance}
              sx={{
                borderRadius: 'var(--qerun-radius-xl, 16px)'
              }}
              startIcon={isSwapping ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isSwapping ? 'Swapping…' : hasInsufficientBalance ? 'Insufficient Balance' : 'Swap now'}
            </Button>
          </Box>

          <Typography variant="caption" align="center" sx={{ color: 'var(--qerun-text-muted)' }}>
            Treasury fee: {(Number(feeBps) / 100).toFixed(2)} bps
          </Typography>
        </Stack>
      </Paper>
    );
};

export default Swap;
