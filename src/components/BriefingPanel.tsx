import { useState, useEffect } from 'react';
import type { FristItem } from '../types';
import { generateBriefing, enhanceBriefingWithAI, speakBriefing } from '../lib/briefing';

interface Props {
  items: FristItem[];
  onRefresh: () => void;
  today?: Date;
}

export function BriefingPanel({ items, onRefresh, today = new Date() }: Props) {
  const [text, setText] = useState(() => generateBriefing(items, today));
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Regenerate when items load (e.g. after Google Calendar fetch), unless AI-enhanced
  useEffect(() => {
    if (!aiEnhanced) {
      setText(generateBriefing(items, today));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function handleSpeak() {
    setSpeaking(true);
    try {
      await speakBriefing(text);
    } finally {
      setSpeaking(false);
    }
  }

  async function handleEnhance() {
    setEnhancing(true);
    try {
      const enhanced = await enhanceBriefingWithAI(text);
      setText(enhanced);
      setAiEnhanced(true);
    } finally {
      setEnhancing(false);
    }
  }

  function handleRefresh() {
    setText(generateBriefing(items, today));
    setAiEnhanced(false);
    onRefresh();
  }

  const hasOpenRouterKey = !!import.meta.env.VITE_OPENROUTER_KEY;
  const hasElevenLabsKey = !!import.meta.env.VITE_ELEVENLABS_KEY;

  return (
    <div className="briefing-panel">
      <div className="briefing-header">
        <span className="briefing-title">
          Morgenbriefing
          {hasElevenLabsKey && <span className="briefing-badge">ElevenLabs</span>}
          {aiEnhanced && <span className="briefing-badge briefing-badge--ai">KI</span>}
        </span>
        <div className="briefing-actions">
          {hasOpenRouterKey && (
            <button
              className="btn-secondary"
              onClick={handleEnhance}
              disabled={enhancing || speaking}
              title="KI-Briefing generieren"
            >
              {enhancing ? '⏳' : '✨'} KI
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={handleSpeak}
            disabled={speaking}
            title="Vorlesen"
          >
            {speaking ? '🔊' : '▶'} Vorlesen
          </button>
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={speaking}
            title="Aktualisieren"
          >
            🔄 Aktualisieren
          </button>
        </div>
      </div>
      <div className="briefing-text">
        {text.split('\n').map((line, i) => (
          <p key={i}>{line || '\u00A0'}</p>
        ))}
      </div>
    </div>
  );
}
