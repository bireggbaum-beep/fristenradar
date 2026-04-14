import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FristItem, FristStatus } from './types';
import { urgencyLevel, urgencyScore } from './lib/urgency';
import { useCalendar } from './hooks/useCalendar';
import { useStatusStore } from './hooks/useStatusStore';
import { TopBar } from './components/TopBar';
import { HeroCard } from './components/HeroCard';
import { DashboardTile } from './components/DashboardTile';
import { DetailOverlay } from './components/DetailOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
import { playBriefingAudio } from './lib/tts';
import { triggerSync } from './lib/calendarApi';
import { useSettings } from './hooks/useSettings';


export function App() {
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedItem, setSelectedItem] = useState<FristItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const briefingAbortRef = useRef<AbortController | null>(null);

  const CALM_MESSAGES = [
    'Alles im Griff. Kein Handlungsbedarf gerade.',
    'Luft holen — im Moment ist nichts dringend.',
    'Ruhige Phase. Genieß den Moment.',
  ];
  const [calmIndex] = useState(() => Math.floor(Math.random() * 3));
  const { voice, setVoice, cycleInterval, setCycleInterval, briefingTypes, saveType, deleteType, llmConfig, saveLLMConfig, availableFilters } = useSettings();

  const { items: rawItems, loading, error, loadFromBackend } = useCalendar();
  const { saveStatus, clearStatus, getStatus } = useStatusStore();

  const items: FristItem[] = useMemo(
    () => rawItems.map(item => ({ ...item, status: getStatus(item.id, item.status) })),
    [rawItems, getStatus]
  );

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => urgencyScore(b, today) - urgencyScore(a, today)),
    [items, today]
  );

  const critical = useMemo(
    () =>
      sortedItems.filter(i => {
        const l = urgencyLevel(i, today);
        return l === 'ÜBERFÄLLIG' || l === 'KRITISCH' || l === 'HEUTE ANFANGEN';
      }),
    [sortedItems, today]
  );

  const soon = useMemo(
    () => sortedItems.filter(i => urgencyLevel(i, today) === 'BALD'),
    [sortedItems, today]
  );

  const heroItems = useMemo(
    () => sortedItems.filter(i => {
      if (i.status === 'erledigt') return false;
      const l = urgencyLevel(i, today);
      return l === 'ÜBERFÄLLIG' || l === 'KRITISCH' || l === 'HEUTE ANFANGEN';
    }).slice(0, 6),
    [sortedItems, today]
  );

  const heroItemIds = useMemo(() => new Set(heroItems.map(i => i.id)), [heroItems]);

  const quietItems = useMemo(
    () => sortedItems.filter(i =>
      i.status !== 'erledigt' &&
      urgencyLevel(i, today) === 'RADAR' &&
      !heroItemIds.has(i.id)
    ),
    [sortedItems, today, heroItemIds]
  );

  const [quietOffset, setQuietOffset] = useState(0);

  useEffect(() => {
    if (quietItems.length <= 3) return;
    const t = setInterval(() => {
      setQuietOffset(o => (o + 3) % quietItems.length);
    }, cycleInterval * 2 * 1000);
    return () => clearInterval(t);
  }, [quietItems.length, cycleInterval]);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  const handleRefresh = useCallback(() => {
    triggerSync();
    loadFromBackend();
  }, [loadFromBackend]);

  const handleStatusChange = useCallback(
    (id: string, status: FristStatus) => {
      // Optimistic update: local state first, backend in background
      saveStatus(id, status);
      if (selectedItem?.id === id) {
        setSelectedItem(prev => (prev ? { ...prev, status } : null));
      }
      // Sync to backend; on success remove local override so DB is source of truth
      fetch(`/api/events/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
        .then(res => { if (res.ok) clearStatus(id); })
        .catch(() => { /* local override stays as fallback */ });
    },
    [saveStatus, clearStatus, selectedItem]
  );

  const heroItem = heroItems[0];
  const soonItems = soon.filter(i => !heroItemIds.has(i.id)).slice(0, 2);

  // Safety net: clear loadingKey if it's stuck for more than 2 minutes
  useEffect(() => {
    if (!loadingKey) return;
    const id = setTimeout(() => {
      setLoadingKey(null);
      setBriefingError('Briefing-Generierung dauerte zu lang — bitte erneut versuchen.');
    }, 120_000);
    return () => clearTimeout(id);
  }, [loadingKey]);

  async function handlePlayBriefing(key: string, force = false) {
    if (loadingKey !== null) return;
    const controller = new AbortController();
    briefingAbortRef.current = controller;
    setLoadingKey(key);
    setBriefingError(null);
    try {
      await playBriefingAudio(key, voice, force, controller.signal);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'Abgebrochen') {
        console.error('Briefing-Fehler:', err);
        setBriefingError(msg);
      }
    } finally {
      briefingAbortRef.current = null;
      setLoadingKey(null);
    }
  }

  function handleCancelBriefing() {
    briefingAbortRef.current?.abort();
  }

  function handleRegenerateBriefing(key: string) {
    handlePlayBriefing(key, true);
  }

  return (
    <div className="app">
      <TopBar onRefresh={handleRefresh} onSettings={() => setShowSettings(true)} isLoading={loading} />

      <main className="home-screen">
        {loading && <div className="loading">Lade...</div>}

        {!loading && error && (
          <section className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <div className="empty-state-text">Backend nicht erreichbar</div>
            <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</div>
          </section>
        )}

        {!loading && !error && (
          <section className="hero-shell">
            <HeroCard
              items={heroItems}
              today={today}
              onMarkInProgress={(id) => handleStatusChange(id, 'in bearbeitung')}
              onMarkDone={(id) => handleStatusChange(id, 'erledigt')}
              onPlayBriefing={handlePlayBriefing}
              onRegenerateBriefing={handleRegenerateBriefing}
              briefingTypes={briefingTypes}
              loadingKey={loadingKey}
              cycleInterval={cycleInterval}
              calmMessage={CALM_MESSAGES[calmIndex]}
            />
            {briefingError && (
              <div style={{ color: '#e05', fontSize: '0.8rem', padding: '0.5rem 0.25rem' }}>
                ⚠ {briefingError}
              </div>
            )}

            <div className="preview-grid">
              <section className="preview-card">
                <div className="preview-head">
                  <h2 className="preview-title">Bald kritisch</h2>
                  {soon.length > 2 && (
                    <button
                      className="preview-more"
                      onClick={() => setSelectedItem(soon[0])}
                    >
                      +{soon.length - 2} weitere
                    </button>
                  )}
                </div>

                <div className="preview-list">
                  {soonItems.length > 0 ? (
                    soonItems.map(item => (
                      <DashboardTile
                        key={item.id}
                        item={item}
                        onClick={setSelectedItem}
                        variant="compact"
                        today={today}
                      />
                    ))
                  ) : (
                    <div className="preview-empty">Nichts, das bald kritisch wird.</div>
                  )}
                </div>
              </section>

              <section className="preview-card">
                <div className="preview-head">
                  <h2 className="preview-title">Im Blick</h2>
                </div>
                <div className="quiet-list">
                  {quietItems.length > 0 ? (
                    (() => {
                      const slice = quietItems.length <= 3
                        ? quietItems
                        : [...quietItems, ...quietItems].slice(quietOffset, quietOffset + 3);
                      return slice.map(item => {
                        const days = Math.ceil((item.dueDate.getTime() - today.getTime()) / 86400000);
                        const label = days <= 0 ? 'überfällig' : days === 1 ? 'morgen' : days <= 14 ? `in ${days} Tagen` : days <= 60 ? `in ${Math.round(days / 7)} Wochen` : `in ${Math.round(days / 30)} Monaten`;
                        return (
                          <button key={item.id} className="quiet-row" onClick={() => setSelectedItem(item)}>
                            <span className="quiet-title">{item.title}</span>
                            <span className="quiet-when">{label}</span>
                          </button>
                        );
                      });
                    })()
                  ) : (
                    <div className="preview-empty">Gerade ist der Rest noch ruhig.</div>
                  )}
                </div>
              </section>
            </div>
          </section>
        )}
      </main>

      {selectedItem && (
        <DetailOverlay
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange}
          today={today}
        />
      )}


      {loadingKey && (
        <div className="briefing-toast briefing-toast--cancellable">
          <span>Briefing wird generiert…</span>
          <button className="briefing-toast-cancel" onClick={handleCancelBriefing} title="Abbrechen">✕</button>
        </div>
      )}

      {showSettings && (
        <SettingsOverlay
          onClose={() => setShowSettings(false)}
          voice={voice}
          onVoiceChange={setVoice}
          cycleInterval={cycleInterval}
          onCycleIntervalChange={setCycleInterval}
          briefingTypes={briefingTypes}
          onSaveType={saveType}
          onDeleteType={deleteType}
          llmConfig={llmConfig}
          onSaveLLMConfig={saveLLMConfig}
          availableFilters={availableFilters}
        />
      )}
    </div>
  );
}
