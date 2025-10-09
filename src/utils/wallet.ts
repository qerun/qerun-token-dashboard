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

export async function switchToSepolia(): Promise<void> {
  if (!window.ethereum) {
    alert('Please install MetaMask or a compatible wallet!')
    return
  }

  try {
    // Try to switch to Sepolia
    await (window.ethereum as any).request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa36a7' }],
    })
  } catch (switchError: any) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await (window.ethereum as any).request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia test network',
            nativeCurrency: { name: 'SepoliaETH', symbol: 'SepoliaETH', decimals: 18 },
            rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/demo'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/']
          }]
        })
      } catch (addError) {
        console.error('Failed to add network:', addError)
        alert('Failed to add Sepolia network to wallet')
      }
    } else {
      console.error('Failed to switch network:', switchError)
      alert('Failed to switch to Sepolia network')
    }
  }
}