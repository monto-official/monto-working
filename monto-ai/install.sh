#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  Monto AI — Linux GPU Server Install Script
#
#  Run this once on a fresh Ubuntu/Debian GPU server:
#    chmod +x install.sh && sudo ./install.sh
#
#  What it does:
#    1. Installs Docker + Docker Compose (if missing)
#    2. Copies .env.example → .env and prompts you to fill it in
#    3. Opens firewall ports for SIP/RTP/WebSocket
#    4. Builds and starts all 4 containers (Asterisk, Backend, Frontend, Parent App)
#    5. Verifies each service is healthy
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 1. Root check ─────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Please run as root: sudo ./install.sh"

# ── 2. Install Docker ─────────────────────────────────────────────────────────
info "Checking Docker..."
if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    success "Docker installed"
else
    success "Docker already installed: $(docker --version)"
fi

# ── 3. Install Docker Compose plugin ──────────────────────────────────────────
if ! docker compose version &>/dev/null; then
    info "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
    success "Docker Compose installed"
else
    success "Docker Compose already installed: $(docker compose version --short)"
fi

# ── 4. Set up .env ────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
    info "Creating .env from template..."
    cp .env.example .env

    # Auto-detect server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    sed -i "s/SERVER_IP=192\.168\.1\.100/SERVER_IP=${SERVER_IP}/" .env
    success "Auto-detected SERVER_IP=${SERVER_IP}"

    echo ""
    warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    warn " IMPORTANT: Edit .env before continuing!"
    warn " At minimum change the SIP/AMI passwords from their defaults."
    warn " If using cloud AI (USE_LOCAL_GPU=false), add GROQ_API_KEY."
    warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    read -rp "Press ENTER after editing .env to continue, or Ctrl+C to abort: "
else
    success ".env already exists — skipping template copy"
fi

# Load .env
set -a; source .env; set +a

# ── 5. Open firewall ports ────────────────────────────────────────────────────
info "Configuring firewall (ufw)..."
if command -v ufw &>/dev/null; then
    ufw allow 5060/udp   comment "Asterisk SIP (Pi)"        2>/dev/null || true
    ufw allow 5060/tcp   comment "Asterisk SIP TCP"          2>/dev/null || true
    ufw allow 8088/tcp   comment "Asterisk WebSocket (JsSIP)" 2>/dev/null || true
    ufw allow 8000/tcp   comment "Monto backend API"          2>/dev/null || true
    ufw allow 3000/tcp   comment "Monto frontend"             2>/dev/null || true
    ufw allow 3001/tcp   comment "Monto parent app"           2>/dev/null || true
    # RTP media range
    ufw allow 10000:20000/udp comment "Asterisk RTP"          2>/dev/null || true
    success "Firewall rules added"
else
    warn "ufw not found — skipping firewall config. Open ports manually: 5060/udp, 8088/tcp, 8000/tcp, 3000/tcp, 3001/tcp, 10000-20000/udp"
fi

# ── 6. Build and start containers ─────────────────────────────────────────────
info "Building Docker images (this takes a few minutes the first time)..."
docker compose build --parallel

info "Starting all services..."
docker compose up -d

# ── 7. Wait for health checks ─────────────────────────────────────────────────
info "Waiting for services to become healthy..."

wait_healthy() {
    local name=$1
    local url=$2
    local retries=20
    local delay=5
    for ((i=1; i<=retries; i++)); do
        if curl -sf "$url" &>/dev/null; then
            success "${name} is healthy"
            return 0
        fi
        echo -n "."
        sleep $delay
    done
    warn "${name} did not become healthy in time — check: docker compose logs ${name}"
    return 1
}

echo ""
wait_healthy "backend"    "http://localhost:8000/health"
wait_healthy "frontend"   "http://localhost:3000"
wait_healthy "parent-app" "http://localhost:3001"

# Asterisk health via AMI port
if nc -z 127.0.0.1 5038 2>/dev/null; then
    success "asterisk AMI port is open"
else
    warn "asterisk AMI port 5038 not reachable yet — check: docker compose logs asterisk"
fi

# ── 8. Print summary ──────────────────────────────────────────────────────────
SERVER_IP="${SERVER_IP:-$(hostname -I | awk '{print $1}')}"
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Monto AI is running!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🤖 Monto AI (child UI)    → http://${SERVER_IP}:3000"
echo -e "  📱 Parent App             → http://${SERVER_IP}:3001"
echo -e "  🔧 Backend API docs       → http://${SERVER_IP}:8000/docs"
echo -e "  📞 Asterisk WebSocket SIP → ws://${SERVER_IP}:8088/ws"
echo ""
echo -e "  Raspberry Pi .env:"
echo -e "    BACKEND_URL=http://${SERVER_IP}:8000"
echo -e "    ASTERISK_HOST=${SERVER_IP}"
echo -e "    SIP_DOMAIN=${SERVER_IP}"
echo ""
echo -e "  Useful commands:"
echo -e "    docker compose logs -f asterisk   # Asterisk logs"
echo -e "    docker compose logs -f backend    # Backend logs"
echo -e "    docker compose restart asterisk   # Reload after config change"
echo -e "    docker compose down               # Stop everything"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
