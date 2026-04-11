# Fristenradar — Projektbeschreibung

## Was ist das?

Eine **PWA-Dashboard-App** ("Fristenradar"), die **Deadlines und Fristen** aus Google Kalender einliest, nach Dringlichkeit sortiert und als **sprachfähiges Morgenbriefing** aufbereitet. Die App zeigt auf einen Blick, welche Fristen heute kritisch sind, was bald ansteht und was noch auf dem Radar liegt.

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| PWA | vite-plugin-pwa (Workbox) |
| Styling | Plain CSS (Custom Properties, Dark Theme) |
| Font | Inter (Google Fonts) |
| Google Calendar | Google Calendar API v3 (OAuth Access Token) |
| TTS | Web Speech API (de-DE) + optional ElevenLabs |
| AI Briefing | Optional: OpenRouter (Gemini Flash 1.5) |
| Status-Persistenz | localStorage |

## Architektur

```
Google Calendar API
       │
       ▼
  calendarApi.ts ──fetchEvents──► GoogleCalendarEvent[]
       │
       ▼
  tagParser.ts ──parseDescriptionTags──► ParsedTags
       │
       ▼
  fristMapper.ts ──mapEventsToFristItems──► FristItem[]
       │
       ▼
  urgency.ts ──urgencyLevel / urgencyScore──► Sortierung + Label
       │
       ▼
  App.tsx ──HeroCard + DashboardTiles + DetailOverlay──► UI
       │
       ▼
  tts.ts / briefing.ts ──speakText / speakBriefing──► Audio-Ausgabe
```

## Datenmodell

**FristItem** — Kern-Interface:
```ts
{
  id: string;
  title: string;
  type: 'Behörde' | 'Vertrag' | 'Rechnung' | 'Intern' | 'Sonstiges';
  dueDate: Date;       // Fälligkeitsdatum
  startBy: Date;       // Bis wann anfangen
  priority: 'hoch' | 'mittel' | 'niedrig';
  status: 'neu' | 'geplant' | 'in bearbeitung' | 'erledigt' | 'verschoben' | 'überfällig';
  note: string;
  warnDays: number[];  // Warn-Tage vor Frist
  rawDescription: string;
}
```

## Dringlichkeitsstufen (urgency.ts)

| Label | Bedingung |
|-------|-----------|
| **ÜBERFÄLLIG** | `dueDate <= heute` |
| **KRITISCH** | `dueDate in ≤ 2 Tagen` |
| **HEUTE ANFANGEN** | `startBy erreicht` oder `dueDate in ≤ 5 Tagen` |
| **BALD** | `dueDate in ≤ 14 Tagen` |
| **RADAR** | `dueDate in > 14 Tagen` |

## Google Calendar Tag-System

Fristen werden über **Tags in der Event-Beschreibung** definiert:

| Tag | Bedeutung | Beispiel |
|-----|-----------|----------|
| `#typ` | Frist-Typ | `#typ Behörde` |
| `#aktion` | Was zu tun ist | `#aktion Verlängerung beantragen` |
| `#faellig` | Fälligkeitsdatum | `#faellig 2026-04-22` |
| `#start` | Start-Datum | `#start 2026-04-15` |
| `#warn` | Warn-Tage (kommagetrennt) | `#warn 14,7,3,1` |
| `#prio` | Priorität | `#prio hoch` |
| `#notiz` | Zusatzinfo | `#notiz Unterlagen prüfen` |

Events aus dem Kalender **"Fristen & Deadlines"** werden automatisch als Fristen behandelt. Alternativ reicht `#typ` oder `#frist` in der Beschreibung.

## Dateistruktur

