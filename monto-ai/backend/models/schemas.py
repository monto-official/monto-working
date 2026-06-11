from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Intent(str, Enum):
    GENERAL_QUESTION = "GENERAL_QUESTION"
    HOMEWORK         = "HOMEWORK"
    STORY            = "STORY"
    JOKE             = "JOKE"
    GREETING         = "GREETING"
    COMFORT          = "COMFORT"
    PRAISE           = "PRAISE"
    UNKNOWN          = "UNKNOWN"


class Emotion(str, Enum):
    HAPPY = "happy"
    THINKING = "thinking"
    EXCITED = "excited"
    SAD = "sad"
    SURPRISED = "surprised"
    NEUTRAL = "neutral"


class Animation(str, Enum):
    SMILE = "smile"
    THINKING = "thinking"
    TALKING = "talking"
    EXCITED = "excited"
    SAD = "sad"
    BLINK = "blink"


class LLMResponse(BaseModel):
    intent: Intent = Field(default=Intent.UNKNOWN)
    emotion: Emotion = Field(default=Emotion.NEUTRAL)
    animation: Animation = Field(default=Animation.TALKING)
    response: str = Field(default="")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class VoiceQueryResponse(BaseModel):
    transcript: str
    intent: str
    emotion: str
    animation: str
    response: str
    confidence: float


class HealthResponse(BaseModel):
    status: str
    version: str
