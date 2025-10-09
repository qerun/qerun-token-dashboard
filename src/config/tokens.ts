export const TOKENS = {
  QER: {
    address: '0xAF022142A86034d9189ab1A4fb8389057CB4eDc2',
    symbol: 'QER',
    decimals: 18,
    image: undefined, // Add your token logo URL here
  },
  USDQ: {
    address: '0x161B35FBd6FBb27C1E3342B14435140e42BF2E2b',
    symbol: 'USDQ',
    decimals: 18,
    image: undefined, // Add your token logo URL here
  },
} as const

export type TokenKey = keyof typeof TOKENS