"""
Monto AI — Raspberry Pi Listener
Press SPACE (or GPIO button) to talk to Monto.
USB mic auto-detected and cached at startup.
Live mic level shown on screen during recording.

Fixed bugs:
  - PyAudio mic index cached at startup (not re-enumerated every press)
  - Full traceback logged on errors (not just "something went wrong")
  - subprocess.run instead of os.system for audio playback
  - imports moved out of render loop
  - face.run() not called — main loop owned here
"""
import os
import io
import wave
import time
import tempfile
import logging
import threading
import subprocess
import traceback
import numpy as np
import requests
import pyaudio
import pygame
from display.face import MontoFace, glow, Theme
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
_busy           = threading.Event()

# Cached mic device index and sample rate (set once at startup)
_mic_idx        = None
_mic_rate       = 16000   # updated after init_mic()

def get_backend():
    with _backend_lock: return _active_backend

def set_backend(url):
    global _active_backend
    with _backend_lock: _active_backend = url
    logger.info(f"Backend → {url}")

# ── AUDIO DEVICE SETUP ────────────────────────────────────────────────────────

def init_mic():
    """Find and cache I2S or USB mic index and sample rate at startup."""
    global _mic_idx, _mic_rate
    pa  = pyaudio.PyAudio()
    idx = None
    try:
        # I2S mic keywords
        i2s_kw  = ["i2s", "inmp441", "admp441", "sph0645"]
        usb_kw  = ["usb", "microphone", "mic", "headset", "earphone", "composite"]
        all_kw  = i2s_kw + usb_kw

        logger.info("Available audio input devices:")
        for i in range(pa.get_device_count()):
            d = pa.get_device_info_by_index(i)
            if d["maxInputChannels"] > 0:
                logger.info(f"  [{i}] {d['name']} (SR:{d['defaultSampleRate']:.0f})")
                name = d["name"].lower()
                # Prefer I2S mic, then USB
                if any(k in name for k in i2s_kw) and idx is None:
                    idx = i
                    logger.info(f"  ↑ I2S mic selected")
                elif any(k in name for k in usb_kw) and idx is None:
                    idx = i
                    logger.info(f"  ↑ USB mic selected")
    finally:
        pa.terminate()

    _mic_idx = idx

    if _mic_idx is not None:
        pa2 = pyaudio.PyAudio()
        try:
            d = pa2.get_device_info_by_index(_mic_idx)
            # I2S mics usually support 16000Hz
            for rate in [16000, 44100, 48000, 22050]:
                try:
                    if pa2.is_format_supported(
                        rate,
                        input_device=_mic_idx,
                        input_channels=1,
                        input_format=pyaudio.paInt32,  # I2S uses 32-bit
                    ):
                        _mic_rate = rate
                        break
                except Exception:
                    # Try 16-bit
                    try:
                        if pa2.is_format_supported(
                            rate,
                            input_device=_mic_idx,
                            input_channels=1,
                            input_format=pyaudio.paInt16,
                        ):
                            _mic_rate = rate
                            break
                    except Exception:
                        continue
            else:
                _mic_rate = int(d["defaultSampleRate"])
        finally:
            pa2.terminate()

        logger.info(f"✅ Mic ready: index={_mic_idx}, rate={_mic_rate}Hz")
    else:
        _mic_rate = 16000
        logger.warning("⚠️  No mic found — connect a USB mic or I2S mic to use voice")


def record_audio_live(duration: int, face) -> bytes:
    """Record from I2S or USB mic, show live level, return 16kHz WAV.
    - I2S mics (INMP441): 32-bit samples, converted to 16-bit
    - USB mics: 16-bit samples directly
    - Auto-resamples to 16kHz for Whisper
    """
    pa = pyaudio.PyAudio()

    # Try 32-bit first (I2S INMP441), fall back to 16-bit (USB)
    pa_format    = pyaudio.paInt32
    sample_width = 4
    try:
        pa.is_format_supported(_mic_rate, input_device=_mic_idx,
                               input_channels=1, input_format=pyaudio.paInt32)
        logger.info("Using 32-bit I2S audio format")
    except Exception:
        pa_format    = pyaudio.paInt16
        sample_width = 2
        logger.info("Using 16-bit audio format")
    finally:
        pa.terminate()

    pa = pyaudio.PyAudio()
    kwargs = dict(
        format=pa_format, channels=1,
        rate=_mic_rate, input=True, frames_per_buffer=512,
    )
    if _mic_idx is not None:
        kwargs["input_device_index"] = _mic_idx

    try:
        stream = pa.open(**kwargs)
    except OSError as e:
        pa.terminate()
        raise RuntimeError(f"Cannot open mic (index={_mic_idx}, rate={_mic_rate}): {e}")

    try:
        for i in range(total):
            data = stream.read(512, exception_on_overflow=False)
            frames.append(data)

            if i % 8 == 0 and face:
                if sample_width == 4:
                    arr = np.frombuffer(data, dtype=np.int32).astype(np.float32) / 2147483648.0
                else:
                    arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                rms   = float(np.sqrt(np.mean(arr ** 2)))
                level = min(1.0, rms * 12)
                face.set_mic_level(level)
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()
        if face: face.set_mic_level(0.0)

    raw = b"".join(frames)

    # Convert 32-bit I2S → 16-bit PCM
    if sample_width == 4:
        arr32 = np.frombuffer(raw, dtype=np.int32)
        raw   = (arr32 >> 16).astype(np.int16).tobytes()

    # Resample to 16kHz if needed
    if _mic_rate != 16000:
        try:
            try:
                import audioop
            except ImportError:
                import audioop_lts as audioop
            raw, _ = audioop.ratecv(raw, 2, 1, _mic_rate, 16000, None)
            logger.info(f"Resampled {_mic_rate}Hz → 16000Hz")
        except ImportError:
            logger.warning("audioop not available — pip install audioop-lts")

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(raw)
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
            # Use subprocess instead of os.system (safer, no shell injection)
            if suffix == ".wav":
                subprocess.run(["aplay", "-q", path],
                               check=False, timeout=30)
            else:
                subprocess.run(["mpg123", "-q", path],
                               check=False, timeout=30)
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
                if not _busy.is_set():
                    face.set_emotion("excited", "GPU back online! 🚀")
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
                        if not _busy.is_set():
                            face.set_emotion("neutral", "Using cloud backup 🌐")
                            time.sleep(2)
                            face.set_emotion("idle")
                    gpu_fail_start = None
        time.sleep(15)

