import type { ReactNode } from 'react';

interface Props {
  title: string;
  color: string;
  children: ReactNode;
  count?: number;
}

export function Section({ title, color, children, count }: Props) {
  return (
    <section className="section">
      <div className="section-header" style={{ borderLeftColor: color }}>
        <span className="section-title" style={{ color }}>
          {title}
        </span>
        {count !== undefined && (
          <span className="section-count" style={{ background: color }}>
            {count}
          </span>
        )}
      </div>
      <div className="section-cards">{children}</div>
    </section>
  );
}
