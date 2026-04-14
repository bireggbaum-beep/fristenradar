import { useState, useEffect } from 'react';
import type { FristItem, BriefingType } from '../types';
import { urgencyLevel } from '../lib/urgency';

interface Props {
  items: FristItem[];
  today?: Date;
  onMarkInProgress: (id: string) => void;
  onMarkDone: (id: string) => void;
  onPlayBriefing?: (key: string) => void;
  onRegenerateBriefing?: (key: string) => void;
  briefingTypes?: BriefingType[];
  loadingKey?: string | null;
  cycleInterval?: number;
  calmMessage?: string;
}

function getHeroMessage(item: FristItem, today: Date): string {
  const actionDiffersFromTitle =
    item.action && item.action.trim().toLowerCase() !== item.title.trim().toLowerCase();
  if (actionDiffersFromTitle) return item.action;
  const level = urgencyLevel(item, today);
  if (level === 'ÜBERFÄLLIG')     return 'Diese Frist braucht sofort deine Aufmerksamkeit.';
  if (level === 'KRITISCH')       return 'Darum solltest du dich jetzt kümmern.';
  if (level === 'HEUTE ANFANGEN') return 'Heute solltest du damit anfangen.';
  if (level === 'BALD')           return 'Das rückt näher — plan es ein.';
  return 'Das ist als Nächstes wichtig.';
}

function formatCountdown(days: number): string {
  if (days < 0)  return 'überfällig';
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days <= 14) return `in ${days} Tagen`;
  return `in ${Math.round(days / 7)} Wochen`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="audio-icon">
      <path d="M7 5.5L14 10L7 14.5V5.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

const URGENCY_KICKER: Record<string, string> = {
  'ÜBERFÄLLIG':     'Sofort handeln',
  'KRITISCH':       'Dringend',
  'HEUTE ANFANGEN': 'Jetzt anfangen',
  'BALD':           'Bald fällig',
};

export function HeroCard({
  items,
  today = new Date(),
  onMarkInProgress,
  onMarkDone,
  onPlayBriefing,
  onRegenerateBriefing,
  briefingTypes = [],
  loadingKey = null,
  cycleInterval = 8,
  calmMessage,
}: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const safeIndex = items.length > 0 ? Math.min(index, items.length - 1) : 0;
  const item = items[safeIndex];

  useEffect(() => {
    if (index >= items.length && items.length > 0) setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % items.length);
        setVisible(true);
      }, 250);
    }, cycleInterval * 1000);
    return () => clearInterval(timer);
  }, [items.length, cycleInterval]);

  if (!item) {
    return (
      <section className="hero-card">
        <div className="hero-top">
          <div className="hero-kicker">Heute</div>
          <div className="hero-audio-actions">
            {briefingTypes.map(type => (
              <div key={type.key} className="hero-audio-group">
                <button
                  type="button"
                  className={`hero-audio-btn${loadingKey === type.key ? ' hero-audio-btn--loading' : ''}`}
                  onClick={() => onPlayBriefing?.(type.key)}
                  disabled={loadingKey !== null}
                >
                  <PlayIcon />
                  <span>{loadingKey === type.key ? '…' : type.name}</span>
                </button>
                <button
                  type="button"
                  className="hero-audio-regen"
                  onClick={() => onRegenerateBriefing?.(type.key)}
                  disabled={loadingKey !== null}
                  title="Neu generieren"
                >↺</button>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-content">
          <h1 className="hero-message hero-message--calm">{calmMessage ?? 'Alles im Griff.'}</h1>
        </div>
      </section>
    );
  }

  const daysLeft = Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const level = urgencyLevel(item, today);
  const hasCustomAction = item.action && item.action.trim().toLowerCase() !== item.title.trim().toLowerCase();
  const message = hasCustomAction ? item.action : null;
  const kicker = hasCustomAction ? 'Heute wichtig' : (URGENCY_KICKER[level] ?? 'Heute wichtig');
  const countdown = formatCountdown(daysLeft);

  return (
    <section className="hero-card">
      <div className="hero-top">
        <div className="hero-kicker">{kicker}</div>
        <div className="hero-audio-actions">
          {briefingTypes.map(type => (
            <div key={type.key} className="hero-audio-group">
              <button
                type="button"
                className={`hero-audio-btn${loadingKey === type.key ? ' hero-audio-btn--loading' : ''}`}
                onClick={() => onPlayBriefing?.(type.key)}
                disabled={loadingKey !== null}
              >
                <PlayIcon />
                <span>{loadingKey === type.key ? '…' : type.name}</span>
              </button>
              <button
                type="button"
                className="hero-audio-regen"
                onClick={() => onRegenerateBriefing?.(type.key)}
                disabled={loadingKey !== null}
                title="Neu generieren"
              >↺</button>
            </div>
          ))}
        </div>
      </div>

      <div className={`hero-content${visible ? '' : ' hero-content--hidden'}`}>
        {item.status === 'in bearbeitung' && (
          <span className="hero-status-badge">In Bearbeitung</span>
        )}
        <h1 className="hero-message">{message ?? item.title}</h1>

        {message && (
          <div className="hero-focus">
            <div className="hero-focus-title">{item.title}</div>
            {item.note && <p className="hero-focus-note">{item.note}</p>}
          </div>
        )}
        {!message && item.note && (
          <div className="hero-focus">
            <p className="hero-focus-note">{item.note}</p>
          </div>
        )}
      </div>

      <div className="hero-footer">
        <div className="hero-footer-left">
          <div className="hero-countdown">{countdown}</div>
          <div className="hero-actions">
            <button type="button" className="hero-btn hero-btn--primary" onClick={() => onMarkInProgress(item.id)}>
              In Bearbeitung
            </button>
            <button type="button" className="hero-btn hero-btn--secondary" onClick={() => onMarkDone(item.id)}>
              Erledigt
            </button>
          </div>
        </div>

        {items.length > 1 && (
          <div className="hero-dots">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hero-dot${i === safeIndex ? ' hero-dot--active' : ''}`}
                onClick={() => { setIndex(i); setVisible(true); }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
