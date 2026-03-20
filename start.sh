#!/bin/bash
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║           Nexus — One-Click Start            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${NEXUS_DATA_DIR:-$HOME/Nexus}"
mkdir -p "$DATA_DIR"

# ── 1. Check for python3 ─────────────────────────────────────
echo "→ Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "  ✗ python3 not found. Install Python 3.10+ from https://python.org"
    exit 1
fi
echo "  ✓ python3 found: $(python3 --version)"

# ── 2. Check Ollama ──────────────────────────────────────────
echo "→ Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "  ✗ Ollama not found. Install from: https://ollama.ai"
    echo "    macOS: brew install ollama"
    echo "    Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    exit 1
fi

if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "  Starting Ollama..."
    ollama serve &> /dev/null &
    sleep 3
fi
echo "  ✓ Ollama running"

MODEL="${NEURAL_MODEL:-llama3.1:8b}"
if ! ollama list | grep -q "$MODEL"; then
    echo "  ↓ Pulling $MODEL (first time only, may take a few minutes)..."
    ollama pull "$MODEL"
fi
echo "  ✓ Model ready: $MODEL"

# ── 3. Backend ───────────────────────────────────────────────
echo "→ Starting backend..."
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
python3 -m pip install -q --upgrade pip
python3 -m pip install -q -r requirements.txt

NEXUS_DATA_DIR="$DATA_DIR" python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for backend to be ready
echo "  Waiting for backend..."
for i in $(seq 1 15); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done
echo "  ✓ Backend running on port 8000"

# ── 4. Frontend ──────────────────────────────────────────────
echo "→ Starting frontend..."
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm install --silent 2>/dev/null || true
fi
npm run dev &
FRONTEND_PID=$!

sleep 2

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✓ Nexus is running!                        ║"
echo "║                                             ║"
echo "║  App:      http://localhost:8080             ║"
echo "║  Backend:  http://localhost:8000             ║"
echo "║  Data:     $DATA_DIR"
echo "║                                             ║"
echo "║  Press Ctrl+C to stop everything            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Open browser (macOS/Linux)
if command -v open &> /dev/null; then
    open http://localhost:8080
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8080
fi

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; deactivate 2>/dev/null; exit" INT TERM
wait
