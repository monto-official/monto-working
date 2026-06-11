"""
Monto AI — Nepali TTS Server
Uses Microsoft Edge TTS for high-quality Nepali voice (online).
Falls back to gTTS if edge-tts unavailable.

Port: 5003
Available Nepali voices:
  ne-NP-HemkalaNeural  (Female - recommended)
  ne-NP-SagarNeural    (Male)
"""
import os
import io
import asyncio
import functools
import logging
from flask import Flask, request, jsonify, send_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app     = Flask(__name__)
API_KEY = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
VOICE   = os.getenv("NEPALI_VOICE", "ne-NP-HemkalaNeural")  # Female child-friendly


def require_key(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


async def _edge_tts(text: str, voice: str) -> bytes:
    import edge_tts
    buf = io.BytesIO()
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    buf.seek(0)
    return buf.read()


def _gtts_fallback(text: str) -> bytes:
    from gtts import gTTS
    buf = io.BytesIO()
    gTTS(text=text, lang="ne").write_to_fp(buf)
    buf.seek(0)
    return buf.read()


@app.route("/v1/tts/nepali", methods=["POST"])
@require_key
def nepali_tts():
    data    = request.get_json(force=True, silent=True) or {}
    text    = data.get("text", "").strip()
    voice   = data.get("voice", VOICE)

    if not text:
        return jsonify({"error": "text required"}), 400

    try:
        # Try Edge TTS first (best quality)
        audio = asyncio.run(_edge_tts(text, voice))
        logger.info(f"Edge TTS [{voice}]: '{text[:60]}' → {len(audio)} bytes")
    except Exception as e:
        logger.warning(f"Edge TTS failed ({e}), falling back to gTTS")
        try:
            audio = _gtts_fallback(text)
            logger.info(f"gTTS fallback: '{text[:60]}' → {len(audio)} bytes")
        except Exception as e2:
            logger.error(f"Both TTS failed: {e2}")
            return jsonify({"error": str(e2)}), 500

    return send_file(
        io.BytesIO(audio),
        mimetype="audio/mpeg",
        download_name="monto_nepali.mp3",
    )


@app.route("/voices")
@require_key
def list_voices():
    return jsonify({
        "nepali_voices": [
            "ne-NP-HemkalaNeural (Female)",
            "ne-NP-SagarNeural (Male)",
        ],
        "current": VOICE,
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok", "engine": "edge-tts + gtts fallback", "voice": VOICE})


if __name__ == "__main__":
    port = int(os.getenv("NEPALI_TTS_PORT", 5003))
    logger.info(f"Nepali TTS server on port {port} | voice: {VOICE}")
    app.run(host="0.0.0.0", port=port, threaded=True)
