import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, placeholder, children, className, id: externalId, ...props }, ref) => {
  const autoId = useId();
  const id = externalId ?? autoId;

  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <select
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors ${error ? 'border-error-500' : 'border-gray-300'} ${className ?? ''}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
