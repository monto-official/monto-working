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
from services.groq_key_pool import GroqClientPool, is_retryable_groq_error, load_groq_keys

logger = logging.getLogger(__name__)

# ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
VOICE_ASSISTANT_POLICY = """You are a friendly, emotionally intelligent multilingual AI assistant for children.

LANGUAGE PRIORITY
- Nepali is always the default and highest-priority response language, regardless of the user's input language.
- Understand Nepali (Unicode and Romanized), English, Hindi (Unicode and Romanized), Bhojpuri, and mixed-language messages.
- Never reply in Hindi or Bhojpuri. If the user speaks Hindi or Bhojpuri, understand them and answer in natural Nepali.
- Reply in English only when the user explicitly asks for English; otherwise always reply in Nepali.
- Use natural, caring Nepali, not robotic or overly formal wording.
- ALWAYS address the user respectfully as "तपाईं" or "हजुर" in every Nepali response.
- NEVER address the user as "तँ", "तिमी", or "तिम्रो", and never use informal verb forms such as "छौ", "हौ", "गर", "पायौ", or "दियौ".
- Use respectful forms such as "तपाईं", "हजुर", "तपाईंको", "हुनुहुन्छ", "गर्नुहोस्", and "सक्नुहुन्छ" consistently, regardless of the user's age or wording.

OFFENSIVE CONTENT
- Detect profanity, vulgar or sexual language, insults, hate, harassment, threats, religious or caste insults, bullying, and discriminatory language across all supported languages, including obfuscation and mixed languages.
- Never repeat or generate the offensive wording.
- First occurrence: politely request respectful language and continue helping when possible.
- Repeated abuse: respond firmly but respectfully with a disappointed tone.
- If the user apologizes, respond warmly and continue.

EMOTION AND ELEVENLABS V3
- Analyze every message and choose its strongest emotion.
- The JSON `response` value MUST begin with exactly one suitable ElevenLabs v3 tag on its own line: [happy], [excited], [calm], [friendly], [empathetic], [reassuring], [serious], [disappointed], [concerned], [laughs], or [giggles].
- Never use a cheerful tag for sadness, anger, danger, fear, or serious subjects.
- Use [laughs] and [giggles] only for clearly playful, harmless conversation.
- Keep the separate JSON `emotion` field restricted to the allowed application values listed below; choose the closest equivalent.

Be kind, patient, helpful, child-safe, respectful, positive, and encouraging. Never generate hate, violence encouragement, discrimination, explicit adult content, bullying, or insults.
"""

