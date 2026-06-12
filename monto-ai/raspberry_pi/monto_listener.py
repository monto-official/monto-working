"""
Monto AI — Raspberry Pi Listener (Button Mode)
No wake word — press ENTER or GPIO button to talk to Monto.

How it works:
  1. Pi starts → shows MONTO face
  2. Press ENTER (or GPIO button) → records audio
  3. Sends to backend → gets response
  4. Plays TTS + shows emotion on face
  5. Returns to idle — ready for next press

Requirements: pip install -r requirements.txt
"""
import os
import io
import wave
import time
import tempfile
import logging
import threading
import numpy as np
import requests
import pyaudio
from dotenv import dotenv_values

env = dotenv_values(".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
GPU_BACKEND      = env.get("BACKEND_URL",          "http://100.76.66.40:8000")
FALLBACK_BACKEND = env.get("FALLBACK_BACKEND_URL",  "http://100.122.50.13:8000")
SESSION_ID       = env.get("SESSION_ID",            "pi-monto")
RECORD_SECONDS   = int(env.get("RECORD_SECONDS",    "5"))
FULLSCREEN       = env.get("FULLSCREEN",            "true").lower() == "true"
SAMPLE_RATE      = 16000

# GPIO button pin (optional — set 0 to disable GPIO)
GPIO_PIN         = int(env.get("GPIO_BUTTON_PIN",  "0"))

# Active backend
_active_backend  = GPU_BACKEND
_backend_lock    = threading.Lock()

def get_backend() -> str:
    with _backend_lock:
        return _active_backend

def set_backend(url: str):
    global _active_backend
    with _backend_lock:
        _active_backend = url
    logger.info(f"Active backend → {url}")

# ── AUDIO ─────────────────────────────────────────────────────────────────────

def record_audio(duration: int) -> bytes:
    """Record from mic for duration seconds, return WAV bytes."""
    pa = pyaudio.PyAudio()
    logger.info(f"Recording {duration}s...")

    stream = pa.open(
        format=pyaudio.paInt16, channels=1,
        rate=SAMPLE_RATE, input=True, frames_per_buffer=1024,
    )
    frames = [stream.read(1024, exception_on_overflow=False)
              for _ in range(int(SAMPLE_RATE / 1024 * duration))]
    stream.stop_stream()
    stream.close()
    pa.terminate()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()

# ── BACKEND ───────────────────────────────────────────────────────────────────

def check_url(url: str, timeout: int = 3) -> bool:
    try:
        return requests.get(f"{url}/health", timeout=timeout).ok
    except Exception:
        return False

def send_to_backend(audio_bytes: bytes) -> dict | None:
    url = get_backend()
    try:
        r = requests.post(
            f"{url}/voice/process",
            files={"audio": ("audio.wav", audio_bytes, "audio/wav")},
            headers={"X-Session-Id": SESSION_ID},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"Backend error ({url}): {e}")
        return None

def play_tts(text: str, emotion: str = "neutral", face=None):
    url = get_backend()
    try:
        r = requests.post(
            f"{url}/tts/speak",
            json={"text": text, "emotion": emotion},
            timeout=15,
        )
        r.raise_for_status()
        suffix = ".wav" if "wav" in r.headers.get("Content-Type", "") else ".mp3"
        fd, path = tempfile.mkstemp(suffix=suffix)
        try:
            os.write(fd, r.content)
            os.close(fd)
            if face: face.set_talking(True)
            if suffix == ".wav":
                os.system(f"aplay -q {path}")
            else:
                os.system(f"mpg123 -q {path}")
        finally:
            if face: face.set_talking(False)
            try: os.unlink(path)
            except OSError: pass
    except Exception as e:
        logger.error(f"TTS error: {e}")

# ── BACKEND MANAGER ───────────────────────────────────────────────────────────

def backend_manager(face):
    """Background: switch to fallback after 1 min, switch back when GPU is up."""
    gpu_fail_start = None
    while face.running:
        gpu_ok  = check_url(GPU_BACKEND)
        current = get_backend()

        if gpu_ok:
            if current != GPU_BACKEND:
                logger.info("GPU back online — switching back")
                set_backend(GPU_BACKEND)
                face.set_emotion("excited", "GPU reconnected! 🚀")
                time.sleep(2)
                face.set_emotion("idle")
            gpu_fail_start = None
        else:
            if current == GPU_BACKEND:
                if gpu_fail_start is None:
                    gpu_fail_start = time.time()
                elif time.time() - gpu_fail_start >= 60:
                    if FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                        set_backend(FALLBACK_BACKEND)
                        logger.info("Switched to fallback (Groq cloud)")
                        face.set_emotion("neutral", "Using cloud backup 🌐")
                        time.sleep(2)
                        face.set_emotion("idle")
                    gpu_fail_start = None
        time.sleep(15)

# ── CONVERSATION HANDLER ──────────────────────────────────────────────────────

def handle_conversation(face):
    """One full conversation turn: record → send → respond."""
    face.set_emotion("listening", "Listening...")
    audio_bytes = record_audio(RECORD_SECONDS)

    face.set_emotion("thinking", "Thinking...")
    result = send_to_backend(audio_bytes)

    if result:
        emotion  = result.get("emotion", "neutral")
        response = result.get("response", "")
        transcript = result.get("transcript", "")
        logger.info(f"Transcript: '{transcript}'")
        logger.info(f"[{emotion}] {response[:80]}")
        face.set_emotion(emotion, response)
        if response:
            play_tts(response, emotion=emotion, face=face)
        time.sleep(1.5)
    else:
        face.set_emotion("sad", "No response from server 😢")
        time.sleep(2)

    face.set_emotion("idle")

# ── INPUT LISTENERS ───────────────────────────────────────────────────────────

def keyboard_listener(face):
    """Press ENTER in terminal to trigger conversation."""
    logger.info("Press ENTER to talk to Monto (or set up GPIO button)")
    while face.running:
        try:
            input()   # blocks until ENTER
            if face.running:
                handle_conversation(face)
        except (EOFError, KeyboardInterrupt):
            break

def gpio_listener(face, pin: int):
    """Optional: physical button on GPIO pin."""
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        logger.info(f"GPIO button ready on pin {pin}")

        while face.running:
            if GPIO.input(pin) == GPIO.LOW:
                handle_conversation(face)
                time.sleep(0.5)  # debounce
            time.sleep(0.05)

    except ImportError:
        logger.warning("RPi.GPIO not available — GPIO button disabled")
    except Exception as e:
        logger.error(f"GPIO error: {e}")

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    from display.face import MontoFace

    logger.info(f"GPU backend:      {GPU_BACKEND}")
    logger.info(f"Fallback backend: {FALLBACK_BACKEND}")
    logger.info(f"Session ID:       {SESSION_ID}")
    logger.info(f"Record seconds:   {RECORD_SECONDS}")
    logger.info(f"Fullscreen:       {FULLSCREEN}")
    logger.info(f"GPIO pin:         {GPIO_PIN if GPIO_PIN else 'disabled'}")

    face = MontoFace(fullscreen=FULLSCREEN)
    face.set_emotion("thinking", "Connecting to Monto...")

    def startup():
        # Connect to backend
        retry = 0
        while face.running:
            retry += 1
            if check_url(GPU_BACKEND):
                set_backend(GPU_BACKEND)
                logger.info(f"Connected to GPU backend")
                break
            if retry >= 4 and FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                set_backend(FALLBACK_BACKEND)
                logger.info("Using fallback backend")
                break
            logger.info(f"Waiting for backend... ({retry})")
            face.set_emotion("thinking", f"Connecting... ({retry})")
            time.sleep(15)

        if not face.running:
            return

        face.set_emotion("happy", "Hi! I'm Monto 😊 Press ENTER to talk!")
        time.sleep(2)
        face.set_emotion("idle")

        # Start backend monitor
        monitor = threading.Thread(target=backend_manager, args=(face,), daemon=True)
        monitor.start()

        # Start GPIO button if configured
        if GPIO_PIN > 0:
            gpio_t = threading.Thread(target=gpio_listener, args=(face, GPIO_PIN), daemon=True)
            gpio_t.start()

        # Keyboard input (ENTER key)
        keyboard_listener(face)

    t = threading.Thread(target=startup, daemon=True)
    t.start()
    face.run()


if __name__ == "__main__":
    main()
