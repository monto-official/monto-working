#!/bin/bash
# Run this ONCE on your Pi to make it boot straight into the Monto web UI,
# full-screen, no desktop visible. Needs Raspberry Pi OS *with Desktop* (not
# Lite) and Desktop Autologin enabled — check with: sudo raspi-config →
# System Options → Boot / Auto Login → Desktop Autologin.
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

echo "Installing Chromium + kiosk helpers..."
sudo apt update
sudo apt install -y chromium-browser unclutter curl

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Next.js needs Node 18+."
  echo "Install it first, e.g.: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

echo "Setting up frontend/.env (if missing)..."
if [ ! -f "$FRONTEND_DIR/.env" ] && [ -f "$FRONTEND_DIR/.env.example" ]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
  echo "⚠️  Created frontend/.env from .env.example — edit NEXT_PUBLIC_API_URL to point"
  echo "   at your backend machine's LAN IP (same host as raspberry_pi/.env's BACKEND_URL)."
  echo "   The default (localhost:8000) only works if the backend also runs on this Pi."
fi

echo "Installing frontend dependencies and building for production..."
(cd "$FRONTEND_DIR" && npm install && npm run build)

echo "Installing monto-frontend systemd service..."
sudo cp "$REPO_ROOT/raspberry_pi/monto-frontend.service" /etc/systemd/system/monto-frontend.service
sudo systemctl daemon-reload
sudo systemctl enable monto-frontend.service
sudo systemctl start monto-frontend.service

echo "Installing kiosk autostart..."
chmod +x "$REPO_ROOT/raspberry_pi/monto-kiosk.sh"
mkdir -p ~/.config/autostart
cp "$REPO_ROOT/raspberry_pi/monto-kiosk.desktop" ~/.config/autostart/monto-kiosk.desktop

echo ""
echo "✅ Done! On next boot the Pi will start the frontend server and open it"
echo "   full-screen in Chromium automatically — no manual steps needed."
echo ""
echo "Useful commands:"
echo "  Frontend status: sudo systemctl status monto-frontend"
echo "  Frontend logs:   sudo journalctl -u monto-frontend -f"
echo "  Rebuild after a code change: cd frontend && npm run build && sudo systemctl restart monto-frontend"
echo ""
echo "Reboot now to test: sudo reboot"
