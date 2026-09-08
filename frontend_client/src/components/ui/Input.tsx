import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, id: externalId, ...props }, ref) => {
  const autoId = useId();
  const id = externalId ?? autoId;

  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <input
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors ${error ? 'border-error-500' : 'border-gray-300'} ${className ?? ''}`}
        {...props}
      />
      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
