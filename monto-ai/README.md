# 🤖 MONTO AI — Child-Safe Voice AI Companion

Monto is a premium child-safe voice AI companion application. Children speak naturally, and Monto listens, understands, and responds with emotion-aware animated avatar responses.

---

## 🏗️ Architecture

```
monto-ai/
├── frontend/          # Next.js 15 + TypeScript + TailwindCSS + Framer Motion
└── backend/           # FastAPI + Python 3.12
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- Groq API Key

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Add your GROQ_API_KEY to .env

uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Create .env.local
cp .env.example .env.local

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🐳 Docker Support

```bash
# From monto-ai root
docker-compose up --build
```

---

## 🔑 Environment Variables

### Backend `.env`
```
GROQ_API_KEY=your_groq_api_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🎯 Features

- 🎤 Voice recording with visual feedback
- 🧠 Groq Whisper Large V3 speech-to-text
- 💬 Qwen3-32B LLM responses
- 😊 Animated SVG avatar with 7 emotion states
- 🌏 English + Nepali language support
- 🌙 Dark mode
- 📱 Mobile-first responsive design
- 💾 Conversation history
- ⚙️ Settings panel

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/voice/query` | Upload audio, get AI response |
| GET | `/health` | Health check |

---

## 🛡️ Child Safety

- All responses filtered for age 5–15
- No adult content
- Short, educational responses
- Safe intent classification
