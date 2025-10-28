import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NetworkManager from './NetworkManager';
import { addTokenToWallet, switchToLocalhost } from '../utils/wallet';

// Mock the wallet utilities
vi.mock('../utils/wallet', () => ({
  addTokenToWallet: vi.fn(),
  switchToLocalhost: vi.fn(),
}));

// Mock the tokens config
vi.mock('../config/tokens', () => ({
  TOKENS: {
    QER: { address: '0x123', symbol: 'QER', decimals: 18 },
    USDQ: { address: '0x456', symbol: 'USDQ', decimals: 18 },
  },
}));

describe('NetworkManager', () => {
  const mockAddTokenToWallet = vi.mocked(addTokenToWallet);
  const mockSwitchToLocalhost = vi.mocked(switchToLocalhost);

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all buttons', () => {
    render(<NetworkManager />);

    expect(screen.getByText('Switch to Sepolia')).toBeInTheDocument();
    expect(screen.getByText('Add QER Token')).toBeInTheDocument();
    expect(screen.getByText('Add USDQ Token')).toBeInTheDocument();
  });

  it('calls switchToLocalhost when Switch to Sepolia button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnAfterSwitch = vi.fn();

    render(<NetworkManager onAfterSwitch={mockOnAfterSwitch} />);

    const switchButton = screen.getByText('Switch to Sepolia');
    await user.click(switchButton);

    expect(mockSwitchToLocalhost).toHaveBeenCalledTimes(1);
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
    mockSwitchToLocalhost.mockRejectedValue(new Error('Network switch failed'));

    // Mock console.error to avoid test output pollution
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<NetworkManager onAfterSwitch={mockOnAfterSwitch} />);

    const switchButton = screen.getByText('Switch to Sepolia');
    await user.click(switchButton);

    expect(mockSwitchToLocalhost).toHaveBeenCalledTimes(1);
    expect(mockOnAfterSwitch).toHaveBeenCalledTimes(1); // Still called even on error
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});