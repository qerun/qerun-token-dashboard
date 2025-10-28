import { ethers } from 'ethers';

declare global {
  interface Window {
    __RUNTIME_CONFIG?: Record<string, string>;
  }
}


const makeId = (label: string) => ethers.id(label);

export const CONTRACT_CONFIG = {
  stateManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  chainId: '31337',
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
