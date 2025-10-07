interface ImportMetaEnv {
  readonly VITE_SWAP_ADDRESS?: string;
  readonly VITE_USD_TOKEN_ADDRESS?: string;
  readonly VITE_QER_TOKEN_ADDRESS?: string;
  readonly VITE_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
