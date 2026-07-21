#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  Monto AI — GPU Server Launcher
#  Starts: Ollama (LLM) + Whisper STT server + Piper TTS server + Nepali TTS
#
#  Usage:
#    bash start_gpu_server.sh
#
#  Requirements:
#    - Python 3.10+ with pip
#    - NVIDIA GPU with CUDA drivers
#    - piper binary in PATH (or set PIPER_BIN in .env)
#    - Ollama installed (auto-installs if missing)
# ══════════════════════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
[ -f .env ] && export $(grep -v '^#' .env | xargs)

# ── Config defaults ────────────────────────────────────────────────────────────
WHISPER_PORT="${WHISPER_PORT:-5001}"
PIPER_PORT="${PIPER_PORT:-5002}"
NEPALI_TTS_PORT="${NEPALI_TTS_PORT:-5003}"
LOCAL_LLM_MODEL="${LOCAL_LLM_MODEL:-qwen3:8b}"
PIPER_DEFAULT_VOICE="${PIPER_DEFAULT_VOICE:-en_US-amy-medium}"
VOICES_DIR="${PIPER_VOICES_DIR:-./voices}"

PIDS=()

cleanup() {
    echo ""
    echo "🛑 Stopping Monto GPU servers..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    echo "✅ All stopped."
}
trap cleanup EXIT INT TERM

# ── Python venv ────────────────────────────────────────────────────────────────
if [ ! -d "venv" ]; then
    echo "📦 Creating Python venv..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "📦 Installing Python dependencies..."
pip install -q -r requirements.txt

# ── Ollama ─────────────────────────────────────────────────────────────────────
echo ""
echo "🔧 Checking Ollama..."
if ! command -v ollama &>/dev/null; then
    echo "📥 Ollama not found — installing..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

if ! pgrep -x "ollama" > /dev/null; then
    echo "🚀 Starting Ollama..."
    ollama serve &>/dev/null &
    PIDS+=($!)
    sleep 3
fi

echo "📥 Pulling model: $LOCAL_LLM_MODEL (may take a few minutes first time)..."
ollama pull "$LOCAL_LLM_MODEL"

echo "✅ Ollama ready — model: $LOCAL_LLM_MODEL (port 11434)"

# ── Piper voices ───────────────────────────────────────────────────────────────
mkdir -p "$VOICES_DIR"

VOICE_FILE="$VOICES_DIR/${PIPER_DEFAULT_VOICE}.onnx"
if [ ! -f "$VOICE_FILE" ]; then
    echo ""
    echo "📥 Downloading Piper voice: $PIPER_DEFAULT_VOICE..."
    VOICE_URL="https://github.com/rhasspy/piper/releases/download/v1.2.0/${PIPER_DEFAULT_VOICE}.onnx.tar.gz"
    VOICE_CONFIG_URL="https://github.com/rhasspy/piper/releases/download/v1.2.0/${PIPER_DEFAULT_VOICE}.onnx.json"

    curl -fsSL "$VOICE_URL" -o "/tmp/voice.tar.gz" || {
        echo "⚠️  Could not auto-download voice. Please download manually:"
        echo "    https://github.com/rhasspy/piper/releases"
        echo "    Place the .onnx file in: $VOICES_DIR/"
    }

    if [ -f "/tmp/voice.tar.gz" ]; then
        tar -xzf /tmp/voice.tar.gz -C "$VOICES_DIR/"
        curl -fsSL "$VOICE_CONFIG_URL" -o "$VOICES_DIR/${PIPER_DEFAULT_VOICE}.onnx.json" 2>/dev/null || true
        rm -f /tmp/voice.tar.gz
        echo "✅ Voice downloaded: $PIPER_DEFAULT_VOICE"
    fi
fi

# ── Check piper binary ─────────────────────────────────────────────────────────
PIPER_BIN="${PIPER_BIN:-piper}"
if ! command -v "$PIPER_BIN" &>/dev/null; then
    echo ""
    echo "⚠️  'piper' binary not found. Install from:"
    echo "    https://github.com/rhasspy/piper/releases"
    echo "    Then add it to PATH or set PIPER_BIN in .env"
    echo "    Piper TTS server will still start but synthesis will fail until piper is installed."
fi

# ── Start Whisper server ───────────────────────────────────────────────────────
echo ""
echo "🚀 Starting Whisper STT server on port $WHISPER_PORT..."
python whisper_server.py &
PIDS+=($!)
sleep 2

# ── Start Piper TTS server ─────────────────────────────────────────────────────
echo "🚀 Starting Piper TTS server on port $PIPER_PORT..."
python piper_server.py &
PIDS+=($!)
sleep 1

# ── Start Nepali TTS server ────────────────────────────────────────────────────
echo "🚀 Starting Nepali TTS server on port $NEPALI_TTS_PORT..."
python nepali_tts_server.py &
PIDS+=($!)
sleep 1

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo "✅ Monto GPU servers are running!"
echo ""
echo "  Ollama  (LLM)       → http://localhost:11434"
echo "  Whisper (STT)       → http://localhost:$WHISPER_PORT"
echo "  Piper   (TTS EN)    → http://localhost:$PIPER_PORT"
echo "  Nepali  (TTS NE)    → http://localhost:$NEPALI_TTS_PORT"
echo ""
echo "Set in backend/.env:"
echo "  USE_LOCAL_GPU=true"
echo "  GPU_OLLAMA_URL=http://$(hostname -I | awk '{print $1}'):11434"
echo "  GPU_WHISPER_URL=http://$(hostname -I | awk '{print $1}'):$WHISPER_PORT"
echo "  GPU_PIPER_URL=http://$(hostname -I | awk '{print $1}'):$PIPER_PORT"
echo "  GPU_NEPALI_TTS_URL=http://$(hostname -I | awk '{print $1}'):$NEPALI_TTS_PORT"
echo ""
echo "Press Ctrl+C to stop all servers."
echo "══════════════════════════════════════════════════"

# Wait for all background processes
wait
