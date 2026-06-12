# Monto AI — Asterisk VoIP (Linux / GPU Server)

Asterisk runs as a Docker container on the same Linux GPU server as the Monto backend. All four services start with one command.

---

## Architecture

```
Internet / LAN
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GPU Server (Linux)  192.168.1.100              │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │  Asterisk    │   │  Backend     │   │  Parent App      │   │
│  │  (Docker)    │   │  FastAPI     │   │  Next.js :3001   │   │
│  │              │◀──│  :8000       │   │                  │   │
│  │  SIP :5060   │   │  /call/*     │   │  JsSIP WebRTC    │   │
│  │  WS  :8088   │   │  (AMI)       │   │  ─── ws:8088 ──▶ │   │
│  │  AMI :5038   │   └──────────────┘   └──────────────────┘   │
│  └──────┬───────┘                                              │
│         │                         ┌──────────────────┐         │
│         │ SIP UDP :5060           │  Frontend        │         │
│         │                         │  Next.js :3000   │         │
└─────────┼─────────────────────────┴──────────────────┴─────────┘
          │
          ▼
   Raspberry Pi
   SIP UDP (pjsua2 or backend REST)
   ext: monto
```

**Call flows:**
- **Parent → Monto:** Browser (JsSIP) → WS :8088 → Asterisk → Pi (SIP UDP)
- **Monto → Parent:** Pi calls `POST /call/ring-parent` → Backend → AMI → Asterisk → Browser rings

---

## Quick Start (Linux GPU server)

```bash
# Clone / pull the repo, then:
cd monto-ai
chmod +x install.sh
sudo ./install.sh
```

That's it. The script installs Docker, sets up `.env`, opens firewall ports, builds images, and starts everything.

---

## Manual Setup (if you prefer)

### 1. Create .env
```bash
cp .env.example .env
nano .env   # set SERVER_IP, passwords, API keys
```

### 2. Start everything
```bash
docker compose up -d --build
```

### 3. Check status
```bash
docker compose ps
docker compose logs -f asterisk
```

### 4. Verify Asterisk is working
```bash
# Check SIP peers are registered (run after parent app + Pi connect)
docker compose exec asterisk asterisk -rx "sip show peers"

# Check AMI is accessible
docker compose exec asterisk asterisk -rx "manager show connected"

# Make a test call (extension 999 plays a sound)
docker compose exec asterisk asterisk -rx "originate SIP/parent extension 999@monto-calls"
```

---

## Configuring the Raspberry Pi

After `install.sh` runs, add to `raspberry_pi/.env`:

```env
BACKEND_URL=http://YOUR_SERVER_IP:8000
ASTERISK_HOST=YOUR_SERVER_IP
SIP_USERNAME=monto
SIP_PASSWORD=montopass123        # must match .env MONTO_SIP_PASSWORD
SIP_DOMAIN=YOUR_SERVER_IP
PARENT_EXTENSION=parent
```

The Pi uses `sip_client.py` to either:
- **Call parent via REST** (default, no extra deps): `POST /call/ring-parent`
- **Register as SIP peer** (install `pjsua2` on Pi): handles inbound calls from parent too

---

## Configuring the Parent App

The parent app reads its SIP config from environment variables baked in at Docker build time (set in `.env`). After changing passwords, rebuild:

```bash
docker compose up -d --build parent-app
```

Or open `http://YOUR_SERVER_IP:3001` → click **SIP Settings** to update in the browser without rebuilding.

---

## Port Reference

| Port | Protocol | Service | Used by |
|------|----------|---------|---------|
| 5060 | UDP/TCP | Asterisk SIP | Raspberry Pi |
| 8088 | TCP | Asterisk WebSocket | Browser (JsSIP) |
| 5038 | TCP | Asterisk AMI | Backend (internal) |
| 10000–20000 | UDP | RTP audio | Both peers |
| 8000 | TCP | Monto backend | Everything |
| 3000 | TCP | Monto frontend | Child browser |
| 3001 | TCP | Parent app | Parent browser |

---

## Changing Passwords

1. Edit `.env` — update `PARENT_SIP_PASSWORD`, `MONTO_SIP_PASSWORD`, `ASTERISK_AMI_SECRET`
2. Rebuild: `docker compose up -d --build`
3. Update `raspberry_pi/.env` with new `SIP_PASSWORD`

---

## Troubleshooting

**Parent app shows "Error" / won't connect**
```bash
# Check Asterisk WebSocket is up
curl -v http://YOUR_SERVER_IP:8088/ws
# Should get a 400 (expected — not a plain HTTP endpoint)
```

**Pi can't register (sip show peers shows offline)**
```bash
# Verify SIP port is reachable from Pi
nmap -sU -p 5060 YOUR_SERVER_IP
# Check Pi password matches sip.conf
docker compose exec asterisk asterisk -rx "sip show peer monto"
```

**Calls connect but no audio**
- RTP ports 10000-20000/udp must be open on the firewall
- If server is behind NAT, set `externaddr` in `sip.conf` `[general]`

**Rebuild single service**
```bash
docker compose up -d --build asterisk   # after config change
docker compose restart backend          # after .env change
```
