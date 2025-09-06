---
to: src/components/<%= name %>.test.tsx
---
import React from 'react';
import { render, screen } from '@testing-library/react';
import { <%= name %> } from './<%= name %>';

describe('<%= name %>', () => {
  it('renders without crashing', () => {
    render(<<%= name %> />);
  });

  it('renders children correctly', () => {
    render(<<%= name %>>Test content</<%= name %>>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});