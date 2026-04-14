import { useState, useEffect, useCallback } from 'react';
import type { BriefingType, LLMConfig, AvailableFilters } from '../types';

const VOICE_KEY = 'fristenradar_voice';
const DEFAULT_VOICE = 'de-DE-KatjaNeural';
const CYCLE_KEY = 'fristenradar_cycle';
const DEFAULT_CYCLE = 8;

const DEFAULT_LLM: LLMConfig = {
  provider: 'local',
  localModel: 'qwen2.5:7b',
  openrouterKey: '',
  openrouterModel: 'google/gemini-flash-1.5-8b',
};

const EMPTY_FILTERS: AvailableFilters = { tags: [], calendars: [] };

export function useSettings() {
  const [voice, setVoiceState] = useState<string>(
    () => localStorage.getItem(VOICE_KEY) ?? DEFAULT_VOICE
  );
  const [cycleInterval, setCycleIntervalState] = useState<number>(
    () => Number(localStorage.getItem(CYCLE_KEY) ?? DEFAULT_CYCLE)
  );
  const [briefingTypes, setBriefingTypes] = useState<BriefingType[]>([]);
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(DEFAULT_LLM);
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>(EMPTY_FILTERS);

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

  const loadLLMConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/llm-config');
      if (res.ok) setLLMConfig(await res.json());
    } catch { }
  }, []);

  const saveLLMConfig = useCallback(async (config: LLMConfig) => {
    const res = await fetch('/api/llm-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Speichern fehlgeschlagen');
    setLLMConfig(config);
  }, []);

  const loadAvailableFilters = useCallback(async () => {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) setAvailableFilters(await res.json());
    } catch { }
  }, []);

  useEffect(() => {
    loadTypes();
    loadLLMConfig();
    loadAvailableFilters();
  }, [loadTypes, loadLLMConfig, loadAvailableFilters]);

  return {
    voice, setVoice,
    cycleInterval, setCycleInterval,
    briefingTypes, saveType, deleteType,
    llmConfig, saveLLMConfig,
    availableFilters,
  };
}
