export type FristStatus =
  | 'neu'
  | 'geplant'
  | 'in bearbeitung'
  | 'erledigt'
  | 'verschoben'
  | 'überfällig';

export type FristType =
  | 'Behörde'
  | 'Vertrag'
  | 'Rechnung'
  | 'Intern'
  | 'Sonstiges';

export interface FristItem {
  id: string;
  title: string;
  type: FristType;
  dueDate: Date;
  startBy: Date;
  priority: 'hoch' | 'mittel' | 'niedrig';
  status: FristStatus;
  note: string;
  action: string;
  warnDays: number[];
  rawDescription: string;
}

export interface ParsedEventData {
  vorlauf: number;   // days of lead time
  aktion: string;    // what to do
  notiz: string;     // extra info
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    date?: string;       // all-day: 'YYYY-MM-DD'
    dateTime?: string;   // timed: ISO string
  };
  end: {
    date?: string;
    dateTime?: string;
  };
  calendarId?: string;
  status?: FristStatus;  // persisted in SQLite, not in Google Calendar
  parsed?: ParsedEventData;
}

export interface BriefingType {
  key: string;
  name: string;
  date_range: string;   // 'urgent'|'next_7'|'next_14'|'next_30'|'next_90'|'past_7'|'past_30'
  filter_by?: string;   // 'tag:kind_1' | 'calendar:id' | '' | undefined → kein Filter
  prompt: string;
  active: boolean;
}

export interface AvailableFilters {
  tags: string[];
  calendars: { id: string; name: string }[];
}

export const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'urgent',  label: 'Dringend (nächste 14 Tage)' },
  { value: 'next_7',  label: 'Nächste 7 Tage' },
  { value: 'next_14', label: 'Nächste 14 Tage' },
  { value: 'next_30', label: 'Nächste 30 Tage' },
  { value: 'next_90', label: 'Nächste 90 Tage' },
  { value: 'past_7',  label: 'Vergangene 7 Tage' },
  { value: 'past_30', label: 'Vergangene 30 Tage' },
];

export interface LLMConfig {
  provider: 'local' | 'openrouter';
  localModel: string;
  openrouterKey: string;
  openrouterModel: string;
}

