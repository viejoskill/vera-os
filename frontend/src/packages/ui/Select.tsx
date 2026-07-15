import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

/** VERA Select. Native select styled with tokens + custom caret. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, id, className = '', ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="vera-field">
        {label && (
          <label className="vera-field__label" htmlFor={fieldId}>
            {label}
          </label>
        )}
        <div className="vera-select-wrap">
          <select
            ref={ref}
            id={fieldId}
            className={['vera-select', className].filter(Boolean).join(' ')}
            aria-invalid={Boolean(error)}
            {...props}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="vera-select-caret" aria-hidden="true" />
        </div>
        {error && <span className="vera-field__error">{error}</span>}
      </div>
    );
  },
);

Select.displayName = 'Select';
