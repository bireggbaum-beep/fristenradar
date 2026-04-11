import { useEffect, useState } from 'react';

interface Props {
  onRefresh: () => void;
  onSettings: () => void;
  isLoading?: boolean;
}

export function TopBar({ onRefresh, onSettings, isLoading }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = (() => {
    const h = time.getHours();
    if (h < 5) return 'Gute Nacht';
    if (h < 12) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 21) return 'Guten Abend';
    return 'Gute Nacht';
  })();

  const dateStr = time.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const timeStr = time.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="greeting">{greeting}</div>
        <div className="datetime">{dateStr}</div>
      </div>

      <div className="topbar-right">
        <div className="topbar-time">{timeStr}</div>
        <button
          type="button"
          className={`refresh-btn${isLoading ? ' spinning' : ''}`}
          onClick={onRefresh}
          title="Aktualisieren"
          aria-label="Aktualisieren"
        >
          ↻
        </button>
        <button
          type="button"
          className="settings-btn"
          onClick={onSettings}
          title="Einstellungen"
          aria-label="Einstellungen"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
