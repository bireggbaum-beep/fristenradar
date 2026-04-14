"""
Fristenradar – FastAPI Backend
SQLite mirror of Google Calendar + hybrid LLM briefing (configurable provider).
"""
import asyncio
import json
import logging
import os
import re
import sqlite3
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
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
DB_PATH             = BASE_DIR / "fristenradar.db"
BRIEFING_DIR        = BASE_DIR / "briefings"
BRIEFING_TYPES_FILE = BASE_DIR / "briefing_types.json"
LLM_CONFIG_FILE     = BASE_DIR / "llm_config.json"
UI_DIST             = Path("/opt/fristenradar-ui/dist")

BRIEFING_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
DEFAULT_LLM_CONFIG = {
    "provider": "local",
    "localModel": "qwen2.5:7b",
    "openrouterKey": "",
    "openrouterModel": "google/gemini-flash-1.5-8b",
}

# ── SQLite ─────────────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                start_date  TEXT NOT NULL,
                end_date    TEXT,
                all_day     INTEGER NOT NULL DEFAULT 1,
                calendar_id TEXT NOT NULL DEFAULT 'primary',
                imported_at TEXT NOT NULL,
                deleted_at  TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);

            CREATE TABLE IF NOT EXISTS event_tags (
                event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                tag      TEXT NOT NULL,
                PRIMARY KEY (event_id, tag)
            );
            CREATE INDEX IF NOT EXISTS idx_tags_tag ON event_tags(tag);

            CREATE TABLE IF NOT EXISTS parsed_data (
                event_id   TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
                vorlauf    INTEGER NOT NULL DEFAULT 0,
                aktion     TEXT    NOT NULL DEFAULT '',
                notiz      TEXT    NOT NULL DEFAULT '',
                parsed_at  TEXT    NOT NULL,
                model_used TEXT    NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS briefing_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                type_key     TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                text_used    TEXT,
                audio_path   TEXT
            );
        """)
    log.info("DB initialised at %s", DB_PATH)


# ── Tag extraction ─────────────────────────────────────────────────────────────
def extract_tags(description: str) -> list[str]:
    """Extract #tag values and #typ as type:X from event description."""
    tags = re.findall(r'#tag\s+(\S+)', description, re.IGNORECASE)
    typ = re.search(r'#typ\s+(\S+)', description, re.IGNORECASE)
    if typ:
        tags.append(f"type:{typ.group(1).lower()}")
    return list(set(t.lower() for t in tags))


# ── Calendar sync ──────────────────────────────────────────────────────────────
def _fetch_raw_events(days_back: int = 90, days_forward: int = 365) -> list[dict]:
    """Fetch events from Google Calendar covering past + future range."""
    from app.google_calendar import get_google_service
    service = get_google_service()
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")

    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=days_back)).isoformat()
    time_max = (now + timedelta(days=days_forward)).isoformat()

    result = service.events().list(
        calendarId=calendar_id,
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
        maxResults=2500,
    ).execute()

    events = []
    for ev in result.get("items", []):
        if ev.get("status") == "cancelled":
            continue
        start = ev.get("start", {})
        end   = ev.get("end", {})
        all_day = "date" in start
        events.append({
            "id":          ev["id"],
            "title":       ev.get("summary") or "",
            "description": ev.get("description") or "",
            "start_date":  start.get("date") if all_day else (start.get("dateTime") or "")[:10],
            "end_date":    end.get("date") if all_day else (end.get("dateTime") or "")[:10],
            "all_day":     1 if all_day else 0,
            "calendar_id": calendar_id,
        })
    return events


