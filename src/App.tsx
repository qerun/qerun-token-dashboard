import { useState } from 'react';
import Swap from './components/Swap';
import AdminPanel from './components/AdminPanel';
import Connect from './components/Connect';
import Logo from './components/Logo';
import NetworkManager from './components/NetworkManager';
import Metrics, { type MetricsData } from './components/Metrics';
import styles from './styles/qerunTheme.module.css';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [metrics, setMetrics] = useState<MetricsData>({
    swapUsdBalance: '0',
    swapQerBalance: '0',
    usdTotalSupply: '0',
    qerTotalSupply: '0',
  });

  return (
    <div className={styles.qerunPage}>
      <Logo />
      <div className={styles.qerunLayout}>
        <Swap refreshKey={refreshKey} onMetricsUpdate={setMetrics} />
        <div className={styles.qerunCard}>
          <h2 className={styles.qerunCardTitle}>Network & Status</h2>
          <Metrics {...metrics} />
          <div className={styles.qerunButtonContainer}>
            <NetworkManager onAfterSwitch={() => setRefreshKey((v) => v + 1)} />
          </div>
        </div>
      </div>
      <AdminPanel />
      <div className={styles.qerunConnectFixed}>
        <Connect />
      </div>
    </div>
  );
}

export default App
