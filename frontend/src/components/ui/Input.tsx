import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:bg-gray-900 dark:text-gray-100 ${
            error
              ? 'border-error-500 focus:border-error-500'
              : 'border-gray-300 focus:border-brand-500 dark:border-gray-700'
          } ${className}`}
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-sm text-error-500">
            {error}
          </p>
        ) : hint ? (
          <p className="text-sm text-gray-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