def sync_to_db(events: list[dict]) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        for ev in events:
            conn.execute("""
                INSERT INTO events (id, title, description, start_date, end_date,
                                    all_day, calendar_id, imported_at, deleted_at)
                VALUES (:id, :title, :description, :start_date, :end_date,
                        :all_day, :calendar_id, :imported_at, NULL)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title, description=excluded.description,
                    start_date=excluded.start_date, end_date=excluded.end_date,
                    all_day=excluded.all_day, imported_at=excluded.imported_at,
                    deleted_at=NULL
            """, {**ev, "imported_at": now_iso})

            conn.execute("DELETE FROM event_tags WHERE event_id = ?", (ev["id"],))
            for tag in extract_tags(ev["description"]):
                conn.execute(
                    "INSERT OR IGNORE INTO event_tags (event_id, tag) VALUES (?, ?)",
                    (ev["id"], tag)
                )
    log.info("Synced %d events to DB", len(events))


async def sync_events() -> None:
    try:
        events = _fetch_raw_events()
        sync_to_db(events)
    except Exception as e:
        log.warning("sync_events failed: %s", e)


async def sync_loop() -> None:
    while True:
        log.info("sync_loop: syncing calendar…")
        await sync_events()
        await asyncio.sleep(15 * 60)   # every 15 minutes


# ── Parse cache (now in SQLite) ────────────────────────────────────────────────
def get_cached_parse(event_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT vorlauf, aktion, notiz FROM parsed_data WHERE event_id = ?",
            (event_id,)
        ).fetchone()
    return dict(row) if row else None


def save_cached_parse(event_id: str, data: dict, model: str = "") -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO parsed_data (event_id, vorlauf, aktion, notiz, parsed_at, model_used)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(event_id) DO UPDATE SET
                vorlauf=excluded.vorlauf, aktion=excluded.aktion,
                notiz=excluded.notiz, parsed_at=excluded.parsed_at,
                model_used=excluded.model_used
        """, (event_id, data.get("vorlauf", 0), data.get("aktion", ""),
              data.get("notiz", ""), now_iso, model))


# ── Config persistence ─────────────────────────────────────────────────────────
def load_llm_config() -> dict:
    if LLM_CONFIG_FILE.exists():
        try:
            return json.loads(LLM_CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return dict(DEFAULT_LLM_CONFIG)


def save_llm_config(config: dict) -> None:
    LLM_CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def load_briefing_types() -> list[dict]:
    if BRIEFING_TYPES_FILE.exists():
        with open(BRIEFING_TYPES_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_briefing_types(types: list[dict]) -> None:
    with open(BRIEFING_TYPES_FILE, "w", encoding="utf-8") as f:
        json.dump(types, f, ensure_ascii=False, indent=2)


# ── LLM dispatchers ────────────────────────────────────────────────────────────
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
                "max_tokens": 500,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


async def _call_llm(prompt: str) -> str:
    config = load_llm_config()
    if config.get("provider") == "openrouter":
        key   = config.get("openrouterKey", "")
        model = config.get("openrouterModel", "google/gemini-flash-1.5-8b")
        if not key:
            raise ValueError("OpenRouter API-Schlüssel fehlt")
        return await _call_openrouter(prompt, key, model)
    return await _call_ollama(prompt, config.get("localModel", "qwen2.5:7b"))


# ── Background parse loop ──────────────────────────────────────────────────────
async def parse_all_events() -> None:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT e.id, e.description
            FROM events e
            LEFT JOIN parsed_data p ON e.id = p.event_id
            WHERE e.description != '' AND p.event_id IS NULL AND e.deleted_at IS NULL
        """).fetchall()

    if not rows:
        return

    config = load_llm_config()
    model_used = config.get("localModel", "") if config.get("provider") == "local" \
        else config.get("openrouterModel", "")

    for row in rows:
        try:
            parsed = await _parse_description(row["description"])
            save_cached_parse(row["id"], parsed, model_used)
            log.info("Parsed event %s", row["id"])
        except Exception as e:
            log.warning("parse failed for %s: %s", row["id"], e)


async def _parse_description(description: str) -> dict:
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
        end   = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception:
        return {"vorlauf": 0, "aktion": "", "notiz": ""}


