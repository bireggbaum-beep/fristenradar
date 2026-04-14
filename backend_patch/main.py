"""
Fristenradar – FastAPI Backend
Hybrid briefing: code builds date-accurate skeleton, LLM adds prose only.
LLM is configurable: local Ollama or OpenRouter cloud model.
"""
import asyncio
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv("/opt/fristenradar/.env")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fristenradar")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR            = Path("/opt/fristenradar")
PARSE_CACHE_DIR     = BASE_DIR / "parsed"
BRIEFING_DIR        = BASE_DIR / "briefings"
BRIEFING_TYPES_FILE = BASE_DIR / "briefing_types.json"
LLM_CONFIG_FILE     = BASE_DIR / "llm_config.json"
UI_DIST             = Path("/opt/fristenradar-ui/dist")

PARSE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
BRIEFING_DIR.mkdir(parents=True, exist_ok=True)

# ── Config defaults ─────────────────────────────────────────────────────────────
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
DEFAULT_LLM_CONFIG = {
    "provider": "local",
    "localModel": "qwen2.5:7b",
    "openrouterKey": "",
    "openrouterModel": "google/gemini-flash-1.5-8b",
}


# ── LLM config persistence ──────────────────────────────────────────────────────
def load_llm_config() -> dict:
    if LLM_CONFIG_FILE.exists():
        try:
            return json.loads(LLM_CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return dict(DEFAULT_LLM_CONFIG)


def save_llm_config(config: dict) -> None:
    LLM_CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Briefing types persistence ──────────────────────────────────────────────────
def load_briefing_types() -> list[dict]:
    if BRIEFING_TYPES_FILE.exists():
        with open(BRIEFING_TYPES_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_briefing_types(types: list[dict]) -> None:
    with open(BRIEFING_TYPES_FILE, "w", encoding="utf-8") as f:
        json.dump(types, f, ensure_ascii=False, indent=2)


# ── Parse cache ─────────────────────────────────────────────────────────────────
def _desc_hash(description: str) -> str:
    return hashlib.md5(description.encode()).hexdigest()[:8]


def get_cached_parse(event_id: str, description: str) -> dict | None:
    h = _desc_hash(description)
    f = PARSE_CACHE_DIR / f"{event_id}-{h}.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def save_cached_parse(event_id: str, description: str, data: dict) -> None:
    h = _desc_hash(description)
    f = PARSE_CACHE_DIR / f"{event_id}-{h}.json"
    f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


# ── LLM dispatchers ─────────────────────────────────────────────────────────────
async def _call_ollama(prompt: str, model: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


async def _call_openrouter(prompt: str, api_key: str, model: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://fristenradar.local",
                "X-Title": "Fristenradar",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


async def _call_llm(prompt: str) -> str:
    """Dispatch to configured LLM provider."""
    config = load_llm_config()
    if config.get("provider") == "openrouter":
        key = config.get("openrouterKey", "")
        model = config.get("openrouterModel", "google/gemini-flash-1.5-8b")
        if not key:
            raise ValueError("OpenRouter API-Schlüssel fehlt")
        return await _call_openrouter(prompt, key, model)
    else:
        model = config.get("localModel", "qwen2.5:7b")
        return await _call_ollama(prompt, model)


# ── Event description parser ────────────────────────────────────────────────────
async def parse_with_llm(description: str) -> dict:
    prompt = (
        "Lies die folgende Kalendertermin-Beschreibung und extrahiere diese drei Felder als JSON:\n"
        '{"vorlauf": <Ganzzahl: Tage Vorlauf vor dem Termin, oder 0>, '
        '"aktion": "<Was konkret zu tun ist, max. 1 Satz, oder leer>", '
        '"notiz": "<Wichtige Zusatzinfo, max. 1 Satz, oder leer>"}\n'
        "Nur JSON zurückgeben, kein Text davor oder danach.\n\n"
        f"Beschreibung:\n{description}"
    )
    raw = await _call_llm(prompt)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception:
        return {"vorlauf": 0, "aktion": "", "notiz": ""}


# ── Edge TTS ────────────────────────────────────────────────────────────────────
async def _text_to_speech(text: str, output_path: str, voice: str) -> str:
    import edge_tts  # type: ignore
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    return output_path


# ── Background parse loop ───────────────────────────────────────────────────────
async def parse_all_events() -> None:
    from app.google_calendar import get_upcoming_events
    try:
        events = get_upcoming_events(days=365)
    except Exception as e:
        log.warning(f"parse_all_events: Kalender-Fehler: {e}")
        return
    for ev in events:
        desc = ev.get("note") or ""
        if not desc.strip():
            continue
        if get_cached_parse(ev["id"], desc) is not None:
            continue
        try:
            parsed = await parse_with_llm(desc)
            save_cached_parse(ev["id"], desc, parsed)
            log.info(f"Parsed: {ev.get('title', ev['id'])}")
        except Exception as e:
            log.warning(f"parse failed for {ev['id']}: {e}")


async def parse_loop() -> None:
    while True:
        log.info("parse_loop: Starte Parsing-Durchlauf")
        await parse_all_events()
        await asyncio.sleep(4 * 3600)


# ── Lifespan ─────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(parse_loop())
    yield
    task.cancel()


# ── App ──────────────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Urgency helpers (mirrors urgency.ts exactly) ────────────────────────────────
def _calc_urgency(event_date: date, today: date, vorlauf: int = 0) -> str:
    days_left = (event_date - today).days
    if days_left <= 0:
        return "ÜBERFÄLLIG"
    if days_left <= 2:
        return "KRITISCH"
    if vorlauf > 0:
        start_by = event_date - timedelta(days=vorlauf)
        if today >= start_by:
            return "HEUTE ANFANGEN"
    if days_left <= 5:
        return "HEUTE ANFANGEN"
    if days_left <= 14:
        return "BALD"
    return "RADAR"


def _rel(event_date: date, today: date) -> str:
    """Relative time string — only this goes to the LLM, never absolute dates."""
    days_left = (event_date - today).days
    if days_left < 0:
        return "überfällig"
    if days_left == 0:
        return "heute fällig"
    if days_left == 1:
        return "morgen fällig"
    if days_left <= 14:
        return f"in {days_left} Tagen"
    if days_left <= 60:
        return f"in {round(days_left / 7)} Wochen"
    return f"in {round(days_left / 30)} Monaten"


# ── Briefing generation ──────────────────────────────────────────────────────────
async def generate_and_cache(key: str, btype: dict, voice: str, force: bool = False) -> str:
    today = date.today()
    cache_file = BRIEFING_DIR / f"{today.isoformat()}-{key}.mp3"

    if not force and cache_file.exists():
        return str(cache_file)

    from app.google_calendar import get_upcoming_events
    events = get_upcoming_events(days=365)

    # Enrich with urgency + relative time
    enriched = []
    for ev in events:
        start_str = ev.get("start") or ""
        try:
            event_date = date.fromisoformat(str(start_str)[:10])
        except ValueError:
            continue

        desc = ev.get("note") or ""
        parsed = get_cached_parse(ev["id"], desc) if desc.strip() else None
        vorlauf = int(parsed.get("vorlauf") or 0) if parsed else 0
        aktion  = str(parsed.get("aktion") or "").strip() if parsed else ""
        notiz   = str(parsed.get("notiz") or "").strip() if parsed else ""

        urgency = _calc_urgency(event_date, today, vorlauf)
        rel     = _rel(event_date, today)

        enriched.append({
            "title":   ev.get("title") or "(Termin)",
            "urgency": urgency,
            "rel":     rel,
            "aktion":  aktion,
            "notiz":   notiz,
        })

    # Select events — urgency-based, not date-range-based
    include_radar = int(btype.get("days") or 0) > 14
    selected = [
        e for e in enriched
        if e["urgency"] in ("ÜBERFÄLLIG", "KRITISCH", "HEUTE ANFANGEN", "BALD")
        or (include_radar and e["urgency"] == "RADAR")
    ][:15]

    # Build skeleton with ONLY relative time refs — no absolute dates to LLM
    if not selected:
        skeleton = "Gerade sind keine dringenden Fristen vorhanden."
    else:
        urgent = [e for e in selected if e["urgency"] in ("ÜBERFÄLLIG", "KRITISCH", "HEUTE ANFANGEN")]
        bald   = [e for e in selected if e["urgency"] == "BALD"]
        radar  = [e for e in selected if e["urgency"] == "RADAR"]

        lines: list[str] = []

        if urgent:
            lines.append("=== JETZT HANDELN ===")
            for e in urgent:
                lines.append(f"- {e['title']} [{e['urgency']} — {e['rel']}]")
                if e["aktion"]:
                    lines.append(f"  Aktion: {e['aktion']}")
                if e["notiz"]:
                    lines.append(f"  Notiz: {e['notiz']}")

        if bald:
            lines.append("=== BALD ===")
            for e in bald:
                lines.append(f"- {e['title']} [{e['rel']}]")
                if e["aktion"]:
                    lines.append(f"  Aktion: {e['aktion']}")

        if radar:
            lines.append("=== IM BLICK ===")
            for e in radar:
                lines.append(f"- {e['title']} [{e['rel']}]")

        skeleton = "\n".join(lines)

    log.info(f"Briefing skeleton für '{key}':\n{skeleton}")

    # LLM: reformulate to natural prose — time refs must stay EXACTLY as given
    user_prompt = btype.get("prompt") or "Erstelle ein kurzes Briefing auf Deutsch."
    prompt = (
        "Forme diesen strukturierten Text in ein natürliches Briefing auf Deutsch um.\n"
        "WICHTIG: Übernimm alle Zeitangaben EXAKT wie angegeben "
        "(z.B. 'in 3 Tagen' bleibt 'in 3 Tagen', 'morgen fällig' bleibt 'morgen fällig').\n"
        "Erfinde keine Daten, rechne nichts um. Kein Markdown.\n\n"
        f"{skeleton}\n\n"
        f"{user_prompt}"
    )

    text = await _call_llm(prompt)
    if not text:
        text = skeleton

    log.info(f"Briefing text für '{key}': {text[:120]}...")
    await _text_to_speech(text, str(cache_file), voice)
    return str(cache_file)


# ── API endpoints ────────────────────────────────────────────────────────────────
@app.get("/api/calendar/upcoming")
def calendar_upcoming(days: int = 90):
    from app.google_calendar import get_upcoming_events
    events = get_upcoming_events(days=days)
    result = []
    for ev in events:
        desc = ev.get("note") or ""
        parsed = get_cached_parse(ev["id"], desc) if desc.strip() else None
        result.append({
            "id":          ev["id"],
            "title":       ev.get("title") or "",
            "description": desc,
            "start":       ev.get("start"),
            "end":         ev.get("end"),
            "allDay":      ev.get("allDay", True),
            "status":      ev.get("status"),
            "parsed":      parsed,
        })
    return {"items": result}


@app.post("/api/events/reparse")
async def reparse_events():
    asyncio.create_task(parse_all_events())
    return {"status": "started"}


# Briefing audio — matches frontend: /api/briefing/audio?key=X&voice=Y&force=true
@app.get("/api/briefing/audio")
async def get_briefing_audio(key: str, voice: str = "de-DE-KatjaNeural", force: bool = False):
    btypes = load_briefing_types()
    btype = next((b for b in btypes if b["key"] == key), None)
    if btype is None:
        raise HTTPException(status_code=404, detail=f"Briefing-Typ '{key}' nicht gefunden")

    audio_path = await generate_and_cache(key, btype, voice=voice, force=force)
    return FileResponse(audio_path, media_type="audio/mpeg")


# Briefing types — matches frontend: /api/briefing/types
@app.get("/api/briefing/types")
def get_briefing_types():
    return load_briefing_types()


@app.post("/api/briefing/types")
async def save_briefing_type(btype: dict):
    types = load_briefing_types()
    existing = next((i for i, b in enumerate(types) if b["key"] == btype["key"]), None)
    if existing is not None:
        types[existing] = btype
    else:
        types.append(btype)
    save_briefing_types(types)
    return btype


@app.delete("/api/briefing/types/{key}")
async def delete_briefing_type(key: str):
    types = load_briefing_types()
    types = [b for b in types if b["key"] != key]
    save_briefing_types(types)
    return {"status": "ok"}


# LLM config
@app.get("/api/llm-config")
def get_llm_config():
    return load_llm_config()


@app.post("/api/llm-config")
async def post_llm_config(config: dict):
    save_llm_config(config)
    return {"status": "ok"}


# ── Serve frontend (must be last) ────────────────────────────────────────────────
if UI_DIST.exists():
    app.mount("/", StaticFiles(directory=str(UI_DIST), html=True), name="static")
