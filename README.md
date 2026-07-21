# Monto AI

Child-safe voice AI companion — warm, playful, and always remembers your name.

## Project Structure

```
monto-ai/
│
├── backend/          ← FastAPI server (runs on your laptop/server)
│   ├── main.py
│   ├── routes/
│   ├── services/
│   ├── models/
│   └── .env.example
│
├── frontend/         ← Next.js web app (runs on your laptop/server)
│   ├── app/
│   ├── components/
│   └── .env.example
│
├── gpu_server/       ← Whisper STT + Ollama LLM (runs on GPU machine)
│   ├── whisper_server.py
│   ├── start_gpu_server.sh
│   └── .env.example
│
└── raspberry_pi/     ← Wake word listener + face display (runs on Pi)
    ├── monto_listener.py
    ├── display/
    │   └── face.py
    ├── setup.sh
    └── .env.example
```

## What runs where

| Folder          | Runs on            | Purpose                              |
|-----------------|--------------------|--------------------------------------|
| `backend/`      | Your PC / server   | API — STT, LLM, TTS, memory          |
| `frontend/`     | Your PC / server   | Web chat interface                   |
| `gpu_server/`   | GPU machine        | Local Whisper + Ollama (optional)    |
| `raspberry_pi/` | Raspberry Pi       | Wake word + animated face display    |

## Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env   # fill in your API keys
python -m venv venv
venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev            # opens on http://localhost:3000
```

### 3. GPU Server (optional — skip to use Groq cloud)
```bash
cd gpu_server
bash start_gpu_server.sh
# Then set USE_LOCAL_GPU=true in backend/.env
```

### 4. Raspberry Pi
```bash
cd raspberry_pi
bash setup.sh          # one-time install
nano .env              # set BACKEND_URL + PORCUPINE_KEY
bash install_service.sh # auto-start on boot
```

## Modes

| Mode | STT | LLM | TTS |
|------|-----|-----|-----|
| Cloud (default) | Groq Whisper | Groq Qwen3-32B | ElevenLabs |
| Local GPU | Your Whisper server | Your Ollama | ElevenLabs |

Switch by setting `USE_LOCAL_GPU=true` in `backend/.env`.
