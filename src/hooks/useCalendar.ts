import { useState, useCallback } from 'react';
import type { FristItem } from '../types';
import {
  fetchEvents,
  fetchCalendarIdByName,
  fetchEventsFromCalendar,
  fetchEventsFromBackend,
  getMockEvents,
} from '../lib/calendarApi';
import { mapEventsToFristItems } from '../lib/fristMapper';
import { urgencyScore } from '../lib/urgency';

interface CalendarState {
  items: FristItem[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export function useCalendar() {
  const [state, setState] = useState<CalendarState>({
    items: [],
    loading: false,
    error: null,
    lastSync: null,
  });

  const loadMock = useCallback(() => {
    const items = mapEventsToFristItems(getMockEvents());
    items.sort((a, b) => urgencyScore(b) - urgencyScore(a));
    setState({ items, loading: false, error: null, lastSync: new Date() });
  }, []);

  const loadFromGoogle = useCallback(async (accessToken: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const primary = await fetchEvents(accessToken);

      // Try to fetch dedicated "Fristen & Deadlines" calendar
      const fristenId = await fetchCalendarIdByName(accessToken, 'Fristen & Deadlines');
      const fristenEvents = fristenId
        ? await fetchEventsFromCalendar(accessToken, fristenId)
        : [];

      // Mark fristen-calendar events BEFORE deduplication so fristMapper recognizes them
      fristenEvents.forEach(e => { e.calendarId = 'Fristen & Deadlines'; });

      // Deduplicate by id (primary wins if same event appears in both)
      const seen = new Set<string>();
      const allEvents = [...fristenEvents, ...primary].filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      const items = mapEventsToFristItems(allEvents);
      items.sort((a, b) => urgencyScore(b) - urgencyScore(a));
      setState({ items, loading: false, error: null, lastSync: new Date() });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      }));
    }
  }, []);

  const loadFromBackend = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const events = await fetchEventsFromBackend(365, controller.signal);
      clearTimeout(timeoutId);
      const items = mapEventsToFristItems(events);
      items.sort((a, b) => urgencyScore(b) - urgencyScore(a));
      setState({ items, loading: false, error: null, lastSync: new Date() });
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      setState(prev => ({
        ...prev,
        loading: false,
        error: isAbort
          ? 'Backend antwortet nicht (Timeout)'
          : err instanceof Error ? err.message : 'Unbekannter Fehler',
      }));
    }
  }, []);

  return { ...state, loadMock, loadFromGoogle, loadFromBackend };
}
