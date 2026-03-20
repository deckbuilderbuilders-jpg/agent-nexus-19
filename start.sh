#!/bin/bash
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║        Nexus — One-Click Start               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${NEXUS_DATA_DIR:-$HOME/Nexus}"
mkdir -p "$DATA_DIR"

# Check Ollama
echo "→ Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "  ✗ Ollama not found. Install: https://ollama.ai"
    exit 1
fi

if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "  Starting Ollama..."
    ollama serve &
    sleep 3
fi
echo "  ✓ Ollama running"

MODEL="${NEURAL_MODEL:-llama3.1:8b}"
if ! ollama list | grep -q "$MODEL"; then
    echo "  ↓ Pulling $MODEL..."
    ollama pull "$MODEL"
fi

# Backend
echo "→ Starting backend..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
NEURAL_DATA_DIR="$DATA_DIR" uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Frontend
echo "→ Starting frontend..."
npm install --silent 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Nexus is running!                           ║"
echo "║                                              ║"
echo "║  App:     http://localhost:8080               ║"
echo "║  Backend: http://localhost:8000               ║"
echo "║  Data:    $DATA_DIR"
echo "║                                              ║"
echo "║  Press Ctrl+C to stop everything             ║"
echo "╚══════════════════════════════════════════════╝"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
