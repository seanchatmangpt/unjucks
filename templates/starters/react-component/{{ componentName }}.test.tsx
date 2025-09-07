---
to: {{ componentName }}.test.tsx
skipIf: "{{ withTests === false }}"
---
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { {{ componentName }} } from './{{ componentName }}';

describe('{{ componentName }}', () => {
  it('renders without crashing', () => {
    render(<{{ componentName }} />);
    expect(screen.getByText('{{ componentName }} Component')).toBeInTheDocument();
  });

  {% if withProps %}it('accepts custom className', () => {
    const { container } = render(<{{ componentName }} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles click events when not disabled', () => {
    const handleClick = jest.fn();
    render(<{{ componentName }} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('{{ componentName }} Component'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not handle click events when disabled', () => {
    const handleClick = jest.fn();
    render(<{{ componentName }} onClick={handleClick} disabled />);
    
    fireEvent.click(screen.getByText('{{ componentName }} Component'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders children when provided', () => {
    render(
      <{{ componentName }}>
        <span>Child content</span>
      </{{ componentName }}>
    );
    
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const { container } = render(<{{ componentName }} style={customStyle} />);
    
    expect(container.firstChild).toHaveStyle('background-color: red');
  });{% endif %}
});