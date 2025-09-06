import React from 'react';
import { render, screen } from '@testing-library/react';
import { TestComponent } from './TestComponent';

describe('TestComponent', () => {
  it('renders without crashing', () => {
    render(<TestComponent />);
  });

  it('renders children correctly', () => {
    render(<TestComponent>Test content</TestComponent>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});