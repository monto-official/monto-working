"""Moderation Route — manage custom blocked words from admin panel"""
import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/moderation", tags=["moderation"])

WORDS_FILE = Path(__file__).parent.parent / "blocked_words.json"
VALID_CATEGORIES = {"profanity", "violence", "adult", "danger", "custom"}
DEFAULT_WORDS = {"profanity": [], "violence": [], "adult": [], "danger": [], "custom": []}

def _load() -> dict:
    if not WORDS_FILE.exists():
        _save(DEFAULT_WORDS)
        return DEFAULT_WORDS.copy()
    try:
        data = json.loads(WORDS_FILE.read_text(encoding="utf-8"))
        for cat in VALID_CATEGORIES:
            if cat not in data:
                data[cat] = []
        return data
    except Exception:
        return DEFAULT_WORDS.copy()

def _save(data: dict) -> None:
    WORDS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

class AddWordPayload(BaseModel):
    word: str
    category: str = "custom"

class TestPhrasePayload(BaseModel):
    text: str

@router.get("/words")
async def get_words():
    data = _load()
    return {"words": data, "total": sum(len(v) for v in data.values()), "categories": list(VALID_CATEGORIES)}

@router.post("/words")
async def add_word(payload: AddWordPayload):
    word = payload.word.strip().lower()
    category = payload.category.strip().lower()
    if not word or len(word) < 2:
        raise HTTPException(status_code=400, detail="Word must be at least 2 characters")
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}")
    data = _load()
    for cat, words in data.items():
        if word in [w.lower() for w in words]:
            raise HTTPException(status_code=409, detail=f"Word '{word}' already exists in category '{cat}'")
    data[category].append(word)
    _save(data)
    _reload_filter()
    logger.info(f"Moderation: added '{word}' to '{category}'")
    return {"status": "added", "word": word, "category": category}

@router.delete("/words/{category}/{word}")
async def remove_word(category: str, word: str):
    category = category.strip().lower()
    word = word.strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    data = _load()
    if word not in [w.lower() for w in data[category]]:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not found in '{category}'")
    data[category] = [w for w in data[category] if w.lower() != word]
    _save(data)
    _reload_filter()
    logger.info(f"Moderation: removed '{word}' from '{category}'")
    return {"status": "removed", "word": word, "category": category}

@router.post("/test")
async def test_phrase(payload: TestPhrasePayload):
    from services.content_filter import check_content
    result = check_content(payload.text)
    return {"text": payload.text, "is_safe": result.is_safe, "category": result.category, "redirect_response": result.redirect_response, "emotion": result.emotion}

@router.get("/categories")
async def get_categories():
    return {"categories": [
        {"id": "profanity",  "label": "Profanity",         "color": "red",    "desc": "Swear words and offensive language"},
        {"id": "violence",   "label": "Violence",           "color": "orange", "desc": "Violent words and harmful actions"},
        {"id": "adult",      "label": "Adult Content",      "color": "purple", "desc": "Sexual or drug-related content"},
        {"id": "danger",     "label": "Danger / Self-harm", "color": "yellow", "desc": "Self-harm or dangerous activities"},
        {"id": "custom",     "label": "Custom",             "color": "blue",   "desc": "Your own custom blocked words"},
    ]}

def _reload_filter():
    try:
        from services.content_filter import reload_custom_words
        reload_custom_words()
    except Exception as e:
        logger.warning(f"Could not reload filter: {e}")