async def parse_loop() -> None:
    await asyncio.sleep(10)   # let sync run first
    while True:
        log.info("parse_loop: parsing unparsed descriptions…")
        await parse_all_events()
        await asyncio.sleep(4 * 3600)


# ── Edge TTS ───────────────────────────────────────────────────────────────────
async def _text_to_speech(text: str, output_path: str, voice: str) -> str:
    import edge_tts  # type: ignore
    await edge_tts.Communicate(text, voice).save(output_path)
    return output_path


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    t1 = asyncio.create_task(sync_loop())
    t2 = asyncio.create_task(parse_loop())
    yield
    t1.cancel()
    t2.cancel()


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Urgency helpers ────────────────────────────────────────────────────────────
def _calc_urgency(event_date: date, today: date, vorlauf: int = 0) -> str:
    days_left = (event_date - today).days
    if days_left <= 0:   return "ÜBERFÄLLIG"
    if days_left <= 2:   return "KRITISCH"
    if vorlauf > 0 and today >= event_date - timedelta(days=vorlauf):
        return "HEUTE ANFANGEN"
    if days_left <= 5:   return "HEUTE ANFANGEN"
    if days_left <= 14:  return "BALD"
    return "RADAR"


def _rel_future(event_date: date, today: date) -> str:
    d = (event_date - today).days
    if d < 0:   return "überfällig"
    if d == 0:  return "heute fällig"
    if d == 1:  return "morgen fällig"
    if d <= 14: return f"in {d} Tagen"
    if d <= 60: return f"in {round(d/7)} Wochen"
    return f"in {round(d/30)} Monaten"


def _rel_past(event_date: date, today: date) -> str:
    d = (today - event_date).days
    if d == 0:  return "heute"
    if d == 1:  return "gestern"
    if d <= 14: return f"vor {d} Tagen"
    if d <= 60: return f"vor {round(d/7)} Wochen"
    return f"vor {round(d/30)} Monaten"


# ── Query helpers ──────────────────────────────────────────────────────────────
DATE_RANGE_SQL: dict[str, tuple[str, str]] = {
    "urgent":  ("date('now', '-1 day')", "date('now', '+14 days')"),
    "next_7":  ("date('now')",           "date('now', '+7 days')"),
    "next_14": ("date('now')",           "date('now', '+14 days')"),
    "next_30": ("date('now')",           "date('now', '+30 days')"),
    "next_90": ("date('now')",           "date('now', '+90 days')"),
    "past_7":  ("date('now', '-7 days')", "date('now')"),
    "past_30": ("date('now', '-30 days')", "date('now')"),
}


def _query_events(date_range: str, filter_by: str = "") -> list[sqlite3.Row]:
    time_min, time_max = DATE_RANGE_SQL.get(date_range, DATE_RANGE_SQL["urgent"])

    base_sql = f"""
        SELECT e.id, e.title, e.start_date, e.description, e.calendar_id,
               COALESCE(p.vorlauf, 0)  AS vorlauf,
               COALESCE(p.aktion, '')  AS aktion,
               COALESCE(p.notiz, '')   AS notiz
        FROM events e
        LEFT JOIN parsed_data p ON e.id = p.event_id
        WHERE e.deleted_at IS NULL
          AND e.start_date >= {time_min}
          AND e.start_date <= {time_max}
    """
    params: list = []

    if filter_by:
        prefix, _, value = filter_by.partition(":")
        if prefix == "tag":
            base_sql += " AND e.id IN (SELECT event_id FROM event_tags WHERE tag = ?)"
            params.append(value.lower())
        elif prefix == "calendar":
            base_sql += " AND e.calendar_id = ?"
            params.append(value)
        elif prefix == "type":
            base_sql += " AND e.id IN (SELECT event_id FROM event_tags WHERE tag = ?)"
            params.append(f"type:{value.lower()}")

    base_sql += " ORDER BY e.start_date"

    with get_db() as conn:
        return conn.execute(base_sql, params).fetchall()


