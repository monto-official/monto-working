"""
Monto AI — GPU Server: Piper TTS
Runs on your GPU machine.
Converts text to speech using Piper (fast, local, no API key).

Endpoint: POST /v1/tts/synthesize   → returns WAV audio bytes
          GET  /health
          GET  /voices              → list available voices

Setup:
    pip install piper-tts
    # Download voice model:
    python -m piper --download-dir ./voices en_US-lessac-medium
    # Or for a child-friendly voice:
    python -m piper --download-dir ./voices en_US-amy-medium
"""
import os
import io
import logging
import subprocess
import tempfile
import functools
from flask import Flask, request, jsonify, send_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

app         = Flask(__name__)
API_KEY     = os.getenv("GPU_SERVER_API_KEY",  "monto-secret-2024")
VOICES_DIR  = os.getenv("PIPER_VOICES_DIR",   "./voices")
DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE", "en_US-amy-medium")

# ── EMOTION → PIPER SETTINGS ─────────────────────────────────────────────────
# Piper uses --length-scale (speed) and --noise-scale (expressiveness)
# length_scale: >1 = slower, <1 = faster
# noise_scale:  higher = more varied/expressive
EMOTION_PARAMS = {
    "happy":     {"length_scale": 0.95, "noise_scale": 0.667, "noise_w": 0.8},
    "excited":   {"length_scale": 0.88, "noise_scale": 0.8,   "noise_w": 0.9},
    "sad":       {"length_scale": 1.15, "noise_scale": 0.5,   "noise_w": 0.6},
    "thinking":  {"length_scale": 1.05, "noise_scale": 0.55,  "noise_w": 0.7},
    "surprised": {"length_scale": 0.90, "noise_scale": 0.75,  "noise_w": 0.85},
    "neutral":   {"length_scale": 1.00, "noise_scale": 0.667, "noise_w": 0.8},
}


# ── AUTH ──────────────────────────────────────────────────────────────────────
def require_key(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


def get_voice_model_path(voice_name: str) -> str:
    """Find the .onnx model file for a voice."""
    path = os.path.join(VOICES_DIR, f"{voice_name}.onnx")
    if os.path.exists(path):
        return path
    # Try default
    fallback = os.path.join(VOICES_DIR, f"{DEFAULT_VOICE}.onnx")
    if os.path.exists(fallback):
        logger.warning(f"Voice '{voice_name}' not found, using default '{DEFAULT_VOICE}'")
        return fallback
    raise FileNotFoundError(
        f"Voice model not found: {path}\n"
        f"Download with: python -m piper --download-dir {VOICES_DIR} {voice_name}"
    )


# ── ROUTES ────────────────────────────────────────────────────────────────────
@app.route("/v1/tts/synthesize", methods=["POST"])
@require_key
def synthesize():
    """
    Request body (JSON):
      text    : str   — text to speak
      voice   : str   — voice name e.g. "en_US-amy-medium" (optional)
      emotion : str   — happy/sad/excited/thinking/surprised/neutral (optional)
      language: str   — language hint (optional, for future multi-lang support)

    Returns: WAV audio bytes (audio/wav)
    """
    data    = request.get_json(force=True, silent=True) or {}
    text    = data.get("text", "").strip()
    voice   = data.get("voice",   DEFAULT_VOICE)
    emotion = data.get("emotion", "neutral")

    if not text:
        return jsonify({"error": "text is required"}), 400

    if len(text) > 1000:
        return jsonify({"error": "text too long (max 1000 chars)"}), 400

    try:
        model_path = get_voice_model_path(voice)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    params = EMOTION_PARAMS.get(emotion, EMOTION_PARAMS["neutral"])

    # Write text to a temp file — piper reads from stdin or file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_tmp:
        out_path = out_tmp.name

    try:
        # Piper CLI: echo "text" | piper --model voice.onnx --output_file out.wav
        cmd = [
            "piper",
            "--model",        model_path,
            "--output_file",  out_path,
            "--length_scale", str(params["length_scale"]),
            "--noise_scale",  str(params["noise_scale"]),
            "--noise_w",      str(params["noise_w"]),
        ]

        result = subprocess.run(
            cmd,
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )

        if result.returncode != 0:
            err = result.stderr.decode("utf-8", errors="replace")
            logger.error(f"Piper error: {err}")
            return jsonify({"error": f"Piper failed: {err}"}), 500

        with open(out_path, "rb") as f:
            wav_bytes = f.read()

        logger.info(f"TTS [{emotion}] {len(wav_bytes)} bytes: '{text[:60]}'")
        return send_file(
            io.BytesIO(wav_bytes),
            mimetype="audio/wav",
            as_attachment=False,
            download_name="monto_speech.wav",
        )

    except subprocess.TimeoutExpired:
        return jsonify({"error": "TTS timed out"}), 504
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass


@app.route("/voices")
@require_key
def list_voices():
    """List all downloaded voice models."""
    voices = []
    if os.path.isdir(VOICES_DIR):
        for f in os.listdir(VOICES_DIR):
            if f.endswith(".onnx"):
                voices.append(f.replace(".onnx", ""))
    return jsonify({"voices": voices, "default": DEFAULT_VOICE})


@app.route("/health")
def health():
    return jsonify({
        "status":        "ok",
        "default_voice": DEFAULT_VOICE,
        "voices_dir":    VOICES_DIR,
    })


if __name__ == "__main__":
    port = int(os.getenv("PIPER_PORT", 5002))
    logger.info(f"Piper TTS server starting on port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)
