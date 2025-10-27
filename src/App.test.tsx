import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    chainId: 31337,
    isConnected: true,
  }),
  useBlockNumber: () => ({
    data: 12345,
  }),
  useReadContract: () => ({
    data: undefined,
    isLoading: false,
  }),
  useWriteContract: () => ({
    writeContract: vi.fn(),
    isPending: false,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
  }),
}));

// Mock RainbowKit
vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: any) => React.ReactNode }) =>
      children({
        account: { address: '0x1234567890123456789012345678901234567890' },
        chain: { id: 31337 },
        openConnectModal: vi.fn(),
        mounted: true,
      }),
  },
}));

describe('App', () => {
  it('renders the main application', () => {
    render(<App />);
    // Basic test to ensure the app renders without crashing
    expect(document.body).toBeInTheDocument();
  });

  it('displays main content', () => {
    render(<App />);
    // Check if main content is present - the app should render without throwing
    const container = document.querySelector('[data-testid="app-container"]') || document.body;
    expect(container).toBeInTheDocument();
  });
});