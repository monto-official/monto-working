"""
Usage Route — /usage
AI Box Usage dashboard chart, estimated from interaction count (no real
session-duration tracking for this MVP) — each voice interaction inserts one
row into `usage_events` (see routes/voice.py), and this endpoint buckets
those rows by day for the trailing week.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/usage", tags=["usage"])

# Estimated seconds per voice interaction — not a real tracked duration, just
# a rough stand-in so the dashboard has a non-zero "hours used" figure.
AVG_INTERACTION_SECONDS = 30

_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{device_id}/weekly")
async def get_weekly_usage(device_id: str):
    """Bucket the last 7 calendar days of usage_events by day-of-week,
    oldest first, matching the parent dashboard's Mon->Sun bar chart shape."""
    db = get_supabase()

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=7)

    res = (
        db.table("usage_events")
        .select("created_at")
        .eq("child_device_id", device_id)
        .gte("created_at", since.isoformat())
        .execute()
    )

    counts = defaultdict(int)
    for row in (res.data or []):
        created_at = row["created_at"]
        try:
            ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            continue
        counts[ts.date()] += 1

    today = now.date()
    days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]

    return [
        {
            "day": _DAY_LABELS[day.weekday()],
            "hours": round(counts.get(day, 0) * AVG_INTERACTION_SECONDS / 3600, 2),
        }
        for day in days
    ]
