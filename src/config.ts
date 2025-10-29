import { ethers } from 'ethers';

declare global {
  interface Window {
    __RUNTIME_CONFIG?: Record<string, string>;
  }
}


const makeId = (label: string) => ethers.id(label);

export const CONTRACT_CONFIG = {
  stateManager: window.__RUNTIME_CONFIG?.VITE_STATE_MANAGER_ADDRESS || '0xD2689D396b3A06b607d2143a50097a034cd8476c',
  chainId: window.__RUNTIME_CONFIG?.VITE_CHAIN_ID || '97', // Binance Smart Chain Testnet
} as const;

export const REGISTRY_IDS = {
  MAIN_CONTRACT: makeId('MAIN_CONTRACT'),
  TREASURY: makeId('TREASURY'),
  PRIMARY_QUOTE: makeId('PRIMARY_QUOTE'),
  SWAP_FEE_BPS: makeId('SWAP_FEE_BPS'),
  SWAP_CONTRACT: makeId('SWAP_CONTRACT'),
  TREASURY_APPLY_GOVERNANCE: makeId('TREASURY_APPLY_GOVERNANCE'),
} as const;

export const DEFAULT_DECIMALS = {
  usd: 18,
  qer: 18,
} as const;
