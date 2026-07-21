#!/bin/bash
# Run this on your Raspberry Pi to set everything up

echo "Installing system dependencies..."
sudo apt update
sudo apt install -y python3 python3-pip python3-venv portaudio19-dev python3-pyaudio git

echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python packages..."
pip install -r requirements.txt

echo "Copying env file..."
cp .env.example .env

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env → set BACKEND_URL and PORCUPINE_KEY"
echo "  2. Get a free Picovoice key at: https://picovoice.ai/"
echo "  3. Run: bash install_service.sh   ← makes it auto-start on boot"
echo "  4. Power cycle the Pi — it will start listening automatically"
