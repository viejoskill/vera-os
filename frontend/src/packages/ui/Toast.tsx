import { Check } from 'lucide-react';

export interface ToastProps {
  message: string;
  tone?: 'default' | 'success';
}

/** VERA Toast. Presentational transient pill; visibility is managed by the caller. */
export const Toast = ({ message, tone = 'default' }: ToastProps) => (
  <div className={`vera-toast vera-toast--${tone}`} role="status" aria-live="polite">
    {tone === 'success' && <Check size={16} />}
    {message}
  </div>
);
