import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock ethers before importing the component
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn(() => ({
      request: vi.fn().mockImplementation(async ({ method, params }) => {
        if (method === 'eth_call') {
          const [callData] = params;
          if (callData.data === '0x95d89b41') { // symbol()
            // Return ABI-encoded string "QER" or "USDQ"
            const symbol = callData.to === '0x123' ? 'QER' : 'USDQ';
            const symbolHex = Buffer.from(symbol).toString('hex');
            const lenHex = symbol.length.toString(16);
            const offset = '0000000000000000000000000000000000000000000000000000000000000020';
            const length = '0'.repeat(64 - lenHex.length) + lenHex;
            const data = symbolHex.padEnd(64, '0');
            const encoded = '0x' + offset + length + data;
            return encoded;
          } else if (callData.data === '0x313ce567') { // decimals()
            return '0x' + '0000000000000000000000000000000000000000000000000000000000000012'; // 18
          }
        }
        return '0x';
      }),
      // add getSigner for mint operations in tests
      getSigner: () => ({
        getAddress: async () => '0xCAFEBABE00000000000000000000000000000000',
      }),
    })),
    Contract: class MockContract {
      constructor(address: string) {
        // Provide different behavior depending on which contract is instantiated
        if (address === '0xstateManager') {
          (this as any).has = vi.fn().mockResolvedValue(true);
          (this as any).addressOf = vi.fn().mockImplementation((id: string) => {
            if (id === 'MAIN_CONTRACT') return '0x123';
            if (id === 'PRIMARY_QUOTE') return '0x456';
            return '0x0000000000000000000000000000000000000000';
          });
        } else if (address === '0x456') {
          // Token contract mock with mint
          (this as any).mint = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) });
        }
      }
    },
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  },
}));

// Mock StateManagerAbi
vi.mock('../abi/StateManager.json', () => ({
  default: { abi: [] },
}));

// Mock the wallet utilities
vi.mock('../utils/wallet', () => ({
  addTokenToWallet: vi.fn(),
  switchToNetwork: vi.fn(),
  getNetworkName: vi.fn(),
}));

// Mock the config
vi.mock('../config', () => ({
  CONTRACT_CONFIG: {
    chainId: '97',
    stateManager: '0xstateManager',
  },
  REGISTRY_IDS: {
    MAIN_CONTRACT: 'MAIN_CONTRACT',
    PRIMARY_QUOTE: 'PRIMARY_QUOTE',
  },
}));

import NetworkManager from './NetworkManager';
import { addTokenToWallet, switchToNetwork, getNetworkName } from '../utils/wallet';

describe('NetworkManager', () => {
  const mockAddTokenToWallet = vi.mocked(addTokenToWallet);
  const mockSwitchToNetwork = vi.mocked(switchToNetwork);
  const mockGetNetworkName = vi.mocked(getNetworkName);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNetworkName.mockReturnValue('BSC Testnet');
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all buttons', () => {
    render(<NetworkManager />);

    expect(screen.getByText('Switch to BSC Testnet')).toBeInTheDocument();
    expect(screen.getByText('Add QER Token')).toBeInTheDocument();
    expect(screen.getByText('Add USDQ Token')).toBeInTheDocument();
    expect(screen.getByText('Fund me 200 USDQ (test)')).toBeInTheDocument();
  });

  it('mints 200 USDQ to the connected wallet when Fund button clicked', async () => {
    const user = userEvent.setup();
    render(<NetworkManager />);

    const fundButton = screen.getByText('Fund me 200 USDQ (test)');
    await user.click(fundButton);

    // Expect success alert to be shown
    expect(window.alert).toHaveBeenCalledWith('200 USDQ has been minted to your wallet (test only).');
  });

  it('calls switchToNetwork when Switch button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnAfterSwitch = vi.fn();

    render(<NetworkManager onAfterSwitch={mockOnAfterSwitch} />);

    const switchButton = screen.getByText('Switch to BSC Testnet');
    await user.click(switchButton);

    expect(mockSwitchToNetwork).toHaveBeenCalledWith('97');
    expect(mockOnAfterSwitch).toHaveBeenCalledTimes(1);
  });

  it('calls addTokenToWallet with QER token when Add QER Token button is clicked', async () => {
    const user = userEvent.setup();
    mockAddTokenToWallet.mockResolvedValue(true);

    render(<NetworkManager />);

    const addQerButton = screen.getByText('Add QER Token');
    await user.click(addQerButton);

    expect(mockAddTokenToWallet).toHaveBeenCalledWith({
      address: '0x123',
      symbol: 'QER',
      decimals: 18,
    });
  });

  it('calls addTokenToWallet with USDQ token when Add USDQ Token button is clicked', async () => {
    const user = userEvent.setup();
    mockAddTokenToWallet.mockResolvedValue(true);

    render(<NetworkManager />);

    const addUsdqButton = screen.getByText('Add USDQ Token');
    await user.click(addUsdqButton);

    expect(mockAddTokenToWallet).toHaveBeenCalledWith({
      address: '0x456',
      symbol: 'USDQ',
      decimals: 18,
    });
  });

  it('shows success alert when token is added successfully', async () => {
    const user = userEvent.setup();
    mockAddTokenToWallet.mockResolvedValue(true);

    render(<NetworkManager />);

    const addQerButton = screen.getByText('Add QER Token');
    await user.click(addQerButton);

    expect(window.alert).toHaveBeenCalledWith('QER token added to wallet!');
  });

  it('does not show alert when token addition fails', async () => {
    const user = userEvent.setup();
    mockAddTokenToWallet.mockResolvedValue(false);

    render(<NetworkManager />);

    const addQerButton = screen.getByText('Add QER Token');
    await user.click(addQerButton);

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('handles switch network errors gracefully', async () => {
    const user = userEvent.setup();
    const mockOnAfterSwitch = vi.fn();
    mockSwitchToNetwork.mockRejectedValue(new Error('Network switch failed'));

    // Mock console.error to avoid test output pollution
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<NetworkManager onAfterSwitch={mockOnAfterSwitch} />);

    const switchButton = screen.getByText('Switch to BSC Testnet');
    await user.click(switchButton);

    expect(mockSwitchToNetwork).toHaveBeenCalledWith('97');
    expect(mockOnAfterSwitch).toHaveBeenCalledTimes(1); // Still called even on error
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});