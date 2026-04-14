import { useState } from 'react';
import type { BriefingType, LLMConfig, AvailableFilters } from '../types';
import { DATE_RANGE_OPTIONS } from '../types';

const VOICES = [
  { value: 'de-DE-KatjaNeural',   label: 'Katja — weiblich, neutral (DE)' },
  { value: 'de-DE-ConradNeural',  label: 'Conrad — männlich, neutral (DE)' },
  { value: 'de-DE-AmalaNeural',   label: 'Amala — weiblich, freundlich (DE)' },
  { value: 'de-AT-JonasNeural',   label: 'Jonas — männlich, österreichisch' },
  { value: 'de-CH-LeniNeural',    label: 'Leni — weiblich, Schweizerdeutsch' },
];

const EMPTY_TYPE: BriefingType = {
  key: '',
  name: '',
  date_range: 'urgent',
  filter_by: '',
  prompt: 'Erstelle ein Morgenbriefing auf Deutsch. Maximal 3-4 Sätze. Sprich direkt wie eine Assistentin. Nur Fließtext.',
  active: true,
};

interface FormState {
  type: BriefingType;
  isNew: boolean;
  saving: boolean;
  error: string | null;
}

interface Props {
  onClose: () => void;
  voice: string;
  onVoiceChange: (voice: string) => void;
  cycleInterval: number;
  onCycleIntervalChange: (n: number) => void;
  briefingTypes: BriefingType[];
  onSaveType: (type: BriefingType) => Promise<void>;
  onDeleteType: (key: string) => Promise<void>;
  llmConfig: LLMConfig;
  onSaveLLMConfig: (config: LLMConfig) => Promise<void>;
  availableFilters: AvailableFilters;
}

function dateRangeLabel(value: string): string {
  return DATE_RANGE_OPTIONS.find(o => o.value === value)?.label ?? value;
}

function filterLabel(filter_by: string | undefined): string {
  if (!filter_by) return '';
  const [prefix, value] = filter_by.split(':');
  if (prefix === 'tag') return `#${value}`;
  if (prefix === 'calendar') return `📅 ${value}`;
  return filter_by;
}

