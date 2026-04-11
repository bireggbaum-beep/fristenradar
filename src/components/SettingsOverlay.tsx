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
          <p className="settings-placeholder">Einstellungen folgen.</p>
        </div>
      </div>
    </div>
  );
}
