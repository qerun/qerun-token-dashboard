import './runtime';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import App from './App.tsx';
import { CONTRACT_CONFIG } from './config';
import '@rainbow-me/rainbowkit/styles.css';

const walletConnectProjectId =
  import.meta.env.WALLETCONNECT_PROJECT_ID ?? 'd9f61ed66163e5f8c12e1c7d633792a6';

const chainId = CONTRACT_CONFIG.chainId ? Number.parseInt(CONTRACT_CONFIG.chainId, 10) : undefined;
const fallbackRpcUrl = import.meta.env.CHAIN_RPC_URL ?? 'http://127.0.0.1:8545';
const fallbackExplorerUrl = import.meta.env.CHAIN_EXPLORER_URL as string | undefined;

const baseChains = [mainnet, sepolia] as const;
const customChain =
  chainId !== undefined && Number.isFinite(chainId) && !baseChains.some(chain => chain.id === chainId)
    ? defineChain({
        id: chainId,
        name: `Chain ${chainId}`,
        network: `custom-${chainId}`,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: {
          default: { http: [fallbackRpcUrl] },
          public: { http: [fallbackRpcUrl] },
        },
        blockExplorers: fallbackExplorerUrl
          ? {
              default: { name: 'Explorer', url: fallbackExplorerUrl },
            }
          : undefined,
      })
    : null;

const chains = (() => {
  if (!customChain) {
    return baseChains;
  }

  if (customChain.id === mainnet.id) {
    return [mainnet, sepolia] as const;
  }

  if (customChain.id === sepolia.id) {
    return [sepolia, mainnet] as const;
  }

  return [customChain, ...baseChains] as const;
})();

const config = getDefaultConfig({
  appName: 'Qerun Dashboard',
  projectId: walletConnectProjectId,
  chains,
  ssr: false,
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
