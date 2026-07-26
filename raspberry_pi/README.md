# Monto AI — Raspberry Pi Listener

This is the **only folder you need on your Raspberry Pi**.  
The Pi acts as a lightweight mic + speaker — all heavy processing (STT, LLM, TTS) happens on your backend/GPU machine.

## Folder Contents

```
raspberry_pi/
├── monto_listener.py       ← main script, listens for "Hey Monto"
├── requirements.txt        ← Python dependencies (lightweight)
├── .env.example            ← copy to .env and fill in your values
├── monto.service           ← systemd service (auto-start on boot)
├── setup.sh                ← run once to install everything
├── install_service.sh      ← run once to enable auto-start on boot
│
├── monto-frontend.service  ← systemd service that runs the web UI (frontend/)
├── monto-kiosk.sh          ← waits for the web UI, opens it full-screen in Chromium
├── monto-kiosk.desktop     ← autostart entry that runs monto-kiosk.sh on login
└── install_kiosk.sh        ← run once to boot straight into the full web UI (kiosk mode)
```

## Setup (run once on Pi)

```bash
# 1. Clone the repo
git clone https://github.com/monto-official/monto-working.git monto-working
cd monto-working/raspberry_pi

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

## Optional: boot straight into the full web UI (kiosk mode)

By default the Pi is just a mic + speaker (`monto_listener.py`) — no screen
UI. If your Pi has a display attached and you want it to boot directly into
the same web app shown on `frontend/` (full-screen, no desktop visible),
run this **in addition to** the setup above:

```bash
cd monto-working/raspberry_pi
bash install_kiosk.sh
```

Requirements:
- Raspberry Pi OS **with Desktop** (not Lite), with Desktop Autologin enabled
  (`sudo raspi-config` → System Options → Boot / Auto Login → Desktop Autologin)
- Node.js 18+ (`node -v` — install via NodeSource if missing, see script output)

This builds `frontend/` for production and runs it as a systemd service
(`monto-frontend`), then opens it in Chromium kiosk mode on login.
`NEXT_PUBLIC_API_URL` is set automatically from `raspberry_pi/.env`'s
`BACKEND_URL` — no need to type your backend's LAN IP in twice. If
`raspberry_pi/.env` isn't set up yet, run `setup.sh` (or set `BACKEND_URL`
by hand) first, then re-run `install_kiosk.sh`.

```bash
sudo systemctl status monto-frontend   # check the web server
sudo journalctl -u monto-frontend -f   # live logs
# after changing frontend code:
cd frontend && npm run build && sudo systemctl restart monto-frontend
```