```
fristenradar/
├── index.html                          # Entry Point
├── package.json                        # React 18, Vite 5, TypeScript, PWA
├── vite.config.ts                      # Vite + vite-plugin-pwa
├── tsconfig.json                       # TypeScript config
├── public/
│   └── manifest.json                   # PWA Manifest (Dark Theme, Icons)
│
└── src/
    ├── main.tsx                        # React Root
    ├── App.tsx                         # Hauptkomponente: Hero + Preview Grid + DetailOverlay
    │
    ├── types/
    │   └── index.ts                    # FristItem, FristStatus, FristType, GoogleCalendarEvent
    │
    ├── hooks/
    │   ├── useCalendar.ts              # Fetch Calendar Events (Mock + Google API)
    │   └── useStatusStore.ts           # Status-Persistenz via localStorage
    │
    ├── lib/
    │   ├── urgency.ts                  # Dringlichkeitsberechnung + Score + Warn-Templates
    │   ├── tagParser.ts                # Parst #typ, #faellig, #start, #warn, #prio, #notiz
    │   ├── fristMapper.ts              # Mappt GoogleCalendarEvent → FristItem
    │   ├── calendarApi.ts              # Google Calendar API Client + Mock-Daten
    │   ├── briefing.ts                 # Text-Briefing + AI Enhancement + TTS (ElevenLabs/Web Speech)
    │   └── tts.ts                      # Web Speech API Wrapper (de-DE Stimme)
    │
    ├── components/
    │   ├── TopBar.tsx                  # Begrüssung, Datum, Uhrzeit, Refresh-Button
    │   ├── HeroCard.tsx                # Haupt-Frist (dringendste) mit Audio-Briefing + Aktionen
    │   ├── DashboardTile.tsx           # Kompakte Frist-Kachel für Preview-Listen
    │   ├── DetailOverlay.tsx           # Detail-Ansicht einer Frist (Modal)
    │   ├── StatusDropdown.tsx          # Status-Auswahl (neu → erledigt)
    │   ├── FristCard.tsx               # Vollständige Frist-Karte (nicht in App.tsx verwendet)
    │   ├── BriefingPanel.tsx           # Vollständiges Briefing-Panel mit KI + TTS (nicht verwendet)
    │   ├── LeftPanel.tsx               # Sidebar mit Uhr, Übersicht, Filter, Google Login (nicht verwendet)
    │   └── Section.tsx                 # Generische Sektions-Komponente (nicht verwendet)
    │
    └── styles/
        └── global.css                  # Dark Theme, Layout, Komponenten-Styles (652 Zeilen)
```

## Aktueller Stand

**Implementiert:**
- ✅ Dashboard mit Hero-Card (dringendste Frist)
- ✅ Preview-Grid: "Bald kritisch" + "Im Blick"
- ✅ Dringlichkeits-Sortierung nach Score
- ✅ Detail-Overlay mit Status-Management
- ✅ TTS: Deutschsprachige Sprachausgabe (Web Speech API)
- ✅ Kurz- und Voll-Briefing per Knopfdruck
- ✅ Mock-Daten für Demo-Betrieb
- ✅ Google Calendar Integration (bereit, OAuth Token nötig)
- ✅ Status-Persistenz via localStorage
- ✅ PWA-fähig (Manifest + Service Worker)
- ✅ Responsive Design (Desktop → Mobile)

**Nicht aktiv verwendet (bestehende Komponenten):**
- 🔲 `BriefingPanel.tsx` — Vollständiges Briefing mit KI-Enhancement
- 🔲 `LeftPanel.tsx` — Sidebar mit Filtern + Google Login
- 🔲 `FristCard.tsx` — Detaillierte Einzelansicht
- 🔲 `Section.tsx` — Generische Sektion
- 🔲 AI Briefing (OpenRouter/Gemini) — Code vorhanden, Env-Var nötig
- 🔲 ElevenLabs TTS — Code vorhanden, Env-Var nötig

## Dev-Befehle

```bash
npm run dev       # Dev-Server (Port 5173, oder 5174 wenn belegt)
npm run build     # TypeScript + Vite Build
npm run preview   # Preview des Production-Builds
```

## Umgebungsvariablen (optional)

| Variable | Zweck |
|----------|-------|
| `VITE_OPENROUTER_KEY` | AI-Briefing via OpenRouter/Gemini |
| `VITE_ELEVENLABS_KEY` | Premium TTS via ElevenLabs |
| `VITE_ELEVENLABS_VOICE_ID` | Spezifische ElevenLabs Stimme |

## Warn-Templates pro Typ (urgency.ts)

| Typ | Warn-Tage |
|-----|-----------|
| Behörde | 21, 10, 5, 2 |
| Vertrag | 30, 14, 7, 3 |
| Rechnung | 7, 3, 1 |
| Intern | 14, 7, 3 |
| Sonstiges | 14, 7, 3, 1 |

## Lead-Zeiten für startBy (falls kein #start Tag)

| Typ | Tage vor Fälligkeit |
|-----|---------------------|
| Behörde | 7 |
| Vertrag | 14 |
| Rechnung | 3 |
| Intern | 5 |
| Sonstiges | 5 |
