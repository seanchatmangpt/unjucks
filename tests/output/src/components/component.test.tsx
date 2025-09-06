import React from 'react';
import { render, screen } from '@testing-library/react';
import { component } from './component';

describe('component', () => {
  it('renders without crashing', () => {
    render(<component />);
  });

  it('renders children correctly', () => {
    render(<component>Test content</component>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});