import type { FristItem } from '../types';
import { diffDays } from '../lib/urgency';

interface Props {
  item: FristItem;
  onClick: (item: FristItem) => void;
  variant?: 'default' | 'compact';
  today?: Date;
}

function formatCountdown(days: number): string {
  if (days < 0) return 'überfällig';
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days <= 14) return `in ${days} Tagen`;
  return `in ${Math.round(days / 7)} Wochen`;
}

export function DashboardTile({
  item,
  onClick,
  variant = 'default',
  today = new Date(),
}: Props) {
  const daysLeft = diffDays(item.dueDate, today);
  const countdown = formatCountdown(daysLeft);

  const countdownClass =
    daysLeft <= 2
      ? 'tile-countdown--critical'
      : daysLeft <= 7
      ? 'tile-countdown--soon'
      : '';

  return (
    <button
      type="button"
      className={`tile${variant === 'compact' ? ' tile--compact' : ''}`}
      onClick={() => onClick(item)}
    >
      <div className="tile-main">
        <div className="tile-title">{item.title}</div>
        {item.note && <div className="tile-meta">{item.note}</div>}
      </div>

      <div className="tile-right">
        {item.status === 'in bearbeitung' && (
          <span className="tile-status-badge">⏳</span>
        )}
        <span className={`tile-countdown ${countdownClass}`}>{countdown}</span>
      </div>
    </button>
  );
}
