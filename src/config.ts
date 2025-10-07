const REQUIRED_KEYS = ['VITE_SWAP_ADDRESS', 'VITE_USD_TOKEN_ADDRESS', 'VITE_QER_TOKEN_ADDRESS'] as const;

type RequiredKey = typeof REQUIRED_KEYS[number];

function requireEnv(key: RequiredKey): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing environment variable ${key}. Check your .env configuration.`);
  }
  return value;
}

export const CONTRACT_ADDRESSES = {
  swap: requireEnv('VITE_SWAP_ADDRESS'),
  usd: requireEnv('VITE_USD_TOKEN_ADDRESS'),
  qer: requireEnv('VITE_QER_TOKEN_ADDRESS'),
  chainId: import.meta.env.VITE_CHAIN_ID ?? '31337',
} as const;

export const DEFAULT_DECIMALS = {
  usd: 18,
  qer: 18,
} as const;
