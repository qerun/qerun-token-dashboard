interface ImportMetaEnv {
  readonly SWAP_ADDRESS?: string;
  readonly STATE_MANAGER_ADDRESS?: string;
  readonly CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