# ── Briefing skeleton builder ──────────────────────────────────────────────────
def _build_skeleton(rows: list[sqlite3.Row], date_range: str, today: date) -> str:
    if not rows:
        return "In diesem Zeitraum gibt es keine relevanten Termine."

    is_past = date_range.startswith("past_")

    if is_past:
        lines = ["=== RÜCKBLICK ==="]
        for r in rows:
            try:
                d = date.fromisoformat(r["start_date"])
            except ValueError:
                continue
            rel = _rel_past(d, today)
            lines.append(f"- {r['title']} [{rel}]")
            if r["aktion"]:
                lines.append(f"  Aktion: {r['aktion']}")
            if r["notiz"]:
                lines.append(f"  Notiz: {r['notiz']}")
        return "\n".join(lines)

    # Future: group by urgency
    groups: dict[str, list] = {k: [] for k in
        ("ÜBERFÄLLIG", "KRITISCH", "HEUTE ANFANGEN", "BALD", "RADAR")}

    for r in rows:
        try:
            d = date.fromisoformat(r["start_date"])
        except ValueError:
            continue
        urgency = _calc_urgency(d, today, int(r["vorlauf"] or 0))
        rel     = _rel_future(d, today)
        groups[urgency].append({
            "title":  r["title"],
            "urgency": urgency,
            "rel":    rel,
            "aktion": r["aktion"],
            "notiz":  r["notiz"],
        })

    lines: list[str] = []
    urgent = groups["ÜBERFÄLLIG"] + groups["KRITISCH"] + groups["HEUTE ANFANGEN"]
    if urgent:
        lines.append("=== JETZT HANDELN ===")
        for e in urgent:
            lines.append(f"- {e['title']} [{e['urgency']} — {e['rel']}]")
            if e["aktion"]: lines.append(f"  Aktion: {e['aktion']}")
            if e["notiz"]:  lines.append(f"  Notiz: {e['notiz']}")
    if groups["BALD"]:
        lines.append("=== BALD ===")
        for e in groups["BALD"]:
            lines.append(f"- {e['title']} [{e['rel']}]")
            if e["aktion"]: lines.append(f"  Aktion: {e['aktion']}")
    if groups["RADAR"]:
        lines.append("=== IM BLICK ===")
        for e in groups["RADAR"]:
            lines.append(f"- {e['title']} [{e['rel']}]")

    return "\n".join(lines) if lines else "Gerade sind keine relevanten Termine in diesem Zeitraum."


# ── Briefing generation ────────────────────────────────────────────────────────
async def generate_and_cache(key: str, btype: dict, voice: str, force: bool = False) -> str:
    today     = date.today()
    cache_file = BRIEFING_DIR / f"{today.isoformat()}-{key}.mp3"

    if not force and cache_file.exists():
        return str(cache_file)

    date_range = btype.get("date_range") or "urgent"
    filter_by  = btype.get("filter_by") or ""

    rows     = _query_events(date_range, filter_by)
    skeleton = _build_skeleton(rows, date_range, today)

    log.info("Briefing skeleton für '%s':\n%s", key, skeleton)

    user_prompt = btype.get("prompt") or "Erstelle ein kurzes Briefing auf Deutsch."
    prompt = (
        "Forme diesen strukturierten Text in ein natürliches Briefing auf Deutsch um.\n"
        "WICHTIG: Übernimm alle Zeitangaben EXAKT wie angegeben "
        "('in 3 Tagen' bleibt 'in 3 Tagen', 'vor 5 Tagen' bleibt 'vor 5 Tagen').\n"
        "Erfinde keine Daten, rechne nichts um. Kein Markdown.\n\n"
        f"{skeleton}\n\n"
        f"{user_prompt}"
    )

    text = await _call_llm(prompt)
    if not text:
        text = skeleton

    log.info("Briefing text für '%s': %s…", key, text[:100])
    await _text_to_speech(text, str(cache_file), voice)

    with get_db() as conn:
        conn.execute(
            "INSERT INTO briefing_log (type_key, generated_at, text_used, audio_path) VALUES (?,?,?,?)",
            (key, datetime.now(timezone.utc).isoformat(), text, str(cache_file))
        )

    return str(cache_file)


