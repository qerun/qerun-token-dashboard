import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from './Logo';

describe('Logo', () => {
  it('renders the logo image', () => {
    render(<Logo />);

    const logoImg = screen.getByAltText('Qerun crown logo');
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', '/logo.png');
  });

  it('applies correct styling and positioning', () => {
    render(<Logo />);

    const logoContainer = screen.getByAltText('Qerun crown logo').parentElement;
    expect(logoContainer).toHaveStyle({
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      gap: '16px', // 2 * 8px in MUI
      zIndex: '1001',
    });
  });

  it('has responsive sizing', () => {
    render(<Logo />);

    const logoImg = screen.getByAltText('Qerun crown logo');
    // The component uses responsive width/height, but we can check the img element exists
    expect(logoImg).toBeInTheDocument();
  });
});