import { forwardRef, type InputHTMLAttributes } from 'react';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className = '', ...rest }, ref) => {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={`h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 ${className}`}
          {...rest}
        />
        {label}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
