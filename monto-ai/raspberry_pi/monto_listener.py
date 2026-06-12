"""
Monto AI — Raspberry Pi Listener
Wake word detection → record → send to backend → play TTS → show face

Wake word: OpenWakeWord (no API key needed)
Default:   "Hey Jarvis" (say "Hey Jarvis" to trigger)

Setup:
    pip install -r requirements.txt
    sudo apt install -y mpg123

.env variables:
    BACKEND_URL         GPU backend URL (primary)
    FALLBACK_BACKEND_URL  Laptop/Groq backend (used after 1 min if GPU offline)
    SESSION_ID          Unique device ID
    WAKE_WORD           Built-in wake word (hey_jarvis / alexa / hey_mycroft)
    WAKE_MODEL_PATH     Path to custom .tflite wake word model
    WAKE_THRESHOLD      Detection sensitivity 0.0-1.0 (default 0.5)
    RECORD_SECONDS      How long to record after wake word (default 5)
    FULLSCREEN          Show face fullscreen (true/false)
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
WAKE_WORD        = env.get("WAKE_WORD",             "hey_jarvis")
WAKE_MODEL_PATH  = env.get("WAKE_MODEL_PATH",       "")
WAKE_THRESHOLD   = float(env.get("WAKE_THRESHOLD",  "0.5"))
RECORD_SECONDS   = int(env.get("RECORD_SECONDS",    "5"))
FULLSCREEN       = env.get("FULLSCREEN",            "true").lower() == "true"
SAMPLE_RATE      = 16000
CHUNK            = 1280   # 80ms at 16kHz — required by OpenWakeWord

# Active backend (switches between GPU and fallback)
_active_backend  = GPU_BACKEND
_backend_lock    = threading.Lock()

def get_backend() -> str:
    with _backend_lock:
        return _active_backend

def set_backend(url: str):
    global _active_backend
    with _backend_lock:
        _active_backend = url
    logger.info(f"🔀 Active backend → {url}")

# ── AUDIO ─────────────────────────────────────────────────────────────────────

def record_audio(pa: pyaudio.PyAudio, duration: int) -> bytes:
    logger.info(f"Recording {duration}s...")
    stream = pa.open(
        format=pyaudio.paInt16, channels=1,
        rate=SAMPLE_RATE, input=True, frames_per_buffer=1024,
    )
    frames = [stream.read(1024, exception_on_overflow=False)
              for _ in range(int(SAMPLE_RATE / 1024 * duration))]
    stream.stop_stream()
    stream.close()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()

# ── BACKEND CHECK ─────────────────────────────────────────────────────────────

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
    """
    Background thread:
    - Try GPU backend first
    - After 1 minute of failure → switch to fallback (Groq/laptop)
    - Keep checking GPU in background → switch back when available
    """
    gpu_fail_start = None

    while face.running:
        gpu_ok = check_url(GPU_BACKEND)
        current = get_backend()

        if gpu_ok:
            # GPU is up
            if current != GPU_BACKEND:
                logger.info("GPU backend back online — switching back")
                set_backend(GPU_BACKEND)
                face.set_emotion("excited", "GPU reconnected! 🚀")
                time.sleep(2)
            gpu_fail_start = None
        else:
            # GPU is down
            if current == GPU_BACKEND:
                # Start failure timer
                if gpu_fail_start is None:
                    gpu_fail_start = time.time()
                    logger.warning("GPU backend unreachable — starting 60s countdown")

                elapsed = time.time() - gpu_fail_start
                if elapsed >= 60:
                    # 1 minute passed — try fallback
                    if FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                        logger.info("Switching to fallback backend (Groq cloud)")
                        set_backend(FALLBACK_BACKEND)
                        face.set_emotion("neutral", "Using cloud backup 🌐")
                        time.sleep(2)
                    else:
                        logger.warning("Fallback also unreachable — waiting...")
                        face.set_emotion("sad", "No server available 😢")

        time.sleep(15)  # check every 15 seconds

# ── WAKE WORD ─────────────────────────────────────────────────────────────────

def listener_thread(face):
    """
    Wake word detection using Google Speech Recognition.
    Say 'Hi Monto' or 'Hey Monto' to trigger.
    No training, no model download needed.
    Falls back to OpenWakeWord if speech_recognition unavailable.
    """
    # Try installing speech_recognition if not present
    try:
        import speech_recognition as sr
        _listen_with_sr(face, sr)
    except ImportError:
        logger.warning("speech_recognition not installed — trying OpenWakeWord")
        _listen_with_oww(face)


def _listen_with_sr(face, sr):
    """Speech recognition based wake word — say 'Hi Monto' or 'Hey Monto'."""
    recognizer = sr.Recognizer()
    recognizer.energy_threshold        = 300
    recognizer.dynamic_energy_threshold = True
    recognizer.pause_threshold          = 0.8

    wake_keywords = ["monto", "hi monto", "hey monto", "hello monto",
                     "monte", "hi monte", "hey monte"]  # common mishearings

    pa  = pyaudio.PyAudio()
    mic = pa.open(
        rate=SAMPLE_RATE, channels=1,
        format=pyaudio.paInt16, input=True,
        frames_per_buffer=1024,
    )

    face.set_emotion("idle")
    logger.info("✅ Listening for 'Hi Monto' or 'Hey Monto'...")

    LISTEN_SECS      = 2
    FRAMES_PER_CHECK = int(SAMPLE_RATE / 1024 * LISTEN_SECS)

    try:
        while face.running:
            # Collect 2s of audio
            frames = [mic.read(1024, exception_on_overflow=False)
                      for _ in range(FRAMES_PER_CHECK)]

            # Energy check — skip silence
            audio_arr = np.frombuffer(b"".join(frames), dtype=np.int16)
            energy    = np.sqrt(np.mean(audio_arr.astype(np.float32) ** 2))
            if energy < 150:
                continue

            # Build WAV
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(b"".join(frames))

            # Recognize
            try:
                audio_data = sr.AudioData(buf.getvalue(), SAMPLE_RATE, 2)
                text = recognizer.recognize_google(
                    audio_data, language="en-US"
                ).lower()
                logger.debug(f"Heard: '{text}'")

                if any(kw in text for kw in wake_keywords):
                    logger.info(f"✅ Wake word detected! Heard: '{text}'")
                    mic.stop_stream()
                    _handle_wake(pa, mic, face)
                    mic.start_stream()
                    logger.info("Listening for 'Hi Monto'...")

            except sr.UnknownValueError:
                pass   # silence or unclear speech
            except sr.RequestError:
                # Google SR offline — try local Whisper via backend
                _check_with_backend(buf.getvalue(), mic, pa, face, wake_keywords)
            except Exception as e:
                logger.debug(f"SR: {e}")

    except Exception as e:
        logger.error(f"Listener error: {e}")
    finally:
        mic.stop_stream()
        mic.close()
        pa.terminate()


def _check_with_backend(wav_bytes, mic, pa, face, wake_keywords):
    """Use backend STT to check for wake word when Google SR is offline."""
    try:
        url = get_backend()
        r = requests.post(
            f"{url}/voice/process",
            files={"audio": ("audio.wav", wav_bytes, "audio/wav")},
            headers={"X-Session-Id": SESSION_ID},
            timeout=10,
        )
        if r.ok:
            transcript = r.json().get("transcript", "").lower()
            if transcript and any(kw in transcript for kw in wake_keywords):
                logger.info(f"Backend wake word detected: '{transcript}'")
                mic.stop_stream()
                _handle_wake(pa, mic, face)
                mic.start_stream()
    except Exception:
        pass


def _listen_with_oww(face):
    """Fallback: OpenWakeWord detection."""
    try:
        from openwakeword.model import Model
        wake_word = env.get("WAKE_WORD", "hey_jarvis")
        model     = Model(wakeword_model_paths=[wake_word])
        logger.info(f"OpenWakeWord fallback: say '{wake_word.replace('_',' ').title()}'")
    except Exception as e:
        logger.error(f"No wake word engine available: {e}")
        face.set_emotion("sad", "Wake word unavailable 😢")
        return

    pa  = pyaudio.PyAudio()
    mic = pa.open(rate=SAMPLE_RATE, channels=1,
                  format=pyaudio.paInt16, input=True,
                  frames_per_buffer=CHUNK)
    face.set_emotion("idle")

    try:
        while face.running:
            raw   = mic.read(CHUNK, exception_on_overflow=False)
            chunk = np.frombuffer(raw, dtype=np.int16)
            preds = model.predict(chunk)
            for name, score in preds.items():
                if score >= WAKE_THRESHOLD:
                    logger.info(f"OWW wake: [{name}] {score:.2f}")
                    mic.stop_stream()
                    _handle_wake(pa, mic, face)
                    mic.start_stream()
                    break
    except Exception as e:
        logger.error(f"OWW error: {e}")
    finally:
        mic.stop_stream()
        mic.close()
        pa.terminate()
def _handle_wake(pa, mic, face):
    """Handle one wake word → record → process → respond cycle."""
    model = None  # reset handled by predict state
    mic.stop_stream()
    face.set_emotion("excited", "")
    time.sleep(0.3)

    # Record
    face.set_emotion("listening", "Listening...")
    audio_bytes = record_audio(pa, RECORD_SECONDS)

    # Send to backend
    face.set_emotion("thinking", "Thinking...")
    result = send_to_backend(audio_bytes)

    if result:
        emotion  = result.get("emotion", "neutral")
        response = result.get("response", "")
        logger.info(f"[{emotion}] {response[:80]}")
        face.set_emotion(emotion, response)
        if response:
            play_tts(response, emotion=emotion, face=face)
        time.sleep(1.5)
    else:
        face.set_emotion("sad", "No response 😢")
        time.sleep(2)

    face.set_emotion("idle")
    mic.start_stream()

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    from display.face import MontoFace

    logger.info(f"GPU backend:      {GPU_BACKEND}")
    logger.info(f"Fallback backend: {FALLBACK_BACKEND}")
    logger.info(f"Session ID:       {SESSION_ID}")
    logger.info(f"Wake word:        {WAKE_WORD}")
    logger.info(f"Fullscreen:       {FULLSCREEN}")

    face = MontoFace(fullscreen=FULLSCREEN)
    face.set_emotion("thinking", "Connecting to Monto...")

    def startup():
        # Step 1: Try GPU backend
        retry = 0
        while face.running:
            retry += 1
            logger.info(f"Trying GPU backend... (attempt {retry})")

            if check_url(GPU_BACKEND):
                set_backend(GPU_BACKEND)
                break

            if retry >= 4:  # ~1 minute (4 × 15s)
                # Try fallback
                if FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                    logger.info("GPU offline — using fallback backend")
                    set_backend(FALLBACK_BACKEND)
                    face.set_emotion("neutral", "Using cloud backup 🌐")
                    time.sleep(2)
                    break
                else:
                    face.set_emotion("sad", "Waiting for server...")
                    logger.info("Both backends offline — retrying in 30s...")
                    time.sleep(30)
                    retry = 0
                    continue

            time.sleep(15)

        if not face.running:
            return

        # Step 2: Start backend monitor in background
        monitor = threading.Thread(target=backend_manager, args=(face,), daemon=True)
        monitor.start()

        # Step 3: Start listener (restarts on error)
        face.set_emotion("excited", "Hey! I'm Monto 😊")
        time.sleep(1.5)

        while face.running:
            listener_thread(face)
            if face.running:
                logger.warning("Listener stopped — restarting in 3s...")
                face.set_emotion("thinking", "Restarting...")
                time.sleep(3)

    t = threading.Thread(target=startup, daemon=True)
    t.start()
    face.run()


if __name__ == "__main__":
    main()
