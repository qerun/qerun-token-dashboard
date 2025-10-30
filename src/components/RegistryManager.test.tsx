import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ethers } from 'ethers';
import RegistryManager from './RegistryManager';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0xadmin1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));

// Mock ethers with detailed contract interaction tracking
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      BrowserProvider: vi.fn().mockImplementation(() => ({
        getNetwork: vi.fn().mockResolvedValue({ chainId: 31337n }),
        getSigner: vi.fn().mockResolvedValue({
          getAddress: vi.fn().mockResolvedValue('0xadmin1234567890123456789012345678901234567890'),
        }),
        getCode: vi.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50d3801561001d57600080fd5b50d2801561002a57600080fd5b506100f'), // Mock contract bytecode
      })),
      Contract: vi.fn().mockImplementation((address, abi, signerOrProvider) => {
        if (address === '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
          return {
            has: vi.fn((id) => Promise.resolve(['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS'].includes(id))),
            getMetadata: vi.fn((id) => {
              if (id === 'MAIN_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              if (id === 'TREASURY') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              if (id === 'PRIMARY_QUOTE') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              if (id === 'SWAP_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              if (id === 'SWAP_FEE_BPS') return Promise.resolve([2, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              return Promise.resolve([0, '0x0000000000000000000000000000000000000000000000000000000000000000']);
            }),
            addressOf: vi.fn((id) => {
              if (id === 'MAIN_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567890');
              if (id === 'TREASURY') return Promise.resolve('0x1234567890123456789012345678901234567891');
              if (id === 'PRIMARY_QUOTE') return Promise.resolve('0x1234567890123456789012345678901234567892');
              if (id === 'SWAP_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567893');
              return Promise.resolve('0x0000000000000000000000000000000000000000');
            }),
            getUint: vi.fn((id) => {
              if (id === 'SWAP_FEE_BPS') return Promise.resolve(30n);
              return Promise.resolve(0n);
            }),
            getBool: vi.fn(),
            getBytes32: vi.fn(),
            getGovernanceModule: vi.fn((contractAddress) => {
              // Return governance module for MAIN_CONTRACT and SWAP_CONTRACT
              if (contractAddress === '0x1234567890123456789012345678901234567890' || contractAddress === '0x1234567890123456789012345678901234567893') {
                return Promise.resolve('0x1111111111111111111111111111111111111111');
              }
              return Promise.resolve(ethers.ZeroAddress);
            }),
            setAddress: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setUint: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBool: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBytes32: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
          };
        } else {
          // For other contracts
          const setStateManagerFn = Object.assign(
            vi.fn(() => Promise.resolve({})),
            { staticCall: vi.fn(() => Promise.resolve({})) }
          );
          
          return {
            isGovernanceEnabled: vi.fn(() => Promise.resolve(false)), // Mock governance as disabled initially
            enableGovernance: vi.fn(() => Promise.resolve({})),
            disableGovernance: vi.fn(() => Promise.resolve({})),
            setStateManager: setStateManagerFn,
            target: address,
            interface: { format: vi.fn() },
            filters: {},
          };
        }
      }),
      getAddress: vi.fn((addr) => addr),
      ZeroAddress: '0x0000000000000000000000000000000000000000',
      formatUnits: vi.fn((value) => value.toString()),
      id: vi.fn((label) => ethers.keccak256(ethers.toUtf8Bytes(label))),
      isAddress: vi.fn((addr) => typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42),
      isHexString: vi.fn((str) => typeof str === 'string' && str.startsWith('0x')),
      keccak256: vi.fn((data) => {
        if (data instanceof Uint8Array) {
          // Return a proper hash for 'IMMUTABLE'
          if (Buffer.from(data).toString() === 'IMMUTABLE') {
            return '0x4c494d4d555441424c4500000000000000000000000000000000000000000000';
          }
          // Convert to hex and pad
          const hex = Buffer.from(data).toString('hex');
          return '0x' + hex.padStart(64, '0').slice(0, 64);
        }
        return '0x' + data.toString().padStart(64, '0');
      }),
      toUtf8Bytes: vi.fn((str) => new Uint8Array(Buffer.from(str))),
    },
  };
});

// Mock config
vi.mock('../config', () => ({
  CONTRACT_CONFIG: {
    stateManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    chainId: '31337',
  },
}));

// Mock StateManager ABI
vi.mock('../abi/StateManager.json', () => ({
  default: [],
  abi: [],
}));

