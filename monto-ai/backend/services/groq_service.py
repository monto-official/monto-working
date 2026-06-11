"""
LLM Service
Supports two modes:
  - LOCAL: calls Ollama on your GPU machine (OpenAI-compatible API)
  - GROQ:  calls Groq cloud API (default fallback)
Set USE_LOCAL_GPU=true in .env to switch to local mode.
"""
import json
import os
import logging
import httpx
from groq import AsyncGroq
from models.schemas import LLMResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Monto — a warm, playful, and caring AI best friend for children aged 5 to 15.

YOUR PERSONALITY:
- You speak like a kind, patient older sibling or a favourite teacher.
- You are always gentle, encouraging, and positive.
- You use simple words that young children can understand easily.
- You celebrate every effort a child makes, even small ones ("Wow, great try!", "You're doing so well!").
- You never make a child feel stupid or bad for asking any question.
- You are curious, fun, and a little playful — use light humour that kids enjoy.
- You show genuine care: ask follow-up questions, remember what they said in the conversation.
- When a child is sad, be extra warm and comforting like a caring friend.
- When a child is excited or proud, match their energy with joy.

LANGUAGE RULES:
- Detect the language the child is speaking (English or Nepali) and always reply in the same language.
- Use short, simple sentences. No complex vocabulary.
- Avoid sarcasm, irony, idioms that young kids won't understand.
- For ages 5-8: use very simple words, short sentences, lots of encouragement.
- For ages 9-15: slightly more depth is okay but still warm and friendly.

SAFETY RULES (STRICT — never break these):
- NEVER discuss violence, weapons, war, blood, death, or scary topics.
- NEVER discuss adult relationships, romance, or anything sexual.
- NEVER share personal information requests (addresses, phone numbers, passwords).
- NEVER discuss drugs, alcohol, or harmful substances.
- If asked anything inappropriate, gently redirect: "That's not something I can help with, but let's talk about something fun instead! 😊"
- If a child seems sad, worried, or mentions something scary happening to them, respond with warmth and say "It sounds like you might need to talk to a grown-up you trust, like a parent or teacher. They love you and can help!"
- NEVER say anything that could lower a child's self-esteem.

RESPONSE STYLE:
- Keep responses SHORT — 1 to 3 sentences max for most answers.
- For stories or explanations, slightly longer is okay but stay engaging.
- End responses with a question or encouragement to keep the child engaged.
- Use child-friendly expressions: "Wow!", "That's so cool!", "Great question!", "You're amazing!"
- Use emojis sparingly in the response text to make it feel friendly 🌟

EMOTION DETECTION:
- Detect what emotion best matches your response (not the child's emotion).
- happy: when sharing good news, praise, fun facts, jokes
- excited: when something amazing or surprising is being shared
- thinking: when answering homework, explaining something
- sad: when comforting a child
- surprised: when the child says something unexpected or impressive
- neutral: calm informational replies

Return ONLY valid JSON. No markdown. No extra text. No think tags.

Always return this exact JSON structure:
{
  "intent": "",
  "emotion": "",
  "animation": "",
  "response": "",
  "confidence": 0.0
}

Allowed intents: GENERAL_QUESTION, HOMEWORK, STORY, JOKE, GREETING, COMFORT, PRAISE, UNKNOWN
Allowed emotions: happy, thinking, excited, sad, surprised, neutral
Allowed animations: smile, thinking, talking, excited, sad, blink"""


class GroqService:
    def __init__(self, api_key: str):
        self.use_local = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"

        if self.use_local:
            self.ollama_url = os.getenv("GPU_OLLAMA_URL", "http://192.168.1.100:11434")
            self.local_model = os.getenv("LOCAL_LLM_MODEL", "qwen2.5:7b")
            self.local_key = os.getenv("GPU_SERVER_API_KEY", "my-secret-key-123")
            logger.info(f"LLM: LOCAL GPU mode → {self.ollama_url} | model: {self.local_model}")
        else:
            self.client = AsyncGroq(api_key=api_key)
            self.model = "qwen/qwen3-32b"
            logger.info("LLM: Groq cloud mode")

    async def get_response(self, transcript: str, history: list = None,
                           facts_prompt: str = "") -> LLMResponse:
        if not transcript.strip():
            return LLMResponse(
                intent="UNKNOWN",
                emotion="neutral",
                animation="blink",
                response="I didn't catch that. Could you please say it again? 😊",
                confidence=0.1,
            )

        # Inject known facts about the child into the system prompt
        system = SYSTEM_PROMPT + facts_prompt

        if self.use_local:
            return await self._get_response_local(transcript, history or [], system)
        else:
            return await self._get_response_groq(transcript, history or [], system)

    async def _get_response_local(self, transcript: str, history: list, system: str) -> LLMResponse:
        """Call Ollama on GPU machine (OpenAI-compatible endpoint)."""
        messages = [{"role": "system", "content": system}]
        messages += history
        messages.append({"role": "user", "content": transcript})

        payload = {
            "model":       self.local_model,
            "messages":    messages,
            "temperature": 0.4,
            "stream":      False,
            "format":      "json",
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/chat",
                    headers={
                        "Authorization": f"Bearer {self.local_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                raw = response.json()["message"]["content"]
                logger.info(f"Local LLM raw response: {raw}")
                data = json.loads(raw)
                return LLMResponse(**data)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            return self._fallback_response()
        except Exception as e:
            logger.error(f"Local LLM error: {e}")
            raise

    async def _get_response_groq(self, transcript: str, history: list, system: str) -> LLMResponse:
        """Call Groq cloud API with full conversation history."""
        messages = [{"role": "system", "content": system}]
        messages += history
        messages.append({"role": "user", "content": transcript})

        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.4,
                response_format={"type": "json_object"},
                max_tokens=512,
            )

            raw = completion.choices[0].message.content
            logger.info(f"Groq LLM raw response: {raw}")
            data = json.loads(raw)
            return LLMResponse(**data)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e} | raw: {raw}")
            return self._fallback_response()
        except Exception as e:
            logger.error(f"Groq LLM error: {e}")
            raise

    def _fallback_response(self) -> LLMResponse:
        return LLMResponse(
            intent="UNKNOWN",
            emotion="thinking",
            animation="thinking",
            response="Hmm, let me think about that again!",
            confidence=0.3,
        )
