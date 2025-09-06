import React from 'react';

interface componentProps {
  children?: React.ReactNode;
}

export const component: React.FC<componentProps> = ({ children }) => {
  return (
    <div className="component">
      {children}
    </div>
  );
};