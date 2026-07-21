#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Monto AI — I2S Audio Setup
# Configures:
#   - INMP441 I2S Microphone
#   - MAX98357A I2S Amplifier / Speaker
# Run ONCE after fresh Pi OS install
# ─────────────────────────────────────────────────────────────────

set -e

echo "=== Monto AI I2S Audio Setup ==="
echo ""

# ── 1. config.txt ─────────────────────────────────────────────────
CONFIG_FILE="/boot/firmware/config.txt"
# Older Pi OS uses /boot/config.txt
[ -f "/boot/config.txt" ] && CONFIG_FILE="/boot/config.txt"

echo "Updating $CONFIG_FILE..."

# Remove old Monto I2S entries if any
sudo sed -i '/# Monto I2S/,/^$/d' "$CONFIG_FILE"

# Add new entries
sudo tee -a "$CONFIG_FILE" > /dev/null << 'EOF'

# Monto I2S Audio
dtparam=i2s=on
dtoverlay=i2s-mmap
dtoverlay=max98357a,sdmode-pin=25
EOF

echo "✅ config.txt updated"

# ── 2. ALSA config ────────────────────────────────────────────────
echo "Writing /etc/asound.conf..."

sudo tee /etc/asound.conf > /dev/null << 'EOF'
# MAX98357A I2S Amplifier (output)
pcm.max98357a {
    type hw
    card 0
    device 0
}

# INMP441 I2S Microphone (input)
pcm.i2s_mic {
    type hw
    card 1
    device 0
}

# Default audio device
pcm.!default {
    type asym
    playback.pcm {
        type plug
        slave.pcm "max98357a"
    }
    capture.pcm {
        type plug
        slave.pcm "i2s_mic"
    }
}

ctl.!default {
    type hw
    card 0
}
EOF

echo "✅ ALSA config written"

# ── 3. Install audio tools ────────────────────────────────────────
echo "Installing audio tools..."
sudo apt install -y alsa-utils portaudio19-dev python3-pyaudio mpg123 2>/dev/null || true
echo "✅ Audio tools installed"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. sudo reboot"
echo "  2. After reboot: arecord -l  (check mic appears)"
echo "  3. arecord -D plughw:1,0 -c1 -r 16000 -f S32_LE -d 3 test.wav"
echo "  4. aplay test.wav"
echo "  5. python check_all.py"
echo ""
echo "GPIO connections:"
echo "  INMP441: VDD→3.3V  GND→GND  SD→GPIO20  WS→GPIO19  SCK→GPIO18  L/R→GND"
echo "  MAX98357A: VIN→5V  GND→GND  DIN→GPIO21  BCLK→GPIO18  LRC→GPIO19"
