import type { FristItem } from '../types';
import { urgencyLevel } from '../lib/urgency';

interface Props {
  item: FristItem;
  today?: Date;
  onMarkInProgress: () => void;
  onMarkDone: () => void;
  onPlayBriefing?: () => void;
  onPlayShortBriefing?: () => void;
  briefingLoading?: boolean;
}

function formatCountdown(days: number): string {
  if (days < 0) return 'überfällig';
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days <= 14) return `in ${days} Tagen`;
  return `in ${Math.round(days / 7)} Wochen`;
}

function getHeroMessage(item: FristItem, today: Date): string {
  const level = urgencyLevel(item, today);

  if (level === 'ÜBERFÄLLIG') return 'Diese Frist braucht sofort deine Aufmerksamkeit.';
  if (level === 'KRITISCH') return 'Darum solltest du dich jetzt kümmern.';
  if (level === 'HEUTE ANFANGEN') return 'Heute solltest du das anstoßen.';
  return 'Das ist als Nächstes wichtig.';
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="audio-icon">
      <path
        d="M7 5.5L14 10L7 14.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="audio-icon">
      <path d="M4 11V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 13V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 15V5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13 12V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 11V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function HeroCard({
  item,
  today = new Date(),
  onMarkInProgress,
  onMarkDone,
  onPlayBriefing,
  onPlayShortBriefing,
  briefingLoading = false,
}: Props) {
  const daysLeft = Math.ceil(
    (item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const countdown = formatCountdown(daysLeft);
  const message = getHeroMessage(item, today);

  return (
    <section className="hero-card">
      <div className="hero-top">
        <div className="hero-kicker">Heute wichtig</div>

        <div className="hero-audio-actions">
          <button
            type="button"
            className={`hero-audio-btn${briefingLoading ? ' hero-audio-btn--loading' : ''}`}
            onClick={onPlayBriefing}
            disabled={briefingLoading}
          >
            <PlayIcon />
            <span>{briefingLoading ? '…' : 'Briefing'}</span>
          </button>

          <button
            type="button"
            className="hero-audio-btn"
            onClick={onPlayShortBriefing}
            disabled={briefingLoading}
          >
            <WaveIcon />
            <span>Kurz</span>
          </button>
        </div>
      </div>

      <h1 className="hero-message">{message}</h1>

      <div className="hero-focus">
        <div className="hero-focus-title">{item.title}</div>
        {item.note && <p className="hero-focus-note">{item.note}</p>}
      </div>

      <div className="hero-footer">
        <div className="hero-countdown">{countdown}</div>

        <div className="hero-actions">
          <button
            type="button"
            className="hero-btn hero-btn--primary"
            onClick={onMarkInProgress}
          >
            In Bearbeitung
          </button>

          <button
            type="button"
            className="hero-btn hero-btn--secondary"
            onClick={onMarkDone}
          >
            Erledigt
          </button>
        </div>
      </div>
    </section>
  );
}
