# Monto AI — Complete Project Documentation

> Child-safe voice AI companion with animated face display, persistent memory, and full offline GPU support.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Component Deep Dive](#4-component-deep-dive)
   - 4.1 [Backend (FastAPI)](#41-backend-fastapi)
   - 4.2 [Frontend (Next.js)](#42-frontend-nextjs)
   - 4.3 [GPU Server](#43-gpu-server)
   - 4.4 [Raspberry Pi](#44-raspberry-pi)
5. [Two Modes: Testing vs Production](#5-two-modes-testing-vs-production)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [API Endpoints](#7-api-endpoints)
8. [Persistent Memory System](#8-persistent-memory-system)
9. [Animated Face Display](#9-animated-face-display)
10. [Wake Word & Audio Flow](#10-wake-word--audio-flow)
11. [Setup Guide](#11-setup-guide)
    - 11.1 [Backend Setup](#111-backend-setup)
    - 11.2 [Frontend Setup](#112-frontend-setup)
    - 11.3 [GPU Server Setup](#113-gpu-server-setup)
    - 11.4 [Raspberry Pi Setup](#114-raspberry-pi-setup)
12. [Deployment: Auto-start on Boot](#12-deployment-auto-start-on-boot)
13. [Bugs Fixed During Development](#13-bugs-fixed-during-development)
14. [What Was Built — Session Summary](#14-what-was-built--session-summary)

---

## 1. Project Overview

Monto AI is a voice-activated AI companion designed specifically for children aged 5–15. It:

- Listens for the wake word **"Hey Monto"** via a Raspberry Pi
- Transcribes the child's speech (Whisper STT)
- Generates a warm, child-safe response (Qwen3 LLM)
- Speaks back using a friendly voice (Piper TTS)
- Shows **animated facial expressions** on a connected display (happy, sad, thinking, excited, etc.)
- **Remembers** the child's name, age, interests, and previous conversations — even after reboots

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     NETWORK (WiFi / LAN)                        │
└─────────────────────────────────────────────────────────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  Raspberry Pi   │  │  Backend Server │  │    GPU Machine       │
│                 │  │  (FastAPI)      │  │                      │
│  monto_listener │  │  port 8000      │  │  Whisper  port 5001  │
│  display/face   │  │                 │  │  Piper    port 5002  │
│  wake word      │  │  /voice/process │  │  Ollama   port 11434 │
│  mic + speaker  │  │  /voice/query   │  │  (qwen3:8b)          │
│                 │  │  /tts/speak     │  │                      │
│                 │  │  SQLite memory  │  │                      │
└────────┬────────┘  └────────┬────────┘  └──────────────────────┘
         │                    │
         │  "Hey Monto"       │
         │  audio (WAV) ─────▶│
         │                    │── STT ──▶ GPU Whisper (or Groq)
         │                    │── LLM ──▶ GPU Ollama  (or Groq)
         │                    │── TTS ──▶ GPU Piper   (or ElevenLabs)
         │◀── JSON + audio ───│
         │  show face         │
         │  play audio        │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  Web Browser    │  │  SQLite DB      │
│  (Next.js)      │  │  monto_memory   │
│  session memory │  │  .db            │
└─────────────────┘  └─────────────────┘
```

---

## 3. Folder Structure

```
monto-ai/
│
├── backend/                    ← FastAPI server (your PC / server)
│   ├── main.py                 ← app startup, service init
│   ├── routes/
│   │   ├── voice.py            ← /voice/query, /voice/process, /voice/memory
│   │   └── tts.py              ← /tts/speak
│   ├── services/
│   │   ├── stt_service.py      ← Whisper STT (GPU or Groq)
│   │   ├── llm_service.py      ← LLM (Ollama or Groq)
│   │   ├── tts_service.py      ← TTS (Piper or ElevenLabs)
│   │   ├── memory_service.py   ← SQLite persistent memory
│   │   └── emotion_service.py  ← emotion → animation mapping
│   ├── models/
│   │   └── schemas.py          ← Pydantic models
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/                   ← Next.js web app (your PC / server)
│   ├── app/
│   ├── components/
│   ├── hooks/
│   │   ├── useConversation.ts  ← chat history + session ID
│   │   ├── useAudioRecorder.ts
│   │   └── useTTS.ts
│   ├── lib/
│   │   ├── api.ts              ← API calls + session ID management
│   │   └── utils.ts
│   └── types/
│
├── gpu_server/                 ← Runs on your GPU machine
│   ├── whisper_server.py       ← faster-whisper STT (port 5001)
│   ├── piper_server.py         ← Piper TTS (port 5002)
│   ├── start_gpu_server.sh     ← starts all 3 services
│   ├── requirements.txt
│   └── .env.example
│
└── raspberry_pi/               ← Runs on Raspberry Pi
    ├── monto_listener.py       ← wake word + audio pipeline
    ├── display/
    │   ├── face.py             ← animated face (Pygame)
    │   └── __init__.py
    ├── setup.sh                ← one-time install
    ├── install_service.sh      ← register auto-start on boot
    ├── monto.service           ← systemd service definition
    ├── requirements.txt
    └── .env.example
```

---

## 4. Component Deep Dive

### 4.1 Backend (FastAPI)

**`main.py`**
- Loads `.env` first, then initialises all three services
- In `USE_LOCAL_GPU=false` mode: validates Groq API key
- In `USE_LOCAL_GPU=true` mode: skips cloud key check
- Exposes `/health` and `/` endpoints
- CORS configured from `ALLOWED_ORIGINS` env var

**`services/stt_service.py`**
- `STTService.transcribe(audio_bytes, filename)` → `str`
- Local mode: POSTs audio to `GPU_WHISPER_URL/v1/audio/transcriptions`
- Cloud mode: uses Groq Whisper Large V3
- Auto-detects MIME type from filename (`.wav` → `audio/wav`, else `audio/webm`)

**`services/llm_service.py`** *(renamed from groq_service.py)*
- `LLMService.get_response(transcript, history, facts_prompt)` → `LLMResponse`
- Local mode: calls Ollama `/api/chat` with `qwen3:8b`
- Cloud mode: calls Groq API with `qwen/qwen3-32b`
- Forces JSON output via `format: "json"` (Ollama) / `response_format` (Groq)
- Injects child facts into system prompt on every call

**`services/tts_service.py`**
- `TTSService.synthesize(text, voice, emotion, language)` → `bytes`
- Local mode: POSTs to `GPU_PIPER_URL/v1/tts/synthesize` → returns WAV
- Cloud mode: uses ElevenLabs Turbo v2.5 → returns MP3
- Emotion-aware: each emotion maps to different speed/expressiveness settings
- Adds `"... "` prefix for `sad`/`thinking` for a more natural pause

**`services/memory_service.py`**
- `PersistentMemory` backed by SQLite (`monto_memory.db`)
- Two layers:
  - **Recent context**: last 20 messages sent to LLM every turn
  - **Long-term facts**: child name, age, grade, interests — injected into system prompt forever
- Auto-extracts facts from conversation using regex (no extra LLM call)
- Thread-safe with `threading.Lock()`
- DB path read at `__init__` time (after `load_dotenv()` runs)

**`services/emotion_service.py`**
- Maps `emotion` → `animation` string
- Falls back to emotion-based default if LLM returns invalid animation

**`models/schemas.py`**
- `Intent` enum: `GENERAL_QUESTION, HOMEWORK, STORY, JOKE, GREETING, COMFORT, PRAISE, UNKNOWN`
- `Emotion` enum: `happy, thinking, excited, sad, surprised, neutral`
- `Animation` enum: `smile, thinking, talking, excited, sad, blink`
- `LLMResponse`, `VoiceQueryResponse`, `HealthResponse`

---

### 4.2 Frontend (Next.js)

**`lib/api.ts`**
- `getSessionId()` — generates a unique stable session ID per browser, stored in `localStorage`
- `sendVoiceQuery(audioBlob)` — sends audio + `X-Session-Id` header to `/voice/query`
- `clearMemory()` — calls `DELETE /voice/memory/{sessionId}`

**`hooks/useConversation.ts`**
- Stores chat history in `localStorage` for UI display
- `clearHistory()` — clears both `localStorage` and backend SQLite memory

---

### 4.3 GPU Server

Three separate servers on the GPU machine:

#### `whisper_server.py` — port 5001
- Loads `faster-whisper` model on CUDA
- `POST /v1/audio/transcriptions` — accepts audio file, returns `{"text": "...", "language": "en"}`
- `GET /health` — status check
- API key auth via `Authorization: Bearer` header
- VAD filter enabled (skips silence automatically)
- Configurable model size via `WHISPER_MODEL` env var (tiny → large-v3)

#### `piper_server.py` — port 5002
- Runs Piper TTS via subprocess
- `POST /v1/tts/synthesize` — accepts JSON `{text, voice, emotion}`, returns WAV audio
- `GET /voices` — lists downloaded voice models
- `GET /health` — status check
- Emotion-aware speed/expressiveness via `length_scale` and `noise_scale`
- Voices stored in `./voices/` directory as `.onnx` files

#### Ollama — port 11434
- Managed by Ollama directly
- Serves `qwen3:8b`
- Backend calls `/api/chat` directly — no wrapper needed

#### `start_gpu_server.sh`
- Installs Ollama if missing
- Pulls `qwen3:8b` model
- Downloads Piper voice if missing
- Starts all 3 services in background
- Prints connection URLs at the end
- Handles `Ctrl+C` to stop all processes cleanly

---

### 4.4 Raspberry Pi

**`monto_listener.py`**

Full pipeline:
1. `wait_for_backend()` — retries up to 20× every 3s on boot
2. Shows "Connecting to Monto..." on face display while waiting
3. Initialises Porcupine wake word engine
4. Listens for "Hey Monto" continuously
5. On detection:
   - Face → `excited`
   - Records audio for `RECORD_SECONDS` seconds
   - Face → `listening`
   - Sends audio to `/voice/process` with `X-Session-Id` header
   - Face → `thinking`
   - Receives `{emotion, animation, response}` JSON
   - Face → matching emotion + response text displayed
   - Calls `/tts/speak` → receives WAV/MP3 → plays it
   - After 1.5s → face back to `idle`

**`display/face.py`**

High-quality Pygame face renderer:
- 60 FPS, hardware-accelerated double buffer
- Gradient background, anti-aliased drawing via `pygame.gfxdraw`
- Radial glow effects per emotion
- Smooth floating animation (sine wave)
- 7 emotion states with distinct visuals:

| Emotion | Visual Details |
|---------|----------------|
| `idle` | Gentle float, blink every ~3s |
| `happy` | Big smile with teeth, rosy cheeks, glow |
| `excited` | Bouncing, sparkle stars, wide eyes |
| `sad` | Droopy eyes, frown, animated teardrop |
| `thinking` | One squinted eye, floating thought bubbles |
| `surprised` | Giant eyes, raised brows, O-mouth, jolt up |
| `listening` | Pulsing mouth, expanding sound rings |

- Response text rendered in a semi-transparent rounded box at bottom
- Emotion label + emoji shown top-left
- `set_emotion(emotion, text)` is thread-safe (called from listener thread, renders on main thread)

---

## 5. Two Modes: Testing vs Production

| | Testing (default) | Production |
|---|---|---|
| `.env` setting | `USE_LOCAL_GPU=false` | `USE_LOCAL_GPU=true` |
| STT | Groq Whisper Large V3 (cloud) | faster-whisper on your GPU |
| LLM | Groq qwen3-32b (cloud) | Ollama qwen3:8b on your GPU |
| TTS | ElevenLabs Turbo (cloud, MP3) | Piper TTS on your GPU (WAV) |
| Cost | API credits used | Completely free after setup |
| Privacy | Audio sent to cloud | All local, nothing leaves network |
| Internet | Required | Not required |
| Setup | Just add API keys | Run `start_gpu_server.sh` |

**Switch is instant** — just change one line in `backend/.env`:
```
USE_LOCAL_GPU=true
```

---

## 6. Environment Variables Reference

### `backend/.env`

```env
# Mode
USE_LOCAL_GPU=false                    # true = GPU server, false = cloud APIs

# Cloud APIs (testing mode)
GROQ_API_KEY=your_groq_api_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# GPU Server (production mode)
GPU_SERVER_API_KEY=monto-secret-2024   # must match gpu_server/.env
GPU_WHISPER_URL=http://192.168.1.100:5001
GPU_OLLAMA_URL=http://192.168.1.100:11434
GPU_PIPER_URL=http://192.168.1.100:5002
LOCAL_LLM_MODEL=qwen3:8b
PIPER_DEFAULT_VOICE=en_US-amy-medium

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Memory
MEMORY_DB_PATH=monto_memory.db
```

### `gpu_server/.env`

```env
GPU_SERVER_API_KEY=monto-secret-2024   # must match backend/.env
WHISPER_MODEL=large-v3                 # tiny/base/small/medium/large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE=float16
WHISPER_PORT=5001
PIPER_DEFAULT_VOICE=en_US-amy-medium
PIPER_VOICES_DIR=./voices
PIPER_PORT=5002
LOCAL_LLM_MODEL=qwen3:8b
```

### `raspberry_pi/.env`

```env
BACKEND_URL=http://192.168.1.101:8000  # IP of backend machine
PORCUPINE_KEY=your_picovoice_key       # free from picovoice.ai
RECORD_SECONDS=5
FULLSCREEN=false                        # true for TV/monitor
SESSION_ID=pi-device-1                 # unique per Pi device
```

---

## 7. API Endpoints

### Voice

| Method | Endpoint | Used by | Description |
|--------|----------|---------|-------------|
| `POST` | `/voice/query` | Web frontend | Audio → JSON response |
| `POST` | `/voice/process` | Raspberry Pi | Audio → JSON response (includes session memory) |
| `GET` | `/voice/memory` | Admin | List all sessions |
| `GET` | `/voice/memory/{id}` | Admin | Session stats + known facts |
| `DELETE` | `/voice/memory/{id}` | Frontend/Admin | Clear session memory |

**Headers for both POST endpoints:**
```
X-Session-Id: your-session-id    ← ties request to persistent memory
```

**Response JSON (`/voice/query` and `/voice/process`):**
```json
{
  "transcript": "My name is Aarav",
  "intent":     "GREETING",
  "emotion":    "happy",
  "animation":  "smile",
  "response":   "Hi Aarav! Great to meet you! 😊",
  "confidence": 0.95
}
```

### TTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tts/speak` | Text → audio bytes (WAV or MP3) |

**Request body:**
```json
{
  "text":     "Hello Aarav!",
  "voice":    "monto",
  "emotion":  "happy",
  "language": "english"
}
```

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Backend health check |
| `GET` | `/` | Status + mode info |

### GPU Server Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `http://gpu:5001/health` | Whisper status |
| `GET` | `http://gpu:5002/health` | Piper status |
| `GET` | `http://gpu:11434/api/tags` | Ollama model list |

---

## 8. Persistent Memory System

### Architecture

```
Conversation turn
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  PersistentMemory (SQLite)                           │
│                                                      │
│  messages table:                                     │
│    session_id | role | content | timestamp           │
│                                                      │
│  session_facts table:                                │
│    session_id | facts_json | updated_at              │
└──────────────────────────────────────────────────────┘
       │                    │
       ▼                    ▼
  Recent context       Long-term facts
  (last 20 msgs)       (name, age, grade,
  sent to LLM          interests)
  every turn           injected into
                       system prompt
```

### Automatic Fact Extraction

Facts are extracted from user messages using regex — no extra LLM call needed:

| Child says | Fact stored |
|------------|-------------|
| "My name is Aarav" | `name: "Aarav"` |
| "I'm 10 years old" | `age: 10` |
| "I'm in class 5" | `grade: "5"` |
| "I love cricket" | `interests: ["cricket"]` |

### Facts Injected Into System Prompt

```
WHAT YOU KNOW ABOUT THIS CHILD (remember this always):
- The child's name is Aarav. Always use their name warmly.
- They are 10 years old.
- They are in grade/class 5.
- Their interests include: cricket, drawing, space.
- Last time they talked about: I got full marks in science test
```

### Session IDs

| Source | Session ID | Behaviour |
|--------|-----------|-----------|
| Web browser | Auto-generated, stored in `localStorage` | Persists across page refreshes |
| Raspberry Pi | Set in `raspberry_pi/.env` as `SESSION_ID` | Persists across reboots |
| Shared | Same `SESSION_ID` on both | Pi and web share the same memory |

---

## 9. Animated Face Display

### Emotion → Visual Mapping

| Backend returns | Face shows |
|-----------------|------------|
| `idle` | Gentle floating, periodic blink |
| `listening` | Pulsing mouth, sound wave rings |
| `thinking` | Squinted eye, floating thought bubbles |
| `happy` | Big smile with teeth, rosy cheeks, glow |
| `excited` | Bouncing body, sparkle stars, wide eyes |
| `sad` | Droopy eyes, frown, animated teardrop |
| `surprised` | Giant eyes, raised brows, O-mouth |
| `neutral` | Calm face |

### Face Render Flow

```
Pi boots
  → idle face (blinking, floating)
  ↓ "Hey Monto" detected
  → excited face
  ↓ recording
  → listening face (sound rings)
  ↓ waiting for response
  → thinking face (thought bubbles)
  ↓ response received
  → emotion face + response text shown
  ↓ TTS plays + 1.5s
  → back to idle
```

### Display Resolution

Default: `480×480` (Pi touchscreen)
Set `FULLSCREEN=true` in `.env` for TV/monitor full-screen mode.

---

## 10. Wake Word & Audio Flow

### Wake Word Detection

Uses **Picovoice Porcupine** (free tier available):
- Default keyword: `"hey google"` (for testing)
- Production: replace with custom `"hey_monto_raspberry-pi.ppn` keyword file
- Get free access key: https://picovoice.ai/
- Sensitivity: `0.7` (adjust higher = more sensitive, more false positives)

### Full Audio Flow

```
1. Mic stream open (16kHz, mono, 512 sample frames)
2. Porcupine processes each frame
3. Wake word detected → mic stream stopped
4. New mic stream opens (1024 frames)
5. Records for RECORD_SECONDS (default 5)
6. WAV bytes assembled in memory (no disk write)
7. POST to backend /voice/process
8. Backend: STT → transcript
9. Backend: LLM → JSON response
10. Backend: stores in SQLite memory
11. Pi receives JSON → updates face display
12. Pi POSTs response text to /tts/speak
13. Backend: TTS → audio bytes
14. Pi saves to temp file → playsound() → delete
15. Pi back to wake word detection
```

---

## 11. Setup Guide

### 11.1 Backend Setup

```bash
cd monto-ai/backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env — add GROQ_API_KEY for testing, or set USE_LOCAL_GPU=true

# Run
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 11.2 Frontend Setup

```bash
cd monto-ai/frontend

npm install

# Configure
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# Opens at http://localhost:3000
```

### 11.3 GPU Server Setup

```bash
cd monto-ai/gpu_server

# Configure
cp .env.example .env
# Set GPU_SERVER_API_KEY (must match backend .env)
# Set WHISPER_MODEL size based on your VRAM

# Run everything (Ollama + Whisper + Piper)
bash start_gpu_server.sh
```

**VRAM requirements:**

| Component | Model | Min VRAM |
|-----------|-------|----------|
| LLM | qwen3:8b | 6 GB |
| STT | whisper large-v3 | 10 GB |
| STT | whisper medium | 5 GB |
| STT | whisper small | 2 GB |
| TTS | Piper (CPU) | 0 GB |

### 11.4 Raspberry Pi Setup

```bash
# On the Raspberry Pi:
cd monto-ai/raspberry_pi

# Install system + Python deps
bash setup.sh

# Configure
cp .env.example .env
nano .env
# Set:
#   BACKEND_URL=http://<backend-machine-ip>:8000
#   PORCUPINE_KEY=<your free key from picovoice.ai>
#   SESSION_ID=<child name or device name>

# Test it manually first
source venv/bin/activate
python monto_listener.py

# Once working — enable auto-start on boot
bash install_service.sh
```

---

## 12. Deployment: Auto-start on Boot

The Pi uses **systemd** to start Monto automatically on every boot.

**`monto.service`** (installed to `/etc/systemd/system/`):
```ini
[Unit]
Description=Monto AI Wake Word Listener
After=network.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/monto-ai/raspberry_pi
EnvironmentFile=/home/pi/monto-ai/raspberry_pi/.env
ExecStart=/home/pi/monto-ai/raspberry_pi/venv/bin/python monto_listener.py
Restart=always
RestartSec=5
```

**Commands:**
```bash
sudo systemctl status monto       # check status
sudo journalctl -u monto -f       # live logs
sudo systemctl restart monto      # restart
sudo systemctl stop monto         # stop
sudo systemctl disable monto      # disable auto-start
```

**Boot sequence:**
```
Pi powers on
  → systemd starts monto.service
  → face.py shows "Connecting to Monto..."
  → wait_for_backend() retries every 3s (up to 20 attempts)
  → backend responds → ✅
  → "Hey Monto" listening begins
```

---

## 13. Bugs Fixed During Development

| # | Bug | Impact | Fix |
|---|-----|--------|-----|
| 1 | Backend crashed when `USE_LOCAL_GPU=true` but no Groq key set | Couldn't use local GPU mode | Skip key check when local mode enabled |
| 2 | TTS route passed `voice=emotion` — mapped "happy" in VOICE_MAP where it didn't exist | Always used fallback female voice | Pass `voice` and `emotion` as separate params |
| 3 | `STTService(api_key=None)` crashed Groq SDK init | Startup crash in local mode | Pass `api_key or ""` |
| 4 | `MEMORY_DB_PATH` read at import time before `load_dotenv()` | Env variable always ignored | Read lazily in `__init__` |
| 5 | Pi deleted temp MP3 before `playsound()` finished | Audio cut off randomly | Delete in `finally` block after playback |
| 6 | Whisper server hardcoded `.webm` suffix | Failed to read `.wav` from Pi | Detect suffix from actual filename |
| 7 | LLM service named `groq_service.py` — misleading when using local GPU | Confusion | Renamed to `llm_service.py` |
| 8 | `gpu_server/` buried inside `backend/` | Not standalone for GPU machine | Moved to top-level `gpu_server/` |
| 9 | No conversation history — Monto forgot everything | "I don't know your name" even after being told | Added per-session message history sent to LLM |
| 10 | Memory only in RAM | Lost on every restart | Migrated to SQLite persistent DB |
| 11 | Pi had no startup retry | Crashed silently if backend not ready | `wait_for_backend()` with face display |
| 12 | Pi always used `.mp3` temp file | Broke when local GPU returns `.wav` | Auto-detect from `Content-Type` header |

---

## 14. What Was Built — Session Summary

### Phase 1 — Basic Running
- Identified two apps: root TanStack/Vite app and `monto-ai/` with Next.js frontend + FastAPI backend
- Started frontend (`npm run dev` → port 3000) and backend (`uvicorn` → port 8000)
- Fixed backend dependency issue: `pydantic-core 2.9.2` needed Rust compilation, switched to `pydantic>=2.10.0` to use prebuilt wheels for Python 3.14

### Phase 2 — GPU & Raspberry Pi Architecture
- Designed full deployment architecture: Pi → Backend → GPU server
- Built `whisper_server.py` — self-hosted Whisper STT with Flask
- Updated `stt_service.py` and `groq_service.py` to support `USE_LOCAL_GPU=true` mode
- Created `raspberry_pi/` folder with `monto_listener.py` — wake word + audio pipeline
- Added `monto.service` systemd config for auto-start on boot
- Created `setup.sh` and `install_service.sh` for one-command Pi setup

### Phase 3 — Display & Animations
- Built `display/face.py` — Pygame animated face with 7 emotions
- V1: basic circles and arcs
- V2: full quality upgrade — anti-aliased drawing, glow effects, gradient background, 60fps

### Phase 4 — Kid-Safe AI Personality
- Rewrote system prompt with defined personality: warm, encouraging, child-safe
- Added strict safety rules (redirect violent/adult topics, tell child to talk to trusted adult if in trouble)
- Added `COMFORT` and `PRAISE` intents
- Made TTS emotion-aware: sad responses use slower, calmer voice; excited uses energetic voice

### Phase 5 — Persistent Memory
- Problem: Monto forgot everything every restart and even between messages
- Built `memory_service.py` with two layers:
  - Recent context (last 20 messages → LLM context window)
  - Long-term facts (name, age, grade, interests → injected into system prompt)
- Automatic fact extraction from conversation (regex, no LLM overhead)
- Migrated from in-RAM dict to SQLite database
- Added `X-Session-Id` header to all requests (web + Pi) for per-device memory
- Web: session ID stored in `localStorage`, persists across refreshes
- Pi: session ID set in `.env`, persists across reboots

### Phase 6 — Full GPU Stack
- Added `piper_server.py` — local TTS using Piper (free, offline, fast)
- Renamed `groq_service.py` → `llm_service.py` (cleaner naming)
- Updated LLM to use `qwen3:8b` via Ollama (production) vs `qwen3-32b` (Groq testing)
- Moved `gpu_server/` to top-level folder (separate from backend)
- Updated `start_gpu_server.sh` to start all 3 services: Ollama + Whisper + Piper
- Backend TTS returns WAV (local) or MP3 (cloud), Pi auto-detects from `Content-Type`
- Full `.env.example` files for all 4 components

### Final State

Everything is controlled by a single env variable:

```
USE_LOCAL_GPU=false   ← testing with Groq + ElevenLabs (cloud APIs)
USE_LOCAL_GPU=true    ← production with Whisper + qwen3:8b + Piper (fully offline)
```

The Raspberry Pi:
1. Powers on
2. Auto-starts Monto via systemd
3. Shows animated face while connecting
4. Listens for "Hey Monto"
5. Responds with correct emotion face + voice
6. Remembers the child forever

---

*Documentation generated from development session — Monto AI v2.0*
