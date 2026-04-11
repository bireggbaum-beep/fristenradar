import { useState, useEffect } from 'react';
import type { FristItem, FristType } from '../types';
import { urgencyLevel } from '../lib/urgency';

type FilterType = FristType | 'alle';

interface Props {
  items: FristItem[];
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  onLogin: () => void;
  onLogout: () => void;
  isLoggedIn: boolean;
  today?: Date;
}

export function LeftPanel({
  items,
  activeFilter,
  onFilterChange,
  onLogin,
  onLogout,
  isLoggedIn,
  today = new Date(),
}: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayCount = items.filter(i => {
    const l = urgencyLevel(i, today);
    return l === 'ÜBERFÄLLIG' || l === 'KRITISCH' || l === 'HEUTE ANFANGEN';
  }).length;

  const weekCount = items.filter(i => urgencyLevel(i, today) === 'BALD').length;
  const radarCount = items.filter(i => urgencyLevel(i, today) === 'RADAR').length;

  const types: FilterType[] = ['alle', 'Behörde', 'Vertrag', 'Rechnung', 'Intern', 'Sonstiges'];

  return (
    <aside className="left-panel">
      <div className="clock">
        <div className="clock-time">
          {time.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="clock-date">
          {today.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div className="overview">
        <div className="overview-item">
          <span className="overview-label">Heute</span>
          <span
            className="overview-count"
            style={{ color: todayCount > 0 ? 'var(--urgency-critical)' : 'var(--text-muted)' }}
          >
            {todayCount}
          </span>
        </div>
        <div className="overview-item">
          <span className="overview-label">Diese Woche</span>
          <span className="overview-count" style={{ color: 'var(--urgency-soon)' }}>
            {weekCount}
          </span>
        </div>
        <div className="overview-item">
          <span className="overview-label">Radar</span>
          <span className="overview-count" style={{ color: 'var(--urgency-radar)' }}>
            {radarCount}
          </span>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-label">Filter</div>
        {types.map(t => (
          <button
            key={t}
            className={`filter-btn${activeFilter === t ? ' active' : ''}`}
            onClick={() => onFilterChange(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="auth-section">
        {isLoggedIn ? (
          <button className="btn-secondary" onClick={onLogout}>
            Abmelden
          </button>
        ) : (
          <button className="btn-primary" onClick={onLogin}>
            Google Login
          </button>
        )}
        {!isLoggedIn && (
          <div className="demo-note">Demo-Modus aktiv</div>
        )}
      </div>
    </aside>
  );
}
