import { ethers } from 'ethers';

declare global {
  interface Window {
    __RUNTIME_CONFIG?: Record<string, string>;
  }
}

type RequiredKey = 'VITE_STATE_MANAGER_ADDRESS';

function requireEnv(key: RequiredKey): string {
  // Priority: Vite build-time env -> runtime injected config -> system env
  const value = import.meta.env[key] ?? window.__RUNTIME_CONFIG?.[key] ?? process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable ${key}. Check your .env configuration, Cloud Run service env, or system environment.`);
  }
  return value;
}

const makeId = (label: string) => ethers.id(label);

export const CONTRACT_CONFIG = {
  stateManager: requireEnv('VITE_STATE_MANAGER_ADDRESS'),
  chainId: (import.meta.env.VITE_CHAIN_ID ?? window.__RUNTIME_CONFIG?.['VITE_CHAIN_ID'] ?? '31337'),
} as const;

export const REGISTRY_IDS = {
  MAIN_CONTRACT: makeId('MAIN_CONTRACT'),
  TREASURY: makeId('TREASURY'),
  PRIMARY_QUOTE: makeId('PRIMARY_QUOTE'),
  SWAP_FEE_BPS: makeId('SWAP_FEE_BPS'),
  SWAP_CONTRACT: makeId('SWAP_CONTRACT'),
} as const;

export const DEFAULT_DECIMALS = {
  usd: 18,
  qer: 18,
} as const;
