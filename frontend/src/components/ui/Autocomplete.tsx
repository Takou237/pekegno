import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';

export interface AutocompleteOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface AutocompleteProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (id: string) => void;
  fetchOptions: (query: string) => Promise<AutocompleteOption[]>;
  error?: string;
  disabled?: boolean;
}

export function Autocomplete({
  label,
  placeholder,
  value,
  onChange,
  fetchOptions,
  error,
  disabled = false,
}: AutocompleteProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder || t('common.search');  const generatedId = useId();
  const inputId = useId();
  const [inputValue, setInputValue] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setOptions([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const result = await fetchOptions(query.trim());
        setOptions(result);
        setIsOpen(result.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions],
  );

  useEffect(() => {
    if (value && !selectedLabel) {
      fetchOptions('').then((all) => {
        const found = all.find((o) => o.id === value);
        if (found) setSelectedLabel(found.label);
      });
    }
  }, [value, selectedLabel, fetchOptions]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputValue.trim()) {
      setOptions([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(inputValue), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(option: AutocompleteOption) {
    setInputValue(option.label);
    setSelectedLabel(option.label);
    onChange(option.id);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(options[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  function handleClear() {
    setInputValue('');
    setSelectedLabel('');
    onChange('');
    setOptions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          placeholder={selectedLabel || resolvedPlaceholder}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (selectedLabel) {
              setSelectedLabel('');
              onChange('');
            }
          }}
          onFocus={() => {
            if (options.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${generatedId}-listbox`}
          role="combobox"
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:bg-gray-900 dark:text-gray-100 ${
            error
              ? 'border-error-500 focus:border-error-500'
              : 'border-gray-300 focus:border-brand-500 dark:border-gray-700'
          }`}
        />
        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            tabIndex={-1}
          >
            &times;
          </button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
        {isOpen && options.length > 0 && (
          <ul
            id={`${generatedId}-listbox`}
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {options.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex cursor-pointer flex-col px-4 py-2 text-sm ${
                  index === highlightedIndex
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                {option.subtitle && (
                  <span className="text-xs text-gray-400">{option.subtitle}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
}
