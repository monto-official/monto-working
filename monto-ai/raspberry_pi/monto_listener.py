"""
Monto AI — Raspberry Pi Listener
Listens for "Hey Monto" wake word, records audio,
sends to backend, plays TTS response, and shows face animations.

Requirements:
    pip install -r requirements.txt
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
import requests
import pyaudio
import pvporcupine
from playsound import playsound
from dotenv import dotenv_values

# Load .env
env = dotenv_values(".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
BACKEND_URL    = env.get("BACKEND_URL",    "http://192.168.1.101:8000")
PORCUPINE_KEY  = env.get("PORCUPINE_KEY",  "your_picovoice_access_key")
RECORD_SECONDS = int(env.get("RECORD_SECONDS", "5"))
FULLSCREEN     = env.get("FULLSCREEN", "false").lower() == "true"
# Unique ID for this Pi device — keeps memory separate per device
SESSION_ID     = env.get("SESSION_ID", "pi-device-1")
SAMPLE_RATE    = 16000
CHANNELS       = 1
# ─────────────────────────────────────────────────────────────────────────────


def record_audio(pa: pyaudio.PyAudio, duration: int) -> bytes:
    """Record from mic for `duration` seconds, return WAV bytes."""
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
        data = stream.read(1024, exception_on_overflow=False)
        frames.append(data)
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
    """Wait until the backend is reachable — useful on boot when backend starts slowly."""
    import time
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
            headers={"X-Session-Id": SESSION_ID},   # ← sends session so backend remembers
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Backend error: {e}")
        return None


def play_tts(text: str, emotion: str = "neutral"):
    """Request TTS audio from backend and play it. Handles WAV (local) or MP3 (cloud)."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/tts/speak",
            json={"text": text, "emotion": emotion},
            timeout=15,
        )
        response.raise_for_status()

        # Detect format from Content-Type header
        content_type = response.headers.get("Content-Type", "audio/mpeg")
        suffix = ".wav" if "wav" in content_type else ".mp3"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        try:
            playsound(tmp_path)
        finally:
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
    """Runs wake word detection + backend calls in a background thread."""
    logger.info("Initialising Porcupine wake word engine...")
    try:
        porcupine = pvporcupine.create(
            access_key=PORCUPINE_KEY,
            keywords=["hey google"],         # ← swap with custom "hey monto" .ppn file
            # keyword_paths=["hey_monto_raspberry-pi.ppn"],
            sensitivities=[0.7],
        )
    except Exception as e:
        logger.error(f"Porcupine init failed: {e}")
        logger.error("Get your free key at https://picovoice.ai/")
        face.stop()
        return

    pa = pyaudio.PyAudio()
    mic = pa.open(
        rate=porcupine.sample_rate,
        channels=1,
        format=pyaudio.paInt16,
        input=True,
        frames_per_buffer=porcupine.frame_length,
    )

    logger.info('Listening for "Hey Monto"...')
    face.set_emotion("idle")

    try:
        while face.running:
            pcm = mic.read(porcupine.frame_length, exception_on_overflow=False)
            pcm = struct.unpack_from("h" * porcupine.frame_length, pcm)

            if porcupine.process(pcm) >= 0:
                logger.info("Wake word detected!")
                face.set_emotion("excited", "")
                mic.stop_stream()

                # Record
                face.set_emotion("listening", "Listening...")
                audio_bytes = record_audio(pa, RECORD_SECONDS)

                # Process
                face.set_emotion("thinking", "Thinking...")
                result = send_to_backend(audio_bytes)

                if result:
                    emotion   = result.get("emotion", "neutral")
                    animation = result.get("animation", "talking")
                    response  = result.get("response", "")
                    logger.info(f"[{emotion}] {response}")

                    # Show face + text
                    face.set_emotion(emotion, response)

                    # Play TTS with matching emotion for voice tone
                    if response:
                        play_tts(response, emotion=emotion)

                    # Short pause then back to idle
                    time.sleep(1.5)
                else:
                    face.set_emotion("sad", "Could not connect...")
                    time.sleep(2)

                face.set_emotion("idle")
                mic.start_stream()
                logger.info('Listening for "Hey Monto"...')

    except Exception as e:
        logger.error(f"Listener error: {e}")
    finally:
        mic.stop_stream()
        mic.close()
        pa.terminate()
        porcupine.delete()


def main():
    # Import here so pygame only loads if display is available
    from display.face import MontoFace

    logger.info(f"Backend: {BACKEND_URL}")
    logger.info(f"Session: {SESSION_ID}")
    logger.info(f"Fullscreen: {FULLSCREEN}")

    face = MontoFace(width=480, height=480, fullscreen=FULLSCREEN)

    # Show connecting screen while waiting for backend
    face.set_emotion("thinking", "Connecting to Monto...")

    # Wait for backend in a thread so pygame can render the screen
    def startup():
        if not wait_for_backend():
            face.set_emotion("sad", "Cannot connect to server 😢")
            time.sleep(5)
            face.stop()
            return
        # Start the main listener
        listener_thread(face)

    t = threading.Thread(target=startup, daemon=True)
    t.start()

    # Pygame must run on main thread
    face.run()


if __name__ == "__main__":
    main()
