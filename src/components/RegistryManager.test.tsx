import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import RegistryManager from './RegistryManager';

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn(),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    keccak256: vi.fn((data) => {
      if (data === '0x494d4d555441424c450000000000000000000000000000000000000000000000') {
        return '0x494d4d555441424c450000000000000000000000000000000000000000000000';
      }
      return '0x' + '0'.repeat(64);
    }),
  },
}));

describe('RegistryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing when wallet is not connected', () => {
      render(<RegistryManager hasWallet={false} />);
      expect(screen.getByText('StateManager Registry')).toBeInTheDocument();
    });

    it('renders without crashing when wallet is connected', () => {
      render(<RegistryManager hasWallet={true} />);
      expect(screen.getByText('StateManager Registry')).toBeInTheDocument();
    });

    it('shows appropriate message when wallet is not connected', () => {
      render(<RegistryManager hasWallet={false} />);
      expect(screen.getByText('No wallet detected. Connect with an admin account to edit registry entries.')).toBeInTheDocument();
    });
  });
});

describe('RegistryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Main mock that works for integration tests
    vi.mocked(ethers.Contract).mockImplementation((address, abi, signer) => {
      if (address === '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
        // StateManager contract
        const stateManagerMock = {
          has: vi.fn((id) => {
            const existingIds = ['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS'];
            return Promise.resolve(existingIds.includes(id));
          }),
          getMetadata: vi.fn((id?: string) => {
            if (id === undefined) {
              return Promise.resolve([
                {
                  id: 'MAIN_CONTRACT',
                  value: '0x1234567890123456789012345678901234567890',
                  valueType: 1,
                  requiredRole: '0x0000000000000000000000000000000000000000000000000000000000000000',
                  isImmutable: false,
                },
              ]);
            }
            if (id === 'MAIN_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
            return Promise.resolve([0, '0x0000000000000000000000000000000000000000000000000000000000000000']);
          }),
          addressOf: vi.fn((id) => {
            if (id === 'MAIN_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567890');
            return Promise.resolve('0x0000000000000000000000000000000000000000');
          }),
          getGovernanceModule: vi.fn((contractAddress) => {
            if (contractAddress === '0x1234567890123456789012345678901234567890') {
              return Promise.resolve('0x1111111111111111111111111111111111111111');
            }
            return Promise.resolve(ethers.ZeroAddress);
          }),
          setGovernanceStatic: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
          setAddress: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
          setUint: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
          setBool: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
          setBytes32: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
        };
        return stateManagerMock;
      } else if (address === '0x1234567890123456789012345678901234567890') {
        // MAIN_CONTRACT with governance functions
        return {
          isGovernanceEnabled: vi.fn(() => Promise.resolve(false)),
          enableGovernance: vi.fn().mockResolvedValue({}),
          disableGovernance: vi.fn().mockResolvedValue({}),
          setStateManager: vi.fn().mockResolvedValue({}),
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
        } as any;
      }

      // Generic contract
      return {
        target: address,
        interface: { format: vi.fn() },
        runner: signer,
        filters: {},
      };
    });
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RegistryManager hasWallet={false} />);
      expect(screen.getByText('StateManager Registry')).toBeInTheDocument();
    });

    it('shows connect wallet message when no wallet is connected', () => {
      render(<RegistryManager hasWallet={false} />);
      expect(screen.getByText('No wallet detected. Connect with an admin account to edit registry entries.')).toBeInTheDocument();
    });
  });
});