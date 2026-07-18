"""Settings Route — read and update backend .env"""
import os
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])

ENV_PATH = Path(__file__).parent.parent / ".env"

SECRET_KEYS = {"GROQ_API_KEY","ELEVENLABS_API_KEY","GPU_SERVER_API_KEY","PARENT_SIP_PASSWORD","MONTO_SIP_PASSWORD","ASTERISK_AMI_SECRET"}
EDITABLE_KEYS = {"GROQ_API_KEY","GROQ_LLM_MODEL","WHISPER_LANGUAGE","ELEVENLABS_API_KEY","USE_LOCAL_GPU","GPU_WHISPER_URL","GPU_OLLAMA_URL","GPU_PIPER_URL","LOCAL_LLM_MODEL","PIPER_DEFAULT_VOICE","ALLOWED_ORIGINS","MEMORY_DB_PATH","SERVER_IP","TZ"}

def _read_env() -> dict:
    if not ENV_PATH.exists(): return {}
    result = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result

def _write_env(data: dict) -> None:
    if not ENV_PATH.exists():
        ENV_PATH.write_text("\n".join(f"{k}={v}" for k, v in data.items()) + "\n", encoding="utf-8")
        return
    original = ENV_PATH.read_text(encoding="utf-8").splitlines()
    updated, written = [], set()
    for line in original:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            updated.append(line); continue
        if "=" in stripped:
            key = stripped.partition("=")[0].strip()
            if key in data: updated.append(f"{key}={data[key]}"); written.add(key)
            else: updated.append(line)
        else: updated.append(line)
    for key, value in data.items():
        if key not in written: updated.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(updated) + "\n", encoding="utf-8")

def _mask(key: str, value: str) -> str:
    if key in SECRET_KEYS and value and value not in ("", "your_groq_api_key_here", "your_elevenlabs_api_key_here"):
        return value[:6] + "•" * max(0, len(value) - 6)
    return value

class SettingsPayload(BaseModel):
    GROQ_API_KEY: Optional[str] = None
    GROQ_LLM_MODEL: Optional[str] = None
    WHISPER_LANGUAGE: Optional[str] = None
    ELEVENLABS_API_KEY: Optional[str] = None
    USE_LOCAL_GPU: Optional[str] = None
    GPU_WHISPER_URL: Optional[str] = None
    GPU_OLLAMA_URL: Optional[str] = None
    GPU_PIPER_URL: Optional[str] = None
    LOCAL_LLM_MODEL: Optional[str] = None
    PIPER_DEFAULT_VOICE: Optional[str] = None
    ALLOWED_ORIGINS: Optional[str] = None
    MEMORY_DB_PATH: Optional[str] = None
    SERVER_IP: Optional[str] = None
    TZ: Optional[str] = None

@router.get("")
async def get_settings():
    env = _read_env()
    masked = {k: _mask(k, v) for k, v in env.items() if k in EDITABLE_KEYS}
    return {"settings": masked, "editable_keys": list(EDITABLE_KEYS), "env_path": str(ENV_PATH)}

@router.post("")
async def update_settings(payload: SettingsPayload):
    env = _read_env()
    updates = payload.model_dump(exclude_none=True)
    if not updates: raise HTTPException(status_code=400, detail="No settings provided")
    PLACEHOLDERS = {"your_groq_api_key_here", "your_elevenlabs_api_key_here", ""}
    for key, value in updates.items():
        if value not in PLACEHOLDERS:
            env[key] = value
            os.environ[key] = value
    _write_env(env)
    return {"status": "saved", "updated_keys": list(updates.keys()), "note": "Restart the backend to apply API key or mode changes."}
