import { useState, useEffect, useCallback } from 'react';
import type { BriefingType } from '../types';

const VOICE_KEY = 'fristenradar_voice';
const DEFAULT_VOICE = 'de-DE-KatjaNeural';
const CYCLE_KEY = 'fristenradar_cycle';
const DEFAULT_CYCLE = 8;

export function useSettings() {
  const [voice, setVoiceState] = useState<string>(
    () => localStorage.getItem(VOICE_KEY) ?? DEFAULT_VOICE
  );
  const [cycleInterval, setCycleIntervalState] = useState<number>(
    () => Number(localStorage.getItem(CYCLE_KEY) ?? DEFAULT_CYCLE)
  );
  const [briefingTypes, setBriefingTypes] = useState<BriefingType[]>([]);

  function setVoice(v: string) {
    localStorage.setItem(VOICE_KEY, v);
    setVoiceState(v);
  }

  function setCycleInterval(n: number) {
    localStorage.setItem(CYCLE_KEY, String(n));
    setCycleIntervalState(n);
  }

  const loadTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/briefing/types');
      if (res.ok) setBriefingTypes(await res.json());
    } catch { /* backend not available */ }
  }, []);

  const saveType = useCallback(async (type: BriefingType) => {
    const res = await fetch('/api/briefing/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(type),
    });
    if (!res.ok) throw new Error('Speichern fehlgeschlagen');
    await loadTypes();
  }, [loadTypes]);

  const deleteType = useCallback(async (key: string) => {
    const res = await fetch(`/api/briefing/types/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Löschen fehlgeschlagen');
    await loadTypes();
  }, [loadTypes]);

  useEffect(() => { loadTypes(); }, [loadTypes]);

  return { voice, setVoice, cycleInterval, setCycleInterval, briefingTypes, saveType, deleteType };
}
