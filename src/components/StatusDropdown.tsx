import { useState, useEffect, useRef } from 'react';
import type { FristStatus } from '../types';

const ALL_STATUSES: FristStatus[] = [
  'neu',
  'geplant',
  'in bearbeitung',
  'erledigt',
  'verschoben',
  'überfällig',
];

interface Props {
  status: FristStatus;
  onChange: (status: FristStatus) => void;
}

export function StatusDropdown({ status, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function select(s: FristStatus) {
    onChange(s);
    setOpen(false);
  }

  return (
    <div ref={ref} className="status-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={`status-badge status-${status.replace(' ', '-')}`}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title="Status ändern"
      >
        {status}
      </button>
      {open && (
        <div className="status-menu">
          {ALL_STATUSES.map(s => (
            <div
              key={s}
              className={`status-option status-${s.replace(' ', '-')}${s === status ? ' active' : ''}`}
              onClick={e => { e.stopPropagation(); select(s); }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
