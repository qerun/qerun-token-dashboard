import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Metrics from './Metrics';

describe('Metrics', () => {
  const mockMetrics = {
    swapUsdBalance: '1000.50',
    swapQerBalance: '2500.75',
    usdTotalSupply: '1000000.00',
    qerTotalSupply: '500000.25',
  };

  it('renders all metric cards with correct labels and values', () => {
    render(<Metrics {...mockMetrics} />);

    expect(screen.getByText('Swap USD Balance')).toBeInTheDocument();
    expect(screen.getByText('1000.50 USD')).toBeInTheDocument();

    expect(screen.getByText('Swap QER Balance')).toBeInTheDocument();
    expect(screen.getByText('2500.75 QER')).toBeInTheDocument();

    expect(screen.getByText('USDQ Total Supply')).toBeInTheDocument();
    expect(screen.getByText('1000000.00')).toBeInTheDocument();

    expect(screen.getByText('QER Total Supply')).toBeInTheDocument();
    expect(screen.getByText('500000.25')).toBeInTheDocument();
  });

  it('renders with zero values', () => {
    const zeroMetrics = {
      swapUsdBalance: '0',
      swapQerBalance: '0',
      usdTotalSupply: '0',
      qerTotalSupply: '0',
    };

    render(<Metrics {...zeroMetrics} />);

    expect(screen.getByText('0 USD')).toBeInTheDocument();
    expect(screen.getByText('0 QER')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders with large numbers', () => {
    const largeMetrics = {
      swapUsdBalance: '999999999.999999',
      swapQerBalance: '1000000000.000001',
      usdTotalSupply: '1000000000000',
      qerTotalSupply: '500000000000',
    };

    render(<Metrics {...largeMetrics} />);

    expect(screen.getByText('999999999.999999 USD')).toBeInTheDocument();
    expect(screen.getByText('1000000000.000001 QER')).toBeInTheDocument();
    expect(screen.getByText('1000000000000')).toBeInTheDocument();
    expect(screen.getByText('500000000000')).toBeInTheDocument();
  });
});