#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Monto AI — GPU Server Startup Script
# Starts: Ollama (LLM) + Whisper (STT) + Piper (TTS)
# Run this on your GPU machine
# ─────────────────────────────────────────────────────────────
set -e

# Load .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

GPU_SERVER_API_KEY=${GPU_SERVER_API_KEY:-"monto-secret-2024"}
WHISPER_MODEL=${WHISPER_MODEL:-"large-v3"}
WHISPER_PORT=${WHISPER_PORT:-5001}
PIPER_PORT=${PIPER_PORT:-5002}
NEPALI_TTS_PORT=${NEPALI_TTS_PORT:-5003}
PIPER_DEFAULT_VOICE=${PIPER_DEFAULT_VOICE:-"en_US-amy-medium"}
PIPER_VOICES_DIR=${PIPER_VOICES_DIR:-"./voices"}
LOCAL_LLM_MODEL=${LOCAL_LLM_MODEL:-"qwen3:8b"}

echo "================================================="
echo "  Monto AI — GPU Server"
echo "================================================="
echo "  LLM   : Ollama ($LOCAL_LLM_MODEL) on port 11434"
echo "  STT   : Whisper ($WHISPER_MODEL)  on port $WHISPER_PORT"
echo "  TTS   : Piper ($PIPER_DEFAULT_VOICE) on port $PIPER_PORT"
echo "  TTS-NE: gTTS Nepali on port $NEPALI_TTS_PORT"
echo "================================================="

# ── 1. OLLAMA ─────────────────────────────────────────────────
echo ""
echo "▶ Starting Ollama LLM server..."
if ! command -v ollama &> /dev/null; then
    echo "  Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

OLLAMA_HOST=0.0.0.0:11434 ollama serve &
OLLAMA_PID=$!
sleep 4

echo "  Pulling model $LOCAL_LLM_MODEL..."
ollama pull "$LOCAL_LLM_MODEL"
echo "  ✅ Ollama ready (pid $OLLAMA_PID)"

# ── 2. PIPER VOICE DOWNLOAD ───────────────────────────────────
echo ""
echo "▶ Setting up Piper TTS voices..."
pip install piper-tts -q

mkdir -p "$PIPER_VOICES_DIR"
if [ ! -f "$PIPER_VOICES_DIR/${PIPER_DEFAULT_VOICE}.onnx" ]; then
    echo "  Downloading voice: $PIPER_DEFAULT_VOICE..."
    python3 -m piper --download-dir "$PIPER_VOICES_DIR" "$PIPER_DEFAULT_VOICE"
    echo "  ✅ Voice downloaded"
else
    echo "  ✅ Voice already downloaded"
fi

# ── 3. WHISPER STT SERVER ─────────────────────────────────────
echo ""
echo "▶ Starting Whisper STT server on port $WHISPER_PORT..."
pip install faster-whisper flask -q

GPU_SERVER_API_KEY="$GPU_SERVER_API_KEY" \
WHISPER_MODEL="$WHISPER_MODEL" \
WHISPER_PORT="$WHISPER_PORT" \
python3 whisper_server.py &
WHISPER_PID=$!
sleep 3
echo "  ✅ Whisper ready (pid $WHISPER_PID)"

# ── 4. PIPER TTS SERVER ───────────────────────────────────────
echo ""
echo "▶ Starting Piper TTS server on port $PIPER_PORT..."
GPU_SERVER_API_KEY="$GPU_SERVER_API_KEY" \
PIPER_VOICES_DIR="$PIPER_VOICES_DIR" \
PIPER_DEFAULT_VOICE="$PIPER_DEFAULT_VOICE" \
PIPER_PORT="$PIPER_PORT" \
python3 piper_server.py &
PIPER_PID=$!
sleep 2
echo "  ✅ Piper ready (pid $PIPER_PID)"

# ── 5. NEPALI TTS SERVER ──────────────────────────────────────
echo ""
echo "▶ Starting Nepali TTS server (gTTS) on port $NEPALI_TTS_PORT..."
pip install gtts -q
GPU_SERVER_API_KEY="$GPU_SERVER_API_KEY" \
NEPALI_TTS_PORT="$NEPALI_TTS_PORT" \
python3 nepali_tts_server.py &
NEPALI_PID=$!
sleep 2
echo "  ✅ Nepali TTS ready (pid $NEPALI_PID)"

echo ""
echo "================================================="
echo "  ✅ All GPU services running!"
echo "  LLM   → http://$(hostname -I | awk '{print $1}'):11434"
echo "  STT   → http://$(hostname -I | awk '{print $1}'):$WHISPER_PORT"
echo "  TTS   → http://$(hostname -I | awk '{print $1}'):$PIPER_PORT"
echo ""
echo "  Set in backend/.env:"
echo "    USE_LOCAL_GPU=true"
echo "    GPU_SERVER_API_KEY=$GPU_SERVER_API_KEY"
echo "    GPU_OLLAMA_URL=http://$(hostname -I | awk '{print $1}'):11434"
echo "    GPU_WHISPER_URL=http://$(hostname -I | awk '{print $1}'):$WHISPER_PORT"
echo "    GPU_PIPER_URL=http://$(hostname -I | awk '{print $1}'):$PIPER_PORT"
echo "================================================="

# Keep script alive — kill all on Ctrl+C
trap "kill $OLLAMA_PID $WHISPER_PID $PIPER_PID 2>/dev/null; echo 'GPU server stopped'" EXIT
wait