SYSTEM_PROMPT = VOICE_ASSISTANT_POLICY + "\n\n" + """You are Monto — a warm, caring, and playful AI mentor and best friend for children aged 5 to 15.

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
- Understand the user's language automatically, but reply in Nepali by default
- For mixed-language input → reply in natural Nepali unless English is explicitly requested
- NEVER generate Hindi vocabulary or Hindi grammar. Use standard, natural Nepali wording only.
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
ACCURACY AND FOCUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Always directly address what the child actually said or asked FIRST, before anything else — never change the subject or ignore their question.
- If you don't know or aren't sure of a fact, say so honestly in simple words ("I'm not 100% sure, but I think...") instead of guessing or making something up.
- Never invent facts, numbers, names, or details and present them as true.
- Keep explanations simple, but make sure they are actually correct.

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
    def __init__(self, api_key: str = ""):
        self.use_local = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"

        # Key pool rotates immediately on quota/auth/server failures.
        self._groq_pool  = GroqClientPool(load_groq_keys(api_key))
        self._groq_model = os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
        self._fast_model = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
        self._reasoning_model = os.getenv("GROQ_REASONING_MODEL", "openai/gpt-oss-120b")
        self._nepali_model = os.getenv("GROQ_NEPALI_MODEL", "llama-3.3-70b-versatile")
        self._has_groq   = len(self._groq_pool) > 0
        logger.info("LLM: %d Groq key(s) available", len(self._groq_pool))
        if self.use_local:
            self.ollama_url = os.getenv("GPU_OLLAMA_URL",  "http://192.168.1.100:11434")
            self.model      = os.getenv("LOCAL_LLM_MODEL", "qwen3:8b")
            self._http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=3.0))
            logger.info(f"✅ LLM: GPU Ollama ({self.model}) | Groq fallback: {'yes' if self._has_groq else 'no'}")
        else:
            logger.info("✅ LLM: Groq routing — fast=%s | reasoning=%s | Nepali=%s", self._fast_model, self._reasoning_model, self._nepali_model)

    async def get_response(
        self,
        transcript:   str,
        history:      list = None,
        facts_prompt: str  = "",
        language:     str  = "english",
    ):
        from models.schemas import LLMResponse

        if not transcript.strip():
            if language == "nepali":
                reply = "सुनिएन! अलि जोरले बोलिदिनुस् 😊"
            else:
                reply = "I didn't catch that. Could you please say it again? 😊"
            return LLMResponse(
                intent="UNKNOWN",
                emotion="neutral",
                animation="blink",
                response=reply,
                confidence=0.1,
            )

        # Nepali is the default regardless of detected input language. The
        # model changes language only when the user explicitly requests it.
        lang_instruction = (
            "\n\n[The input is Nepali. Reply in natural, child-friendly Nepali using Devanagari script, "
            "even when the input transcript is Romanized Nepali. Never answer in Hindi or Bhojpuri. Always address the user as तपाईं or हजुर and use respectful verb forms; never use तँ, तिमी, तिम्रो, छौ, or हौ. Use English only when explicitly requested.]"
            if language == "nepali"
            else "\n\n[Reply in natural Nepali in Devanagari script, even if the input is Hindi, Bhojpuri, or mixed. Never reply in Hindi or Bhojpuri. Always address the user as तपाईं or हजुर and use respectful verb forms; never use तँ, तिमी, तिम्रो, छौ, or हौ. Use English only when explicitly requested.]"
        )
        system = SYSTEM_PROMPT + lang_instruction + facts_prompt
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
            selected_model = self._select_groq_model(transcript, language)
            logger.info("Groq route [%s] -> %s", language, selected_model)
            return await self._call_groq(messages, selected_model)

    def _select_groq_model(self, transcript: str, language: str) -> str:
        """Route voice turns by task while prioritizing natural Nepali."""
        text = transcript.lower().strip()
        complex_markers = (
            "किन", "कसरी", "व्याख्या", "सम्झाऊ", "गणित", "हिसाब", "समस्या",
            "homework", "explain", "why", "how", "calculate", "solve", "reason",
            "compare", "difference", "step by step", "because",
        )
        is_complex = len(text) > 180 or text.count("?") > 1 or any(marker in text for marker in complex_markers)
        if is_complex:
            return self._reasoning_model
        if language == "nepali":
            return self._nepali_model
        return self._fast_model

    # -- LOCAL GPU (Ollama) ────────────────────────────────────────────────────

    async def _call_ollama(self, messages: list):
        from models.schemas import LLMResponse

        payload = {
            "model":       self.model,
            "messages":    messages,
            "temperature": 0.4,
            "stream":      False,
            "format":      "json",  # forces JSON output
            "keep_alive":  "10m",
            "options":     {"num_predict": 256},
        }

        try:
            resp = await self._http.post(
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

    async def _call_groq(self, messages: list, selected_model: str | None = None):
        last_error: Exception | None = None
        requested = selected_model or self._groq_model
        models = list(dict.fromkeys((requested, self._nepali_model, self._fast_model)))
        for model in models:
            for key_index, client in self._groq_pool.candidates():
                try:
                    completion = await client.chat.completions.create(
                        model=model,
                        messages=messages,
                        temperature=0.35,
                        max_tokens=384,
                        response_format={"type": "json_object"},
                    )
                    self._groq_pool.mark_success(key_index)
                    raw = completion.choices[0].message.content.strip()
                    logger.info("Groq LLM [%s] succeeded with key slot %d", model, key_index + 1)
                    return self._parse_llm_output(raw)
                except Exception as error:
                    last_error = error
                    if not is_retryable_groq_error(error):
                        logger.warning("Groq model %s rejected request (%s); trying fallback", model, type(error).__name__)
                        break
                    self._groq_pool.mark_failed(key_index, error)
                    logger.warning("Groq LLM key slot %d unavailable (%s); trying next", key_index + 1, type(error).__name__)
        if last_error:
            raise last_error
        raise RuntimeError("No Groq LLM API key is configured")
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
