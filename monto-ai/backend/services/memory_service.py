"""
Persistent Conversation Memory Service
---------------------------------------
Stores all conversations in a SQLite database so Monto remembers
everything even after server restarts or Pi reboots.

What is stored per session:
  - Every message (user + Monto)
  - Timestamp of each message
  - Child's name (extracted automatically)
  - Any key facts Monto should always remember

Two layers of memory:
  1. RECENT CONTEXT  — last N messages sent to LLM every time (for flow)
  2. LONG-TERM FACTS — child's name, age, interests, extracted and injected
                       into every prompt so Monto always knows who it's talking to
"""
import os
import re
import time
import json
import sqlite3
import logging
import threading
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

DB_PATH             = "monto_memory.db"   # overridden by MEMORY_DB_PATH env var
MAX_RECENT_MESSAGES = 20
MAX_STORED_MESSAGES = 500


class PersistentMemory:
    def __init__(self, db_path: str = None):
        # Read env at init time (after load_dotenv has run in main.py)
        self.db_path = db_path or os.getenv("MEMORY_DB_PATH", DB_PATH)
        self._lock   = threading.Lock()
        self._init_db()
        logger.info(f"✅ Persistent memory ready → {self.db_path}")

    # ── DB SETUP ──────────────────────────────────────────────────────────────

    def _init_db(self):
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS messages (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id  TEXT    NOT NULL,
                    role        TEXT    NOT NULL,   -- 'user' or 'assistant'
                    content     TEXT    NOT NULL,
                    timestamp   REAL    NOT NULL
                );

                CREATE TABLE IF NOT EXISTS session_facts (
                    session_id  TEXT PRIMARY KEY,
                    facts_json  TEXT NOT NULL DEFAULT '{}',
                    updated_at  REAL NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_messages_session
                    ON messages(session_id, timestamp);
            """)

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    # ── PUBLIC API ────────────────────────────────────────────────────────────

    def get_history(self, session_id: str) -> List[dict]:
        """
        Returns the last MAX_RECENT_MESSAGES messages for this session.
        Used as context window sent to the LLM.
        """
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute("""
                    SELECT role, content FROM messages
                    WHERE session_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (session_id, MAX_RECENT_MESSAGES)).fetchall()

        # Reverse to chronological order
        return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

    def add_turn(self, session_id: str, user_text: str, assistant_text: str):
        """Save one user + assistant exchange to the database.
        assistant_text must be plain readable text — never raw JSON.
        """
        # Guard: if assistant_text is JSON, extract the response field
        clean_text = self._ensure_plain_text(assistant_text)

        now = time.time()
        with self._lock:
            with self._get_conn() as conn:
                conn.executemany(
                    "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?,?,?,?)",
                    [
                        (session_id, "user",      user_text,   now),
                        (session_id, "assistant",  clean_text,  now + 0.001),
                    ]
                )
                # Prune oldest messages if session is too long
                conn.execute("""
                    DELETE FROM messages
                    WHERE session_id = ? AND id NOT IN (
                        SELECT id FROM messages
                        WHERE session_id = ?
                        ORDER BY timestamp DESC
                        LIMIT ?
                    )
                """, (session_id, session_id, MAX_STORED_MESSAGES))

        # Extract and save any new facts (name, age, etc.)
        self._extract_facts(session_id, user_text, assistant_text)

        logger.debug(f"Memory [{session_id}]: turn saved")

    def get_facts(self, session_id: str) -> dict:
        """Return known facts about the child for this session."""
        with self._lock:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT facts_json FROM session_facts WHERE session_id = ?",
                    (session_id,)
                ).fetchone()
        if row:
            return json.loads(row["facts_json"])
        return {}

    def get_facts_prompt(self, session_id: str) -> str:
        """
        Returns a short string injected into the system prompt so Monto
        always remembers key facts about the child, even across restarts.
        """
        facts = self.get_facts(session_id)
        if not facts:
            return ""

        lines = []
        if facts.get("name"):
            lines.append(f"- The child's name is {facts['name']}. Always use their name warmly.")
        if facts.get("age"):
            lines.append(f"- They are {facts['age']} years old.")
        if facts.get("grade"):
            lines.append(f"- They are in grade/class {facts['grade']}.")
        if facts.get("interests"):
            interests = ", ".join(facts["interests"])
            lines.append(f"- Their interests include: {interests}.")
        if facts.get("last_topic"):
            lines.append(f"- Last time they talked about: {facts['last_topic']}.")

        if not lines:
            return ""

        return (
            "\n\nWHAT YOU KNOW ABOUT THIS CHILD (remember this always):\n"
            + "\n".join(lines)
        )

    def clear(self, session_id: str):
        """Clear all memory for a session."""
        with self._lock:
            with self._get_conn() as conn:
                conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM session_facts WHERE session_id = ?", (session_id,))
        logger.info(f"Memory [{session_id}]: cleared")

    def get_all_sessions(self) -> List[str]:
        """List all session IDs that have stored messages."""
        with self._lock:
            with self._get_conn() as conn:
                rows = conn.execute(
                    "SELECT DISTINCT session_id FROM messages"
                ).fetchall()
        return [r["session_id"] for r in rows]

    def get_session_summary(self, session_id: str) -> dict:
        """Stats about a session — useful for debugging."""
        with self._lock:
            with self._get_conn() as conn:
                count = conn.execute(
                    "SELECT COUNT(*) as c FROM messages WHERE session_id = ?",
                    (session_id,)
                ).fetchone()["c"]
                first = conn.execute(
                    "SELECT timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT 1",
                    (session_id,)
                ).fetchone()
                last = conn.execute(
                    "SELECT timestamp FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1",
                    (session_id,)
                ).fetchone()
        return {
            "session_id":    session_id,
            "total_messages": count,
            "first_message":  first["timestamp"] if first else None,
            "last_message":   last["timestamp"]  if last  else None,
            "facts":          self.get_facts(session_id),
        }

    # ── FACT EXTRACTION ───────────────────────────────────────────────────────

    @staticmethod
    def _ensure_plain_text(text: str) -> str:
        """
        If text is JSON (old bug where raw JSON was stored), extract response field.
        Otherwise return as-is.
        """
        stripped = text.strip() if text else ""
        if stripped.startswith("{"):
            try:
                data = json.loads(stripped)
                if isinstance(data, dict) and "response" in data:
                    return data["response"]
            except (json.JSONDecodeError, ValueError):
                pass
        return text

    def _extract_facts(self, session_id: str, user_text: str, assistant_text: str):
        """
        Automatically extract key facts from conversation and store them.
        Simple rule-based extraction — no extra LLM call needed.
        """
        facts = self.get_facts(session_id)
        changed = False

        text_lower = user_text.lower()

        # Extract name — "my name is X" / "I am X" / "call me X"
        name_match = re.search(
            r"(?:my name is|i am|i'm|call me)\s+([a-zA-Z]{2,20})",
            text_lower
        )
        if name_match and not facts.get("name"):
            name = name_match.group(1).strip().capitalize()
            # Filter out common false positives
            if name.lower() not in ("here", "okay", "good", "fine", "back", "home"):
                facts["name"] = name
                changed = True
                logger.info(f"Memory [{session_id}]: learned name = {name}")

        # Extract age — "I am X years old" / "I'm X"
        age_match = re.search(
            r"(?:i am|i'm)\s+(\d{1,2})\s*(?:years old|yrs|year)",
            text_lower
        )
        if age_match and not facts.get("age"):
            facts["age"] = int(age_match.group(1))
            changed = True
            logger.info(f"Memory [{session_id}]: learned age = {facts['age']}")

        # Extract grade/class — "I'm in class 5" / "grade 3"
        grade_match = re.search(
            r"(?:class|grade|standard)\s*(\d{1,2})",
            text_lower
        )
        if grade_match and not facts.get("grade"):
            facts["grade"] = grade_match.group(1)
            changed = True

        # Extract interests — "I like/love X"
        interest_match = re.search(
            r"(?:i like|i love|i enjoy|my favourite is|i'm interested in)\s+([a-zA-Z\s]{3,30})",
            text_lower
        )
        if interest_match:
            interest = interest_match.group(1).strip().rstrip(".,!")
            if interest and len(interest) > 2:
                interests = facts.get("interests", [])
                if interest not in interests:
                    interests.append(interest)
                    facts["interests"] = interests[-5:]  # keep last 5
                    changed = True

        # Track last topic (simple — first noun phrase from user message)
        if len(user_text) > 10:
            facts["last_topic"] = user_text[:60].strip()
            changed = True

        if changed:
            now = time.time()
            with self._lock:
                with self._get_conn() as conn:
                    conn.execute("""
                        INSERT INTO session_facts (session_id, facts_json, updated_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(session_id) DO UPDATE SET
                            facts_json = excluded.facts_json,
                            updated_at = excluded.updated_at
                    """, (session_id, json.dumps(facts), now))


# ── GLOBAL INSTANCE ───────────────────────────────────────────────────────────
memory = PersistentMemory()
