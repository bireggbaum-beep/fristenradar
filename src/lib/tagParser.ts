import type { FristType } from '../types';

export interface ParsedTags {
  typ?: FristType;
  aktion?: string;
  faellig?: string;
  start?: string;
  warn?: number[];
  prio?: 'hoch' | 'mittel' | 'niedrig';
  notiz?: string;
}

const VALID_TYPES: FristType[] = ['Behörde', 'Vertrag', 'Rechnung', 'Intern', 'Sonstiges'];

function toFristType(value: string): FristType | undefined {
  return VALID_TYPES.find(t => t.toLowerCase() === value.toLowerCase()) ?? undefined;
}

export function parseDescriptionTags(description: string): ParsedTags {
  const lines = description.split('\n');
  const result: ParsedTags = {};

  for (const line of lines) {
    const match = line.match(/^#(\w+)\s+(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    const v = value.trim();
    switch (key) {
      case 'typ':     result.typ = toFristType(v); break;
      case 'aktion':  result.aktion = v; break;
      case 'faellig': result.faellig = v; break;
      case 'start':   result.start = v; break;
      case 'warn':    result.warn = v.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)); break;
      case 'prio':
        if (v === 'hoch' || v === 'mittel' || v === 'niedrig') result.prio = v;
        break;
      case 'notiz':   result.notiz = v; break;
    }
  }

  return result;
}
