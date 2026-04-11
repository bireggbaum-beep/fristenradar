import type { FristItem, FristStatus, FristType } from '../types';
import { urgencyLevel, URGENCY_COLOR, diffDays } from '../lib/urgency';
import { StatusDropdown } from './StatusDropdown';

const TYPE_ICON: Record<FristType, string> = {
  Behörde:   '⚖️',
  Vertrag:   '📄',
  Rechnung:  '💳',
  Intern:    '🏢',
  Sonstiges: '📌',
};

interface Props {
  item: FristItem;
  onStatusChange: (id: string, status: FristStatus) => void;
  today?: Date;
}

export function FristCard({ item, onStatusChange, today = new Date() }: Props) {
  const level = urgencyLevel(item, today);
  const color = URGENCY_COLOR[level];
  const daysLeft = diffDays(item.dueDate, today);
  const startIsPast = diffDays(today, item.startBy) >= 0;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="frist-card" style={{ borderLeftColor: color }}>
      <div className="frist-card-header">
        <span className="urgency-label" style={{ color }}>
          {level}
        </span>
        <span className="type-icon" title={item.type}>
          {TYPE_ICON[item.type]}
        </span>
      </div>

      <div className="frist-card-body">
        <div className="frist-title">{item.title}</div>

        {item.note && (
          <div className="frist-note">{item.note}</div>
        )}

        <div className="frist-dates">
          <span className="frist-due">
            Fällig: <strong>{fmtDate(item.dueDate)}</strong>
          </span>
          <span
            className="frist-start"
            style={{ color: startIsPast ? 'var(--urgency-critical)' : 'var(--text-muted)' }}
          >
            Anfangen: {fmtDate(item.startBy)}
            {startIsPast && ' ⚠'}
          </span>
        </div>
      </div>

      <div className="frist-card-footer">
        <StatusDropdown
          status={item.status}
          onChange={s => onStatusChange(item.id, s)}
        />
        <div
          className="frist-countdown"
          style={{ color: daysLeft <= 0 ? 'var(--urgency-overdue)' : color }}
        >
          {daysLeft <= 0
            ? `+${Math.abs(daysLeft)}d`
            : `${daysLeft}d`}
        </div>
      </div>
    </div>
  );
}
