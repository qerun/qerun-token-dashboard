import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import SwapAbi from '../abi/Swap.json';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG, DEFAULT_DECIMALS, REGISTRY_IDS } from '../config';

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) external returns (bool)',
    'function decimals() view returns (uint8)',
];
const BPS = 10_000n;

type ResolvedAddresses = {
    swap: string;
    usd: string;
    qer: string;
};

const Swap: React.FC = () => {
    const styles: Record<string, React.CSSProperties> = {
        page: {
            minHeight: '100vh',
            margin: 0,
            padding: '72px 16px 96px',
            background:
                'radial-gradient(1200px at 10% 20%, rgba(51, 119, 255, 0.18) 0%, transparent 60%), radial-gradient(900px at 90% 15%, rgba(55, 237, 214, 0.14) 0%, transparent 55%), linear-gradient(160deg, #040a24 0%, #081237 45%, #040720 100%)',
            boxSizing: 'border-box',
            color: '#f5f7ff',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        },
        layout: {
            maxWidth: 1024,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 48,
            alignItems: 'center',
        },
        hero: {
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
        },
        badge: {
            alignSelf: 'flex-start',
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(82, 146, 255, 0.18)',
            color: '#6fb1ff',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
        },
        heroTitle: {
            margin: 0,
            fontSize: 40,
            lineHeight: 1.15,
            fontWeight: 700,
            color: '#f5f7ff',
        },
        heroCopy: {
            margin: 0,
            fontSize: 18,
            lineHeight: 1.6,
            color: 'rgba(220, 231, 255, 0.82)',
            maxWidth: 420,
        },
        metricsPanel: {
            marginTop: 12,
            display: 'grid',
            gap: 12,
        },
        metricCard: {
            background: 'linear-gradient(140deg, rgba(26, 41, 98, 0.65), rgba(21, 31, 82, 0.45))',
            border: '1px solid rgba(108, 150, 255, 0.18)',
            borderRadius: 16,
            padding: 16,
        },
        metricLabel: {
            fontSize: 13,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'rgba(201, 214, 255, 0.7)',
            marginBottom: 4,
        },
        metricValue: {
            fontSize: 20,
            fontWeight: 600,
            color: '#f7f9ff',
        },
        card: {
            position: 'relative',
            background: 'rgba(8, 14, 44, 0.82)',
            backdropFilter: 'blur(10px)',
            borderRadius: 24,
            padding: 32,
            border: '1px solid rgba(92, 132, 255, 0.25)',
            boxShadow: '0 30px 80px rgba(12, 24, 73, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
        },
        cardHeader: {
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        },
        cardTitle: {
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            color: '#eef3ff',
        },
        cardSubtitle: {
            margin: 0,
            fontSize: 14,
            color: 'rgba(201, 214, 255, 0.72)',
        },
        warning: {
            padding: '12px 14px',
            borderRadius: 14,
            background: 'rgba(255, 105, 135, 0.16)',
            border: '1px solid rgba(255, 109, 132, 0.3)',
            color: '#ff81a2',
            fontWeight: 600,
        },
        selectorGroup: {
            display: 'grid',
            gap: 16,
        },
        label: {
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: 'rgba(185, 204, 255, 0.78)',
        },
        select: {
            width: '100%',
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid rgba(112, 152, 255, 0.35)',
            background: 'rgba(18, 28, 69, 0.85)',
            color: '#f6f8ff',
            fontSize: 16,
            appearance: 'none',
        },
        input: {
            width: '100%',
            padding: '14px 16px',
            borderRadius: 14,
            border: '1px solid rgba(112, 152, 255, 0.35)',
            background: 'rgba(18, 28, 69, 0.85)',
            color: '#f6f8ff',
            fontSize: 18,
        },
        swapButton: {
            marginTop: 12,
            padding: '14px 18px',
            borderRadius: 16,
            border: 'none',
            fontSize: 18,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #4c74ff 0%, #37d7ff 100%)',
            color: '#f5f8ff',
            cursor: 'pointer',
            boxShadow: '0 15px 40px rgba(76, 116, 255, 0.45)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        },
        footerNote: {
            marginTop: 4,
            fontSize: 12,
            color: 'rgba(190, 206, 255, 0.65)',
            textAlign: 'center',
        },
    };

    const [addresses, setAddresses] = useState<ResolvedAddresses | null>(null);
    const [account, setAccount] = useState<string>('');
    const [usdBalance, setUsdBalance] = useState<string>('0');
    const [qerBalance, setQerBalance] = useState<string>('0');
    const [swapUsdBalance, setSwapUsdBalance] = useState<string>('0');
    const [swapQerBalance, setSwapQerBalance] = useState<string>('0');
    const [rate, setRate] = useState<string>('');
    const [reserveQer, setReserveQer] = useState<bigint>(0n);
    const [reserveUsd, setReserveUsd] = useState<bigint>(0n);
    const [feeBps, setFeeBps] = useState<bigint>(0n);
    const [usdDecimals, setUsdDecimals] = useState<number>(DEFAULT_DECIMALS.usd);
    const [qerDecimals, setQerDecimals] = useState<number>(DEFAULT_DECIMALS.qer);
    const [networkWarning, setNetworkWarning] = useState<string | null>(null);

    const loadState = useCallback(async () => {
        if (!window.ethereum) return;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const chainId = network?.chainId?.toString();

        if (chainId !== CONTRACT_CONFIG.chainId) {
            setNetworkWarning(
                `Connected network ${chainId ?? 'unknown'} is wrong. Please switch to chain ${CONTRACT_CONFIG.chainId}.`,
            );
            setAddresses(null);
            setAccount('');
            setUsdBalance('0');
            setQerBalance('0');
            setSwapUsdBalance('0');
            setSwapQerBalance('0');
            setRate('Wrong network');
            return;
        }

        setNetworkWarning(null);

        const accounts: string[] = await provider.send('eth_requestAccounts', []);
        if (!accounts || accounts.length === 0) return;
        const activeAccount = accounts[0];
        setAccount(activeAccount);

        let resolved: ResolvedAddresses;
        try {
            const stateManager = new ethers.Contract(CONTRACT_CONFIG.stateManager, StateManagerAbi, provider);
            const getAddress = stateManager.getFunction('getAddress');
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
                    return await getAddress(id);
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

        const [usd, qer, swapUsd, swapQer] = await Promise.all([
            usdToken.balanceOf(activeAccount),
            qerToken.balanceOf(activeAccount),
            usdToken.balanceOf(swapAddress),
            qerToken.balanceOf(swapAddress),
        ]);
        const [usdDecRaw, qerDecRaw] = await Promise.all([
            usdToken.decimals().catch(() => DEFAULT_DECIMALS.usd),
            qerToken.decimals().catch(() => DEFAULT_DECIMALS.qer),
        ]);
        const usdDec = Number(usdDecRaw);
        const qerDec = Number(qerDecRaw);
        setUsdDecimals(usdDec);
        setQerDecimals(qerDec);
        setUsdBalance(ethers.formatUnits(usd, usdDec));
        setQerBalance(ethers.formatUnits(qer, qerDec));
        setSwapUsdBalance(ethers.formatUnits(swapUsd, usdDec));
        setSwapQerBalance(ethers.formatUnits(swapQer, qerDec));

        const swap = new ethers.Contract(swapAddress, SwapAbi, provider);
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
                setRate(`1 QER = ${usdPerQer.toFixed(4)} USD | 1 USD = ${qerPerUsd.toFixed(4)} QER`);
            } else {
                setRate('N/A');
            }
        } catch {
            setRate('Pair not registered');
            setReserveQer(0n);
            setReserveUsd(0n);
            setFeeBps(0n);
        }
    }, []);

    useEffect(() => {
        void loadState();
        const intervalId = setInterval(() => {
            void loadState();
        }, 1000);
        return () => clearInterval(intervalId);
    }, [loadState]);

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

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!window.ethereum) {
            alert('No wallet found');
            return;
        }
        if (!amount || Number(amount) <= 0) {
            alert('Enter an amount greater than zero');
            return;
        }

        try {
            if (!addresses) {
                alert('Contract addresses not loaded yet');
                return;
            }
            const { swap: swapAddress, usd: usdTokenAddress, qer: qerTokenAddress } = addresses;
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(swapAddress, SwapAbi, signer);
            const fromDecimals = fromToken === 'USD' ? usdDecimals : qerDecimals;
            const amountIn = ethers.parseUnits(amount, fromDecimals);
            const expectedOut = estimateAmountOut(amountIn, fromToken);
            const minAmountOut = expectedOut > 0n ? (expectedOut * 98n) / 100n : 0n;

            if (fromToken === 'USD') {
                const usdToken = new ethers.Contract(usdTokenAddress, ERC20_ABI, signer);
                await usdToken.approve(swapAddress, amountIn);
                await contract.swapQuoteForQer(usdTokenAddress, amountIn, minAmountOut);
            } else if (fromToken === 'QER') {
                const qerToken = new ethers.Contract(qerTokenAddress, ERC20_ABI, signer);
                await qerToken.approve(swapAddress, amountIn);
                await contract.swapQerForQuote(usdTokenAddress, amountIn, minAmountOut);
            } else {
                alert('Invalid token pair');
                return;
            }

            alert('Swap transaction sent!');
            setAmount('');
            await loadState();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            alert('Swap failed: ' + message);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.layout}>
                <div style={styles.hero}>
                    <span style={styles.badge}>Qerun Exchange</span>
                    <h1 style={styles.heroTitle}>Swap QER with Main Treasury Liquidity</h1>
                    <p style={styles.heroCopy}>
                        Execute instant swaps between QER and its USD reserve without leaving your wallet. Qerun’s
                        on-chain treasury keeps prices transparent and spreads low.
                    </p>
                    <div style={styles.metricsPanel}>
                        <div style={styles.metricCard}>
                            <div style={styles.metricLabel}>Connected account</div>
                            <div style={styles.metricValue}>{account || '—'}</div>
                        </div>
                        <div style={styles.metricCard}>
                            <div style={styles.metricLabel}>Current pool rate</div>
                            <div style={styles.metricValue}>{rate || 'Loading…'}</div>
                        </div>
                        <div style={styles.metricCard}>
                            <div style={styles.metricLabel}>Treasury balances</div>
                            <div style={styles.metricValue}>
                                {swapUsdBalance} USD • {swapQerBalance} QER
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSwap} style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.cardTitle}>Swap tokens</h2>
                        <p style={styles.cardSubtitle}>Choose the direction, enter an amount, and confirm with your wallet.</p>
                    </div>

                    {networkWarning && <div style={styles.warning}>{networkWarning}</div>}

                    <div style={styles.selectorGroup}>
                        <label style={styles.label}>
                            From token
                            <select
                                value={fromToken}
                                onChange={e => handleFromTokenChange(e.target.value as 'USD' | 'QER')}
                                style={styles.select}
                            >
                                <option value="USD">USD</option>
                                <option value="QER">QER</option>
                            </select>
                        </label>

                        <label style={styles.label}>
                            To token
                            <select
                                value={toToken}
                                onChange={e => handleToTokenChange(e.target.value as 'USD' | 'QER')}
                                style={styles.select}
                            >
                                <option value="USD">USD</option>
                                <option value="QER">QER</option>
                            </select>
                        </label>

                        <label style={styles.label}>
                            Amount
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={styles.input}
                            />
                        </label>

                        <div style={{ display: 'grid', gap: 4, fontSize: 13, color: 'rgba(201, 214, 255, 0.72)' }}>
                            <div>Your balances: {usdBalance} USD • {qerBalance} QER</div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={styles.swapButton}
                        onMouseOver={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 18px 40px rgba(60, 120, 255, 0.45)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '0 15px 40px rgba(76, 116, 255, 0.45)';
                        }}
                    >
                        Swap now
                    </button>
                    <div style={styles.footerNote}>Treasury fee: {(Number(feeBps) / 100).toFixed(2)} bps</div>
                </form>
            </div>
        </div>
    );
};

export default Swap;
