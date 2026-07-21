"""
Emotion Service
Maps LLM emotion/animation output to frontend-ready state.
"""
from models.schemas import Emotion, Animation


EMOTION_TO_ANIMATION: dict[str, str] = {
    "happy": "smile",
    "thinking": "thinking",
    "excited": "excited",
    "sad": "sad",
    "surprised": "talking",
    "neutral": "blink",
}

EMOTION_COLORS: dict[str, str] = {
    "happy": "#FFD700",
    "thinking": "#4F46E5",
    "excited": "#F59E0B",
    "sad": "#6B7280",
    "surprised": "#EC4899",
    "neutral": "#4F46E5",
}


def resolve_animation(emotion: str, animation: str) -> str:
    """
    If animation is not provided or doesn't match, resolve from emotion.
    """
    valid_animations = {a.value for a in Animation}
    if animation in valid_animations:
        return animation
    return EMOTION_TO_ANIMATION.get(emotion, "blink")


def get_emotion_color(emotion: str) -> str:
    return EMOTION_COLORS.get(emotion, "#4F46E5")
