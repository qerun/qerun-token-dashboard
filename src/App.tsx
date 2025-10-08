import './App.css';
import Swap from './components/Swap';
import AdminPanel from './components/AdminPanel';

function App() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: 60 }}>
      <Swap />
      <AdminPanel />
    </div>
  );
}

export default App