export function SettingsOverlay({
  onClose,
  voice,
  onVoiceChange,
  cycleInterval,
  onCycleIntervalChange,
  briefingTypes,
  onSaveType,
  onDeleteType,
  llmConfig,
  onSaveLLMConfig,
  availableFilters,
}: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [llmDraft, setLLMDraft] = useState<LLMConfig>(llmConfig);
  const [llmSaving, setLLMSaving] = useState(false);
  const [llmSaved, setLLMSaved] = useState(false);
  const [llmError, setLLMError] = useState<string | null>(null);

  function startNew() {
    setForm({ type: { ...EMPTY_TYPE }, isNew: true, saving: false, error: null });
  }

  function startEdit(type: BriefingType) {
    setForm({ type: { ...type }, isNew: false, saving: false, error: null });
  }

  function cancelForm() { setForm(null); }

  function updateType(patch: Partial<BriefingType>) {
    setForm(prev => prev ? { ...prev, type: { ...prev.type, ...patch } } : null);
  }

  function handleNameChange(name: string) {
    const patch: Partial<BriefingType> = { name };
    if (form?.isNew) {
      patch.key = name
        .toLowerCase()
        .replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c] ?? c))
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
    setForm(prev => prev ? { ...prev, type: { ...prev.type, ...patch } } : null);
  }

  async function handleSave() {
    if (!form) return;
    const { type } = form;
    if (!type.name.trim()) {
      setForm(prev => prev ? { ...prev, error: 'Name fehlt' } : null);
      return;
    }
    if (!type.prompt.trim()) {
      setForm(prev => prev ? { ...prev, error: 'Prompt fehlt' } : null);
      return;
    }
    setForm(prev => prev ? { ...prev, saving: true, error: null } : null);
    try {
      await onSaveType(type);
      setForm(null);
    } catch (e) {
      setForm(prev =>
        prev ? { ...prev, saving: false, error: e instanceof Error ? e.message : 'Fehler' } : null
      );
    }
  }

  async function handleDelete(key: string) {
    try { await onDeleteType(key); } catch { }
  }

  async function handleToggleActive(type: BriefingType) {
    try { await onSaveType({ ...type, active: !type.active }); } catch { }
  }

  async function handleSaveLLM() {
    setLLMSaving(true);
    setLLMError(null);
    setLLMSaved(false);
    try {
      await onSaveLLMConfig(llmDraft);
      setLLMSaved(true);
      setTimeout(() => setLLMSaved(false), 2000);
    } catch (e) {
      setLLMError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLLMSaving(false);
    }
  }

  // Build filter options from available filters
  const filterOptions: { value: string; label: string }[] = [
    { value: '', label: 'Alle Events' },
    ...availableFilters.tags.map(t => ({ value: `tag:${t}`, label: `#${t}` })),
    ...availableFilters.calendars.map(c => ({ value: `calendar:${c.id}`, label: `📅 ${c.name}` })),
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card settings-card" onClick={e => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-title">Einstellungen</span>
          <button className="overlay-close" onClick={onClose}>×</button>
        </div>

        <div className="overlay-body">

          {/* ── Stimme ─────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">Stimme</div>
            <select
              className="settings-select settings-select--active"
              value={voice}
              onChange={e => onVoiceChange(e.target.value)}
            >
              {VOICES.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <div className="settings-hint">Edge TTS via Backend — gilt für alle Briefing-Typen.</div>
          </div>

          {/* ── KI-Modell ──────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">KI-Modell</div>
            <div className="llm-provider-toggle">
              <label className="llm-provider-option">
                <input type="radio" name="llm-provider"
                  checked={llmDraft.provider === 'local'}
                  onChange={() => setLLMDraft(d => ({ ...d, provider: 'local' }))}
                />
                Lokal (Ollama)
              </label>
              <label className="llm-provider-option">
                <input type="radio" name="llm-provider"
                  checked={llmDraft.provider === 'openrouter'}
                  onChange={() => setLLMDraft(d => ({ ...d, provider: 'openrouter' }))}
                />
                OpenRouter
              </label>
            </div>

            {llmDraft.provider === 'local' && (
              <div className="llm-fields">
                <label className="settings-label">Modell</label>
                <input className="settings-input" value={llmDraft.localModel}
                  onChange={e => setLLMDraft(d => ({ ...d, localModel: e.target.value }))}
                  placeholder="qwen2.5:7b"
                />
                <div className="settings-hint">z.B. qwen2.5:7b, mistral, llama3.2</div>
              </div>
            )}

            {llmDraft.provider === 'openrouter' && (
              <div className="llm-fields">
                <label className="settings-label">API-Schlüssel</label>
                <input className="settings-input" type="password"
                  value={llmDraft.openrouterKey}
                  onChange={e => setLLMDraft(d => ({ ...d, openrouterKey: e.target.value }))}
                  placeholder="sk-or-v1-..." autoComplete="off"
                />
                <label className="settings-label">Modell</label>
                <input className="settings-input" value={llmDraft.openrouterModel}
                  onChange={e => setLLMDraft(d => ({ ...d, openrouterModel: e.target.value }))}
                  placeholder="google/gemini-flash-1.5-8b"
                />
                <div className="settings-hint">
                  z.B. google/gemini-flash-1.5-8b · anthropic/claude-haiku-3-5
                </div>
              </div>
            )}

            {llmError && <div className="briefing-type-error">{llmError}</div>}
            <div className="llm-save-row">
              <button className="btn btn-primary" onClick={handleSaveLLM} disabled={llmSaving}>
                {llmSaving ? '…' : llmSaved ? 'Gespeichert ✓' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* ── Anzeige ────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">Anzeige</div>
            <div className="briefing-type-days-row">
              <span className="settings-hint">Wechsel-Intervall:</span>
              <input
                type="number"
                className="settings-input settings-input--narrow"
                value={cycleInterval}
                min={3} max={60}
                onChange={e => onCycleIntervalChange(Math.max(3, Number(e.target.value)))}
              />
              <span className="settings-hint">Sek.</span>
            </div>
          </div>

          {/* ── Briefing-Typen ─────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">Briefing-Typen</div>

            {briefingTypes.length === 0 && !form && (
              <div className="settings-hint">Noch keine Typen angelegt.</div>
            )}

            {briefingTypes.map(type => (
              <div key={type.key}>
                {form && !form.isNew && form.type.key === type.key ? (
                  <TypeForm
                    form={form}
                    filterOptions={filterOptions}
                    onNameChange={handleNameChange}
                    onChange={updateType}
                    onSave={handleSave}
                    onCancel={cancelForm}
                  />
                ) : (
                  <div className="briefing-type-row">
                    <div className="briefing-type-info">
                      <span className="briefing-type-name">{type.name}</span>
                      <span className="briefing-type-days">
                        {dateRangeLabel(type.date_range)}
                        {type.filter_by ? ` · ${filterLabel(type.filter_by)}` : ''}
                      </span>
                    </div>
                    <div className="briefing-type-actions">
                      <button
                        className={`briefing-type-active-btn${type.active ? ' briefing-type-active-btn--on' : ''}`}
                        onClick={() => handleToggleActive(type)}
                      >
                        {type.active ? 'Cron AN' : 'Cron AUS'}
                      </button>
                      <button className="briefing-type-edit-btn" onClick={() => startEdit(type)}>
                        Bearbeiten
                      </button>
                      <button className="briefing-type-del-btn" onClick={() => handleDelete(type.key)}>
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {form?.isNew && (
              <TypeForm
                form={form}
                filterOptions={filterOptions}
                onNameChange={handleNameChange}
                onChange={updateType}
                onSave={handleSave}
                onCancel={cancelForm}
              />
            )}

            {!form && (
              <button className="briefing-type-add" onClick={startNew}>+ Neuer Typ</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeForm({
  form,
  filterOptions,
  onNameChange,
  onChange,
  onSave,
  onCancel,
}: {
  form: FormState;
  filterOptions: { value: string; label: string }[];
  onNameChange: (name: string) => void;
  onChange: (patch: Partial<BriefingType>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { type, isNew, saving, error } = form;

  return (
    <div className="briefing-type-form">
      <input
        className="settings-input"
        placeholder="Name (z.B. Kurz)"
        value={type.name}
        onChange={e => onNameChange(e.target.value)}
        autoFocus
      />
      <input
        className="settings-input settings-input--muted"
        placeholder="key (auto)"
        value={type.key}
        onChange={e => onChange({ key: e.target.value })}
        disabled={!isNew}
      />

      <div className="briefing-type-filter-row">
        <div className="briefing-type-filter-col">
          <label className="settings-label">Zeitraum</label>
          <select
            className="settings-select settings-select--active"
            value={type.date_range}
            onChange={e => onChange({ date_range: e.target.value })}
          >
            {DATE_RANGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="briefing-type-filter-col">
          <label className="settings-label">Filter</label>
          <select
            className="settings-select settings-select--active"
            value={type.filter_by ?? ''}
            onChange={e => onChange({ filter_by: e.target.value || undefined })}
          >
            {filterOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        className="settings-textarea"
        placeholder="Was soll das Briefing tun? z.B.: Rückblick letzte 30 Tage. Freundlich, bestätigend."
        value={type.prompt}
        rows={3}
        onChange={e => onChange({ prompt: e.target.value })}
      />
      <label className="settings-checkbox-label">
        <input
          type="checkbox"
          checked={type.active}
          onChange={e => onChange({ active: e.target.checked })}
        />
        Täglich pre-generieren (Cron)
      </label>
      {error && <div className="briefing-type-error">{error}</div>}
      <div className="briefing-type-form-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? '…' : 'Speichern'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
}
