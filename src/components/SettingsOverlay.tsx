interface Props {
  onClose: () => void;
}

export function SettingsOverlay({ onClose }: Props) {
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
            <select className="settings-select" disabled>
              <option>de-DE-KatjaNeural (weiblich)</option>
              <option>de-DE-ConradNeural (männlich)</option>
              <option>de-DE-AmalaNeural (weiblich, freundlich)</option>
              <option>de-AT-JonasNeural (österreichisch)</option>
              <option>de-CH-LeniNeural (Schweizerdeutsch)</option>
            </select>
            <div className="settings-hint">
              Edge TTS — wird in einem nächsten Schritt aktiviert.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
