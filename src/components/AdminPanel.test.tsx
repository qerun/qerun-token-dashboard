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
      has: vi.fn((id) => ['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS', 'TREASURY_APPLY_GOVERNANCE'].includes(id)),
      getMetadata: vi.fn((id) => {
        if (id === 'MAIN_CONTRACT') return [1, '0x0000000000000000000000000000000000000000000000000000000000000000'];
        if (id === 'TREASURY') return [1, '0x0000000000000000000000000000000000000000000000000000000000000000'];
        if (id === 'PRIMARY_QUOTE') return [1, '0x0000000000000000000000000000000000000000000000000000000000000000'];
        if (id === 'SWAP_CONTRACT') return [1, '0x0000000000000000000000000000000000000000000000000000000000000000'];
        if (id === 'SWAP_FEE_BPS') return [2, '0x0000000000000000000000000000000000000000000000000000000000000000'];
        if (id === 'TREASURY_APPLY_GOVERNANCE') return [1, '0x0000000000000000000000000000000000000000000000000000000000000000'];
        return [0, '0x0000000000000000000000000000000000000000000000000000000000000000'];
      }),
      getFunction: vi.fn().mockReturnValue(vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')),
      addressOf: vi.fn((id) => {
        if (id === 'MAIN_CONTRACT') return '0x1234567890123456789012345678901234567890';
        if (id === 'TREASURY') return '0x1234567890123456789012345678901234567891';
        if (id === 'PRIMARY_QUOTE') return '0x1234567890123456789012345678901234567892';
        if (id === 'SWAP_CONTRACT') return '0x1234567890123456789012345678901234567893';
        if (id === 'TREASURY_APPLY_GOVERNANCE') return '0x1234567890123456789012345678901234567894';
        return '0x0000000000000000000000000000000000000000';
      }),
      getUint: vi.fn((id) => {
        if (id === 'SWAP_FEE_BPS') return 30n;
        return 0n;
      }),
      getBool: vi.fn(() => false),
      getBytes32: vi.fn(() => '0x0000000000000000000000000000000000000000000000000000000000000000'),
      allPairs: vi.fn().mockResolvedValue([]),
      updatePairs: vi.fn().mockResolvedValue({ wait: vi.fn() }),
      balanceOf: vi.fn().mockResolvedValue(1000000000000000000000n),
      decimals: vi.fn().mockResolvedValue(18),
    })),
    getAddress: vi.fn((addr) => addr),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    formatUnits: vi.fn((value) => value.toString()),
    keccak256: vi.fn((data) => {
      if (data && data.toString().includes('IMMUTABLE')) {
        return '0x1234567890123456789012345678901234567890123456789012345678901234';
      }
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }),
    toUtf8Bytes: vi.fn((str) => Buffer.from(str, 'utf8')),
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
    TREASURY: 'TREASURY',
    SWAP_FEE_BPS: 'SWAP_FEE_BPS',
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