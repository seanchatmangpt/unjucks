import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Show loading spinner */
  loading?: boolean;
  /** Icon to display before text */
  leftIcon?: React.ReactNode;
  /** Icon to display after text */
  rightIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'medium',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          'button',
          `button--${variant}`,
          `button--${size}`,
          {
            'button--loading': loading,
            'button--full-width': fullWidth,
            'button--disabled': isDisabled,
          },
          className
        )}
        {...rest}
      >
        {leftIcon && !loading && (
          <span className="button__icon button__icon--left">{leftIcon}</span>
        )}
        
        {loading && (
          <span className="button__spinner" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="button__spinner-svg">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="31.416"
                strokeDashoffset="31.416"
              />
            </svg>
          </span>
        )}
        
        <span className={clsx('button__content', { 'button__content--hidden': loading })}>
          {children}
        </span>
        
        {rightIcon && !loading && (
          <span className="button__icon button__icon--right">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';