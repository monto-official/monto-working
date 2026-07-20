"""Central app controls shared by admin, child app, and parent app."""
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

router = APIRouter(prefix="/controls", tags=["controls"])
STORE = Path(__file__).parent.parent / "app_controls.json"
LOCK = Lock()

class AppControls(BaseModel):
    maintenance_mode: bool = False
    ai_enabled: bool = True
    microphone_enabled: bool = True
    calls_enabled: bool = True
    explore_enabled: bool = True
    stories_enabled: bool = True
    songs_enabled: bool = True
    yoga_enabled: bool = True
    default_language: Literal["english", "nepali"] = "english"
    default_character: Literal["spiderman", "messi", "nani", "babu", "nepali"] = "spiderman"
    auto_speak: bool = True
    admin_notice: str = Field(default="", max_length=240)
    sync_interval_seconds: int = Field(default=10, ge=3, le=300)

class ControlDocument(BaseModel):
    revision: int = 1
    updated_at: str
    controls: AppControls

def _default() -> ControlDocument:
    return ControlDocument(updated_at=datetime.now(timezone.utc).isoformat(), controls=AppControls())

def _load() -> ControlDocument:
    if not STORE.exists():
        doc = _default()
        _save(doc)
        return doc
    try:
        return ControlDocument.model_validate_json(STORE.read_text(encoding="utf-8"))
    except Exception:
        return _default()

def _save(doc: ControlDocument) -> None:
    STORE.write_text(doc.model_dump_json(indent=2), encoding="utf-8")

@router.get("", response_model=ControlDocument)
async def get_controls():
    with LOCK:
        return _load()

@router.put("", response_model=ControlDocument)
async def update_controls(payload: AppControls):
    with LOCK:
        current = _load()
        updated = ControlDocument(
            revision=current.revision + 1,
            updated_at=datetime.now(timezone.utc).isoformat(),
            controls=payload,
        )
        _save(updated)
        return updated
