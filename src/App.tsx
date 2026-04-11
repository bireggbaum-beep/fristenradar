import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FristItem, FristStatus } from './types';
import { urgencyLevel, urgencyScore } from './lib/urgency';
import { useCalendar } from './hooks/useCalendar';
import { useStatusStore } from './hooks/useStatusStore';
import { TopBar } from './components/TopBar';
import { HeroCard } from './components/HeroCard';
import { DashboardTile } from './components/DashboardTile';
import { DetailOverlay } from './components/DetailOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
import { speakText, stopSpeaking } from './lib/tts';
import { diffDays } from './lib/urgency';


export function App() {
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedItem, setSelectedItem] = useState<FristItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { items: rawItems, loading, error, loadFromBackend } = useCalendar();
  const { saveStatus, getStatus } = useStatusStore();

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

  const radar = useMemo(
    () => sortedItems.filter(i => urgencyLevel(i, today) === 'RADAR'),
    [sortedItems, today]
  );

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  const handleRefresh = useCallback(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  const handleStatusChange = useCallback(
    (id: string, status: FristStatus) => {
      saveStatus(id, status);
      if (selectedItem?.id === id) {
        setSelectedItem(prev => (prev ? { ...prev, status } : null));
      }
    },
    [saveStatus, selectedItem]
  );

  const heroItem = critical[0] || soon[0] || radar[0];
  const soonItems = soon.filter(i => i.id !== heroItem?.id).slice(0, 2);
  const radarItems = radar.filter(i => i.id !== heroItem?.id).slice(0, 2);

    function formatCountdownForSpeech(days: number): string {
    if (days < 0) return 'ist bereits überfällig';
    if (days === 0) return 'ist heute fällig';
    if (days === 1) return 'ist morgen fällig';
    if (days <= 14) return `ist in ${days} Tagen fällig`;
    return `ist in ${Math.round(days / 7)} Wochen fällig`;
  }

  function buildShortBriefing() {
    if (!heroItem) return 'Gerade ist nichts dringend.';

    const days = diffDays(heroItem.dueDate, today);
    return `Heute wichtig: ${heroItem.title}. ${formatCountdownForSpeech(days)}.`;
  }

  function buildFullBriefing() {
    if (!heroItem) {
      return 'Guten Morgen. Gerade ist nichts dringend.';
    }

    const heroDays = diffDays(heroItem.dueDate, today);

    const soonText =
      soonItems.length > 0
        ? `Bald kritisch danach: ${soonItems
            .map(item => {
              const d = diffDays(item.dueDate, today);
              return `${item.title}, ${formatCountdownForSpeech(d)}`;
            })
            .join('. ')}.`
        : 'Danach wird gerade nichts bald kritisch.';

    const radarText =
      radarItems.length > 0
        ? `Im Blick: ${radarItems
            .map(item => {
              const d = diffDays(item.dueDate, today);
              return `${item.title}, ${formatCountdownForSpeech(d)}`;
            })
            .join('. ')}.`
        : 'Der Rest bleibt im Moment ruhig.';

    return [
      'Guten Morgen.',
      `Heute wichtig: ${heroItem.title}.`,
      formatCountdownForSpeech(heroDays) + '.',
      heroItem.note ? `${heroItem.note}.` : '',
      soonText,
      radarText,
    ]
      .filter(Boolean)
      .join(' ');
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

        {!loading && !error && heroItem && (
          <section className="hero-shell">
          <HeroCard
            item={heroItem}
            today={today}
            onMarkInProgress={() =>
              handleStatusChange(heroItem.id, 'in bearbeitung')
            }
            onMarkDone={() =>
              handleStatusChange(heroItem.id, 'erledigt')
            }
            onPlayBriefing={() => {
              stopSpeaking();
              speakText(buildFullBriefing(), { rate: 0.95, pitch: 1 });
            }}
            onPlayShortBriefing={() => {
              stopSpeaking();
              speakText(buildShortBriefing(), { rate: 0.98, pitch: 1 });
            }}
          />





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
                  {radar.length > 2 && (
                    <button
                      className="preview-more"
                      onClick={() => setSelectedItem(radar[0])}
                    >
                      +{radar.length - 2} weitere
                    </button>
                  )}
                </div>

                <div className="preview-list">
                  {radarItems.length > 0 ? (
                    radarItems.map(item => (
                      <DashboardTile
                        key={item.id}
                        item={item}
                        onClick={setSelectedItem}
                        variant="compact"
                        today={today}
                      />
                    ))
                  ) : (
                    <div className="preview-empty">Gerade ist der Rest noch ruhig.</div>
                  )}
                </div>
              </section>
            </div>
          </section>
        )}

        {!loading && !error && !heroItem && (
          <section className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">Gerade ist nichts dringend.</div>
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

      {showSettings && (
        <SettingsOverlay onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
