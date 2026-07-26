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
fi

# Reuse BACKEND_URL from raspberry_pi/.env (already set up for the wake-word
# listener) so the web UI's backend URL doesn't have to be typed in twice.
PI_ENV="$REPO_ROOT/raspberry_pi/.env"
BACKEND_URL_VALUE=""
if [ -f "$PI_ENV" ]; then
  BACKEND_URL_VALUE=$(grep -m1 '^BACKEND_URL=' "$PI_ENV" | cut -d= -f2-)
fi

if [ -n "$BACKEND_URL_VALUE" ]; then
  if grep -q '^NEXT_PUBLIC_API_URL=' "$FRONTEND_DIR/.env"; then
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$BACKEND_URL_VALUE|" "$FRONTEND_DIR/.env"
  else
    echo "NEXT_PUBLIC_API_URL=$BACKEND_URL_VALUE" >> "$FRONTEND_DIR/.env"
  fi
  echo "✅ frontend/.env NEXT_PUBLIC_API_URL set to $BACKEND_URL_VALUE (from raspberry_pi/.env)"
else
  echo "⚠️  Couldn't find BACKEND_URL in raspberry_pi/.env — set it there first (see"
  echo "   raspberry_pi/.env.example), then re-run this script so the web UI picks it up."
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
