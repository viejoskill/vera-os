import type { ReactNode } from 'react';
import { Card } from './Card';

export interface PanelProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** VERA Panel. A titled surface built on Card — the workhorse for grouping sections. */
export const Panel = ({ title, description, action, children, className = '' }: PanelProps) => (
  <Card className={`vera-panel ${className}`.trim()}>
    {(title || action) && (
      <div className="vera-panel__header">
        <div>
          {title && <h2 className="vera-panel__title">{title}</h2>}
          {description && <p className="vera-panel__desc">{description}</p>}
        </div>
        {action && <div className="vera-panel__action">{action}</div>}
      </div>
    )}
    <div className="vera-panel__body">{children}</div>
  </Card>
);
