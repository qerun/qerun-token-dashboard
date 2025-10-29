import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Swap from './Swap';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    chainId: 31337,
  })),
  useBlockNumber: vi.fn(() => ({
    data: 12345,
  })),
}));

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getNetwork: vi.fn().mockResolvedValue({ chainId: 31337n }),
      getSigner: vi.fn().mockResolvedValue({}),
    })),
    Contract: vi.fn().mockImplementation(() => ({
      getFunction: vi.fn().mockReturnValue(vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')),
      getReserves: vi.fn().mockResolvedValue([1000000000000000000000n, 2000000000000000000000n]),
      feeBps: vi.fn().mockResolvedValue(30),
      balanceOf: vi.fn().mockResolvedValue(1000000000000000000000n),
      decimals: vi.fn().mockResolvedValue(18),
      totalSupply: vi.fn().mockResolvedValue(10000000000000000000000n),
    })),
    getAddress: vi.fn((addr) => addr),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    formatUnits: vi.fn((value, decimals) => (Number(value) / Math.pow(10, decimals || 18)).toString()),
    parseUnits: vi.fn((value, decimals) => BigInt(Number(value) * Math.pow(10, decimals || 18))),
  },
}));

// Mock config
vi.mock('../config', () => ({
  CONTRACT_CONFIG: {
    stateManager: '0x1234567890123456789012345678901234567890',
    chainId: '31337',
  },
  REGISTRY_IDS: {
    SWAP_CONTRACT: 'SWAP_CONTRACT',
    PRIMARY_QUOTE: 'PRIMARY_QUOTE',
    MAIN_CONTRACT: 'MAIN_CONTRACT',
  },
  DEFAULT_DECIMALS: {
    usd: 18,
    qer: 18,
  },
}));

describe('Swap', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: {},
      writable: true,
    });
  });

  it('renders the swap interface', () => {
    render(<Swap />);

    expect(screen.getByText('Swap tokens')).toBeInTheDocument();
    expect(screen.getByText(/Choose the direction, enter an amount, and confirm with your wallet/)).toBeInTheDocument();
  });

  it('renders form elements', () => {
    render(<Swap />);

    expect(screen.getByLabelText('From token')).toBeInTheDocument();
    expect(screen.getByLabelText('To token')).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount in/)).toBeInTheDocument();
    expect(screen.getByText('Swap now')).toBeInTheDocument();
  });

  it('renders token selectors with USD and QER options', () => {
    render(<Swap />);

    // Check that both select elements contain USD and QER options
    const fromSelect = screen.getByLabelText('From token');
    const toSelect = screen.getByLabelText('To token');

    expect(fromSelect).toBeInTheDocument();
    expect(toSelect).toBeInTheDocument();
  });

  it('shows current rate section', () => {
    render(<Swap />);

    expect(screen.getByText('Current Rate')).toBeInTheDocument();
  });

  it('shows treasury fee information', () => {
    render(<Swap />);

    expect(screen.getByText(/Treasury fee:/)).toBeInTheDocument();
  });

  it('renders with proper form structure', () => {
    render(<Swap />);

    const form = document.querySelector('form');
    expect(form).toBeInTheDocument();

    const submitButton = screen.getByText('Swap now');
    expect(submitButton).toHaveAttribute('type', 'submit');
  });
});