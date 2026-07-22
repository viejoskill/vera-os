import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/** VERA Input. Accessible (label + aria), token-driven, typed. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const classes = ['vera-input', error ? 'vera-input--error' : '', className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="vera-field">
        {label && (
          <label className="vera-field__label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={classes}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {hint && !error && <span className="vera-field__hint">{hint}</span>}
        {error && (
          <span id={errorId} className="vera-field__error">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
