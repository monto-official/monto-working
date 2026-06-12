"""
Monto AI — Full System Check
Checks: Mic → Record → Backend → STT → LLM → TTS → Playback
Run: python check_all.py
"""
import os, io, wave, time, sys, tempfile, subprocess
import numpy as np
import requests
import pyaudio
from dotenv import dotenv_values

env          = dotenv_values(".env")
BACKEND_URL  = env.get("BACKEND_URL", "http://100.76.66.40:8000")
FALLBACK_URL = env.get("FALLBACK_BACKEND_URL", "http://100.122.50.13:8000")
SESSION_ID   = env.get("SESSION_ID", "pi-check")
SAMPLE_RATE  = 16000

def ok(msg):   print(f"  ✅ {msg}")
def fail(msg): print(f"  ❌ {msg}")
def info(msg): print(f"  ℹ  {msg}")
def sep():     print("-" * 50)

# ── 1. MIC CHECK ──────────────────────────────────────────────────────────────
sep()
print("1. MICROPHONE CHECK")
pa = pyaudio.PyAudio()
mic_idx = None
try:
    for i in range(pa.get_device_count()):
        d = pa.get_device_info_by_index(i)
        if d["maxInputChannels"] > 0:
            info(f"Input [{i}]: {d['name']}")
            if mic_idx is None:
                mic_idx = i
    if mic_idx is not None:
        ok(f"Mic found at index {mic_idx}")
    else:
        fail("No input device found!")
        sys.exit(1)
finally:
    pa.terminate()

# ── 2. RECORD TEST ────────────────────────────────────────────────────────────
sep()
print("2. RECORDING TEST (3 seconds)")

# Find supported sample rate
pa2 = pyaudio.PyAudio()
mic_rate = 44100  # default
try:
    for rate in [16000, 44100, 48000]:
        try:
            if pa2.is_format_supported(rate, input_device=mic_idx,
                                        input_channels=1,
                                        input_format=pyaudio.paInt16):
                mic_rate = rate
                break
        except Exception:
            continue
finally:
    pa2.terminate()

info(f"Using sample rate: {mic_rate}Hz")
info("Recording 3s of audio from mic... SPEAK NOW!")
pa = pyaudio.PyAudio()
try:
    stream = pa.open(
        format=pyaudio.paInt16, channels=1,
        rate=mic_rate, input=True,
        input_device_index=mic_idx,
        frames_per_buffer=512,
    )
    frames = [stream.read(512, exception_on_overflow=False)
              for _ in range(int(mic_rate / 512 * 3))]
    stream.stop_stream()
    stream.close()

    arr    = np.frombuffer(b"".join(frames), dtype=np.int16).astype(np.float32)
    rms    = np.sqrt(np.mean(arr ** 2))
    peak   = np.max(np.abs(arr))
    info(f"RMS energy: {rms:.1f}  Peak: {peak:.0f}")

    if rms < 50:
        fail(f"Audio is silence (RMS={rms:.1f}) — mic may not be working")
    elif rms < 300:
        ok(f"Audio recorded but quiet (RMS={rms:.1f}) — try speaking louder")
    else:
        ok(f"Audio recorded with good level (RMS={rms:.1f})")

    # Save WAV
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(mic_rate)
        wf.writeframes(b"".join(frames))
    wav_bytes = buf.getvalue()
    ok(f"WAV file size: {len(wav_bytes):,} bytes")

except Exception as e:
    fail(f"Recording failed: {e}")
    pa.terminate()
    sys.exit(1)
finally:
    pa.terminate()

# ── 3. BACKEND CHECK ──────────────────────────────────────────────────────────
sep()
print("3. BACKEND CONNECTION CHECK")
active_url = None
for url, label in [(BACKEND_URL, "GPU"), (FALLBACK_URL, "Fallback")]:
    try:
        r = requests.get(f"{url}/health", timeout=5)
        if r.ok:
            data = r.json()
            ok(f"{label} backend online: {url}")
            info(f"Mode: {data.get('mode', '?')} | Version: {data.get('version', '?')}")
            if active_url is None:
                active_url = url
        else:
            fail(f"{label} backend returned {r.status_code}: {url}")
    except Exception as e:
        fail(f"{label} backend unreachable: {url} ({e})")

if active_url is None:
    fail("No backend available! Start the backend first.")
    sys.exit(1)

# ── 4. STT CHECK ──────────────────────────────────────────────────────────────
sep()
print("4. SPEECH-TO-TEXT CHECK")
info(f"Sending audio to {active_url}/voice/process ...")
try:
    r = requests.post(
        f"{active_url}/voice/process",
        files={"audio": ("audio.wav", wav_bytes, "audio/wav")},
        headers={"X-Session-Id": SESSION_ID},
        timeout=30,
    )
    r.raise_for_status()
    result     = r.json()
    transcript = result.get("transcript", "")
    emotion    = result.get("emotion", "")
    response   = result.get("response", "")

    if transcript:
        ok(f"STT working! Transcript: '{transcript}'")
    else:
        fail("STT returned empty transcript (audio may be too quiet or silent)")

    ok(f"LLM working! Emotion: {emotion}")
    ok(f"Response: '{response[:80]}'")

except Exception as e:
    fail(f"Backend processing failed: {e}")
    sys.exit(1)

# ── 5. TTS CHECK ──────────────────────────────────────────────────────────────
sep()
print("5. TEXT-TO-SPEECH CHECK")
test_text = response if response else "Hello! I am Monto, your AI friend!"
info(f"Requesting TTS for: '{test_text[:50]}'")
try:
    r = requests.post(
        f"{active_url}/tts/speak",
        json={"text": test_text, "emotion": emotion or "happy"},
        timeout=15,
    )
    r.raise_for_status()
    content_type = r.headers.get("Content-Type", "")
    audio_size   = len(r.content)
    suffix       = ".wav" if "wav" in content_type else ".mp3"
    ok(f"TTS working! Audio: {audio_size:,} bytes ({suffix[1:].upper()})")

    # ── 6. PLAYBACK CHECK ─────────────────────────────────────────────────────
    sep()
    print("6. AUDIO PLAYBACK CHECK")
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, r.content)
        os.close(fd)
        info(f"Playing audio... (you should hear Monto speak)")
        if suffix == ".wav":
            ret = subprocess.run(["aplay", "-q", path], timeout=30).returncode
        else:
            ret = subprocess.run(["mpg123", "-q", path], timeout=30).returncode

        if ret == 0:
            ok("Audio played successfully!")
        else:
            fail(f"Playback command failed (exit code {ret})")
            info("Install aplay: sudo apt install alsa-utils")
            info("Install mpg123: sudo apt install mpg123")
    finally:
        try: os.unlink(path)
        except: pass

except Exception as e:
    fail(f"TTS failed: {e}")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
sep()
print("SUMMARY")
sep()
print(f"  Backend URL:  {active_url}")
print(f"  Mic index:    {mic_idx}")
print(f"  Transcript:   '{transcript}'")
print(f"  Response:     '{response[:60]}'")
print(f"  Emotion:      {emotion}")
sep()
print("All checks done!")
