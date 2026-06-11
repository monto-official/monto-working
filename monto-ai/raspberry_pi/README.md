# Monto AI — Raspberry Pi Listener

This is the **only folder you need on your Raspberry Pi**.  
The Pi acts as a lightweight mic + speaker — all heavy processing (STT, LLM, TTS) happens on your backend/GPU machine.

## Folder Contents

```
raspberry_pi/
├── monto_listener.py     ← main script, listens for "Hey Monto"
├── requirements.txt      ← Python dependencies (lightweight)
├── .env.example          ← copy to .env and fill in your values
├── monto.service         ← systemd service (auto-start on boot)
├── setup.sh              ← run once to install everything
└── install_service.sh    ← run once to enable auto-start on boot
```

## Setup (run once on Pi)

```bash
# 1. Clone only this folder
git clone --no-checkout <your-repo-url> monto-pi
cd monto-pi
git sparse-checkout init
git sparse-checkout set monto-ai/raspberry_pi
git checkout
cd monto-ai/raspberry_pi

# 2. Install dependencies
bash setup.sh

# 3. Set your config
cp .env.example .env
nano .env    # fill in BACKEND_URL and PORCUPINE_KEY

# 4. Enable auto-start on boot
bash install_service.sh
```

## .env values you must set

| Key | Description |
|-----|-------------|
| `BACKEND_URL` | IP of your backend machine e.g. `http://192.168.1.101:8000` |
| `PORCUPINE_KEY` | Free key from https://picovoice.ai/ |
| `RECORD_SECONDS` | How long to record after wake word (default: 5) |

## After setup

Power on the Pi → it auto-starts → say **"Hey Monto"** → it works.

## Useful commands

```bash
sudo systemctl status monto      # check if running
sudo journalctl -u monto -f      # live logs
sudo systemctl restart monto     # restart
sudo systemctl stop monto        # stop
```
