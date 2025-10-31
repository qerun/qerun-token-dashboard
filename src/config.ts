declare global {
  interface Window {
    __RUNTIME_CONFIG?: Record<string, string>;
  }
}


const makeId = (label: string) => label;

const rawChainId = window.__RUNTIME_CONFIG?.CHAIN_ID || (typeof process !== 'undefined' ? process.env.CHAIN_ID : undefined);

export const CONTRACT_CONFIG = {
  stateManager: window.__RUNTIME_CONFIG?.STATE_MANAGER_ADDRESS || (typeof process !== 'undefined' ? process.env.STATE_MANAGER_ADDRESS : undefined),
  chainId: rawChainId,
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
