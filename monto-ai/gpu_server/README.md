# Monto AI — GPU Server

Runs on your **GPU machine**. Provides two local AI services:
- **Whisper STT** — speech to text (port 5001)
- **Ollama LLM** — Qwen2.5 language model (port 11434)

## Requirements

- Linux machine with NVIDIA GPU
- CUDA drivers installed
- Python 3.10+

## Setup

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull the LLM model
ollama pull qwen2.5:7b   # or :14b / :32b depending on your VRAM

# 3. Install Whisper server deps
pip install -r requirements.txt

# 4. Copy env file
cp .env.example .env
nano .env   # set GPU_SERVER_API_KEY (must match backend .env)
```

## Run

```bash
bash start_gpu_server.sh
```

This starts:
- Ollama on `0.0.0.0:11434`
- Whisper STT server on `0.0.0.0:5001`

## Then update backend/.env

```
USE_LOCAL_GPU=true
GPU_WHISPER_URL=http://<this-machine-ip>:5001
GPU_OLLAMA_URL=http://<this-machine-ip>:11434
GPU_SERVER_API_KEY=my-secret-key-123
```

## VRAM Guide

| Model         | Min VRAM |
|---------------|----------|
| qwen2.5:7b    | 6 GB     |
| qwen2.5:14b   | 10 GB    |
| qwen2.5:32b   | 20 GB    |
| whisper large | 10 GB    |
| whisper medium| 5 GB     |
| whisper small | 2 GB     |
