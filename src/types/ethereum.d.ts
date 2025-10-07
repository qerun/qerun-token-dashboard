import type { Eip1193Provider } from 'ethers';

export {};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
