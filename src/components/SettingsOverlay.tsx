const VOICES = [
  { value: 'de-DE-KatjaNeural',   label: 'Katja — weiblich, neutral (DE)' },
  { value: 'de-DE-ConradNeural',  label: 'Conrad — männlich, neutral (DE)' },
  { value: 'de-DE-AmalaNeural',   label: 'Amala — weiblich, freundlich (DE)' },
  { value: 'de-AT-JonasNeural',   label: 'Jonas — männlich, österreichisch' },
  { value: 'de-CH-LeniNeural',    label: 'Leni — weiblich, Schweizerdeutsch' },
];

interface Props {
  onClose: () => void;
  voice: string;
  onVoiceChange: (voice: string) => void;
}

export function SettingsOverlay({ onClose, voice, onVoiceChange }: Props) {
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
              Edge TTS via Backend — Stimme wird für das Briefing verwendet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
