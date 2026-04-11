import type { FristItem, FristType, GoogleCalendarEvent } from '../types';
import { parseDescriptionTags } from './tagParser';
import { WARN_TEMPLATES, calcStartBy } from './urgency';

const DEFAULT_TYPE: FristType = 'Sonstiges';

function parseDate(str: string): Date {
  // 'YYYY-MM-DD' or ISO datetime
  return new Date(str.includes('T') ? str : `${str}T00:00:00`);
}

function eventDate(event: GoogleCalendarEvent): Date {
  const raw = event.start.date ?? event.start.dateTime;
  if (!raw) return new Date();
  return parseDate(raw);
}

export function mapEventToFristItem(event: GoogleCalendarEvent): FristItem {
  const tags = parseDescriptionTags(event.description ?? '');
  const type: FristType = tags.typ ?? DEFAULT_TYPE;

  const dueDate = tags.faellig
    ? parseDate(tags.faellig)
    : eventDate(event);

  const startBy = tags.start
    ? parseDate(tags.start)
    : calcStartBy(dueDate, type);

  const warnDays = tags.warn ?? WARN_TEMPLATES[type];

  return {
    id: event.id,
    title: event.summary,
    type,
    dueDate,
    startBy,
    priority: tags.prio ?? 'mittel',
    status: 'neu',
    note: tags.notiz ?? '',
    action: tags.aktion ?? '',
    warnDays,
    rawDescription: event.description ?? '',
  };
}

export function mapEventsToFristItems(events: GoogleCalendarEvent[]): FristItem[] {
  return events.map(mapEventToFristItem);
}
