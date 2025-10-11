import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button, Typography, Box, Tooltip, Stack } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

const Connect: React.FC = () => {
  return (
    <Box>
      <ConnectButton.Custom>
        {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
          const ready = mounted;
          const connected = ready && !!account && !!chain;
          const unsupported = chain?.unsupported;

          const buttonLabel = !connected
            ? 'Connect Wallet'
            : unsupported
              ? 'Switch Network'
              : `Manage Wallet (${account.displayName})`;

          return (
            <Box
              {...(!ready && {
                'aria-hidden': true,
                style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
              })}
            >
              <Stack spacing={2} direction="column" alignItems="center">
                <Tooltip title="Tap to connect your wallet. If you don't have a wallet app, try MetaMask or Trust Wallet. For mobile, WalletConnect QR is supported." arrow>
                  <span>
                    <Button
                      color="primary"
                      variant="contained"
                      size="large"
                      startIcon={<AccountBalanceWalletIcon />}
                      disabled={!ready}
                      onClick={() => {
                        if (!connected) {
                          openConnectModal();
                        } else if (unsupported) {
                          openChainModal();
                        } else {
                          openAccountModal();
                        }
                      }}
                      sx={{
                        background: 'var(--qerun-button-bg)',
                        color: 'var(--qerun-button-text)',
                        borderRadius: 'var(--qerun-radius-xl, 16px)',
                        minHeight: 56,
                        fontSize: '1.1rem',
                        px: 3,
                      }}
                    >
                      {buttonLabel}
                    </Button>
                  </span>
                </Tooltip>
                {!connected && (
                  <Button
                    color="secondary"
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      // Open WalletConnect QR modal directly
                      if (window?.rainbowkit) {
                        window.rainbowkit.openWalletConnectModal?.();
                      } else {
                        openConnectModal(); // fallback to default modal
                      }
                    }}
                    sx={{
                      borderRadius: 'var(--qerun-radius-xl, 16px)',
                      minHeight: 48,
                      fontSize: '1rem',
                      px: 2,
                    }}
                  >
                    Connect with WalletConnect QR
                  </Button>
                )}
              </Stack>
              {connected && !unsupported && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'var(--qerun-text-muted)' }}>
                  💡 Use the wallet modal to disconnect or switch accounts.
                </Typography>
              )}
              {unsupported && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'var(--qerun-accent)' }}>
                  ⚠️ Network unsupported. Click the button to switch networks.
                </Typography>
              )}
            </Box>
          );
        }}
      </ConnectButton.Custom>
    </Box>
  );
};

export default Connect;
