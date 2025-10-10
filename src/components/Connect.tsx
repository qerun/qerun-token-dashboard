import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button, Typography, Box } from '@mui/material';

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
              <Button
                color="primary"
                variant="contained"
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
                  borderRadius: 'var(--qerun-radius-xl, 16px)'
                }}
              >
                {buttonLabel}
              </Button>
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
