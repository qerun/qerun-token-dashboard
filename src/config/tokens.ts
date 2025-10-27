export const TOKENS = {
  QER: {
    address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    symbol: 'QER',
    decimals: 18,
    image: undefined, // Add your token logo URL here
  },
  USDQ: {
    address: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    symbol: 'USDQ',
    decimals: 18,
    image: undefined, // Add your token logo URL here
  },
} as const

export type TokenKey = keyof typeof TOKENS