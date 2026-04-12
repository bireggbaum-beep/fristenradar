import { useEffect, useRef, useState } from 'react';

interface Props {
  onRefresh: () => void;
  onSettings: () => void;
  isLoading?: boolean;
}

export function TopBar({ onRefresh, onSettings, isLoading }: Props) {
  const [time, setTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  // Wake Lock
  async function toggleWakeLock() {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLock(false);
    } else {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLock(true);
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
          setWakeLock(false);
        });
      } catch {
        // not supported or denied
      }
    }
  }

  // Re-acquire wake lock when tab becomes visible again
  useEffect(() => {
    const handler = async () => {
      if (wakeLock && !wakeLockRef.current && document.visibilityState === 'visible') {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch { /* ignore */ }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [wakeLock]);

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
          className={`topbar-btn${wakeLock ? ' topbar-btn--active' : ''}`}
          onClick={toggleWakeLock}
          title={wakeLock ? 'Bildschirm-Wachhalten aus' : 'Bildschirm-Wachhalten ein'}
        >☀</button>
        <button
          type="button"
          className="topbar-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Vollbild beenden' : 'Vollbild'}
        >{isFullscreen ? '⛶' : '⛶'}</button>
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
