import React from 'react';

interface ExistingComponentProps {
  children?: React.ReactNode;
}

export const ExistingComponent: React.FC<ExistingComponentProps> = ({ children }) => {
  return (
    <div className="existing-component">
      {children}
    </div>
  );
};