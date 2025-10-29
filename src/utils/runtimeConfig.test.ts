import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONTRACT_CONFIG } from '../config';

describe('runtime config resolution', () => {
  const originalWindow = global.window;
  const originalProcess = global.process;

  beforeEach(() => {
    // Reset window and process
    global.window = { __RUNTIME_CONFIG: undefined } as any;
    global.process = { env: {} } as any;

    // Clear modules to reset imports
    vi.resetModules();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.process = originalProcess;
  });

  it('prioritizes window.__RUNTIME_CONFIG over process.env', async () => {
    global.window.__RUNTIME_CONFIG = {
      VITE_STATE_MANAGER_ADDRESS: '0x123',
      VITE_CHAIN_ID: '1',
    };
    global.process.env = {
      VITE_STATE_MANAGER_ADDRESS: '0x456',
      VITE_CHAIN_ID: '2',
    };

    const { CONTRACT_CONFIG } = await import('../config');

    expect(CONTRACT_CONFIG.stateManager).toBe('0x123');
    expect(CONTRACT_CONFIG.chainId).toBe('1');
  });

  it('falls back to process.env when window.__RUNTIME_CONFIG is missing', async () => {
    global.window.__RUNTIME_CONFIG = undefined;
    global.process.env = {
      VITE_STATE_MANAGER_ADDRESS: '0x456',
      VITE_CHAIN_ID: '2',
    };

    const { CONTRACT_CONFIG } = await import('../config');

    expect(CONTRACT_CONFIG.stateManager).toBe('0x456');
    expect(CONTRACT_CONFIG.chainId).toBe('2');
  });

  it('uses chainId "97" as is', async () => {
    global.window.__RUNTIME_CONFIG = {
      VITE_CHAIN_ID: '97',
    };

    const { CONTRACT_CONFIG } = await import('../config');

    expect(CONTRACT_CONFIG.chainId).toBe('97');
  });

  it('returns undefined when no config is available', async () => {
    global.window.__RUNTIME_CONFIG = undefined;
    global.process.env = {};

    const { CONTRACT_CONFIG } = await import('../config');

    expect(CONTRACT_CONFIG.stateManager).toBeUndefined();
    expect(CONTRACT_CONFIG.chainId).toBeUndefined();
  });
});