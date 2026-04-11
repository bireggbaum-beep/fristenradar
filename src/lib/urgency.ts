import type { FristItem, FristType } from '../types';

export const WARN_TEMPLATES: Record<FristType, number[]> = {
  Behörde:   [21, 10, 5, 2],
  Vertrag:   [30, 14, 7, 3],
  Rechnung:  [7, 3, 1],
  Intern:    [14, 7, 3],
  Sonstiges: [14, 7, 3, 1],
};

/** Returns number of whole days from `from` to `to` (positive = future). */
export function diffDays(to: Date, from: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const toMidnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((toMidnight(to) - toMidnight(from)) / msPerDay);
}

/** Calculate startBy date from dueDate when no #start tag is present. */
export function calcStartBy(dueDate: Date, type: FristType): Date {
  const leadDays: Record<FristType, number> = {
    Behörde:   7,
    Vertrag:   14,
    Rechnung:  3,
    Intern:    5,
    Sonstiges: 5,
  };
  const d = new Date(dueDate);
  d.setDate(d.getDate() - leadDays[type]);
  return d;
}

export type UrgencyLabel =
  | 'ÜBERFÄLLIG'
  | 'KRITISCH'
  | 'HEUTE ANFANGEN'
  | 'BALD'
  | 'RADAR';

export function urgencyLevel(item: FristItem, today: Date = new Date()): UrgencyLabel {
  const daysLeft = diffDays(item.dueDate, today);
  if (daysLeft <= 0) return 'ÜBERFÄLLIG';
  if (daysLeft <= 2) return 'KRITISCH';
  if (diffDays(today, item.startBy) >= 0 || daysLeft <= 5) return 'HEUTE ANFANGEN';
  if (daysLeft <= 14) return 'BALD';
  return 'RADAR';
}

export const URGENCY_COLOR: Record<UrgencyLabel, string> = {
  'ÜBERFÄLLIG':    'var(--urgency-overdue)',
  'KRITISCH':      'var(--urgency-critical)',
  'HEUTE ANFANGEN':'var(--urgency-now)',
  'BALD':          'var(--urgency-soon)',
  'RADAR':         'var(--urgency-radar)',
};

export function urgencyScore(item: FristItem, today: Date = new Date()): number {
  const daysLeft = diffDays(item.dueDate, today);
  const startOverdue = diffDays(today, item.startBy);
  let score = 0;
  if (daysLeft <= 1)      score += 10;
  else if (daysLeft <= 3) score += 8;
  else if (daysLeft <= 7) score += 5;
  if (startOverdue >= 0)  score += 7;
  if (item.priority === 'hoch')   score += 5;
  if (item.status === 'neu')      score += 3;
  return score;
}
