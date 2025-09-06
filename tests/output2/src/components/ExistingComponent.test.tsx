import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExistingComponent } from './ExistingComponent';

describe('ExistingComponent', () => {
  it('renders without crashing', () => {
    render(<ExistingComponent />);
  });

  it('renders children correctly', () => {
    render(<ExistingComponent>Test content</ExistingComponent>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});