describe('RegistryManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.ethereum with EIP-1193 provider interface
    Object.defineProperty(window, 'ethereum', {
      value: {
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        isMetaMask: true,
      },
      writable: true,
    });

    // Mock window.prompt
    Object.defineProperty(window, 'prompt', {
      value: vi.fn(),
      writable: true,
    });
  });

  describe('Component Rendering', () => {
    it('renders the component with wallet connected', async () => {
      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('StateManager Registry')).toBeInTheDocument();
      });

      // Wait for registry entries to load
      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      expect(screen.getByText('TREASURY')).toBeInTheDocument();
    });
  });

  describe('Governance Toggle Functionality', () => {
    it('shows governance toggle switch for contracts with governance modules', async () => {
      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      const toggleSwitches = screen.getAllByRole('switch', { name: /Governance is disabled - Click to enable/i });
      expect(toggleSwitches.length).toBeGreaterThan(0);
    });

    it('calls disableGovernance when toggle is switched off', async () => {
      // Mock the contract to have disableGovernance function
      const mockDisableGovernance = vi.fn().mockResolvedValue({});
      const originalMock = vi.mocked(ethers.Contract);
      
      vi.mocked(ethers.Contract).mockImplementation((address, abi, signer) => {
        if (address === '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
          // StateManager contract
          const stateManagerMock = {
            has: vi.fn((id) => {
              const existingIds = ['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS'];
              return Promise.resolve(existingIds.includes(id));
            }),
            getMetadata: vi.fn((id?: string) => {
              if (id === undefined) {
                return Promise.resolve([
                  {
                    id: 'MAIN_CONTRACT',
                    value: '0x1234567890123456789012345678901234567890',
                    valueType: 1,
                    requiredRole: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    isImmutable: false,
                  },
                ]);
              }
              if (id === 'MAIN_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              return Promise.resolve([0, '0x0000000000000000000000000000000000000000000000000000000000000000']);
            }),
            addressOf: vi.fn((id) => {
              if (id === 'MAIN_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567890');
              return Promise.resolve('0x0000000000000000000000000000000000000000');
            }),
            getGovernanceModule: vi.fn((contractAddress) => {
              if (contractAddress === '0x1234567890123456789012345678901234567890') {
                return Promise.resolve('0x1111111111111111111111111111111111111111');
              }
              return Promise.resolve(ethers.ZeroAddress);
            }),
            setGovernanceStatic: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setAddress: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setUint: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBool: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBytes32: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
          };
          return stateManagerMock;
        } else if (address === '0x1234567890123456789012345678901234567890') {
          // MAIN_CONTRACT with governance functions
          const abiString = JSON.stringify(abi);
          if (abiString.includes('isGovernanceEnabled')) {
            return {
              isGovernanceEnabled: vi.fn(() => Promise.resolve(true)),
              target: address,
              interface: { format: vi.fn() },
              runner: signer,
              filters: {},
            };
          } else {
            return {
              isGovernanceEnabled: vi.fn(() => Promise.resolve(true)),
              disableGovernance: mockDisableGovernance,
              target: address,
              interface: { format: vi.fn() },
              runner: signer,
              filters: {},
              setStateManager: vi.fn().mockResolvedValue({}),
            } as any;
          }
        }
        
        // Generic contract
        return {
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
        };
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const toggleSwitch = screen.getByRole('checkbox', { name: /Governance is enabled - Click to disable/i });
        fireEvent.click(toggleSwitch);
      });

      await waitFor(() => {
        expect(mockDisableGovernance).toHaveBeenCalled();
      });

      // Restore original mock
      vi.mocked(ethers.Contract).mockImplementation(originalMock);
    });

    it('calls enableGovernance when toggle is switched on', async () => {
      // Mock the contract to have enableGovernance function
      const mockEnableGovernance = vi.fn().mockResolvedValue({});
      const originalMock = vi.mocked(ethers.Contract);
      
      vi.mocked(ethers.Contract).mockImplementation((address, abi, signer) => {
        if (address === '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
          // StateManager contract
          const stateManagerMock = {
            has: vi.fn((id) => {
              const existingIds = ['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS'];
              return Promise.resolve(existingIds.includes(id));
            }),
            getMetadata: vi.fn((id?: string) => {
              if (id === undefined) {
                return Promise.resolve([
                  {
                    id: 'MAIN_CONTRACT',
                    value: '0x1234567890123456789012345678901234567890',
                    valueType: 1,
                    requiredRole: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    isImmutable: false,
                  },
                ]);
              }
              if (id === 'MAIN_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              return Promise.resolve([0, '0x0000000000000000000000000000000000000000000000000000000000000000']);
            }),
            addressOf: vi.fn((id) => {
              if (id === 'MAIN_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567890');
              return Promise.resolve('0x0000000000000000000000000000000000000000');
            }),
            getGovernanceModule: vi.fn((contractAddress) => {
              if (contractAddress === '0x1234567890123456789012345678901234567890') {
                return Promise.resolve('0x1111111111111111111111111111111111111111');
              }
              return Promise.resolve(ethers.ZeroAddress);
            }),
            setGovernanceStatic: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setAddress: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setUint: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBool: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBytes32: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
          };
          return stateManagerMock;
        } else if (address === '0x1234567890123456789012345678901234567890') {
          // MAIN_CONTRACT with governance functions
          return {
            isGovernanceEnabled: vi.fn(() => Promise.resolve(false)),
            enableGovernance: mockEnableGovernance,
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
            setStateManager: vi.fn().mockResolvedValue({}),
          } as any;
        }
        
        // Generic contract
        return {
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
        };
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const toggleSwitch = screen.getByRole('checkbox', { name: /Governance is disabled - Click to enable/i });
        fireEvent.click(toggleSwitch);
      });

      await waitFor(() => {
        expect(mockEnableGovernance).toHaveBeenCalled();
      });

      // Restore original mock
      vi.mocked(ethers.Contract).mockImplementation(originalMock);
    });

    it('calls enableGovernance when toggle is switched on', async () => {
      // Mock the contract to have enableGovernance function
      const mockEnableGovernance = vi.fn().mockResolvedValue({});
      const originalMock = vi.mocked(ethers.Contract);
      
      vi.mocked(ethers.Contract).mockImplementation((address, abi, signer) => {
        if (address === '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
          // StateManager contract
          const stateManagerMock = {
            has: vi.fn((id) => {
              const existingIds = ['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS'];
              return Promise.resolve(existingIds.includes(id));
            }),
            getMetadata: vi.fn((id?: string) => {
              if (id === undefined) {
                return Promise.resolve([
                  {
                    id: 'MAIN_CONTRACT',
                    value: '0x1234567890123456789012345678901234567890',
                    valueType: 1,
                    requiredRole: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    isImmutable: false,
                  },
                ]);
              }
              if (id === 'MAIN_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              return Promise.resolve([0, '0x0000000000000000000000000000000000000000000000000000000000000000']);
            }),
            addressOf: vi.fn((id) => {
              if (id === 'MAIN_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567890');
              return Promise.resolve('0x0000000000000000000000000000000000000000');
            }),
            getGovernanceModule: vi.fn((contractAddress) => {
              if (contractAddress === '0x1234567890123456789012345678901234567890') {
                return Promise.resolve('0x1111111111111111111111111111111111111111');
              }
              return Promise.resolve(ethers.ZeroAddress);
            }),
            setGovernanceStatic: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setAddress: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setUint: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBool: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBytes32: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
          };
          return stateManagerMock;
        } else if (address === '0x1234567890123456789012345678901234567890') {
          // MAIN_CONTRACT with governance functions
          return {
            isGovernanceEnabled: vi.fn(() => Promise.resolve(false)),
            enableGovernance: mockEnableGovernance,
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
            setStateManager: vi.fn().mockResolvedValue({}),
          } as any;
        }
        
        // Generic contract
        return {
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
        };
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const toggleSwitch = screen.getByRole('checkbox', { name: /Governance is disabled - Click to enable/i });
        fireEvent.click(toggleSwitch);
      });

      await waitFor(() => {
        expect(mockEnableGovernance).toHaveBeenCalled();
      });

      // Restore original mock
      vi.mocked(ethers.Contract).mockImplementation(originalMock);
    });

  describe('StateManager Setter Functionality', () => {
    it('shows StateManager setter button for contracts with setStateManager function', async () => {
      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      const setterButtons = screen.getAllByLabelText('Set StateManager');
      expect(setterButtons.length).toBeGreaterThan(0);
    });

    it('prompts for new StateManager address when setter button is clicked', async () => {
      const mockPrompt = vi.fn().mockReturnValue('0x9876543210987654321098765432109876543210');
      Object.defineProperty(window, 'prompt', {
        value: mockPrompt,
        writable: true,
      });

      const mockSetStateManager = vi.fn().mockResolvedValue({});

      // Mock contract with setStateManager
      vi.mocked(ethers.Contract).mockImplementationOnce((address, abi, signer) => {
        const contractMock = {
          has: vi.fn((id) => {
            const existingIds = ['MAIN_CONTRACT'];
            return Promise.resolve(existingIds.includes(id));
          }),
          getMetadata: vi.fn((id) => {
            return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
          }),
          addressOf: vi.fn((id) => {
            return Promise.resolve('0x1234567890123456789012345678901234567890');
          }),
          getGovernanceModule: vi.fn((address) => {
            return Promise.resolve(ethers.ZeroAddress);
          }),
          setStateManager: mockSetStateManager,
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
          getUint: vi.fn(),
          getBool: vi.fn(),
          getBytes32: vi.fn(),
          setBytes32: vi.fn(),
        } as any;
        return contractMock;
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const setterButton = screen.getByLabelText('Set StateManager');
        fireEvent.click(setterButton);
      });

      expect(mockPrompt).toHaveBeenCalledWith('Enter new StateManager address:');
      expect(mockSetStateManager).toHaveBeenCalledWith('0x9876543210987654321098765432109876543210');
    });

    it('validates Ethereum address input for StateManager setter', async () => {
      const mockPrompt = vi.fn().mockReturnValue('invalid-address');
      Object.defineProperty(window, 'prompt', {
        value: mockPrompt,
        writable: true,
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const setterButton = screen.getByLabelText('Set StateManager');
        fireEvent.click(setterButton);
      });

      expect(mockPrompt).toHaveBeenCalledWith('Enter new StateManager address:');
      // Should show error message for invalid address
      await waitFor(() => {
        expect(screen.getByText('Invalid Ethereum address')).toBeInTheDocument();
      });
    });

    it('handles cancellation of StateManager address prompt', async () => {
      const mockPrompt = vi.fn().mockReturnValue(null);
      Object.defineProperty(window, 'prompt', {
        value: mockPrompt,
        writable: true,
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const setterButton = screen.getByLabelText('Set StateManager');
        fireEvent.click(setterButton);
      });

      expect(mockPrompt).toHaveBeenCalledWith('Enter new StateManager address:');
      // Should not show error message when cancelled
      expect(screen.queryByText('Invalid Ethereum address')).not.toBeInTheDocument();
    });
  });

  describe('Registry Entry Editing', () => {
    it('allows editing of registry entries when wallet is connected', async () => {
      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByLabelText('Edit');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('shows edit form when edit button is clicked', async () => {
      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      const editButton = screen.getAllByLabelText('Edit')[0];
      fireEvent.click(editButton);

      // Should show text field and save/cancel buttons
      expect(screen.getByDisplayValue('0x1234...7890')).toBeInTheDocument();
      expect(screen.getByLabelText('Save')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error message when governance toggle fails', async () => {
      const mockEnableGovernance = vi.fn().mockRejectedValue(new Error('Transaction failed'));

      vi.mocked(ethers.Contract).mockImplementationOnce((address, abi, signer) => {
        const contractMock = {
          has: vi.fn((id) => {
            const existingIds = ['MAIN_CONTRACT'];
            return Promise.resolve(existingIds.includes(id));
          }),
          getMetadata: vi.fn((id) => {
            return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
          }),
          addressOf: vi.fn((id) => {
            return Promise.resolve('0x1234567890123456789012345678901234567890');
          }),
          getGovernanceModule: vi.fn((address) => {
            return Promise.resolve('0x1111111111111111111111111111111111111111');
          }),
          isGovernanceEnabled: vi.fn(() => Promise.resolve(false)),
          enableGovernance: mockEnableGovernance,
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
          getUint: vi.fn(),
          getBool: vi.fn(),
          getBytes32: vi.fn(),
          setBytes32: vi.fn(),
        } as any;
        return contractMock;
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const toggleSwitch = screen.getByRole('checkbox', { name: /Governance is disabled - Click to enable/i });
        fireEvent.click(toggleSwitch);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to toggle governance: Transaction failed')).toBeInTheDocument();
      });
    });

    it('shows error message when StateManager setter fails', async () => {
      const mockPrompt = vi.fn().mockReturnValue('0x9876543210987654321098765432109876543210');
      const mockSetStateManager = vi.fn().mockRejectedValue(new Error('Contract call failed'));

      Object.defineProperty(window, 'prompt', {
        value: mockPrompt,
        writable: true,
      });

      vi.mocked(ethers.Contract).mockImplementationOnce((address, abi, signer) => {
        const contractMock = {
          has: vi.fn((id) => {
            const existingIds = ['MAIN_CONTRACT'];
            return Promise.resolve(existingIds.includes(id));
          }),
          getMetadata: vi.fn((id) => {
            return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
          }),
          addressOf: vi.fn((id) => {
            return Promise.resolve('0x1234567890123456789012345678901234567890');
          }),
          getGovernanceModule: vi.fn((address) => {
            return Promise.resolve(ethers.ZeroAddress);
          }),
          setStateManager: mockSetStateManager,
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
          getUint: vi.fn(),
          getBool: vi.fn(),
          getBytes32: vi.fn(),
          setBytes32: vi.fn(),
        } as any;
        return contractMock;
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const setterButton = screen.getByLabelText('Set StateManager');
        fireEvent.click(setterButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to set StateManager: Contract call failed')).toBeInTheDocument();
      });
    });

    it('calls enableGovernance when toggle is switched on', async () => {
      // Mock the contract to have enableGovernance function
      const mockEnableGovernance = vi.fn().mockResolvedValue({});
      const originalMock = vi.mocked(ethers.Contract);
      
      vi.mocked(ethers.Contract).mockImplementation((address, abi, signer) => {
        if (address === '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
          // StateManager contract
          const stateManagerMock = {
            has: vi.fn((id) => {
              const existingIds = ['MAIN_CONTRACT', 'TREASURY', 'PRIMARY_QUOTE', 'SWAP_CONTRACT', 'SWAP_FEE_BPS'];
              return Promise.resolve(existingIds.includes(id));
            }),
            getMetadata: vi.fn((id?: string) => {
              if (id === undefined) {
                return Promise.resolve([
                  {
                    id: 'MAIN_CONTRACT',
                    value: '0x1234567890123456789012345678901234567890',
                    valueType: 1,
                    requiredRole: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    isImmutable: false,
                  },
                ]);
              }
              if (id === 'MAIN_CONTRACT') return Promise.resolve([1, '0x0000000000000000000000000000000000000000000000000000000000000000']);
              return Promise.resolve([0, '0x0000000000000000000000000000000000000000000000000000000000000000']);
            }),
            addressOf: vi.fn((id) => {
              if (id === 'MAIN_CONTRACT') return Promise.resolve('0x1234567890123456789012345678901234567890');
              return Promise.resolve('0x0000000000000000000000000000000000000000');
            }),
            getGovernanceModule: vi.fn((contractAddress) => {
              if (contractAddress === '0x1234567890123456789012345678901234567890') {
                return Promise.resolve('0x1111111111111111111111111111111111111111');
              }
              return Promise.resolve(ethers.ZeroAddress);
            }),
            setGovernanceStatic: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setAddress: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setUint: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBool: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            setBytes32: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) }),
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
          };
          return stateManagerMock;
        } else if (address === '0x1234567890123456789012345678901234567890') {
          // MAIN_CONTRACT with governance functions
          return {
            isGovernanceEnabled: vi.fn(() => Promise.resolve(false)),
            enableGovernance: mockEnableGovernance,
            target: address,
            interface: { format: vi.fn() },
            runner: signer,
            filters: {},
            setStateManager: vi.fn().mockResolvedValue({}),
          } as any;
        }
        
        // Generic contract
        return {
          target: address,
          interface: { format: vi.fn() },
          runner: signer,
          filters: {},
        };
      });

      render(<RegistryManager hasWallet={true} />);

      await waitFor(() => {
        expect(screen.getByText('MAIN_CONTRACT')).toBeInTheDocument();
      });

      await waitFor(() => {
        const toggleSwitch = screen.getByRole('checkbox', { name: /Governance is disabled - Click to enable/i });
        fireEvent.click(toggleSwitch);
      });

      await waitFor(() => {
        expect(mockEnableGovernance).toHaveBeenCalled();
      });

      // Restore original mock
      vi.mocked(ethers.Contract).mockImplementation(originalMock);
    });
  });
});
});
