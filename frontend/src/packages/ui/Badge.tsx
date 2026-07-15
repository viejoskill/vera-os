import type { HTMLAttributes } from 'react';

export type BadgeTone = 'default' | 'primary' | 'muted';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** VERA Badge / Tag. Compact label. */
export const Badge = ({ tone = 'default', className = '', ...props }: BadgeProps) => (
  <span className={`vera-tag vera-tag--${tone} ${className}`.trim()} {...props} />
);
