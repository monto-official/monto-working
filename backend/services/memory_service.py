"""
Persistent Conversation Memory Service
---------------------------------------
Uses Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
Falls back automatically to local SQLite when they are not — so local
development works without a Supabase project.
"""
import os, re, json, time, sqlite3, logging, threading
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

MAX_RECENT_MESSAGES = 20
DB_PATH = os.getenv("MEMORY_DB_PATH", "monto_memory.db")

# ── Detect which backend to use ───────────────────────────────────────────────
def _use_supabase() -> bool:
    return bool(os.getenv("SUPABASE_URL")) and bool(os.getenv("SUPABASE_SERVICE_KEY"))


# ══════════════════════════════════════════════════════════════════════════════
# SQLite backend (local fallback)
# ══════════════════════════════════════════════════════════════════════════════
class _SQLiteMemory:
    def __init__(self):
        self._lock = threading.Lock()
        self._init_db()
        logger.info(f"✅ Persistent memory ready → SQLite ({DB_PATH})")

    def _conn(self):
        c = sqlite3.connect(DB_PATH, check_same_thread=False)
        c.row_factory = sqlite3.Row
        return c

    def _init_db(self):
        with self._conn() as c:
            c.executescript("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS session_facts (
                    session_id TEXT PRIMARY KEY,
                    facts_json TEXT NOT NULL DEFAULT '{}',
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id, timestamp);
            """)

    def get_history(self, session_id: str) -> List[dict]:
        with self._lock:
            with self._conn() as c:
                rows = c.execute(
                    "SELECT role, content FROM messages WHERE session_id=? ORDER BY timestamp DESC LIMIT ?",
                    (session_id, MAX_RECENT_MESSAGES)
                ).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

    def get_full_transcript(self, session_id: str, limit: int = 200) -> List[dict]:
        with self._lock:
            with self._conn() as c:
                rows = c.execute(
                    "SELECT role, content, timestamp FROM messages WHERE session_id=? ORDER BY timestamp DESC LIMIT ?",
                    (session_id, limit)
                ).fetchall()
        return [{"role": r["role"], "content": r["content"], "timestamp": r["timestamp"]} for r in reversed(rows)]

    def add_turn(self, session_id: str, user_text: str, assistant_text: str):
        clean = self._plain(assistant_text)
        now   = time.time()
        with self._lock:
            with self._conn() as c:
                c.executemany(
                    "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?,?,?,?)",
                    [(session_id, "user", user_text, now),
                     (session_id, "assistant", clean, now + 0.001)]
                )
                c.execute("""DELETE FROM messages WHERE session_id=? AND id NOT IN (
                    SELECT id FROM messages WHERE session_id=? ORDER BY timestamp DESC LIMIT 500)""",
                    (session_id, session_id))
        self._extract_facts(session_id, user_text, assistant_text)

    def get_facts(self, session_id: str) -> dict:
        with self._lock:
            with self._conn() as c:
                row = c.execute("SELECT facts_json FROM session_facts WHERE session_id=?", (session_id,)).fetchone()
        return json.loads(row["facts_json"]) if row else {}

    def get_facts_prompt(self, session_id: str) -> str:
        facts = self.get_facts(session_id)
        if not facts: return ""
        lines = []
        if facts.get("name"):      lines.append(f"- The child's name is {facts['name']}.")
        if facts.get("age"):       lines.append(f"- They are {facts['age']} years old.")
        if facts.get("grade"):     lines.append(f"- They are in grade {facts['grade']}.")
        if facts.get("interests"): lines.append(f"- Their interests: {', '.join(facts['interests'])}.")
        if facts.get("last_topic"):lines.append(f"- Last topic: {facts['last_topic']}.")
        return ("\n\nWHAT YOU KNOW ABOUT THIS CHILD:\n" + "\n".join(lines)) if lines else ""

    def clear(self, session_id: str):
        with self._lock:
            with self._conn() as c:
                c.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
                c.execute("DELETE FROM session_facts WHERE session_id=?", (session_id,))

    def get_all_sessions(self) -> List[str]:
        with self._lock:
            with self._conn() as c:
                rows = c.execute("SELECT DISTINCT session_id FROM messages").fetchall()
        return [r["session_id"] for r in rows]

    def get_session_summary(self, session_id: str) -> dict:
        with self._lock:
            with self._conn() as c:
                cnt   = c.execute("SELECT COUNT(*) as c FROM messages WHERE session_id=?", (session_id,)).fetchone()["c"]
                first = c.execute("SELECT timestamp FROM messages WHERE session_id=? ORDER BY timestamp ASC  LIMIT 1", (session_id,)).fetchone()
                last  = c.execute("SELECT timestamp FROM messages WHERE session_id=? ORDER BY timestamp DESC LIMIT 1", (session_id,)).fetchone()
        return {"session_id": session_id, "total_messages": cnt,
                "first_message": first["timestamp"] if first else None,
                "last_message":  last["timestamp"]  if last  else None,
                "facts": self.get_facts(session_id)}

    @staticmethod
    def _plain(text: str) -> str:
        if text and text.strip().startswith("{"):
            try:
                d = json.loads(text.strip())
                if isinstance(d, dict) and "response" in d:
                    return d["response"]
            except Exception:
                pass
        return text

    def _extract_facts(self, session_id: str, user_text: str, _assistant: str):
        facts   = self.get_facts(session_id)
        changed = False
        tl      = user_text.lower()

        m = re.search(r"(?:my name is|i am|i'm|call me)\s+([a-zA-Z]{2,20})", tl)
        if m and not facts.get("name"):
            n = m.group(1).capitalize()
            if n.lower() not in ("here","okay","good","fine","back"):
                facts["name"] = n; changed = True

        m = re.search(r"(?:i am|i'm)\s+(\d{1,2})\s*(?:years old|yrs|year)", tl)
        if m and not facts.get("age"):
            facts["age"] = int(m.group(1)); changed = True

        m = re.search(r"(?:class|grade|standard)\s*(\d{1,2})", tl)
        if m and not facts.get("grade"):
            facts["grade"] = m.group(1); changed = True

        m = re.search(r"(?:i like|i love|i enjoy|my favourite is)\s+([a-zA-Z\s]{3,30})", tl)
        if m:
            interest = m.group(1).strip().rstrip(".,!")
            interests = facts.get("interests", [])
            if interest and interest not in interests:
                interests.append(interest); facts["interests"] = interests[-5:]; changed = True

        if len(user_text) > 10:
            facts["last_topic"] = user_text[:60].strip(); changed = True

        if changed:
            with self._lock:
                with self._conn() as c:
                    c.execute("""INSERT INTO session_facts (session_id, facts_json, updated_at) VALUES (?,?,?)
                        ON CONFLICT(session_id) DO UPDATE SET facts_json=excluded.facts_json, updated_at=excluded.updated_at""",
                        (session_id, json.dumps(facts), time.time()))


# ══════════════════════════════════════════════════════════════════════════════
# Supabase backend
# ══════════════════════════════════════════════════════════════════════════════
class _SupabaseMemory:
    def __init__(self):
        logger.info("✅ Persistent memory ready → Supabase (memory_messages)")

    def _db(self):
        from services.supabase_client import get_supabase
        return get_supabase()

    def get_history(self, session_id: str) -> List[dict]:
        res = (self._db().table("memory_messages")
               .select("role, content")
               .eq("session_id", session_id)
               .order("created_at", desc=True)
               .limit(MAX_RECENT_MESSAGES)
               .execute())
        return [{"role": r["role"], "content": r["content"]} for r in reversed(res.data or [])]

    def get_full_transcript(self, session_id: str, limit: int = 200) -> List[dict]:
        res = (self._db().table("memory_messages")
               .select("role, content, created_at")
               .eq("session_id", session_id)
               .order("created_at", desc=True)
               .limit(limit)
               .execute())
        return [{"role": r["role"], "content": r["content"], "timestamp": r["created_at"]} for r in reversed(res.data or [])]

    def add_turn(self, session_id: str, user_text: str, assistant_text: str):
        self._db().table("memory_messages").insert([
            {"session_id": session_id, "role": "user",      "content": user_text},
            {"session_id": session_id, "role": "assistant",  "content": assistant_text},
        ]).execute()

    def get_facts(self, session_id: str) -> dict:
        res = (self._db().table("session_facts")
               .select("facts").eq("session_id", session_id).maybe_single().execute())
        if res and res.data:
            facts = res.data.get("facts")
            return facts if isinstance(facts, dict) else {}
        return {}

    def get_facts_prompt(self, session_id: str) -> str:
        facts = self.get_facts(session_id)
        if not facts: return ""
        lines = []
        if facts.get("name"):      lines.append(f"- The child's name is {facts['name']}.")
        if facts.get("age"):       lines.append(f"- They are {facts['age']} years old.")
        if facts.get("interests"): lines.append(f"- Their interests: {', '.join(facts['interests'])}.")
        return ("\n\nWHAT YOU KNOW ABOUT THIS CHILD:\n" + "\n".join(lines)) if lines else ""

    def clear(self, session_id: str):
        self._db().table("memory_messages").delete().eq("session_id", session_id).execute()
        self._db().table("session_facts").delete().eq("session_id", session_id).execute()

    def get_all_sessions(self) -> List[str]:
        res = self._db().table("memory_messages").select("session_id").execute()
        seen = set(); out = []
        for r in (res.data or []):
            if r["session_id"] not in seen:
                seen.add(r["session_id"]); out.append(r["session_id"])
        return out

    def get_session_summary(self, session_id: str) -> dict:
        cnt = len(self.get_history(session_id))
        return {"session_id": session_id, "total_messages": cnt,
                "first_message": None, "last_message": None,
                "facts": self.get_facts(session_id)}


# ── Global singleton ──────────────────────────────────────────────────────────
def _make_memory():
    if _use_supabase():
        try:
            return _SupabaseMemory()
        except Exception as e:
            logger.warning(f"Supabase init failed ({e}), falling back to SQLite")
    return _SQLiteMemory()

memory = _make_memory()
