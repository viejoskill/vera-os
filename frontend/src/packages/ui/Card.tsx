import { forwardRef, type HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover elevation + pointer affordance. */
  interactive?: boolean;
}

/** VERA Card. The primary surface for grouping content. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, className = '', ...props }, ref) => {
    const classes = ['vera-card', interactive ? 'vera-card--interactive' : '', className]
      .filter(Boolean)
      .join(' ');
    return <div ref={ref} className={classes} {...props} />;
  },
);

Card.displayName = 'Card';