# ── CONVERSATION ──────────────────────────────────────────────────────────────

def do_conversation(face):
    """Trigger one conversation turn in a background thread."""
    if _busy.is_set():
        logger.info("Already busy — ignoring button press")
        return

    def _run():
        _busy.set()
        try:
            # Check if mic is available
            if _mic_idx is None:
                face.set_emotion("sad", "No mic connected! Please connect a USB mic 🎤")
                time.sleep(3)
                return
            audio = record_audio_live(RECORD_SECONDS, face)

            # Step 2: Send to backend
            face.set_emotion("thinking", "Thinking...")
            result = send_to_backend(audio)

            # Step 3: Respond
            if result:
                emotion    = result.get("emotion",    "neutral")
                response   = result.get("response",   "")
                transcript = result.get("transcript", "")
                logger.info(f"You: '{transcript}'")
                logger.info(f"Monto [{emotion}]: '{response[:80]}'")
                face.set_emotion(emotion, response)
                if response:
                    play_tts(response, emotion=emotion, face=face)
                time.sleep(1.5)
            else:
                face.set_emotion("sad", "Could not reach server 😢")
                time.sleep(2)

        except RuntimeError as e:
            # Specific known errors (mic not found etc)
            logger.error(f"Recording error: {e}")
            face.set_emotion("sad", str(e)[:60])
            time.sleep(3)

        except Exception as e:
            # Log full traceback for debugging
            logger.error(f"Conversation error:\n{traceback.format_exc()}")
            face.set_emotion("sad", f"Error: {str(e)[:50]}")
            time.sleep(3)
        finally:
            _busy.clear()
            if face.running:
                face.set_emotion("idle")

    threading.Thread(target=_run, daemon=True).start()

# ── GPIO ──────────────────────────────────────────────────────────────────────

def gpio_listener(face, pin):
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        logger.info(f"GPIO button ready on pin {pin}")
        while face.running:
            if GPIO.input(pin) == GPIO.LOW:
                do_conversation(face)
                time.sleep(0.8)
            time.sleep(0.05)
    except ImportError:
        logger.warning("RPi.GPIO not available — GPIO button disabled")
    except Exception as e:
        logger.error(f"GPIO error: {e}")

# ── MAIN LOOP ─────────────────────────────────────────────────────────────────

def main():
    # Step 1: Init mic at startup (cached for all future recordings)
    init_mic()

    # Step 2: Create face display
    face = MontoFace(fullscreen=FULLSCREEN)
    face.set_emotion("thinking", "Connecting...")

    # Step 3: Connect to backend in background
    def startup():
        retry = 0
        while face.running:
            retry += 1
            if check_url(GPU_BACKEND):
                set_backend(GPU_BACKEND)
                logger.info("✅ Connected to GPU backend")
                break
            if retry >= 3 and FALLBACK_BACKEND and check_url(FALLBACK_BACKEND):
                set_backend(FALLBACK_BACKEND)
                logger.info("✅ Using fallback backend")
                break
            face.set_emotion("thinking", f"Connecting... ({retry})")
            logger.info(f"Waiting for backend ({retry})...")
            time.sleep(10)

        if not face.running:
            return

        face.set_emotion("happy", "Hi! I'm Monto 😊  Press SPACE to talk!")
        time.sleep(2)
        face.set_emotion("idle")

        # Start monitors
        threading.Thread(target=backend_monitor, args=(face,), daemon=True).start()
        if GPIO_PIN > 0:
            threading.Thread(target=gpio_listener, args=(face, GPIO_PIN), daemon=True).start()

    threading.Thread(target=startup, daemon=True).start()

    logger.info("Controls: SPACE or ENTER = talk  |  ESC = quit")

    # Step 4: Main pygame render + event loop
    while face.running:
        # ── Events ───────────────────────────────────────────────────────────
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                face.running = False

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    face.running = False
                elif event.key in (pygame.K_SPACE, pygame.K_RETURN):
                    do_conversation(face)

        # ── Render ───────────────────────────────────────────────────────────
        with face._lock:
            emotion   = face.emotion
            text      = face.text
            tick      = face._tick
            talking   = face.talking
            mic_level = face.mic_level
            parts     = list(face.particles)

        face.screen.blit(face._bg_cached, (0, 0))

        acc = Theme.accent(emotion)
        glow(face.screen, (*acc, 22), face.face_cx, face.face_cy,
             int(min(face.W, face.H) * 0.55), steps=5)

        # Particles
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

        face._draw_status_bar(emotion, mic_level, talking)

        pygame.display.flip()
        with face._lock:
            face._tick += 1
        face.clock.tick(60)

    pygame.quit()
    logger.info("Monto stopped.")


if __name__ == "__main__":
    main()
