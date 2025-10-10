import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import styles from '../styles/qerunTheme.module.css';

const Connect: React.FC = () => {
  return (
    <div className={styles.connectContainer}>
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
            <div
              {...(!ready && {
                'aria-hidden': true,
                style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
              })}
            >
              <button
                type="button"
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
                className={`${styles.qerunConnectButton} ${connected && !unsupported ? styles.connected : ''} ${
                  !ready || unsupported ? styles.disabled : ''
                }`}
              >
                {buttonLabel}
              </button>
              {connected && !unsupported && (
                <p className={styles.connectHelpText}>
                  💡 Use the wallet modal to disconnect or switch accounts.
                </p>
              )}
              {unsupported && (
                <p className={styles.connectHelpText}>
                  ⚠️ Network unsupported. Click the button to switch networks.
                </p>
              )}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
};

export default Connect;
