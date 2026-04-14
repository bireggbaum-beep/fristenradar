import { useState, useCallback } from 'react';
import type { FristStatus } from '../types';

const STORAGE_KEY = 'fristenradar_status';

type StatusMap = Record<string, { status: FristStatus; updatedAt: string }>;

function loadStatusMap(): StatusMap {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StatusMap;
  } catch {
    console.warn('fristenradar: Status-Speicher beschädigt, wird zurückgesetzt');
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function persistStatus(eventId: string, status: FristStatus): void {
  const map = loadStatusMap();
  map[eventId] = { status, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function useStatusStore() {
  const [statusMap, setStatusMap] = useState<StatusMap>(loadStatusMap);

  const saveStatus = useCallback((eventId: string, status: FristStatus) => {
    persistStatus(eventId, status);
    setStatusMap(prev => ({
      ...prev,
      [eventId]: { status, updatedAt: new Date().toISOString() },
    }));
  }, []);

  // Remove local override once backend has confirmed the change
  const clearStatus = useCallback((eventId: string) => {
    setStatusMap(prev => {
      if (!(eventId in prev)) return prev;
      const next = { ...prev };
      delete next[eventId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* storage full or disabled */ }
      return next;
    });
  }, []);

  const getStatus = useCallback(
    (eventId: string, fallback: FristStatus = 'neu'): FristStatus =>
      statusMap[eventId]?.status ?? fallback,
    [statusMap]
  );

  return { saveStatus, clearStatus, getStatus };
}
