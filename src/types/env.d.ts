interface ImportMetaEnv {
  readonly VITE_SWAP_ADDRESS?: string;
  readonly VITE_STATE_MANAGER_ADDRESS?: string;
  readonly VITE_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
