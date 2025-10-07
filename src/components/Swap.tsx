import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import QerunSwapAbi from '../abi/QerunSwap.json';
import StateManagerAbi from '../abi/StateManager.json';
import { CONTRACT_CONFIG, DEFAULT_DECIMALS, QERUN_IDS } from '../config';

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
                requireAddress(QERUN_IDS.MAIN_CONTRACT),
                requireAddress(QERUN_IDS.PRIMARY_QUOTE),
                requireAddress(QERUN_IDS.SWAP_CONTRACT),
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

        const swap = new ethers.Contract(swapAddress, QerunSwapAbi, provider);
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
        loadState();
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
            const contract = new ethers.Contract(swapAddress, QerunSwapAbi, signer);
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
            {networkWarning && (
                <div
                    style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: '#ffebee',
                        color: '#c62828',
                        fontWeight: 600,
                    }}
                >
                    {networkWarning}
                </div>
            )}
            <h2>Token Swap</h2>
            <div style={{ marginBottom: 12 }}>
                <div><b>Account:</b> {account}</div>
                <div><b>Your USD Balance:</b> {usdBalance}</div>
                <div><b>Your QER Balance:</b> {qerBalance}</div>
                <div><b>Swap USD Balance:</b> {swapUsdBalance}</div>
                <div><b>Swap QER Balance:</b> {swapQerBalance}</div>
                <div><b>Current Rate (USD/QER):</b> {rate}</div>
            </div>
            <label>
                From Token
                <select
                    value={fromToken}
                    onChange={e => handleFromTokenChange(e.target.value as 'USD' | 'QER')}
                    style={{ padding: 8, fontSize: 16, marginTop: 4 }}
                >
                    <option value="USD">USD</option>
                    <option value="QER">QER</option>
                </select>
            </label>
            <label>
                To Token
                <select
                    value={toToken}
                    onChange={e => handleToTokenChange(e.target.value as 'USD' | 'QER')}
                    style={{ padding: 8, fontSize: 16, marginTop: 4 }}
                >
                    <option value="USD">USD</option>
                    <option value="QER">QER</option>
                </select>
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
