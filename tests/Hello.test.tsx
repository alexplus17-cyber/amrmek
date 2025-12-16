import React from 'react';
import { render, screen } from '@testing-library/react';
import { Hello } from '../src/components/Hello';

describe('Hello component', () => {
  it('renders with default name', () => {
    render(<Hello />);
    expect(screen.getByText('Hello, World!')).toBeTruthy();
  });

  it('renders with provided name', () => {
    render(<Hello name="Alice" />);
    expect(screen.getByText('Hello, Alice!')).toBeTruthy();
  });
});
