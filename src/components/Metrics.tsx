import React from 'react';
import styles from '../styles/qerunTheme.module.css';

export type MetricsData = {
  swapUsdBalance: string;
  swapQerBalance: string;
  usdTotalSupply: string;
  qerTotalSupply: string;
};

type Props = MetricsData;

const Metrics: React.FC<Props> = ({
  swapUsdBalance,
  swapQerBalance,
  usdTotalSupply,
  qerTotalSupply,
}) => {
  return (
    <div className={styles.qerunMetricsPanel}>
      <div className={styles.qerunMetricCard}>
        <div className={styles.qerunMetricLabel}>Swap USD Balance</div>
        <div className={styles.qerunMetricValue}>{swapUsdBalance} USD</div>
      </div>
      <div className={styles.qerunMetricCard}>
        <div className={styles.qerunMetricLabel}>Swap QER Balance</div>
        <div className={styles.qerunMetricValue}>{swapQerBalance} QER</div>
      </div>
      <div className={styles.qerunMetricCard}>
        <div className={styles.qerunMetricLabel}>USDQ Total Supply</div>
        <div className={styles.qerunMetricValue}>{usdTotalSupply}</div>
      </div>
      <div className={styles.qerunMetricCard}>
        <div className={styles.qerunMetricLabel}>QER Total Supply</div>
        <div className={styles.qerunMetricValue}>{qerTotalSupply}</div>
      </div>
    </div>
  );
};

export default Metrics;
