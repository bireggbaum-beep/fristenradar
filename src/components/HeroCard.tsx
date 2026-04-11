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
}

const URGENCY_LABEL: Record<string, string> = {
  'ÜBERFÄLLIG':     'Überfällig',
  'KRITISCH':       'Kritisch',
  'HEUTE ANFANGEN': 'Heute anfangen',
  'BALD':           'Bald fällig',
  'RADAR':          'Im Blick',
};

const URGENCY_CLASS: Record<string, string> = {
  'ÜBERFÄLLIG':     'hero-urgency--red',
  'KRITISCH':       'hero-urgency--red',
  'HEUTE ANFANGEN': 'hero-urgency--amber',
  'BALD':           'hero-urgency--amber',
  'RADAR':          'hero-urgency--blue',
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="audio-icon">
      <path d="M7 5.5L14 10L7 14.5V5.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

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

  if (!item) return null;

  const level = urgencyLevel(item, today);
  const daysLeft = Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const countdown = daysLeft < 0 ? 'überfällig'
    : daysLeft === 0 ? 'heute fällig'
    : daysLeft === 1 ? 'morgen fällig'
    : `in ${daysLeft} Tagen`;

  return (
    <section className="hero-card">
      <div className="hero-top">
        <div className="hero-kicker">Heute wichtig</div>
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
        <div className="hero-urgency-row">
          <span className={`hero-urgency ${URGENCY_CLASS[level] ?? ''}`}>
            {URGENCY_LABEL[level] ?? level}
          </span>
          <span className="hero-countdown-badge">{countdown}</span>
        </div>

        <div className="hero-focus">
          <div className="hero-focus-title">{item.title}</div>
          {item.note && <p className="hero-focus-note">{item.note}</p>}
        </div>
      </div>

      <div className="hero-footer">
        <div className="hero-actions">
          <button type="button" className="hero-btn hero-btn--primary" onClick={() => onMarkInProgress(item.id)}>
            In Bearbeitung
          </button>
          <button type="button" className="hero-btn hero-btn--secondary" onClick={() => onMarkDone(item.id)}>
            Erledigt
          </button>
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
