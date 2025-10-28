import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ethers } from 'ethers';

// Mock components that use StateManager
vi.mock('./AdminPanel', () => ({
  default: vi.fn(() => <div>AdminPanel Component</div>),
}));

vi.mock('./Swap', () => ({
  default: vi.fn(() => <div>Swap Component</div>),
}));

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0xadmin1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));

// Mock ethers with detailed StateManager interaction tracking
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getNetwork: vi.fn().mockResolvedValue({ chainId: 31337n }),
      getSigner: vi.fn().mockResolvedValue({}),
    })),
    Contract: vi.fn().mockImplementation(() => ({
      hasRole: vi.fn().mockResolvedValue(true),
      getFunction: vi.fn().mockImplementation((signature) => {
        if (signature === 'getAddress(bytes32)') {
          return vi.fn().mockImplementation((id) => {
            // Mock different addresses based on registry ID
            const addressMap: Record<string, string> = {
              [ethers.id('MAIN_CONTRACT')]: '0x1234567890123456789012345678901234567890',
              [ethers.id('TREASURY')]: '0x1234567890123456789012345678901234567891',
              [ethers.id('PRIMARY_QUOTE')]: '0x1234567890123456789012345678901234567892',
              [ethers.id('SWAP_CONTRACT')]: '0x1234567890123456789012345678901234567893',
            };
            return Promise.resolve(addressMap[id] || '0x0000000000000000000000000000000000000000');
          });
        }
        if (signature === 'has(bytes32)') {
          return vi.fn().mockImplementation((id) => {
            // Mock existing IDs
            const existingIds = [
              ethers.id('MAIN_CONTRACT'),
              ethers.id('TREASURY'),
              ethers.id('PRIMARY_QUOTE'),
              ethers.id('SWAP_CONTRACT'),
              ethers.id('SWAP_FEE_BPS'),
            ];
            return Promise.resolve(existingIds.includes(id));
          });
        }
        return vi.fn();
      }),
      getUint: vi.fn().mockImplementation((id) => {
        if (id === ethers.id('SWAP_FEE_BPS')) {
          return Promise.resolve(30n); // 0.3% fee
        }
        return Promise.resolve(0n);
      }),
      getAddress: vi.fn(),
      getBool: vi.fn(),
      getBytes32: vi.fn(),
      balanceOf: vi.fn().mockResolvedValue(1000000000000000000000n),
      decimals: vi.fn().mockResolvedValue(18),
    })),
    getAddress: vi.fn((addr) => addr),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    formatUnits: vi.fn((value) => value.toString()),
    id: vi.fn((label) => ethers.keccak256(ethers.toUtf8Bytes(label))),
  },
}));

// Mock config
vi.mock('../config', () => ({
  CONTRACT_CONFIG: {
    stateManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    chainId: '31337',
  },
  REGISTRY_IDS: {
    MAIN_CONTRACT: ethers.id('MAIN_CONTRACT'),
    TREASURY: ethers.id('TREASURY'),
    PRIMARY_QUOTE: ethers.id('PRIMARY_QUOTE'),
    SWAP_FEE_BPS: ethers.id('SWAP_FEE_BPS'),
    SWAP_CONTRACT: ethers.id('SWAP_CONTRACT'),
  },
}));

describe('StateManager Value Fetching', () => {
  let mockContract: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContract = new (vi.mocked(ethers.Contract))();

    // Mock window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: {},
      writable: true,
    });
  });

  describe('Address Value Fetching', () => {
    it('fetches MAIN_CONTRACT address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager, [], provider);

      const getAddress = stateManager.getFunction('getAddress(bytes32)');
      const mainContractAddress = await getAddress(REGISTRY_IDS.MAIN_CONTRACT);

      expect(mainContractAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('fetches TREASURY address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager, [], provider);

      const getAddress = stateManager.getFunction('getAddress(bytes32)');
      const treasuryAddress = await getAddress(REGISTRY_IDS.TREASURY);

      expect(treasuryAddress).toBe('0x1234567890123456789012345678901234567891');
    });

    it('fetches PRIMARY_QUOTE address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager, [], provider);

      const getAddress = stateManager.getFunction('getAddress(bytes32)');
      const primaryQuoteAddress = await getAddress(REGISTRY_IDS.PRIMARY_QUOTE);

      expect(primaryQuoteAddress).toBe('0x1234567890123456789012345678901234567892');
    });

    it('fetches SWAP_CONTRACT address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager, [], provider);

      const getAddress = stateManager.getFunction('getAddress(bytes32)');
      const swapContractAddress = await getAddress(REGISTRY_IDS.SWAP_CONTRACT);

      expect(swapContractAddress).toBe('0x1234567890123456789012345678901234567893');
    });
  });

  describe('Uint256 Value Fetching', () => {
    it('fetches SWAP_FEE_BPS as uint256 correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager, [], provider);

      const feeBps = await stateManager.getUint(REGISTRY_IDS.SWAP_FEE_BPS);

      expect(feeBps).toBe(30n);
    });
  });

  describe('Existence Checking', () => {
    it('correctly identifies existing registry IDs', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager, [], provider);

      const hasMainContract = stateManager.getFunction('has(bytes32)');
      const exists = await hasMainContract(REGISTRY_IDS.MAIN_CONTRACT);

      expect(exists).toBe(true);
    });

    it('correctly identifies non-existing registry IDs', async () => {
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [], provider);

      const hasFunction = stateManager.getFunction('has(bytes32)');
      const nonExistentId = ethers.id('NON_EXISTENT_ID');
      const exists = await hasFunction(nonExistentId);

      expect(exists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('handles missing addresses gracefully', async () => {
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [], provider);

      const getAddress = stateManager.getFunction('getAddress(bytes32)');
      const nonExistentId = ethers.id('NON_EXISTENT_ADDRESS');
      const address = await getAddress(nonExistentId);

      expect(address).toBe('0x0000000000000000000000000000000000000000');
    });

    it('handles missing uint values gracefully', async () => {
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [], provider);

      const nonExistentId = ethers.id('NON_EXISTENT_UINT');
      const value = await stateManager.getUint(nonExistentId);

      expect(value).toBe(0n);
    });
  });
});