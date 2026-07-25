"""
Monto AI — Content Filter Service
Multi-layer kids safety filter.
Handles both English and Nepali content.
Custom words managed from admin panel (blocked_words.json).
"""
import re
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

BLOCKED_WORDS_FILE = Path(__file__).parent.parent / "blocked_words.json"


@dataclass
class FilterResult:
    is_safe:      bool
    category:     Optional[str]   # what was detected
    redirect_response: Optional[str]  # what Monto should say
    emotion:      str = "neutral"
    animation:    str = "talking"


# ── BAD WORD LISTS ────────────────────────────────────────────────────────────
# Unambiguous words only — no common benign-context words like "die"/"hurt"/
# "hate"/"fight"/"high", which false-positive on normal kid talk ("I died in
# Mario", "that hurt my feelings", "I hate broccoli", "high score") and cause
# Monto to derail into a scary/grown-up redirect instead of answering.
_BAD_WORDS_EN = [
    # Profanity
    r"\bf+u+c+k\b", r"\bs+h+i+t\b", r"\bb+i+t+c+h\b", r"\ba+s+s+h+o+l+e\b",
    r"\bd+a+m+n\b", r"\bc+r+a+p\b", r"\bh+e+l+l\b", r"\bw+t+f\b",
    r"\bs+t+f+u\b", r"\bb+a+s+t+a+r+d\b", r"\bc+u+n+t\b", r"\bd+i+c+k\b",
    r"\bp+e+n+i+s\b", r"\bv+a+g+i+n+a\b", r"\bt+i+t+s?\b", r"\bn+u+d+e\b",
    # Romanized Hindi/Nepali profanity (common in Nepali kids' typed/spoken input)
    r"\bc+h+u+t+i+y+a+\b", r"\bm+a+d+a+r+c+h+o+d\b", r"\bb+e+h+e+n+c+h+o+d\b",
    r"\bb+h+o+s+d+i+\w*\b", r"\br+a+n+d+i+\b", r"\bg+a+n+d+u+\b",
    r"\bl+a+u+d+a+\b", r"\bl+u+n+d+\b", r"\bharami\b", r"\bkamina+\b",
    # Violence — clearly violent/dangerous words only
    r"\bkill\b", r"\bmurder\b", r"\bstab\b", r"\bshoot\b", r"\bblood\b",
    r"\bgun\b", r"\bbomb\b", r"\bweapon\b", r"\bsuicide\b",
    # Adult content
    r"\bsex\b", r"\bporn\b", r"\bnaked\b", r"\bboobs?\b", r"\bcondom\b",
    r"\bdrug\b", r"\bweed\b", r"\bcocaine\b", r"\bdrunk\b",
    r"\balcohol\b", r"\bbeer\b", r"\bcigar\b",
    # Dangerous
    r"\bself.harm\b", r"\bcut myself\b",
]

# Ambiguous words that are only concerning in a threatening/self-harm phrase —
# checked as substrings against _CONTEXT_PHRASES below, never standalone.
_CONTEXT_PHRASES = {
    "violence": [
        "hate you", "want to hurt", "gonna hurt", "beat you up", "fight you",
        "kill you", "hurt someone", "hurt myself",
    ],
    "danger": [
        "want to die", "hate my life", "hurt myself", "nobody loves me",
        "kill myself", "end my life", "run away from home", "wish i was dead",
        "मर्न मन लाग्छ", "कसैले माया गर्दैन",
    ],
    "adult": [
        "get high", "getting high", "smoke weed",
    ],
}

# Nepali bad words (Devanagari)
_BAD_WORDS_NE = [
    "गाली", "भोग", "यौन", "नाङ्गो", "हत्या",
    "रक्त", "बम", "हतियार", "मदिरा", "लागूपदार्थ",
    "रंडी", "भोसडी", "चुत", "लौडा", "साला कुत्ता",
]

# Compiled patterns
_PATTERNS_EN = [re.compile(p, re.IGNORECASE) for p in _BAD_WORDS_EN]
_PATTERNS_NE = [re.compile(p) for p in _BAD_WORDS_NE]

# ── Custom words (admin-managed) ──────────────────────────────────────────────
_custom_patterns: list = []

def _load_custom_words():
    global _custom_patterns
    if not BLOCKED_WORDS_FILE.exists():
        _custom_patterns = []
        return
    try:
        data = json.loads(BLOCKED_WORDS_FILE.read_text(encoding="utf-8"))
        patterns = []
        for category, words in data.items():
            for word in words:
                w = word.strip()
                if w:
                    patterns.append((re.compile(rf"\b{re.escape(w)}\b", re.IGNORECASE), category))
        _custom_patterns = patterns
        logger.info(f"Content filter: loaded {len(patterns)} custom blocked words")
    except Exception as e:
        logger.warning(f"Could not load custom blocked words: {e}")
        _custom_patterns = []

def reload_custom_words():
    """Called by moderation route when words are added/removed."""
    _load_custom_words()

# Load on startup
_load_custom_words()


# ── REDIRECT RESPONSES ────────────────────────────────────────────────────────
# Warm, age-appropriate redirections — never harsh or scary

