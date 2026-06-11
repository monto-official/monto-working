"""
Monto AI — Raspberry Pi Listener
Wake word: "Hey Monto" using OpenWakeWord (open source, no API key needed)
Records audio, sends to backend, plays TTS response, shows face animations.

Requirements: pip install -r requirements.txt
"""
import os
import io
import sys
import wave
import time
import struct
import tempfile
import logging
import threading
import numpy as np
import requests
import pyaudio
from dotenv import dotenv_values

# Load .env
env = dotenv_values(".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
BACKEND_URL    = env.get("BACKEND_URL",    "http://100.122.50.13:8000")
RECORD_SECONDS = int(env.get("RECORD_SECONDS", "5"))
FULLSCREEN     = env.get("FULLSCREEN", "true").lower() == "true"
SESSION_ID     = env.get("SESSION_ID", "pi-device-1")
WAKE_THRESHOLD = float(env.get("WAKE_THRESHOLD", "0.5"))  # sensitivity 0-1
SAMPLE_RATE    = 16000
CHANNELS       = 1
CHUNK          = 1280   # OpenWakeWord needs 80ms chunks at 16kHz
# ─────────────────────────────────────────────────────────────────────────────


def record_audio(pa: pyaudio.PyAudio, duration: int) -> bytes:
    """Record from mic for duration seconds, return WAV bytes."""
    logger.info(f"Recording for {duration}s...")
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=1024,
    )
    frames = []
    for _ in range(int(SAMPLE_RATE / 1024 * duration)):
        frames.append(stream.read(1024, exception_on_overflow=False))
    stream.stop_stream()
    stream.close()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


def wait_for_backend(max_tries: int = 20, delay: int = 3):
    """Wait until the backend is reachable."""
    for attempt in range(1, max_tries + 1):
        try:
            r = requests.get(f"{BACKEND_URL}/health", timeout=3)
            if r.ok:
                logger.info(f"✅ Backend reachable at {BACKEND_URL}")
                return True
        except Exception:
            pass
        logger.info(f"Waiting for backend... ({attempt}/{max_tries})")
        time.sleep(delay)
    logger.error(f"❌ Backend not reachable after {max_tries} attempts")
    return False


def send_to_backend(audio_bytes: bytes) -> dict:
    """Send audio to Monto backend and get response."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/voice/process",
            files={"audio": ("audio.wav", audio_bytes, "audio/wav")},
            headers={"X-Session-Id": SESSION_ID},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to backend at {BACKEND_URL}")
        return None
    except Exception as e:
        logger.error(f"Backend error: {e}")
        return None


def play_tts(text: str, emotion: str = "neutral", face=None):
    """Request TTS audio from backend and play it."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/tts/speak",
            json={"text": text, "emotion": emotion},
            timeout=15,
        )
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "audio/mpeg")
        suffix = ".wav" if "wav" in content_type else ".mp3"

        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        try:
            os.write(fd, response.content)
            os.close(fd)
            if face:
                face.set_talking(True)
            # Use aplay for WAV, mpg123 for MP3
            if suffix == ".wav":
                os.system(f"aplay -q {tmp_path}")
            else:
                os.system(f"mpg123 -q {tmp_path}")
        finally:
            if face:
                face.set_talking(False)
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    except requests.exceptions.ConnectionError:
        logger.error(f"TTS: Cannot connect to backend at {BACKEND_URL}")
    except requests.exceptions.Timeout:
        logger.error("TTS: Request timed out")
    except Exception as e:
        logger.error(f"TTS playback error: {e}")


def listener_thread(face):
    """Wake word detection + backend pipeline."""

    # ── Load OpenWakeWord ─────────────────────────────────────────────────────
    try:
        from openwakeword.model import Model
    except ImportError:
        logger.error("openwakeword not installed. Run: pip install openwakeword")
        face.stop()
        return

    try:
        # Use built-in "hey_jarvis" model as base — we rename the trigger
        # For custom "hey monto" — download from:
        # https://github.com/dscripka/openWakeWord/blob/main/docs/custom_models.md
        # Then set: oww_model = Model(wakeword_models=["hey_monto.tflite"])

        wake_model_path = env.get("WAKE_MODEL_PATH", "")
        if wake_model_path and os.path.exists(wake_model_path):
            oww_model = Model(wakeword_models=[wake_model_path], inference_framework="tflite")
            wake_name = os.path.basename(wake_model_path).replace(".tflite", "")
            logger.info(f"Wake word: custom model → {wake_model_path}")
        else:
            # Built-in pre-trained models available without any recording:
            # "alexa", "hey_jarvis", "hey_mycroft", "timer", "weather"
            wake_word  = env.get("WAKE_WORD", "alexa")
            oww_model  = Model(wakeword_models=[wake_word], inference_framework="tflite")
            wake_name  = wake_word
            logger.info(f"Wake word: built-in '{wake_word}' — say '{wake_word.replace('_',' ').title()}' to trigger")

    except Exception as e:
        logger.error(f"OpenWakeWord init failed: {e}")
        face.stop()
        return

    pa  = pyaudio.PyAudio()
    mic = pa.open(
        rate=SAMPLE_RATE,
        channels=1,
        format=pyaudio.paInt16,
        input=True,
        frames_per_buffer=CHUNK,
    )

    logger.info(f'Listening for wake word "{wake_name}"...')
    face.set_emotion("idle")

    try:
        while face.running:
            # Read chunk
            raw = mic.read(CHUNK, exception_on_overflow=False)
            audio_int16 = np.frombuffer(raw, dtype=np.int16)

            # Run wake word detection
            prediction = oww_model.predict(audio_int16)

            # Check if any model triggered
            triggered = False
            for name, score in prediction.items():
                if score >= WAKE_THRESHOLD:
                    logger.info(f"Wake word detected! [{name}] score={score:.2f}")
                    triggered = True
                    break

            if triggered:
                oww_model.reset()  # reset scores
                face.set_emotion("excited", "")
                mic.stop_stream()

                # Record
                face.set_emotion("listening", "Listening...")
                audio_bytes = record_audio(pa, RECORD_SECONDS)

                # Process
                face.set_emotion("thinking", "Thinking...")
                result = send_to_backend(audio_bytes)

                if result:
                    emotion  = result.get("emotion", "neutral")
                    response = result.get("response", "")
                    logger.info(f"[{emotion}] {response}")

                    face.set_emotion(emotion, response)

                    if response:
                        play_tts(response, emotion=emotion, face=face)

                    time.sleep(1.5)
                else:
                    face.set_emotion("sad", "Could not connect to server 😢")
                    time.sleep(2)

                face.set_emotion("idle")
                mic.start_stream()
                logger.info(f'Listening for wake word "{wake_name}"...')

    except Exception as e:
        logger.error(f"Listener error: {e}")
    finally:
        mic.stop_stream()
        mic.close()
        pa.terminate()


def main():
    from display.face import MontoFace

    logger.info(f"Backend: {BACKEND_URL}")
    logger.info(f"Session: {SESSION_ID}")
    logger.info(f"Fullscreen: {FULLSCREEN}")

    face = MontoFace(fullscreen=FULLSCREEN)
    face.set_emotion("thinking", "Connecting to Monto...")

    def startup():
        if not wait_for_backend():
            face.set_emotion("sad", "Cannot connect to server 😢")
            time.sleep(5)
            face.stop()
            return
        listener_thread(face)

    t = threading.Thread(target=startup, daemon=True)
    t.start()
    face.run()


if __name__ == "__main__":
    main()
