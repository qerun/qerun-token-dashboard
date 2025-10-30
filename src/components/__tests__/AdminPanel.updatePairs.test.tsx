import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, test, expect } from 'vitest';

// Ensure runtime config provides a state manager address used by AdminPanel
(window as any).__RUNTIME_CONFIG = (window as any).__RUNTIME_CONFIG || {};
(window as any).__RUNTIME_CONFIG.VITE_STATE_MANAGER_ADDRESS = '0x00000000000000000000000000000000SM0001';

// Mock wagmi useAccount to simulate connected admin
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF', isConnected: true }),
}));

// We'll mock ethers.Contract and BrowserProvider to intercept calls
import * as realEthers from 'ethers';

const quoteAddress = '0x1111111111111111111111111111111111111111';
const swapAddress = '0x5C06FaB2858743B7725C37a453784f2f2448b40e';
const qerAddress = '0x2222222222222222222222222222222222222222';

const mockUpdatePairs = vi.fn(async (pairs: string[]) => ({ wait: async () => {} }));

const stateManagerStub = {
  // getFunction('addressOf(string)') -> returns async fn that maps registry ids
  getFunction: (name: string) => {
    if (name.startsWith('addressOf')) {
      return async (id: string) => {
        if (id === 'SWAP_CONTRACT') return swapAddress;
        if (id === 'PRIMARY_QUOTE') return quoteAddress;
        if (id === 'MAIN_CONTRACT') return qerAddress;
        if (id === 'TREASURY') return '0x00000000000000000000000000000000TR0001';
        return '0x0000000000000000000000000000000000000000';
      };
    }
    // fallback for has(bytes32) used by AdminPanel; return a function that always true
    if (name.startsWith('has')) {
      return async (_: string) => true;
    }
    return undefined;
  },
  has: async (_: string) => true,
  hasRole: async (_role: string, _account: string) => true,
  addressOf: async (id: string) => {
    if (id === 'SWAP_CONTRACT') return swapAddress;
    if (id === 'PRIMARY_QUOTE') return quoteAddress;
    if (id === 'MAIN_CONTRACT') return qerAddress;
    return '0x0000000000000000000000000000000000000000';
  },
};

const swapStub = {
  allPairs: async () => [],
  updatePairs: mockUpdatePairs,
};

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...(actual as any),
    BrowserProvider: class {
      constructor() {}
      async getSigner() {
        return {} as any;
      }
    },
    Contract: function (address: string) {
      // If it's the state manager address, return stateManagerStub
      if (address === (window as any).__RUNTIME_CONFIG.VITE_STATE_MANAGER_ADDRESS) return stateManagerStub as any;
      // If it's the swap contract address, return swap stub with updatePairs
      if (address === swapAddress) return swapStub as any;
      return {} as any;
    },
  } as any;
});

// Now import the AdminPanel (after mocks)
import AdminPanel from '../AdminPanel';

test('AdminPanel sends only quote addresses to swap.updatePairs (QER omitted)', async () => {
  render(<AdminPanel />);

  // Wait for the admin panel to render controls
  const submit = await screen.findByText('Submit updatePairs');

  // Add the quote address using the input + Add button
  const input = await screen.findByPlaceholderText('0x quote token address');
  fireEvent.change(input, { target: { value: quoteAddress } });
  const addButton = screen.getByText('Add');
  fireEvent.click(addButton);

  // Click submit updatePairs
  fireEvent.click(submit);

  await waitFor(() => {
    expect(mockUpdatePairs).toHaveBeenCalled();
    // Called with array containing only the quoteAddress
    const calledWith = mockUpdatePairs.mock.calls[0][0];
    expect(Array.isArray(calledWith)).toBe(true);
    expect(calledWith).toContain(quoteAddress);
    // Ensure QER address is not included
    expect(calledWith).not.toContain(qerAddress);
  });
});
