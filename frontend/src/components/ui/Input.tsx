import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Input Component
 * 
 * A flexible input component with label, error states, helper text, and icon support.
 * Follows the design system's form styling guidelines.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    // Base input styles – modern SaaS form field
    const baseStyles = 'block px-3.5 py-2.5 text-sm rounded-lg border bg-white transition-smooth focus:outline-none focus:ring-2 focus:ring-offset-0';

    // State styles
    const stateStyles = error
      ? 'border-red-300 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500';

    // Icon padding adjustments
    const iconPaddingLeft = leftIcon ? 'pl-11' : '';
    const iconPaddingRight = rightIcon ? 'pr-11' : '';

    // Width styles
    const widthStyles = fullWidth ? 'w-full' : '';

    // Combine styles
    const combinedStyles = `${baseStyles} ${stateStyles} ${iconPaddingLeft} ${iconPaddingRight} ${widthStyles} ${className}`;

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Input wrapper with icons */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}

          {/* Input field */}
          <input
            ref={ref}
            id={inputId}
            className={combinedStyles}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-red-600"
          >
            {error}
          </p>
        )}

        {/* Helper text */}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="mt-1.5 text-sm text-gray-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

