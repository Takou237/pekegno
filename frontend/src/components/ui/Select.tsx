import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = '', children, ...rest }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:bg-gray-900 dark:text-gray-100 ${
            error
              ? 'border-error-500 focus:border-error-500'
              : 'border-gray-300 focus:border-brand-500 dark:border-gray-700'
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        {error && <p className="text-sm text-error-500">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
