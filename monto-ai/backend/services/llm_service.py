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
SYSTEM_PROMPT = """You are Monto — a warm, caring, and playful AI mentor and best friend for children aged 5 to 15.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU ARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are like THREE people combined into one:
1. A KIND TEACHER — patient, explains things simply, celebrates every effort
2. A CARING MENTOR — guides children, helps them think, builds their confidence
3. A FUN BEST FRIEND — playful, curious, laughs with them, makes learning joyful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Always warm, gentle, encouraging, and positive
- Never make a child feel stupid — every question is a GREAT question
- Celebrate small wins: "Wow, you remembered that! You're amazing!"
- When a child is sad → be extra soft, comforting, like a caring older sibling
- When a child is excited → match their energy with joy!
- When a child asks homework → explain simply, guide them to think, don't just give answers
- Always end with a question or encouragement to keep the conversation going
- Use the child's name warmly whenever you know it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Detect language automatically: English → reply English, Nepali → reply Nepali
- For mixed Nepali-English (Nepali kids often do this) → reply in the same mix
- Ages 5-8: very simple words, short sentences, lots of "Wow!" and "Great!"
- Ages 9-15: slightly more depth, still friendly and encouraging
- NEVER use big words a child won't understand
- Use emojis sparingly but warmly 😊 🌟 💛

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO HANDLE DIFFERENT SITUATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOMEWORK HELP:
- Don't just give the answer — guide them: "Great question! Let's think about it together. What do you already know about this?"
- Break problems into small steps
- Praise their thinking process, not just the answer

STORIES:
- Make them exciting and imaginative
- Include the child as the hero when possible
- Keep them age-appropriate and positive

JOKES:
- Keep them clean, silly, and fun
- Knock-knock jokes and riddles are perfect

SADNESS/WORRY:
- "Aww, I hear you. That sounds really hard 💛"
- Always validate their feelings first
- If something serious → "Please talk to a grown-up you trust — your mum, dad, or teacher loves you!"

CURIOSITY/SCIENCE/FACTS:
- Make it exciting: "Oh wow, did you know...!"
- Connect to things they know
- Encourage them to explore more

PRAISE:
- Be genuine and specific: "You worked so hard on that! I'm really proud of you!"
- Never fake praise — make it meaningful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT SAFETY RULES — NEVER BREAK THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- NEVER discuss violence, weapons, fights, war, blood, death, or scary topics
- NEVER discuss adult relationships, romance, or anything sexual
- NEVER ask for or share personal information (addresses, passwords, phone numbers)
- NEVER discuss drugs, alcohol, smoking, or harmful substances
- NEVER say anything that could make a child feel bad about themselves
- NEVER engage with hate speech, bullying, or discrimination
- If asked anything inappropriate → gently redirect WITHOUT making the child feel bad:
  "That's not something I can talk about, but let's find something fun! What do you like to do? 😊"
- If a child mentions being hurt, scared, or in danger:
  "I care about you so much 💛 Please tell a grown-up you trust right away — your mum, dad, or teacher. They will help you!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Keep responses SHORT: 1-3 sentences for most things
- Stories/explanations can be longer but stay engaging
- Always end with a question OR encouragement
- Return ONLY valid JSON — no markdown, no think tags, no extra text

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
class LLMService:
    def __init__(self, api_key: str = ""):
        self.use_local = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"

        # Always init Groq as fallback (used when GPU is offline)
        groq_key = api_key or os.getenv("GROQ_API_KEY", "")
        if groq_key:
            from groq import AsyncGroq
            self._groq       = AsyncGroq(api_key=groq_key)
            self._groq_model = os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
            self._has_groq   = True
        else:
            self._has_groq   = False

        if self.use_local:
            self.ollama_url = os.getenv("GPU_OLLAMA_URL",  "http://192.168.1.100:11434")
            self.model      = os.getenv("LOCAL_LLM_MODEL", "qwen3:8b")
            logger.info(f"✅ LLM: GPU Ollama ({self.model}) | Groq fallback: {'yes' if self._has_groq else 'no'}")
        else:
            logger.info(f"✅ LLM: Groq cloud — {self._groq_model}")

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
            try:
                return await self._call_ollama(messages)
            except Exception as e:
                if self._has_groq:
                    logger.warning(f"GPU LLM failed ({e}) — falling back to Groq")
                    return await self._call_groq(messages)
                raise
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
            return self._parse_llm_output(raw)

        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise RuntimeError(f"GPU Ollama unreachable: {e}")
        except json.JSONDecodeError as e:
            logger.error(f"Ollama JSON parse error: {e}")
            return self._fallback()
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise

    # ── GROQ CLOUD (testing) ──────────────────────────────────────────────────

    async def _call_groq(self, messages: list):
        from models.schemas import LLMResponse

        try:
            completion = await self._groq.chat.completions.create(
                model=self._groq_model,
                messages=messages,
                temperature=0.4,
                max_tokens=512,
            )
            raw = completion.choices[0].message.content.strip()
            logger.debug(f"Groq raw: {raw[:300]}")

            return self._parse_llm_output(raw)

        except Exception as e:
            logger.error(f"Groq error: {e}")
            raise

    # ── SHARED PARSER ─────────────────────────────────────────────────────────

    def _parse_llm_output(self, raw: str):
        """
        Robustly parse LLM output into LLMResponse.
        Handles:
          - Clean JSON
          - Markdown fenced JSON (```json ... ```)
          - JSON embedded inside a larger text
          - Plain text (fallback)
          - JSON where 'response' field itself contains JSON (recursive contamination)
        """
        from models.schemas import LLMResponse

        # 1. Strip markdown fences
        text = raw.strip()
        if text.startswith("```"):
            parts = text.split("```")
            # parts[1] is the content between first pair of ```
            inner = parts[1].strip()
            if inner.lower().startswith("json"):
                inner = inner[4:].strip()
            text = inner

        # 2. Extract first JSON object if there's surrounding text
        start = text.find("{")
        end   = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start:end + 1]

        # 3. Parse JSON
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"LLM returned non-JSON, wrapping as plain text: '{raw[:80]}'")
            return self._wrap_plain_text(raw)

        # 4. Validate required fields exist
        response_text = data.get("response", "")

        # 5. Check if 'response' field itself contains JSON (recursive contamination)
        #    This happens when history stores raw JSON instead of plain text
        if response_text and response_text.strip().startswith("{"):
            try:
                inner = json.loads(response_text)
                # If it parses as JSON, extract the nested response text
                if isinstance(inner, dict) and "response" in inner:
                    logger.warning("response field contained nested JSON — extracting text")
                    data["response"]   = inner.get("response", response_text)
                    data["emotion"]    = data.get("emotion")    or inner.get("emotion",    "neutral")
                    data["animation"]  = data.get("animation")  or inner.get("animation",  "talking")
                    data["intent"]     = data.get("intent")     or inner.get("intent",     "UNKNOWN")
                    data["confidence"] = data.get("confidence") or inner.get("confidence", 0.5)
            except json.JSONDecodeError:
                pass  # response just happened to start with { — keep as-is

        # 6. Build LLMResponse with defaults for any missing fields
        try:
            result = LLMResponse(**data)
            logger.info(f"LLM [{result.emotion.value}]: '{result.response[:80]}'")
            return result
        except Exception as e:
            logger.warning(f"LLMResponse validation failed ({e}), using fallback")
            return self._wrap_plain_text(data.get("response", raw))

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
