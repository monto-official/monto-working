"""
Monto AI — Raspberry Pi Listener
Press SPACE (or GPIO button) to talk to Monto.
USB mic auto-detected.
Live mic level shown on screen during recording.
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
GPIO_PIN         = int(env.get("GPIO_BUTTON_PIN",   "0"))

_active_backend = GPU_BACKEND
_backend_lock   = threading.Lock()
_busy           = threading.Event()   # prevent double-trigger

def get_backend():
    with _backend_lock: return _active_backend
def set_backend(url):
    global _active_backend
    with _backend_lock: _active_backend = url
    logger.info(f"Backend → {url}")

# ── AUDIO ─────────────────────────────────────────────────────────────────────

def find_mic():
    """Return best USB mic device index, or None for default."""
    pa = pyaudio.PyAudio()
    idx = None
    try:
        usb_kw = ["usb", "microphone", "mic", "headset", "earphone", "input"]
        for i in range(pa.get_device_count()):
            d = pa.get_device_info_by_index(i)
            if d["maxInputChannels"] > 0:
                name = d["name"].lower()
                logger.info(f"Audio input [{i}]: {d['name']}")
                if any(k in name for k in usb_kw) and idx is None:
                    idx = i
    finally:
        pa.terminate()
    if idx is not None:
        logger.info(f"Using USB mic at index {idx}")
    else:
        logger.info("Using default mic")
    return idx


def record_audio_live(duration: int, face) -> bytes:
    """Record audio while showing live mic level on face display."""
    pa      = pyaudio.PyAudio()
    mic_idx = find_mic()

    kwargs = dict(
        format=pyaudio.paInt16, channels=1,
        rate=SAMPLE_RATE, input=True, frames_per_buffer=512,
    )
    if mic_idx is not None:
        kwargs["input_device_index"] = mic_idx

    stream = pa.open(**kwargs)
    frames = []
    total  = int(SAMPLE_RATE / 512 * duration)

    for i in range(total):
        data = stream.read(512, exception_on_overflow=False)
        frames.append(data)

        # Update live mic level every 8 frames (~80ms)
        if i % 8 == 0 and face:
            arr    = np.frombuffer(data, dtype=np.int16).astype(np.float32)
            rms    = np.sqrt(np.mean(arr ** 2))
            level  = min(1.0, rms / 2500.0)
            face.set_mic_level(level)

    stream.stop_stream()
    stream.close()
    pa.terminate()

    if face:
        face.set_mic_level(0.0)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()

# ── BACKEND ───────────────────────────────────────────────────────────────────

def check_url(url, timeout=3):
    try: return requests.get(f"{url}/health", timeout=timeout).ok
    except: return False

def send_to_backend(audio_bytes):
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
        logger.error(f"Backend error: {e}")
        return None

def play_tts(text, emotion="neutral", face=None):
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
                os.system(f"aplay -q '{path}'")
            else:
                os.system(f"mpg123 -q '{path}'")
        finally:
            if face: face.set_talking(False)
            try: os.unlink(path)
            except: pass
    except Exception as e:
        logger.error(f"TTS error: {e}")

# ── BACKEND MONITOR ───────────────────────────────────────────────────────────

def backend_monitor(face):
    gpu_fail_start = None
    while face.running:
        gpu_ok  = check_url(GPU_BACKEND)
        current = get_backend()
        if gpu_ok:
            if current != GPU_BACKEND:
                set_backend(GPU_BACKEND)
                face.set_emotion("excited", "GPU back online! 🚀")
                time.sleep(2)
                if not _busy.is_set():
                    face.set_emotion("idle")
            gpu_fail_start = None
        else:
            if current == GPU_BACKEND:
                if gpu_fail_start is None:
                    gpu_fail_start = time.time()
                elif time.time() - gpu_fail_start >= 60:
                    if FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                        set_backend(FALLBACK_BACKEND)
                        face.set_emotion("neutral", "Using cloud backup 🌐")
                        time.sleep(2)
                        if not _busy.is_set():
                            face.set_emotion("idle")
                    gpu_fail_start = None
        time.sleep(15)

# ── CONVERSATION ──────────────────────────────────────────────────────────────

def do_conversation(face):
    """Run one full conversation turn in background thread."""
    if _busy.is_set():
        return   # already busy

    def _run():
        _busy.set()
        try:
            # 1. Record
            face.set_emotion("listening", f"Listening... ({RECORD_SECONDS}s)")
            audio = record_audio_live(RECORD_SECONDS, face)

            # 2. Process
            face.set_emotion("thinking", "Thinking...")
            result = send_to_backend(audio)

            # 3. Respond
            if result:
                emotion   = result.get("emotion",    "neutral")
                response  = result.get("response",   "")
                transcript = result.get("transcript", "")
                logger.info(f"You said: '{transcript}'")
                logger.info(f"Monto [{emotion}]: '{response[:80]}'")
                face.set_emotion(emotion, response)
                if response:
                    play_tts(response, emotion=emotion, face=face)
                time.sleep(1.5)
            else:
                face.set_emotion("sad", "No response from server 😢")
                time.sleep(2)

            face.set_emotion("idle")
        except Exception as e:
            logger.error(f"Conversation error: {e}")
            face.set_emotion("sad", "Something went wrong 😢")
            time.sleep(2)
            face.set_emotion("idle")
        finally:
            _busy.clear()

    threading.Thread(target=_run, daemon=True).start()

# ── GPIO ──────────────────────────────────────────────────────────────────────

def gpio_listener(face, pin):
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        logger.info(f"GPIO button on pin {pin}")
        while face.running:
            if GPIO.input(pin) == GPIO.LOW:
                do_conversation(face)
                time.sleep(0.8)
            time.sleep(0.05)
    except ImportError:
        logger.warning("RPi.GPIO not available")
    except Exception as e:
        logger.error(f"GPIO error: {e}")

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    import pygame
    from display.face import MontoFace

    logger.info(f"GPU:      {GPU_BACKEND}")
    logger.info(f"Fallback: {FALLBACK_BACKEND}")
    logger.info(f"Session:  {SESSION_ID}")
    logger.info(f"Record:   {RECORD_SECONDS}s")

    face = MontoFace(fullscreen=FULLSCREEN)
    face.set_emotion("thinking", "Connecting...")

    def startup():
        # Connect to backend
        retry = 0
        while face.running:
            retry += 1
            if check_url(GPU_BACKEND):
                set_backend(GPU_BACKEND)
                logger.info("Connected to GPU backend")
                break
            if retry >= 3 and FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                set_backend(FALLBACK_BACKEND)
                logger.info("Using fallback backend")
                break
            face.set_emotion("thinking", f"Connecting... ({retry})")
            logger.info(f"Waiting for backend ({retry})...")
            time.sleep(10)

        if not face.running:
            return

        # Show ready state
        face.set_emotion("happy", "Hi! I'm Monto 😊")
        time.sleep(2)
        face.set_emotion("idle")

        # Start backend monitor
        threading.Thread(target=backend_monitor, args=(face,), daemon=True).start()

        # GPIO button
        if GPIO_PIN > 0:
            threading.Thread(target=gpio_listener, args=(face, GPIO_PIN), daemon=True).start()

    threading.Thread(target=startup, daemon=True).start()

    # ── Main pygame loop — handles SPACE key ──────────────────────────────────
    logger.info("Press SPACE to talk to Monto (ESC to quit)")

    while face.running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                face.running = False

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    face.running = False

                elif event.key == pygame.K_SPACE:
                    # SPACE → start conversation
                    do_conversation(face)

                elif event.key == pygame.K_RETURN:
                    # ENTER also works
                    do_conversation(face)

        # Render frame
        with face._lock:
            emotion   = face.emotion
            text      = face.text
            tick      = face._tick
            talking   = face.talking
            mic_level = face.mic_level
            parts     = list(face.particles)

        import pygame as pg
        face.screen.blit(face._bg_cached, (0, 0))

        from display.face import glow, Theme
        acc = Theme.accent(emotion)
        glow(face.screen, (*acc, 22), face.face_cx, face.face_cy,
             int(min(face.W, face.H) * 0.55), steps=5)

        for p in parts:
            p.update()
            p.draw(face.screen)
        with face._lock:
            face.particles = [p for p in face.particles if p.life > 0]

        face._draw_logo(emotion, tick)
        face._draw_face(emotion, tick, talking)

        if emotion == "listening":
            face._draw_mic_visualizer(mic_level, tick)
        if talking:
            face._draw_speaking_indicator(tick)
        if text:
            face._draw_text_card(text, emotion)

        face._draw_status_bar(emotion, mic_level)

        pg.display.flip()
        with face._lock:
            face._tick += 1
        face.clock.tick(60)

    pygame.quit()


if __name__ == "__main__":
    main()
