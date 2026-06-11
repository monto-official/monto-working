"""
Monto AI — GPU Server: Whisper STT
Runs on your GPU machine.
Transcribes audio using faster-whisper.

Endpoint: POST /v1/audio/transcriptions
          GET  /health
"""
import os
import functools
import tempfile
import logging
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

app      = Flask(__name__)
API_KEY  = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
MODEL_SZ = os.getenv("WHISPER_MODEL",      "large-v3")
DEVICE   = os.getenv("WHISPER_DEVICE",     "cuda")   # "cuda" or "cpu"
COMPUTE  = os.getenv("WHISPER_COMPUTE",    "float16") # float16 / int8

logger.info(f"Loading Whisper {MODEL_SZ} on {DEVICE} ({COMPUTE})...")
model = WhisperModel(MODEL_SZ, device=DEVICE, compute_type=COMPUTE)
logger.info("✅ Whisper ready")


# ── AUTH ──────────────────────────────────────────────────────────────────────
def require_key(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


# ── ROUTES ────────────────────────────────────────────────────────────────────
@app.route("/v1/audio/transcriptions", methods=["POST"])
@require_key
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    audio_file = request.files["file"]
    language   = request.form.get("language", None)   # None = auto-detect
    filename   = audio_file.filename or "audio.wav"
    suffix     = os.path.splitext(filename)[-1] or ".wav"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,          # skip silence automatically
            vad_parameters={"min_silence_duration_ms": 300},
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        logger.info(f"STT [{info.language}]: '{text[:80]}'")
        return jsonify({
            "text":     text,
            "language": info.language,
        })
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_SZ, "device": DEVICE})


if __name__ == "__main__":
    port = int(os.getenv("WHISPER_PORT", 5001))
    logger.info(f"Whisper server starting on port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)
