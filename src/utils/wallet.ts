export interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  image?: string
}

export async function addTokenToWallet(token: TokenInfo): Promise<boolean> {
  if (!window.ethereum) {
    alert('MetaMask or compatible wallet required!')
    return false
  }

  try {
    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          image: token.image,
        },
      },
    })

    return wasAdded
  } catch (error) {
    console.error('Error adding token:', error)
    return false
  }
}

// Network configurations
const NETWORKS = {
  '1': {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io']
  },
  '5': {
    chainId: '0x5',
    chainName: 'Goerli Testnet',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://goerli.infura.io/v3/'],
    blockExplorerUrls: ['https://goerli.etherscan.io']
  },
  '97': {
    chainId: '0x61',
    chainName: 'BSC Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    blockExplorerUrls: ['https://testnet.bscscan.com']
  },
  '31337': {
    chainId: '0x7a69',
    chainName: 'Hardhat Localhost',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['http://127.0.0.1:8545'],
    blockExplorerUrls: []
  }
} as const;

export function getNetworkName(chainId: string): string {
  const network = NETWORKS[chainId as keyof typeof NETWORKS];
  return network?.chainName || `Chain ${chainId}`;
}

export async function switchToNetwork(chainId: string): Promise<void> {
  if (!window.ethereum) {
    alert('Please install MetaMask or a compatible wallet!')
    return
  }

  const network = NETWORKS[chainId as keyof typeof NETWORKS];
  if (!network) {
    alert(`Unsupported chain ID: ${chainId}`)
    return
  }

  try {
    // Try to switch to the network
    await (window.ethereum as any).request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainId }],
    })
  } catch (switchError: any) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await (window.ethereum as any).request({
          method: 'wallet_addEthereumChain',
          params: [network]
        })
      } catch (addError) {
        console.error(`Error adding ${network.chainName} network:`, addError)
        alert(`Failed to add ${network.chainName} network to wallet`)
      }
    } else {
      console.error(`Error switching to ${network.chainName}:`, switchError)
      alert(`Failed to switch to ${network.chainName} network`)
    }
  }
}

export async function switchToLocalhost(): Promise<void> {
  return switchToNetwork('31337');
}