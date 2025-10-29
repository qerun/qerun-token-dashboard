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
    const [usdBalance, setUsdBalance] = useState('0');
    const [qerBalance, setQerBalance] = useState('0');
    // Metrics are lifted to App via onMetricsUpdate
    const [rate, setRate] = useState('Loading...');
    const [networkWarning, setNetworkWarning] = useState<string | null>(null);
    const [reserveQer, setReserveQer] = useState<bigint>(0n);
    const [reserveUsd, setReserveUsd] = useState<bigint>(0n);
    const [feeBps, setFeeBps] = useState<bigint>(0n);
    const [usdDecimals, setUsdDecimals] = useState(18);
    const [qerDecimals, setQerDecimals] = useState(18);
    const loadState = useCallback(async () => {
        if (!window.ethereum) return;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const chainId = network?.chainId?.toString();

        if (chainId !== CONTRACT_CONFIG.chainId) {
            const warn = `Connected network ${chainId ?? 'unknown'} is wrong. Please switch to chain ${CONTRACT_CONFIG.chainId}.`;
            setNetworkWarning(warn);
            setAddresses(null);
            setUsdBalance('0');
            setQerBalance('0');
            // metrics cleared via callback above
            setRate('Wrong network');
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
            const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi.abi, provider);
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
        setUsdDecimals(usdDec);
        setQerDecimals(qerDec);

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
            setUsdBalance(ethers.formatUnits(usd, usdDec));
            setQerBalance(ethers.formatUnits(qer, qerDec));
        } else {
            setUsdBalance('0');
            setQerBalance('0');
        }

        const swap = new ethers.Contract(swapAddress, SwapAbi.abi, provider);
        let nextRate = 'N/A';
        try {
            const [reserveQerRaw, reserveUsdRaw]: [bigint, bigint] = await swap.getReserves(usdTokenAddress);
            const currentFeeBps: bigint = await swap.feeBps();
            setReserveQer(reserveQerRaw);
            setReserveUsd(reserveUsdRaw);
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
            nextRate = 'Pair not registered';
            setRate(nextRate);
            setReserveQer(0n);
            setReserveUsd(0n);
            setFeeBps(0n);
        }

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
        (inputAmount: bigint, source: 'USD' | 'QER'): bigint => {
            if (inputAmount === 0n || reserveQer === 0n || reserveUsd === 0n) return 0n;
            const effectiveFee = feeBps > BPS ? BPS : feeBps;
            const amountInWithFee = (inputAmount * (BPS - effectiveFee)) / BPS;
            if (amountInWithFee === 0n) return 0n;
            if (source === 'USD') {
                const denominator = reserveUsd + amountInWithFee;
                if (denominator === 0n) return 0n;
                return (amountInWithFee * reserveQer) / denominator;
            }
            const denominator = reserveQer + amountInWithFee;
            if (denominator === 0n) return 0n;
            return (amountInWithFee * reserveUsd) / denominator;
        },
        [feeBps, reserveQer, reserveUsd],
    );

    const [fromToken, setFromToken] = useState<'USD' | 'QER'>('USD');
    const [toToken, setToToken] = useState<'USD' | 'QER'>('QER');

    const handleFromTokenChange = (value: 'USD' | 'QER') => {
        setFromToken(value);
        setToToken(value === 'USD' ? 'QER' : 'USD');
    };

    const handleToTokenChange = (value: 'USD' | 'QER') => {
        setToToken(value);
        setFromToken(value === 'USD' ? 'QER' : 'USD');
    };


    const [amount, setAmount] = useState('');
    const [isSwapping, setIsSwapping] = useState(false);

    // Check if user has sufficient balance for the swap
    const hasInsufficientBalance = useMemo(() => {
        if (!amount || !fromToken) return false;

        const swapAmount = parseFloat(amount);
        if (isNaN(swapAmount) || swapAmount <= 0) return false;

        const userBalance = fromToken === 'USD' ? parseFloat(usdBalance) : parseFloat(qerBalance);
        return userBalance < swapAmount;
    }, [amount, fromToken, usdBalance, qerBalance]);

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
            const { swap: swapAddress, usd: usdTokenAddress, qer: qerTokenAddress } = addresses;
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(swapAddress, SwapAbi.abi, signer);
            const fromDecimals = fromToken === 'USD' ? usdDecimals : qerDecimals;
            const amountIn = ethers.parseUnits(amount, fromDecimals);
            const expectedOut = estimateAmountOut(amountIn, fromToken);
            const minAmountOut = expectedOut > 0n ? (expectedOut * 98n) / 100n : 0n;

            if (fromToken === 'USD') {
                const usdToken = new ethers.Contract(usdTokenAddress, ERC20_ABI, signer);
                const approveTx = await usdToken.approve(swapAddress, amountIn);
                await approveTx.wait?.();
                const swapTx = await contract.swapQuoteForQer(usdTokenAddress, amountIn, minAmountOut);
                await swapTx.wait?.();
            } else if (fromToken === 'QER') {
                const qerToken = new ethers.Contract(qerTokenAddress, ERC20_ABI, signer);
                const approveTx = await qerToken.approve(swapAddress, amountIn);
                await approveTx.wait?.();
                const swapTx = await contract.swapQerForQuote(usdTokenAddress, amountIn, minAmountOut);
                await swapTx.wait?.();
            } else {
                alert('Invalid token pair');
                return;
            }

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

          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="from-token-label">From token</InputLabel>
              <Select
                labelId="from-token-label"
                label="From token"
                value={fromToken}
                onChange={(e) => handleFromTokenChange(e.target.value as 'USD' | 'QER')}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="QER">QER</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="to-token-label">To token</InputLabel>
              <Select
                labelId="to-token-label"
                label="To token"
                value={toToken}
                onChange={(e) => handleToTokenChange(e.target.value as 'USD' | 'QER')}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="QER">QER</MenuItem>
              </Select>
            </FormControl>

            <TextField
              type="number"
              label={`Amount in ${fromToken}`}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0, step: 'any' }}
              fullWidth
            />
            <Typography variant="caption" align="right" sx={{ color: 'var(--qerun-text-muted)' }}>
              Balance: {fromToken === 'USD' ? `${usdBalance} USD` : `${qerBalance} QER`}
            </Typography>

            {amount && parseFloat(amount) > 0 && (
              <Box sx={{ color: 'var(--qerun-text-muted)', fontSize: 14 }}>
                Estimated: {(() => {
                  const numAmount = parseFloat(amount);
                  const inputDecimals = fromToken === 'USD' ? usdDecimals : qerDecimals;
                  const outputDecimals = toToken === 'USD' ? usdDecimals : qerDecimals;
                  const estimatedBigInt = estimateAmountOut(ethers.parseUnits(numAmount.toString(), inputDecimals), fromToken);
                  return ethers.formatUnits(estimatedBigInt, outputDecimals);
                })()} {toToken}
                <br />
                Min received: {(() => {
                  const numAmount = parseFloat(amount);
                  const inputDecimals = fromToken === 'USD' ? usdDecimals : qerDecimals;
                  const outputDecimals = toToken === 'USD' ? usdDecimals : qerDecimals;
                  const estimatedBigInt = estimateAmountOut(ethers.parseUnits(numAmount.toString(), inputDecimals), fromToken);
                  const minBigInt = estimatedBigInt > 0n ? (estimatedBigInt * 98n) / 100n : 0n;
                  return ethers.formatUnits(minBigInt, outputDecimals);
                })()} {toToken} (2% slippage)
                <br />
                Price impact: {(() => {
                  const numAmount = parseFloat(amount);
                  if (numAmount <= 0) return '0.00%';
                  const inputDecimals = fromToken === 'USD' ? usdDecimals : qerDecimals;
                  const inputAmount = ethers.parseUnits(numAmount.toString(), inputDecimals);
                  
                  // Contract-style price impact calculation: (amountIn * BPS) / (reserve + amountIn)
                  const BPS = 10000n;
                  let impact: number;
                  if (fromToken === 'QER') {
                    // QER->USD swap: impact = (qerAmount * BPS) / (qerReserve + qerAmount)
                    impact = Number((inputAmount * BPS) / (reserveQer + inputAmount));
                  } else {
                    // USD->QER swap: impact = (usdAmount * BPS) / (usdReserve + usdAmount)
                    impact = Number((inputAmount * BPS) / (reserveUsd + inputAmount));
                  }
                  
                  const impactPercent = impact / 100;
                  const willBeBlocked = fromToken === 'QER' && impactPercent > 0.5;
                  
                  return impactPercent.toFixed(2) + '% ' + (willBeBlocked ? '(BLOCKED by governance)' : '');
                })()}
              </Box>
            )}

            {hasInsufficientBalance && (
              <Alert severity="error">
                Insufficient {fromToken} balance. You have {fromToken === 'USD' ? usdBalance : qerBalance} {fromToken}.
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
