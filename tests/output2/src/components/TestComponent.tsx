import React from 'react';

interface TestComponentProps {
  children?: React.ReactNode;
}

export const TestComponent: React.FC<TestComponentProps> = ({ children }) => {
  return (
    <div className="test-component">
      {children}
    </div>
  );
};