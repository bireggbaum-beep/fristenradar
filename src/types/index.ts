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
  parsed?: ParsedEventData;
}

export interface BriefingType {
  key: string;
  name: string;
  days: number;
  prompt: string;
  active: boolean;
}

export interface LLMConfig {
  provider: 'local' | 'openrouter';
  localModel: string;
  openrouterKey: string;
  openrouterModel: string;
}

