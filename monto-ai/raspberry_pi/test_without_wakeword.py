"""
Monto AI — Pi Test Script (No Wake Word)
Press ENTER to record, speaks back the response.
Use this to test everything works before setting up Porcupine.
"""
import os
import io
import wave
import time
import tempfile
import logging
import requests
import pyaudio
from dotenv import dotenv_values

env = dotenv_values(".env")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BACKEND_URL    = env.get("BACKEND_URL", "http://100.122.50.13:8000")
SESSION_ID     = env.get("SESSION_ID",  "pi-monto")
RECORD_SECONDS = int(env.get("RECORD_SECONDS", "5"))
SAMPLE_RATE    = 16000
CHANNELS       = 1

def record_audio(duration: int) -> bytes:
    pa = pyaudio.PyAudio()
    logger.info(f"Recording for {duration}s... speak now!")
    stream = pa.open(format=pyaudio.paInt16, channels=CHANNELS,
                     rate=SAMPLE_RATE, input=True, frames_per_buffer=1024)
    frames = []
    for _ in range(int(SAMPLE_RATE / 1024 * duration)):
        frames.append(stream.read(1024, exception_on_overflow=False))
    stream.stop_stream()
    stream.close()
    pa.terminate()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()

def send_to_backend(audio_bytes: bytes) -> dict:
    try:
        r = requests.post(
            f"{BACKEND_URL}/voice/process",
            files={"audio": ("audio.wav", audio_bytes, "audio/wav")},
            headers={"X-Session-Id": SESSION_ID},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"Backend error: {e}")
        return None

def play_tts(text: str, emotion: str = "neutral"):
    try:
        r = requests.post(
            f"{BACKEND_URL}/tts/speak",
            json={"text": text, "emotion": emotion},
            timeout=15,
        )
        r.raise_for_status()
        content_type = r.headers.get("Content-Type", "audio/mpeg")
        suffix = ".wav" if "wav" in content_type else ".mp3"
        fd, path = tempfile.mkstemp(suffix=suffix)
        try:
            os.write(fd, r.content)
            os.close(fd)
            # Play using aplay (WAV) or mpg123 (MP3)
            if suffix == ".wav":
                os.system(f"aplay {path}")
            else:
                os.system(f"mpg123 -q {path}")
        finally:
            os.unlink(path)
    except Exception as e:
        logger.error(f"TTS error: {e}")

def check_backend():
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=5)
        return r.ok
    except:
        return False

print(f"\n🤖 Monto AI Test — Backend: {BACKEND_URL}")
print("Checking backend connection...")

if not check_backend():
    print(f"❌ Cannot reach backend at {BACKEND_URL}")
    print("Make sure backend is running on the laptop/GPU machine.")
    exit(1)

print("✅ Backend connected!")
print("Press ENTER to record, Ctrl+C to quit\n")

try:
    while True:
        input("▶  Press ENTER to speak...")
        audio = record_audio(RECORD_SECONDS)
        print("⏳ Processing...")
        result = send_to_backend(audio)
        if result:
            print(f"\n📝 You said : {result.get('transcript', '')}")
            print(f"😊 Emotion  : {result.get('emotion', '')}")
            print(f"💬 Monto    : {result.get('response', '')}\n")
            play_tts(result.get("response", ""), result.get("emotion", "neutral"))
        else:
            print("❌ No response from backend\n")
except KeyboardInterrupt:
    print("\nBye!")
