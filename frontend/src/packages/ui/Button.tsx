import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** VERA Button. Token-driven, accessible, typed. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }, ref) => {
    const classes = ['vera-btn', `vera-btn--${variant}`, `vera-btn--${size}`, className]
      .filter(Boolean)
      .join(' ');
    return <button ref={ref} type={type} className={classes} {...props} />;
  },
);

Button.displayName = 'Button';
