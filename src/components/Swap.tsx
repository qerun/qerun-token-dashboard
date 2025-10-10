import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import styles from '../styles/qerunTheme.module.css';
import { CONTRACT_CONFIG, REGISTRY_IDS, DEFAULT_DECIMALS } from '../config';
import StateManagerAbi from '../abi/StateManager.json';
import SwapAbi from '../abi/Swap.json';
import { addTokenToWallet, switchToSepolia } from '../utils/wallet';
import { TOKENS } from '../config/tokens';
import { useAccount, useBlockNumber } from 'wagmi';

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

const Swap: React.FC = () => {
    const { address: connectedAddress, chainId: connectedChainId } = useAccount();
    const { data: blockNumber } = useBlockNumber({ watch: true });
    const [addresses, setAddresses] = useState<ResolvedAddresses | null>(null);
    const [usdBalance, setUsdBalance] = useState('0');
    const [qerBalance, setQerBalance] = useState('0');
    const [swapUsdBalance, setSwapUsdBalance] = useState('0');
    const [swapQerBalance, setSwapQerBalance] = useState('0');
    const [usdTotalSupply, setUsdTotalSupply] = useState('0');
    const [qerTotalSupply, setQerTotalSupply] = useState('0');
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
            setNetworkWarning(
                `Connected network ${chainId ?? 'unknown'} is wrong. Please switch to chain ${CONTRACT_CONFIG.chainId}.`,
            );
            setAddresses(null);
            setUsdBalance('0');
            setQerBalance('0');
            setSwapUsdBalance('0');
            setSwapQerBalance('0');
            setRate('Wrong network');
            return;
        }

        setNetworkWarning(null);

        const activeAccount = connectedAddress;

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
        setSwapUsdBalance(ethers.formatUnits(swapUsd, usdDec));
        setSwapQerBalance(ethers.formatUnits(swapQer, qerDec));
        setUsdTotalSupply(ethers.formatUnits(usdSupply, usdDec));
        setQerTotalSupply(ethers.formatUnits(qerSupply, qerDec));

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
    }, [connectedAddress, connectedChainId]);

    useEffect(() => {
        // refresh on every new block and on hook mount
        void loadState();
    }, [blockNumber, loadState]);

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
    const handleAddQER = async () => {
        const success = await addTokenToWallet(TOKENS.QER);
        if (success) {
            alert('QER token added to wallet!');
        }
    };

    const handleAddUSDQ = async () => {
        const success = await addTokenToWallet(TOKENS.USDQ);
        if (success) {
            alert('USDQ token added to wallet!');
        }
    };

    const handleSwitchNetwork = async () => {
        await switchToSepolia();
        // Reload state after network switch
        setTimeout(() => loadState(), 1000);
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
            const contract = new ethers.Contract(swapAddress, SwapAbi, signer);
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
        <>
            <form onSubmit={handleSwap} className={styles.qerunCard}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.qerunCardTitle}>Swap tokens</h2>
                        <p className={styles.qerunCardSubtitle}>Choose the direction, enter an amount, and confirm with your wallet.</p>
                    </div>
                    {networkWarning && <div className={styles.warning}>{networkWarning}</div>}
                    <div className={styles.qerunSelectorGroup}>
                        <label className={styles.qerunLabel}>
                            From token
                            <select
                                value={fromToken}
                                onChange={e => handleFromTokenChange(e.target.value as 'USD' | 'QER')}
                                className={styles.qerunSelect}
                            >
                                <option value="USD">USD</option>
                                <option value="QER">QER</option>
                            </select>
                        </label>
                        <label className={styles.qerunLabel}>
                            To token
                            <select
                                value={toToken}
                                onChange={e => handleToTokenChange(e.target.value as 'USD' | 'QER')}
                                className={styles.qerunSelect}
                            >
                                <option value="USD">USD</option>
                                <option value="QER">QER</option>
                            </select>
                        </label>
                        <label className={styles.qerunLabel}>
                            Amount in {fromToken}
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className={styles.qerunInput}
                            />
                            <div className={styles.qerunBalanceDisplay}>
                                Balance: {fromToken === 'USD' ? `${usdBalance} USD` : `${qerBalance} QER`}
                            </div>
                        </label>
                        {amount && parseFloat(amount) > 0 && (
                            <div className={styles.qerunEstimate}>
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
                                    const outputAmount = estimateAmountOut(inputAmount, fromToken);

                                    // Spot rate: for USD->QER, spot = reserveQer / reserveUsd
                                    // Effective rate = outputAmount / inputAmount
                                    let spotRate: number;
                                    let effectiveRate: number;

                                    if (fromToken === 'USD') {
                                        spotRate = Number(ethers.formatUnits(reserveQer, qerDecimals)) / Number(ethers.formatUnits(reserveUsd, usdDecimals));
                                        effectiveRate = Number(ethers.formatUnits(outputAmount, qerDecimals)) / numAmount;
                                    } else {
                                        spotRate = Number(ethers.formatUnits(reserveUsd, usdDecimals)) / Number(ethers.formatUnits(reserveQer, qerDecimals));
                                        effectiveRate = Number(ethers.formatUnits(outputAmount, usdDecimals)) / numAmount;
                                    }

                                    const impact = ((spotRate - effectiveRate) / spotRate) * 100;
                                    return impact.toFixed(2) + '%';
                                })()}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isSwapping || !amount || parseFloat(amount) <= 0 || hasInsufficientBalance}
                        className={styles.qerunSwapButton}
                    >
                        {isSwapping && <span className={styles.qerunSpinner} aria-hidden="true" />}
                        {isSwapping ? 'Swapping…' : hasInsufficientBalance ? 'Insufficient Balance' : 'Swap now'}
                    </button>
                    
                    {hasInsufficientBalance && (
                        <div className={`${styles.qerunAlert} ${styles.qerunAlert__error} ${styles.qerunMarginTop8}`}>
                            Insufficient {fromToken} balance. You have {fromToken === 'USD' ? usdBalance : qerBalance} {fromToken}.
                        </div>
                    )}
                    
                    <div className={styles.qerunFooterNote}>Treasury fee: {(Number(feeBps) / 100).toFixed(2)} bps</div>
                </form>

                <div className={styles.hero}>
                    <div className={styles.qerunMetricsPanel}>
                        <div className={styles.qerunMetricCard}>
                            <div className={styles.qerunMetricLabel}>Current Rate</div>
                            <div className={styles.qerunMetricValue}>{rate}</div>
                        </div>
                        <div className={styles.qerunMetricCard}>
                            <div className={styles.qerunMetricLabel}>Swap USD Balance</div>
                            <div className={styles.qerunMetricValue}>{swapUsdBalance} USD</div>
                        </div>
                        <div className={styles.qerunMetricCard}>
                            <div className={styles.qerunMetricLabel}>Swap QER Balance</div>
                            <div className={styles.qerunMetricValue}>{swapQerBalance} QER</div>
                        </div>
                        <div className={styles.qerunMetricCard}>
                            <div className={styles.qerunMetricLabel}>USDQ Total Supply</div>
                            <div className={styles.qerunMetricValue}>{usdTotalSupply}</div>
                        </div>
                        <div className={styles.qerunMetricCard}>
                            <div className={styles.qerunMetricLabel}>QER Total Supply</div>
                            <div className={styles.qerunMetricValue}>{qerTotalSupply}</div>
                        </div>
                    </div>
                </div>
                {/* Network and Token Management */}
                <div className={`${styles.qerunCard} ${styles.qerunNetworkCardSpacing}`}>
                    <div className={styles.cardHeader}>
                        <h3 className={styles.qerunCardTitle}>Network & Tokens</h3>
                    </div>
                    <div className={styles.qerunButtonContainer}>
                        <button
                            onClick={handleSwitchNetwork}
                            className={styles.qerunSwapButton}
                        >
                            Switch to Sepolia
                        </button>
                        <button
                            onClick={handleAddQER}
                            className={styles.qerunSwapButton}
                        >
                            Add QER Token
                        </button>
                        <button
                            onClick={handleAddUSDQ}
                            className={styles.qerunSwapButton}
                        >
                            Add USDQ Token
                        </button>
                    </div>
                </div>
        </>
    );
};

export default Swap;
