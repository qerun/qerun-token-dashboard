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

export async function switchToLocalhost(): Promise<void> {
  if (!window.ethereum) {
    alert('Please install MetaMask or a compatible wallet!')
    return
  }

  try {
    // Try to switch to localhost
    await (window.ethereum as any).request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7a69' }], // 31337 in hex
    })
  } catch (switchError: any) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await (window.ethereum as any).request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7a69',
            chainName: 'Hardhat Localhost',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['http://127.0.0.1:8545'],
            blockExplorerUrls: []
          }]
        })
      } catch (addError) {
        console.error('Error adding localhost network:', addError)
        alert('Failed to add localhost network to wallet')
      }
    } else {
      console.error('Error switching to localhost:', switchError)
      alert('Failed to switch to localhost network')
    }
  }
}