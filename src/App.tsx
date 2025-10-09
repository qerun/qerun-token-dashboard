import Swap from './components/Swap';
import AdminPanel from './components/AdminPanel';
import Connect from './components/Connect';
import styles from './styles/qerunTheme.module.css';

function App() {
  return (
    <div className={styles.qerunPage}>
      <div className={styles.qerunLogoContainer}>
        <img src="/logo.png" alt="Qerun crown logo" width="96" height="96" className={styles.qerunLogo} />
        <span className={styles.qerunBadge}>Qerun Ecosystem</span>
      </div>

      <div className={styles.qerunLayout}>
        <Swap />
        <AdminPanel />
      </div>

      <div className={styles.qerunConnectFixed}>
        <Connect />
      </div>
    </div>
  );
}

export default App
