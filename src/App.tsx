import './App.css';
import Connect from './components/Connect';
import Swap from './components/Swap';
import AdminPanel from './components/AdminPanel';

function App() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: 60 }}>
      <Connect />
      <Swap />
      <AdminPanel />
    </div>
  );
}

export default App
