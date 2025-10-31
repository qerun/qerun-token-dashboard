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
  // Try to resolve on-chain symbol first — MetaMask can reject if the requested
  // symbol doesn't match the token contract's symbol. We'll query the token
  // contract using a raw eth_call to avoid adding a dependency here.
  let symbolToUse = token.symbol
  try {
    const callData = '0x' + '95d89b41' // selector for symbol()
    const res: string = await (window.ethereum as any).request({
      method: 'eth_call',
      params: [
        {
          to: token.address,
          data: callData,
        },
        'latest',
      ],
    })

    if (res && res !== '0x') {
      // decode ABI-encoded string return: offset(32) | length(32) | data
      try {
        const hex = res.replace(/^0x/, '')
        // length is at bytes 32..64 (chars 64..128)
        const lenHex = hex.slice(64, 128)
        const len = parseInt(lenHex, 16)
        if (!Number.isNaN(len) && len > 0) {
          const dataHex = hex.slice(128, 128 + len * 2)
          const buf = Buffer.from(dataHex, 'hex')
          const onChainSymbol = buf.toString('utf8')
          if (onChainSymbol) {
            symbolToUse = onChainSymbol
            // If mismatch, log so it's easier to debug
            if (onChainSymbol !== token.symbol) {
              console.warn(`Token symbol mismatch: config=${token.symbol} onChain=${onChainSymbol}. Using on-chain symbol when adding to wallet.`)
            }
          }
        }
      } catch (decodeErr) {
        console.warn('Failed to decode token symbol from eth_call result', decodeErr)
      }
    }
  } catch (e) {
    // eth_call failed — we'll log and continue using the provided symbol
    console.warn('Could not resolve token symbol via eth_call, proceeding with configured symbol', e)
  }

  try {
    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: token.address,
          symbol: symbolToUse,
          decimals: token.decimals,
          image: token.image,
        },
      },
    })

    return wasAdded
  } catch (error) {
    console.error('Error adding token:', error)
    // Some wallets or RPC providers can be picky about address case or format.
    // Try a fallback with a lowercased address if the original had mixed case.
    try {
      const lower = token.address.toLowerCase()
      if (lower !== token.address) {
        try {
          const wasAdded2 = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC20',
              options: {
                address: lower,
                symbol: symbolToUse,
                decimals: token.decimals,
                image: token.image,
              },
            },
          })
          if (wasAdded2) return true
        } catch (err2) {
          console.error('Retry adding token with lowercased address failed:', err2)
        }
      }
    } catch (inner) {
      console.error('Lowercase fallback failed:', inner)
    }

    // Provide a user-visible error so it's easier to debug in the UI
    try {
      alert(`Failed to add ${token.symbol} to wallet: ${String((error as any)?.message || error)}`)
    } catch (_) {
      // ignore alert failures
    }
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