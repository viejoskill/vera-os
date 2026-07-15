import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/** VERA Textarea. Token-driven, accessible. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = '', rows = 4, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = `${fieldId}-error`;
    const classes = ['vera-textarea', className].filter(Boolean).join(' ');
    return (
      <div className="vera-field">
        {label && (
          <label className="vera-field__label" htmlFor={fieldId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          className={classes}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && (
          <span id={errorId} className="vera-field__error">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
