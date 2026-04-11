import { useState } from 'react';

const VOICE_KEY = 'fristenradar_voice';
const DEFAULT_VOICE = 'de-DE-KatjaNeural';

export function useSettings() {
  const [voice, setVoiceState] = useState<string>(
    () => localStorage.getItem(VOICE_KEY) ?? DEFAULT_VOICE
  );

  function setVoice(v: string) {
    localStorage.setItem(VOICE_KEY, v);
    setVoiceState(v);
  }

  return { voice, setVoice };
}
