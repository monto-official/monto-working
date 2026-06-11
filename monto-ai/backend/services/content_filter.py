"""
Monto AI — Content Filter Service
Multi-layer kids safety filter:
  Layer 1: Fast keyword/pattern check (no LLM needed)
  Layer 2: Context analysis for subtle harmful content
  Layer 3: Graceful redirection responses

Handles both English and Nepali content.
"""
import re
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class FilterResult:
    is_safe:      bool
    category:     Optional[str]   # what was detected
    redirect_response: Optional[str]  # what Monto should say
    emotion:      str = "neutral"
    animation:    str = "talking"


# ── BAD WORD LISTS ────────────────────────────────────────────────────────────
# English bad words / inappropriate content patterns
_BAD_WORDS_EN = [
    # Profanity
    r"\bf+u+c+k\b", r"\bs+h+i+t\b", r"\bb+i+t+c+h\b", r"\ba+s+s+h+o+l+e\b",
    r"\bd+a+m+n\b", r"\bc+r+a+p\b", r"\bh+e+l+l\b", r"\bw+t+f\b",
    r"\bs+t+f+u\b", r"\bb+a+s+t+a+r+d\b", r"\bc+u+n+t\b", r"\bd+i+c+k\b",
    r"\bp+e+n+i+s\b", r"\bv+a+g+i+n+a\b", r"\bt+i+t+s?\b", r"\bn+u+d+e\b",
    # Violence
    r"\bkill\b", r"\bmurder\b", r"\bstab\b", r"\bshoot\b", r"\bblood\b",
    r"\bgun\b", r"\bbomb\b", r"\bweapon\b", r"\bsuicide\b", r"\bdie\b",
    r"\bdead\b", r"\bhate\b", r"\bfight\b", r"\bhurt\b",
    # Adult content
    r"\bsex\b", r"\bporn\b", r"\bnaked\b", r"\bboobs?\b", r"\bcondom\b",
    r"\bdrug\b", r"\bweed\b", r"\bcocaine\b", r"\bhigh\b", r"\bdrunk\b",
    r"\balcohol\b", r"\bbeer\b", r"\bcigar\b",
    # Dangerous
    r"\bsuicide\b", r"\bself.harm\b", r"\bcut myself\b", r"\brun away\b",
    r"\bsteal\b", r"\bcheat\b", r"\bhack\b",
]

# Nepali bad words (Devanagari)
_BAD_WORDS_NE = [
    "मर", "गाली", "भोग", "यौन", "नाङ्गो", "हत्या", "मार",
    "रक्त", "बम", "हतियार", "मदिरा", "लागूपदार्थ",
]

# Compiled patterns
_PATTERNS_EN = [re.compile(p, re.IGNORECASE) for p in _BAD_WORDS_EN]
_PATTERNS_NE = [re.compile(p) for p in _BAD_WORDS_NE]


# ── REDIRECT RESPONSES ────────────────────────────────────────────────────────
# Warm, age-appropriate redirections — never harsh or scary

_REDIRECTS = {
    "profanity_en": [
        "Oops! We don't use those words here 😊 Let's talk about something fun instead! What's your favourite game?",
        "Hey, those aren't the kind of words Monto uses! Let's keep things friendly — what cool thing happened today?",
        "That word isn't a nice one! How about we talk about something awesome instead? 🌟",
    ],
    "profanity_ne": [
        "अरे! हामी यस्ता शब्द प्रयोग गर्दैनौं 😊 कुनै राम्रो कुरा गरौं! तिम्रो मनपर्ने खेल के हो?",
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
        "तिमीलाई केही परेको जस्तो लाग्छ 💛 आफ्नो आमा, बुवा वा शिक्षकसँग कुरा गर! उहाँहरू तिमीलाई माया गर्नुहुन्छ। म पनि सधैं यहाँ छु 🤗",
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
                                          "blood", "gun", "bomb", "weapon",
                                          "dead", "die", "fight", "hurt", "hate"]):
                return "violence"

            if any(v in matched for v in ["sex", "porn", "naked", "drug", "weed",
                                          "cocaine", "alcohol", "beer", "cigar",
                                          "boob", "condom", "high", "drunk"]):
                return "adult"

            if any(v in matched for v in ["suicide", "self.harm", "cut myself",
                                          "run away", "steal", "cheat", "hack"]):
                return "danger"

            return "profanity"

    # Context-based checks (no bad words but still concerning)
    danger_phrases = [
        "want to die", "hate my life", "hurt myself", "nobody loves me",
        "kill myself", "end my life", "run away from home",
        "मर्न मन लाग्छ", "कसैले माया गर्दैन",
    ]
    for phrase in danger_phrases:
        if phrase in text_lower or phrase in text:
            return "danger"

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
