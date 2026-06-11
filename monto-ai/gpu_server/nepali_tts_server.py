"""
Monto AI — Nepali TTS Server
Uses gTTS for Nepali language support.
Falls back to Piper for English.

Port: 5003
"""
import os
import io
import functools
import logging
from flask import Flask, request, jsonify, send_file
from gtts import gTTS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app     = Flask(__name__)
API_KEY = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")


def require_key(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


@app.route("/v1/tts/nepali", methods=["POST"])
@require_key
def nepali_tts():
    """
    Request body: { "text": "...", "slow": false }
    Returns: MP3 audio
    """
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    slow = data.get("slow", False)

    if not text:
        return jsonify({"error": "text required"}), 400

    try:
        tts = gTTS(text=text, lang="ne", slow=slow)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        logger.info(f"Nepali TTS: '{text[:60]}'")
        return send_file(buf, mimetype="audio/mpeg",
                         download_name="monto_nepali.mp3")
    except Exception as e:
        logger.error(f"Nepali TTS error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok", "engine": "gTTS", "language": "ne"})


if __name__ == "__main__":
    port = int(os.getenv("NEPALI_TTS_PORT", 5003))
    logger.info(f"Nepali TTS server on port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)