# ── API endpoints ──────────────────────────────────────────────────────────────
@app.get("/api/calendar/upcoming")
def calendar_upcoming(days: int = 90):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT e.id, e.title, e.description, e.start_date, e.end_date,
                   e.all_day, e.calendar_id,
                   p.vorlauf, p.aktion, p.notiz
            FROM events e
            LEFT JOIN parsed_data p ON e.id = p.event_id
            WHERE e.deleted_at IS NULL
              AND e.start_date >= date('now')
              AND e.start_date <= date('now', '+' || ? || ' days')
            ORDER BY e.start_date
        """, (days,)).fetchall()

    result = []
    for r in rows:
        parsed = None
        if r["vorlauf"] is not None:
            parsed = {"vorlauf": r["vorlauf"], "aktion": r["aktion"] or "", "notiz": r["notiz"] or ""}
        all_day = bool(r["all_day"])
        result.append({
            "id":          r["id"],
            "title":       r["title"],
            "description": r["description"],
            "start":       r["start_date"],
            "end":         r["end_date"],
            "allDay":      all_day,
            "parsed":      parsed,
        })
    return {"items": result}


@app.post("/api/events/reparse")
async def reparse_events():
    # Clear parsed_data so everything gets re-parsed
    with get_db() as conn:
        conn.execute("DELETE FROM parsed_data")
    asyncio.create_task(parse_all_events())
    return {"status": "started"}


@app.post("/api/events/sync")
async def trigger_sync():
    asyncio.create_task(sync_events())
    return {"status": "started"}


@app.get("/api/filters")
def get_filters():
    """Return available tags and calendars for the briefing type filter dropdown."""
    with get_db() as conn:
        tag_rows = conn.execute("""
            SELECT DISTINCT tag FROM event_tags
            WHERE tag NOT LIKE 'type:%'
            ORDER BY tag
        """).fetchall()
        cal_rows = conn.execute("""
            SELECT DISTINCT calendar_id FROM events WHERE deleted_at IS NULL
        """).fetchall()

    tags = [r["tag"] for r in tag_rows]
    calendars = [{"id": r["calendar_id"], "name": r["calendar_id"]} for r in cal_rows]
    return {"tags": tags, "calendars": calendars}


@app.get("/api/briefing/audio")
async def get_briefing_audio(key: str, voice: str = "de-DE-KatjaNeural", force: bool = False):
    btypes = load_briefing_types()
    btype  = next((b for b in btypes if b["key"] == key), None)
    if btype is None:
        raise HTTPException(status_code=404, detail=f"Briefing-Typ '{key}' nicht gefunden")
    audio_path = await generate_and_cache(key, btype, voice=voice, force=force)
    return FileResponse(audio_path, media_type="audio/mpeg")


@app.get("/api/briefing/types")
def get_briefing_types():
    return load_briefing_types()


@app.post("/api/briefing/types")
async def save_briefing_type(btype: dict):
    types = load_briefing_types()
    idx = next((i for i, b in enumerate(types) if b["key"] == btype["key"]), None)
    if idx is not None:
        types[idx] = btype
    else:
        types.append(btype)
    save_briefing_types(types)
    return btype


@app.delete("/api/briefing/types/{key}")
async def delete_briefing_type(key: str):
    types = [b for b in load_briefing_types() if b["key"] != key]
    save_briefing_types(types)
    return {"status": "ok"}


@app.get("/api/llm-config")
def get_llm_config():
    return load_llm_config()


@app.post("/api/llm-config")
async def post_llm_config(config: dict):
    save_llm_config(config)
    return {"status": "ok"}


# ── Serve frontend (must be last) ──────────────────────────────────────────────
if UI_DIST.exists():
    app.mount("/", StaticFiles(directory=str(UI_DIST), html=True), name="static")
