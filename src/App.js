
import './App.css';
import React, { useState } from 'react';
import WalletConnect from './components/WalletConnect';

function App() {
  const [wallet, setWallet] = useState(null);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Qerun Token Dashboard</h1>
      </header>
      <WalletConnect onConnect={setWallet} />
      {/* Add dashboard components here, passing wallet as needed */}
    </div>
  );
}

export default App;
