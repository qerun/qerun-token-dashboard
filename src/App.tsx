import Swap from './components/Swap';
import AdminPanel from './components/AdminPanel';
import Connect from './components/Connect';
import Logo from './components/Logo';
import styles from './styles/qerunTheme.module.css';

function App() {
  return (
    <div className={styles.qerunPage}>
      <Logo />

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
