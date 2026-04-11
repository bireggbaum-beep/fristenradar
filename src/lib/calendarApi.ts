import type { GoogleCalendarEvent } from '../types';

/** Fetch events from Google Calendar primary calendar for the next 90 days. */
export async function fetchEvents(accessToken: string): Promise<GoogleCalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.items ?? []) as GoogleCalendarEvent[];
}

/** Fetch events from a named calendar (e.g. "Fristen & Deadlines"). */
export async function fetchCalendarIdByName(
  accessToken: string,
  calendarName: string
): Promise<string | null> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const calendar = (data.items ?? []).find(
    (c: { summary: string; id: string }) => c.summary === calendarName
  );
  return calendar?.id ?? null;
}

export async function fetchEventsFromCalendar(
  accessToken: string,
  calendarId: string
): Promise<GoogleCalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GoogleCalendarEvent[];
}
/** Trigger background re-parse of all event descriptions via Qwen. Fire-and-forget. */
export function triggerReparse(): void {
  fetch('/api/events/reparse', { method: 'POST' }).catch(() => {});
}

/** Fetch events from our own backend (eliteVault server). */
export async function fetchEventsFromBackend(
  days: number = 90
): Promise<GoogleCalendarEvent[]> {
  const res = await fetch(`/api/calendar/upcoming?days=${days}`);
  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    summary: item.title,
    description: item.description ?? '',
    start: item.allDay ? { date: item.start } : { dateTime: item.start },
    end: item.allDay ? { date: item.end } : { dateTime: item.end },
    parsed: item.parsed ?? undefined,
  })) as GoogleCalendarEvent[];
}
/**
 * Two sample events matching spec §14.
 * Dates are calculated relative to today so they always show up in the radar.
 */
export function getMockEvents(): GoogleCalendarEvent[] {
  const today = new Date();
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().split('T')[0];
  };

  return [
    {
      id: 'mock-steuer-2026',
      summary: 'Fristverlängerung Steuererklärung',
      description: [
        '#typ Behörde',
        '#aktion Verlängerung beantragen',
        `#faellig ${addDays(today, 12)}`,
        `#start ${addDays(today, 4)}`,
        '#warn 14,7,3,1',
        '#prio hoch',
        '#notiz Unterlagen vorher prüfen',
      ].join('\n'),
      start: { date: addDays(today, 12) },
      end:   { date: addDays(today, 12) },
    },
    {
      id: 'mock-krankenkasse-2026',
      summary: 'Krankenkasse kündigen',
      description: [
        '#typ Vertrag',
        '#aktion Schriftlich per Einschreiben kündigen',
        `#faellig ${addDays(today, 22)}`,
        '#warn 30,14,7,3',
        '#prio mittel',
      ].join('\n'),
      start: { date: addDays(today, 22) },
      end:   { date: addDays(today, 22) },
    },
  ];
}
