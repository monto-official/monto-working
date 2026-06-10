"""
Groq LLM Service
Sends transcripts to Qwen3-32B and parses structured JSON responses.
"""
import json
import logging
from groq import AsyncGroq
from models.schemas import LLMResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Monto AI. A child-safe AI companion for children aged 5 to 15.

RULES:
- Always return ONLY valid JSON. No markdown. No explanation. No think tags. No extra text.
- Use Nepali language if the user speaks Nepali.
- Use English language if the user speaks English.
- Keep answers short and easy to understand.
- Responses must be suitable for children aged 5 to 15.
- Never return adult content, violence, or inappropriate material.

You must detect the intent, emotion, animation, and provide a response.

Allowed intents: GENERAL_QUESTION, HOMEWORK, STORY, JOKE, GREETING, UNKNOWN
Allowed emotions: happy, thinking, excited, sad, surprised, neutral
Allowed animations: smile, thinking, talking, excited, sad, blink

Always return this exact JSON structure:
{
  "intent": "",
  "emotion": "",
  "animation": "",
  "response": "",
  "confidence": 0.0
}"""


class GroqService:
    def __init__(self, api_key: str):
        self.client = AsyncGroq(api_key=api_key)
        self.model = "qwen/qwen3-32b"

    async def get_response(self, transcript: str) -> LLMResponse:
        """
        Send transcript to Qwen3-32B via Groq and parse structured JSON response.
        """
        if not transcript.strip():
            return LLMResponse(
                intent="UNKNOWN",
                emotion="neutral",
                animation="blink",
                response="I didn't catch that. Could you please say it again?",
                confidence=0.1,
            )

        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": transcript},
                ],
                temperature=0.4,
                response_format={"type": "json_object"},
                max_tokens=512,
            )

            raw = completion.choices[0].message.content
            logger.info(f"LLM raw response: {raw}")

            data = json.loads(raw)
            return LLMResponse(**data)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e} | raw: {raw}")
            return self._fallback_response()
        except Exception as e:
            logger.error(f"LLM error: {e}")
            raise

    def _fallback_response(self) -> LLMResponse:
        return LLMResponse(
            intent="UNKNOWN",
            emotion="thinking",
            animation="thinking",
            response="Hmm, let me think about that again!",
            confidence=0.3,
        )
