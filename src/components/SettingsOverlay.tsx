import { useState } from 'react';
import type { BriefingType } from '../types';

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
  days: 30,
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
  briefingTypes: BriefingType[];
  onSaveType: (type: BriefingType) => Promise<void>;
  onDeleteType: (key: string) => Promise<void>;
}

export function SettingsOverlay({
  onClose,
  voice,
  onVoiceChange,
  briefingTypes,
  onSaveType,
  onDeleteType,
}: Props) {
  const [form, setForm] = useState<FormState | null>(null);

  function startNew() {
    setForm({ type: { ...EMPTY_TYPE }, isNew: true, saving: false, error: null });
  }

  function startEdit(type: BriefingType) {
    setForm({ type: { ...type }, isNew: false, saving: false, error: null });
  }

  function cancelForm() {
    setForm(null);
  }

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
    if (!type.key.trim()) {
      setForm(prev => prev ? { ...prev, error: 'Key fehlt' } : null);
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
    try {
      await onDeleteType(key);
    } catch {
      // ignore
    }
  }

  async function handleToggleActive(type: BriefingType) {
    try {
      await onSaveType({ ...type, active: !type.active });
    } catch {
      // ignore
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card settings-card" onClick={e => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-title">Einstellungen</span>
          <button className="overlay-close" onClick={onClose}>×</button>
        </div>

        <div className="overlay-body">
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
            <div className="settings-hint">
              Edge TTS via Backend — gilt für alle Briefing-Typen.
            </div>
          </div>

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
                    onNameChange={handleNameChange}
                    onChange={updateType}
                    onSave={handleSave}
                    onCancel={cancelForm}
                  />
                ) : (
                  <div className="briefing-type-row">
                    <span className="briefing-type-name">{type.name}</span>
                    <span className="briefing-type-days">{type.days}d</span>
                    <button
                      className={`briefing-type-toggle${type.active ? ' briefing-type-toggle--active' : ''}`}
                      onClick={() => handleToggleActive(type)}
                      title={type.active ? 'Cron: aktiv' : 'Cron: inaktiv'}
                    >
                      {type.active ? '●' : '○'}
                    </button>
                    <button className="briefing-type-btn" onClick={() => startEdit(type)}>✎</button>
                    <button
                      className="briefing-type-btn briefing-type-btn--del"
                      onClick={() => handleDelete(type.key)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}

            {form?.isNew && (
              <TypeForm
                form={form}
                onNameChange={handleNameChange}
                onChange={updateType}
                onSave={handleSave}
                onCancel={cancelForm}
              />
            )}

            {!form && (
              <button className="briefing-type-add" onClick={startNew}>
                + Neuer Typ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeForm({
  form,
  onNameChange,
  onChange,
  onSave,
  onCancel,
}: {
  form: FormState;
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
        title="Key wird automatisch aus dem Namen generiert"
      />
      <div className="briefing-type-days-row">
        <span className="settings-hint">Tage:</span>
        <input
          type="number"
          className="settings-input settings-input--narrow"
          value={type.days}
          min={1}
          max={365}
          onChange={e => onChange({ days: Number(e.target.value) })}
        />
      </div>
      <textarea
        className="settings-textarea"
        placeholder="Prompt für Qwen (z.B. 2-3 Sätze Morgenbriefing...)"
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
        <button className="btn btn-secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
