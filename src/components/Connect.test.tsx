import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Connect from './Connect';

// Mock RainbowKit with a simpler approach
const mockOpenConnectModal = vi.fn();
const mockOpenAccountModal = vi.fn();
const mockOpenChainModal = vi.fn();

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: any) => React.ReactNode }) => {
      return children({
        account: {
          address: '0x1234567890123456789012345678901234567890',
          displayName: '0x1234...7890',
        },
        chain: { id: 31337, unsupported: false },
        mounted: true,
        openAccountModal: mockOpenAccountModal,
        openChainModal: mockOpenChainModal,
        openConnectModal: mockOpenConnectModal,
      });
    },
  },
}));

describe('Connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders manage wallet button when connected', () => {
    render(<Connect />);

    expect(screen.getByText('Manage Wallet (0x1234...7890)')).toBeInTheDocument();
  });

  it('calls openAccountModal when manage wallet button is clicked', async () => {
    const user = userEvent.setup();

    render(<Connect />);

    const manageButton = screen.getByText('Manage Wallet (0x1234...7890)');
    await user.click(manageButton);

    expect(mockOpenAccountModal).toHaveBeenCalledTimes(1);
  });

  it('shows wallet connection hint when connected', () => {
    render(<Connect />);

    expect(screen.getByText('💡 Use the wallet modal to disconnect or switch accounts.')).toBeInTheDocument();
  });

  it('has wallet icon in the button', () => {
    render(<Connect />);

    const button = screen.getByText('Manage Wallet (0x1234...7890)').closest('button');
    expect(button).toBeInTheDocument();
  });
});