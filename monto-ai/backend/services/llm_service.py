"""
Monto AI — LLM Service
Two modes controlled by USE_LOCAL_GPU in .env:
  - LOCAL (production) : Ollama on GPU machine running qwen3:8b
  - GROQ  (testing)    : Groq cloud API running qwen3-32b

Renamed from groq_service.py → llm_service.py to reflect it now
supports both local and cloud backends cleanly.
"""
import json
import os
import logging
import httpx

logger = logging.getLogger(__name__)

# ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
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
- If asked anything inappropriate, gently redirect: "That's not something I can help with, but let's talk about something fun instead!"
- If a child seems sad, worried, or mentions something scary, respond warmly: "It sounds like you might need to talk to a grown-up you trust, like a parent or teacher. They love you and can help!"
- NEVER say anything that could lower a child's self-esteem.

RESPONSE STYLE:
- Keep responses SHORT — 1 to 3 sentences max for most answers.
- For stories or explanations, slightly longer is okay but stay engaging.
- End responses with a question or encouragement to keep the child engaged.
- Use child-friendly expressions: "Wow!", "That's so cool!", "Great question!", "You're amazing!"
- Use emojis sparingly to feel friendly.

EMOTION DETECTION (pick the emotion that matches YOUR response):
- happy    : good news, praise, fun facts, jokes
- excited  : something amazing or surprising
- thinking : answering homework, explaining something
- sad      : comforting a child
- surprised: child says something unexpected or impressive
- neutral  : calm informational replies

Return ONLY valid JSON. No markdown. No think tags. No extra text.

JSON structure (always exactly this):
{
  "intent": "",
  "emotion": "",
  "animation": "",
  "response": "",
  "confidence": 0.0
}

Allowed intents   : GENERAL_QUESTION, HOMEWORK, STORY, JOKE, GREETING, COMFORT, PRAISE, UNKNOWN
Allowed emotions  : happy, thinking, excited, sad, surprised, neutral
Allowed animations: smile, thinking, talking, excited, sad, blink"""


class LLMService:
    def __init__(self, api_key: str = ""):
        self.use_local = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"

        if self.use_local:
            self.ollama_url = os.getenv("GPU_OLLAMA_URL",  "http://192.168.1.100:11434")
            self.model      = os.getenv("LOCAL_LLM_MODEL", "qwen3:8b")
            self.api_key    = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
            logger.info(f"✅ LLM: LOCAL GPU → {self.ollama_url} | {self.model}")
        else:
            from groq import AsyncGroq
            self._groq  = AsyncGroq(api_key=api_key)
            # llama-3.3-70b-versatile supports json_object reliably on Groq
            # qwen3-32b does NOT support response_format on Groq (returns 400)
            self._model = os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
            logger.info(f"✅ LLM: Groq cloud — {self._model} (testing mode)")

    async def get_response(
        self,
        transcript:   str,
        history:      list = None,
        facts_prompt: str  = "",
    ):
        from models.schemas import LLMResponse

        if not transcript.strip():
            return LLMResponse(
                intent="UNKNOWN",
                emotion="neutral",
                animation="blink",
                response="I didn't catch that. Could you please say it again? 😊",
                confidence=0.1,
            )

        system   = SYSTEM_PROMPT + facts_prompt
        messages = [{"role": "system", "content": system}]
        messages += (history or [])
        messages.append({"role": "user", "content": transcript})

        if self.use_local:
            return await self._call_ollama(messages)
        else:
            return await self._call_groq(messages)

    # ── LOCAL GPU (Ollama) ────────────────────────────────────────────────────

    async def _call_ollama(self, messages: list):
        from models.schemas import LLMResponse

        payload = {
            "model":       self.model,
            "messages":    messages,
            "temperature": 0.4,
            "stream":      False,
            "format":      "json",  # forces JSON output
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.ollama_url}/api/chat",
                    headers={"Content-Type": "application/json"},
                    json=payload,
                )
                resp.raise_for_status()

            raw  = resp.json()["message"]["content"]
            data = json.loads(raw)
            logger.info(f"Ollama [{data.get('emotion')}]: '{data.get('response','')[:80]}'")
            return LLMResponse(**data)

        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot connect to Ollama at {self.ollama_url}. "
                "Is the GPU server running?"
            )
        except json.JSONDecodeError as e:
            logger.error(f"Ollama JSON parse error: {e}")
            return self._fallback()
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise

    # ── GROQ CLOUD (testing) ──────────────────────────────────────────────────

    async def _call_groq(self, messages: list):
        from models.schemas import LLMResponse

        # Append a strong reminder as the last user turn to force JSON output
        enforced = messages + [{
            "role": "user",
            "content": (
                "IMPORTANT: You MUST reply with ONLY a valid JSON object. "
                "No explanation, no markdown, no text before or after. "
                "Start your reply with { and end with }."
            )
        }] if messages[-1]["role"] != "user" else messages

        try:
            completion = await self._groq.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=0.4,
                max_tokens=512,
                # Note: response_format omitted — not all Groq models support it
            )
            raw = completion.choices[0].message.content.strip()
            logger.debug(f"Groq raw: {raw[:200]}")

            # Try to parse as JSON directly
            try:
                # Strip markdown code fences if present
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()

                data = json.loads(raw)
                logger.info(f"Groq [{data.get('emotion')}]: '{data.get('response','')[:80]}'")
                return LLMResponse(**data)

            except (json.JSONDecodeError, KeyError):
                # Model returned plain text — wrap it into a valid response
                logger.warning(f"Groq returned non-JSON, wrapping: '{raw[:80]}'")
                return self._wrap_plain_text(raw)

        except Exception as e:
            logger.error(f"Groq error: {e}")
            raise

    def _wrap_plain_text(self, text: str):
        """When model returns plain text instead of JSON, wrap it gracefully."""
        from models.schemas import LLMResponse
        # Best-guess emotion from keywords in the text
        text_lower = text.lower()
        if any(w in text_lower for w in ["wow", "amazing", "great", "fantastic", "yay"]):
            emotion, animation = "happy", "smile"
        elif any(w in text_lower for w in ["sorry", "sad", "hard", "difficult"]):
            emotion, animation = "sad", "sad"
        elif any(w in text_lower for w in ["hmm", "let me think", "interesting"]):
            emotion, animation = "thinking", "thinking"
        else:
            emotion, animation = "neutral", "talking"

        return LLMResponse(
            intent="GENERAL_QUESTION",
            emotion=emotion,
            animation=animation,
            response=text,
            confidence=0.7,
        )

    def _fallback(self):
        from models.schemas import LLMResponse
        return LLMResponse(
            intent="UNKNOWN",
            emotion="thinking",
            animation="thinking",
            response="Hmm, let me think about that again! 🤔",
            confidence=0.3,
        )
