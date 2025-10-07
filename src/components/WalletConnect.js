import React, { useState } from "react";
import { ethers } from "ethers";

export default function WalletConnect({ onConnect }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  async function connectWallet() {
    setError("");
    if (!window.ethereum) {
      setError("No Ethereum wallet found. Please install MetaMask or another wallet.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setAddress(userAddress);
      if (onConnect) onConnect({ provider, signer, address: userAddress });
    } catch (err) {
      setError(err.message || "Wallet connection failed.");
    }
  }

  return (
    <div style={{ margin: "1rem 0" }}>
      {address ? (
        <div>
          <strong>Connected:</strong> {address}
        </div>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}
