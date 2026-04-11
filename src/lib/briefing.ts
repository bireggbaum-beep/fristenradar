import type { FristItem } from '../types';
import { urgencyLevel, diffDays } from './urgency';

export function generateBriefing(items: FristItem[], today: Date = new Date()): string {
  const critical = items.filter(i => {
    const level = urgencyLevel(i, today);
    return level === 'ÜBERFÄLLIG' || level === 'KRITISCH' || level === 'HEUTE ANFANGEN';
  });
  const coming = items.filter(i => urgencyLevel(i, today) === 'BALD');

  const wochentag = today.toLocaleDateString('de-CH', { weekday: 'long' });
  const datum = today.toLocaleDateString('de-CH', { day: 'numeric', month: 'long' });

  let text = `Guten Morgen. Heute ist ${wochentag}, der ${datum}.\n\n`;

  if (critical.length === 0) {
    text += 'Heute gibt es keine akut dringenden Fristen.';
  } else {
    text += `${
      critical.length === 1
        ? 'Ein Punkt braucht'
        : `${critical.length} Punkte brauchen`
    } heute deine Aufmerksamkeit.\n`;

    for (const item of critical) {
      const d = diffDays(item.dueDate, today);
      const level = urgencyLevel(item, today);
      if (level === 'ÜBERFÄLLIG') {
        text += `— ${item.title}: Bereits abgelaufen. Sofort klären.\n`;
      } else {
        text += `— ${item.title}: Frist in ${d} ${d === 1 ? 'Tag' : 'Tagen'}. ${
          level === 'KRITISCH' ? 'Sofort handeln.' : 'Heute anfangen.'
        }\n`;
      }
    }
  }

  if (coming.length > 0) {
    text += `\nAuf dem Radar: ${coming.length} ${
      coming.length === 1 ? 'Frist nähert sich' : 'Fristen nähern sich'
    }.\n`;
    for (const item of coming.slice(0, 2)) {
      const d = diffDays(item.dueDate, today);
      const startIsPast = diffDays(today, item.startBy) >= 0;
      text += `— ${item.title}: fällig in ${d} Tagen. ${
        startIsPast
          ? 'Spätestens jetzt anfangen.'
          : `Anfangen ab ${item.startBy.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })}.`
      }\n`;
    }
  }

  return text;
}

export async function enhanceBriefingWithAI(rawBriefing: string): Promise<string> {
  const key = import.meta.env.VITE_OPENROUTER_KEY;
  if (!key) return rawBriefing;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [
        {
          role: 'user',
          content:
            `Formuliere dieses Morgenbriefing auf Deutsch natürlich und klar um. ` +
            `Maximal 5 Sätze. Kein Smalltalk. Fokus auf Handlungsbedarf. Originaldaten:\n\n${rawBriefing}`,
        },
      ],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? rawBriefing;
}

/**
 * Spricht den Text vor.
 * Wenn VITE_ELEVENLABS_KEY gesetzt → ElevenLabs API (bessere Qualität).
 * Sonst → Web Speech API (kein Key nötig).
 * Gibt ein Promise zurück, das resolved wenn die Wiedergabe endet.
 */
export async function speakBriefing(text: string): Promise<void> {
  const elevenKey = import.meta.env.VITE_ELEVENLABS_KEY;
  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';

  if (elevenKey) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        return new Promise(resolve => {
          const audio = new Audio(url);
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
        });
      }
    } catch {
      // ElevenLabs fehlgeschlagen → Fallback Web Speech
    }
  }

  // Web Speech API Fallback
  window.speechSynthesis.cancel();
  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
