import type { FristItem, FristStatus } from '../types';
import { urgencyLevel, diffDays } from '../lib/urgency';
import { StatusDropdown } from './StatusDropdown';

interface Props {
  item: FristItem;
  onClose: () => void;
  onStatusChange: (id: string, status: FristStatus) => void;
  today?: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCountdown(days: number): string {
  if (days < 0) return `seit ${Math.abs(days)} Tagen überfällig`;
  if (days === 0) return 'heute fällig';
  if (days === 1) return 'morgen fällig';
  return `noch ${days} Tage`;
}

export function DetailOverlay({ item, onClose, onStatusChange, today = new Date() }: Props) {
  const daysLeft = diffDays(item.dueDate, today);
  const level = urgencyLevel(item, today);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-title">{item.title}</span>
          <button className="overlay-close" onClick={onClose}>×</button>
        </div>
        <div className="overlay-body">
          <div className="detail-section">
            <div className="detail-label">{level}</div>
            <div className="detail-big">{formatCountdown(daysLeft)}</div>
          </div>

          <div className="detail-section">
            <div className="detail-label">Fällig am</div>
            <div className="detail-value">{formatDate(item.dueDate)}</div>
          </div>

          <div className="detail-section">
            <div className="detail-label">Anfangen bis</div>
            <div className="detail-value">{formatDate(item.startBy)}</div>
          </div>

          {item.note && (
            <div className="detail-section">
              <div className="detail-note">{item.note}</div>
            </div>
          )}

          <div className="detail-status">
            <span className="detail-label">Status</span>
            <StatusDropdown
              status={item.status}
              onChange={s => onStatusChange(item.id, s)}
            />
          </div>

          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => onStatusChange(item.id, 'in bearbeitung')}>
              In Bearbeitung
            </button>
            <button className="btn btn-secondary" onClick={() => onStatusChange(item.id, 'erledigt')}>
              Erledigt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
