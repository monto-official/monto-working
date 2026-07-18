"""
Persistent Conversation Memory Service
---------------------------------------
Stores all conversations in Supabase (Postgres) so Monto remembers
everything even after server restarts or Pi reboots — and so memory is
shared across every machine hitting the same Supabase project, not just
whichever disk the SQLite file happened to live on.

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
import re
import json
import logging
from typing import List

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

MAX_RECENT_MESSAGES = 20
# MAX_STORED_MESSAGES pruning to 500 per session is enforced by a DB trigger
# (see backend/supabase/schema.sql) rather than in application code.


class PersistentMemory:
    def __init__(self):
        logger.info("✅ Persistent memory ready → Supabase (memory_messages)")

    # ── PUBLIC API ────────────────────────────────────────────────────────────

    def get_history(self, session_id: str) -> List[dict]:
        """
        Returns the last MAX_RECENT_MESSAGES messages for this session.
        Used as context window sent to the LLM.
        """
        db = get_supabase()
        res = (
            db.table("memory_messages")
            .select("role, content")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(MAX_RECENT_MESSAGES)
            .execute()
        )
        rows = res.data or []
        # Reverse to chronological order
        return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

    def add_turn(self, session_id: str, user_text: str, assistant_text: str):
        """Save one user + assistant exchange to the database.
        assistant_text must be plain readable text — never raw JSON.
        """
        # Guard: if assistant_text is JSON, extract the response field
        clean_text = self._ensure_plain_text(assistant_text)

        db = get_supabase()
        db.table("memory_messages").insert([
            {"session_id": session_id, "role": "user", "content": user_text},
            {"session_id": session_id, "role": "assistant", "content": clean_text},
        ]).execute()

        # Extract and save any new facts (name, age, etc.)
        self._extract_facts(session_id, user_text, assistant_text)

        logger.debug(f"Memory [{session_id}]: turn saved")

    def get_facts(self, session_id: str) -> dict:
        """Return known facts about the child for this session."""
        db = get_supabase()
        res = (
            db.table("session_facts")
            .select("facts")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]["facts"] or {}
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
        db = get_supabase()
        db.table("memory_messages").delete().eq("session_id", session_id).execute()
        db.table("session_facts").delete().eq("session_id", session_id).execute()
        logger.info(f"Memory [{session_id}]: cleared")

    def get_all_sessions(self) -> List[str]:
        """List all session IDs that have stored messages."""
        db = get_supabase()
        res = db.table("memory_messages").select("session_id").execute()
        return sorted({r["session_id"] for r in (res.data or [])})

    def get_session_summary(self, session_id: str) -> dict:
        """Stats about a session — useful for debugging."""
        db = get_supabase()
        count_res = (
            db.table("memory_messages")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )
        first_res = (
            db.table("memory_messages")
            .select("created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        last_res = (
            db.table("memory_messages")
            .select("created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return {
            "session_id":      session_id,
            "total_messages":  count_res.count or 0,
            "first_message":   first_res.data[0]["created_at"] if first_res.data else None,
            "last_message":    last_res.data[0]["created_at"] if last_res.data else None,
            "facts":           self.get_facts(session_id),
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
            db = get_supabase()
            db.table("session_facts").upsert({
                "session_id": session_id,
                "facts": facts,
            }).execute()


# ── GLOBAL INSTANCE ───────────────────────────────────────────────────────────
memory = PersistentMemory()
