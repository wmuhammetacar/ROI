import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, subtitle, actions, children }: SectionCardProps) {
  return (
    <section className="page-card section-card">
      {title || actions ? (
        <div className="section-card-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="section-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="section-card-body">{children}</div>
    </section>
  );
}
