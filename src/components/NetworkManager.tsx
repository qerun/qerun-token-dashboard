import React from 'react';
import styles from '../styles/qerunTheme.module.css';
import { addTokenToWallet, switchToSepolia } from '../utils/wallet';
import { TOKENS } from '../config/tokens';

type Props = {
  onAfterSwitch?: () => void;
};

const NetworkManager: React.FC<Props> = ({ onAfterSwitch }) => {
  const handleAddQER = async () => {
    const success = await addTokenToWallet(TOKENS.QER);
    if (success) alert('QER token added to wallet!');
  };

  const handleAddUSDQ = async () => {
    const success = await addTokenToWallet(TOKENS.USDQ);
    if (success) alert('USDQ token added to wallet!');
  };

  const handleSwitchNetwork = async () => {
    await switchToSepolia();
    // Let the parent refresh its state (e.g., re-read contracts/balances)
    onAfterSwitch?.();
  };

  return (
    <div className={`${styles.qerunCard} ${styles.qerunNetworkCardSpacing}`}>
      <div>
        <h3 className={styles.qerunCardTitle}>Network & Tokens</h3>
      </div>
      <div className={styles.qerunButtonContainer}>
        <button onClick={handleSwitchNetwork} className={styles.qerunSwapButton}>
          Switch to Sepolia
        </button>
        <button onClick={handleAddQER} className={styles.qerunSwapButton}>
          Add QER Token
        </button>
        <button onClick={handleAddUSDQ} className={styles.qerunSwapButton}>
          Add USDQ Token
        </button>
      </div>
    </div>
  );
};

export default NetworkManager;