_REDIRECTS = {
    "profanity_en": [
        "Oops! We don't use those words here 😊 Let's talk about something fun instead! What's your favourite game?",
        "Hey, those aren't the kind of words Monto uses! Let's keep things friendly — what cool thing happened today?",
        "That word isn't a nice one! How about we talk about something awesome instead? 🌟",
    ],
    "profanity_ne": [
        "अरे! हामी यस्ता शब्द प्रयोग गर्दैनौं 😊 कुनै राम्रो कुरा गरौं! तपाईंको मनपर्ने खेल कुन हो?",
        "त्यस्तो शब्द राम्रो होइन! आउ, कुनै रमाइलो कुरा गरौं! 🌟",
    ],
    "violence_en": [
        "That sounds a bit scary — Monto wants to keep things safe and happy! 💛 Let's talk about something nice instead. What made you smile today?",
        "Monto doesn't like scary topics! Let's think of something cheerful. Did anything fun happen today? 😊",
    ],
    "violence_ne": [
        "त्यो थोडा डरलाग्दो लाग्छ! मन्टो खुसी र सुरक्षित कुरा मन पराउँछ 💛 आज के राम्रो भयो?",
    ],
    "adult_en": [
        "Hmm, that's not something Monto can help with! How about we talk about something more fun — like a cool story or a riddle? 😊",
        "That's a grown-up topic! Maybe ask a parent or teacher about that. I'm here to help with fun things! 🌟",
    ],
    "adult_ne": [
        "त्यो मन्टोले मद्दत गर्न नसक्ने विषय हो! कुनै मजाको कुरा गरौं — कहानी वा पहेली सुनाउँ? 😊",
    ],
    "danger_en": [
        "It sounds like something might be bothering you 💛 Please talk to a grown-up you trust — like your mum, dad, or a teacher. They love you and will help! I'm always here too. 🤗",
    ],
    "danger_ne": [
        "तपाईंलाई केही समस्या परेको जस्तो लाग्छ 💛 आफ्नो आमा, बुवा वा शिक्षकसँग कुरा गर्नुहोस्! उहाँहरू तपाईंलाई माया गर्नुहुन्छ। म पनि सधैं यहाँ छु 🤗",
    ],
}


def _get_redirect(category: str, is_nepali: bool = False) -> tuple:
    """Return (response_text, emotion, animation) for a category."""
    import random
    suffix = "_ne" if is_nepali else "_en"
    key    = category + suffix
    if key not in _REDIRECTS:
        key = category + "_en"
    options = _REDIRECTS.get(key, _REDIRECTS.get(category + "_en", ["Let's talk about something fun! 😊"]))
    text    = random.choice(options)

    if "scary" in category or "danger" in category or "violence" in category:
        return text, "sad", "sad"
    return text, "happy", "smile"


def _is_nepali(text: str) -> bool:
    return any('\u0900' <= ch <= '\u097F' for ch in text)


# ── CATEGORY DETECTION ────────────────────────────────────────────────────────

def _detect_category(text: str) -> Optional[str]:
    text_lower = text.lower()
    is_ne      = _is_nepali(text)

    # Check Nepali bad words
    if is_ne:
        for pat in _PATTERNS_NE:
            if pat.search(text):
                return "profanity"

    # Check English patterns
    for pat in _PATTERNS_EN:
        if pat.search(text_lower):
            matched = pat.pattern

            # Categorise
            if any(v in matched for v in ["kill", "murder", "stab", "shoot",
                                          "blood", "gun", "bomb", "weapon"]):
                return "violence"

            if any(v in matched for v in ["sex", "porn", "naked", "drug", "weed",
                                          "cocaine", "alcohol", "beer", "cigar",
                                          "boob", "condom", "drunk"]):
                return "adult"

            if any(v in matched for v in ["suicide", "self.harm", "cut myself"]):
                return "danger"

            return "profanity"

    # Context-based checks — ambiguous words (hurt/hate/fight/die/high, etc.)
    # only count when they appear in an actually threatening/self-harm phrase,
    # never standalone, so normal kid talk doesn't get derailed.
    for category, phrases in _CONTEXT_PHRASES.items():
        for phrase in phrases:
            if phrase in text_lower or phrase in text:
                return category

    return None


# ── PUBLIC API ────────────────────────────────────────────────────────────────

def check_content(text: str) -> FilterResult:
    """
    Check if text is safe for children.
    Returns FilterResult with is_safe=True if clean,
    or is_safe=False with a redirect response if not.
    """
    if not text or not text.strip():
        return FilterResult(is_safe=True, category=None, redirect_response=None)

    is_ne    = _is_nepali(text)
    category = _detect_category(text)

    if category is None:
        return FilterResult(is_safe=True, category=None, redirect_response=None)

    response, emotion, animation = _get_redirect(category, is_ne)

    logger.warning(f"Content filter blocked [{category}]: '{text[:60]}'")

    return FilterResult(
        is_safe=False,
        category=category,
        redirect_response=response,
        emotion=emotion,
        animation=animation,
    )


def sanitize_response(response_text: str) -> str:
    """
    Make sure LLM response itself doesn't contain anything harmful.
    (Extra safety layer on the output side)
    """
    result = check_content(response_text)
    if not result.is_safe:
        logger.warning("LLM response itself failed content filter — replacing")
        return "Let's talk about something fun and happy! 😊 What would you like to know?"
    return response_text
