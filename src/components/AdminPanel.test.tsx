import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminPanel from './AdminPanel';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0xadmin1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));

// Mock ethers with proper contract mocking
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getNetwork: vi.fn().mockResolvedValue({ chainId: 31337n }),
      getSigner: vi.fn().mockResolvedValue({}),
    })),
    Contract: vi.fn().mockImplementation(() => ({
      hasRole: vi.fn().mockResolvedValue(true), // Mock admin access
      getFunction: vi.fn().mockReturnValue(vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')),
      addressOf: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      getUint: vi.fn().mockResolvedValue(30),
      allPairs: vi.fn().mockResolvedValue([]),
      updatePairs: vi.fn().mockResolvedValue({ wait: vi.fn() }),
      balanceOf: vi.fn().mockResolvedValue(1000000000000000000000n),
      decimals: vi.fn().mockResolvedValue(18),
    })),
    getAddress: vi.fn((addr) => addr),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    formatUnits: vi.fn((value) => value.toString()),
  },
}));

// Mock config
vi.mock('../config', () => ({
  CONTRACT_CONFIG: {
    stateManager: '0x1234567890123456789012345678901234567890',
    chainId: '31337',
  },
  REGISTRY_IDS: {
    SWAP_CONTRACT: '0x1234567890123456789012345678901234567890',
    PRIMARY_QUOTE: '0x1234567890123456789012345678901234567891',
    MAIN_CONTRACT: '0x1234567890123456789012345678901234567892',
    TREASURY: '0x1234567890123456789012345678901234567893',
    SWAP_FEE_BPS: '0x1234567890123456789012345678901234567894',
  },
}));

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: {},
      writable: true,
    });
  });

  it('renders admin controls when user has admin access', async () => {
    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText('Admin Controls')).toBeInTheDocument();
    });
  });

  it('renders input field for adding quote token addresses', async () => {
    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('0x quote token address')).toBeInTheDocument();
    });
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('renders action buttons', async () => {
    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText('Include USD token')).toBeInTheDocument();
    });
    expect(screen.getByText('Reset')).toBeInTheDocument();
    expect(screen.getAllByText('Refresh')).toHaveLength(2); // One in AdminPanel, one in RegistryManager
    expect(screen.getByText('Submit updatePairs')).toBeInTheDocument();
  });

  it('does not render when no wallet is detected', async () => {
    // Remove ethereum from window
    Object.defineProperty(window, 'ethereum', {
      value: undefined,
      writable: true,
    });

    const { container } = render(<AdminPanel />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});