let voicesCache: SpeechSynthesisVoice[] = [];

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  return window.speechSynthesis;
}

function isGermanVoice(voice: SpeechSynthesisVoice) {
  const lang = (voice.lang || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();

  return (
    lang.startsWith('de') ||
    name.includes('deutsch') ||
    name.includes('german') ||
    name.includes('de-de')
  );
}

async function loadVoices(timeout = 1500): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth();
  if (!synth) return [];

  let voices = synth.getVoices();
  if (voices.length > 0) {
    voicesCache = voices;
    return voices;
  }

  voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      const result = synth.getVoices();
      voicesCache = result;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(result);
    };

    const onVoicesChanged = () => finish();

    synth.addEventListener('voiceschanged', onVoicesChanged);

    window.setTimeout(() => finish(), timeout);
  });

  return voices;
}

export async function getGermanVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = voicesCache.length ? voicesCache : await loadVoices();

  const germanVoices = voices.filter(isGermanVoice);

  return (
    germanVoices.find(v => v.lang?.toLowerCase() === 'de-de') ||
    germanVoices.find(v => v.lang?.toLowerCase().startsWith('de')) ||
    germanVoices[0] ||
    null
  );
}

export function stopSpeaking() {
  const synth = getSynth();
  if (!synth) return;
  synth.cancel();
}

export async function speakText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  }
) {
  const synth = getSynth();
  if (!synth) {
    throw new Error('speechSynthesis wird in diesem Browser nicht unterstützt.');
  }

  const germanVoice = await getGermanVoice();

  if (!germanVoice) {
    return;
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = germanVoice.lang || 'de-DE';
  utterance.voice = germanVoice;
  utterance.rate = options?.rate ?? 0.97;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('TTS-Wiedergabe fehlgeschlagen.'));
    synth.speak(utterance);
  });
}

export async function debugVoices() {
  const voices = await loadVoices();
  return voices.map(v => ({
    name: v.name,
    lang: v.lang,
    default: v.default,
    german: isGermanVoice(v),
  }));
}

const BACKEND_URL = '';

export async function speakViaBackend(text: string, voice = 'de-DE-KatjaNeural'): Promise<void> {
  const url = `${BACKEND_URL}/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TTS-Fehler: ${res.status}`);
  const blob = await res.blob();
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio-Fehler'));
    audio.play();
  });
  URL.revokeObjectURL(audioUrl);
}

export async function fetchBriefingText(): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/briefing`);
  if (!res.ok) throw new Error(`Briefing-Fehler: ${res.status}`);
  const data = await res.json();
  return data.text as string;
}

export async function playBriefingAudio(key: string, voice: string, force = false): Promise<void> {
  const url = `/api/briefing/audio?key=${encodeURIComponent(key)}&voice=${encodeURIComponent(voice)}${force ? '&force=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Briefing-Fehler ${res.status}`);
  const blob = await res.blob();
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio-Fehler'));
    audio.play();
  });
  URL.revokeObjectURL(audioUrl);
}
