#!/bin/bash
# Run this ONCE on your Pi to install the auto-start service

echo "Installing Monto as a system service..."

# Copy service file
sudo cp monto.service /etc/systemd/system/monto.service

# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable monto.service

# Start it now
sudo systemctl start monto.service

echo ""
echo "✅ Done! Monto will now start on every boot."
echo ""
echo "Useful commands:"
echo "  Check status:  sudo systemctl status monto"
echo "  View logs:     sudo journalctl -u monto -f"
echo "  Stop:          sudo systemctl stop monto"
echo "  Restart:       sudo systemctl restart monto"
