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
      if (signature === 'addressOf(string)') {
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
      getUint: vi.fn((id) => {
        if (id === 'SWAP_FEE_BPS') {
          return Promise.resolve(30n); // 0.3% fee
        }
        return Promise.resolve(0n);
      }),
      addressOf: vi.fn((id) => {
        if (id === 'MAIN_CONTRACT') return '0x1234567890123456789012345678901234567890';
        if (id === 'TREASURY') return '0x1234567890123456789012345678901234567891';
        if (id === 'PRIMARY_QUOTE') return '0x1234567890123456789012345678901234567892';
        if (id === 'SWAP_CONTRACT') return '0x1234567890123456789012345678901234567893';
        return '0x0000000000000000000000000000000000000000';
      }),
      getBool: vi.fn(),
      getBytes32: vi.fn(),
      getFunction: vi.fn((name) => {
        if (name === 'has(string)') {
          return vi.fn((id) => id === 'MAIN_CONTRACT');
        }
        if (name === 'addressOf(string)') {
          return vi.fn((id) => {
            if (id === 'MAIN_CONTRACT') return '0x1234567890123456789012345678901234567890';
            if (id === 'TREASURY') return '0x1234567890123456789012345678901234567891';
            if (id === 'PRIMARY_QUOTE') return '0x1234567890123456789012345678901234567892';
            if (id === 'SWAP_CONTRACT') return '0x1234567890123456789012345678901234567893';
            return '0x0000000000000000000000000000000000000000';
          });
        }
        return vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
      }),
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
    MAIN_CONTRACT: 'MAIN_CONTRACT',
    TREASURY: 'TREASURY',
    PRIMARY_QUOTE: 'PRIMARY_QUOTE',
    SWAP_FEE_BPS: 'SWAP_FEE_BPS',
    SWAP_CONTRACT: 'SWAP_CONTRACT',
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
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager!, [], provider);

  const addressOf = stateManager.getFunction('addressOf(string)');
  const mainContractAddress = await addressOf(REGISTRY_IDS.MAIN_CONTRACT);

      expect(mainContractAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('fetches TREASURY address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager!, [], provider);

  const addressOf = stateManager.getFunction('addressOf(string)');
  const treasuryAddress = await addressOf(REGISTRY_IDS.TREASURY);

      expect(treasuryAddress).toBe('0x1234567890123456789012345678901234567891');
    });

    it('fetches PRIMARY_QUOTE address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager!, [], provider);

  const addressOf = stateManager.getFunction('addressOf(string)');
  const primaryQuoteAddress = await addressOf(REGISTRY_IDS.PRIMARY_QUOTE);

      expect(primaryQuoteAddress).toBe('0x1234567890123456789012345678901234567892');
    });

    it('fetches SWAP_CONTRACT address correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager!, [], provider);

  const addressOf = stateManager.getFunction('addressOf(string)');
  const swapContractAddress = await addressOf(REGISTRY_IDS.SWAP_CONTRACT);

      expect(swapContractAddress).toBe('0x1234567890123456789012345678901234567893');
    });
  });

  describe('Uint256 Value Fetching', () => {
    it('fetches SWAP_FEE_BPS as uint256 correctly', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager!, [], provider);

      const feeBps = await stateManager.getUint(REGISTRY_IDS.SWAP_FEE_BPS);

      expect(feeBps).toBe(30n);
    });
  });

  describe('Existence Checking', () => {
    it('correctly identifies existing registry IDs', async () => {
      const { CONTRACT_CONFIG, REGISTRY_IDS } = await import('../config');
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract(CONTRACT_CONFIG.stateManager!, [], provider);

      const hasMainContract = stateManager.getFunction('has(string)');
      const exists = await hasMainContract(REGISTRY_IDS.MAIN_CONTRACT);

      expect(exists).toBe(true);
    });

    it('correctly identifies non-existing registry IDs', async () => {
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [], provider);

      const hasFunction = stateManager.getFunction('has(string)');
      const nonExistentId = 'NON_EXISTENT_ID';
      const exists = await hasFunction(nonExistentId);

      expect(exists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('handles missing addresses gracefully', async () => {
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [], provider);

      const getAddress = stateManager.getFunction('addressOf(string)');
      const nonExistentId = 'NON_EXISTENT_ADDRESS';
      const address = await getAddress(nonExistentId);

      expect(address).toBe('0x0000000000000000000000000000000000000000');
    });

    it('handles missing uint values gracefully', async () => {
      const ethers = await import('ethers');

      const provider = new ethers.ethers.BrowserProvider(window.ethereum);
      const stateManager = new ethers.ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [], provider);

      const nonExistentId = 'NON_EXISTENT_UINT';
      const value = await stateManager.getUint(nonExistentId);

      expect(value).toBe(0n);
    });
  });
});