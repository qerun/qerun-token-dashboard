import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import Connect from './components/Connect';
import Swap from './components/Swap';

function App() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <Connect />
      <Swap />
    </div>
  );
}

export default App
