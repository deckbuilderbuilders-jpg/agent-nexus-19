#!/bin/bash
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║     Neural Agent v4 — Setup Script           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Check Ollama ──────────────────────────────────────────
echo "→ Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo "  ✓ Ollama installed"
else
    echo "  ✗ Ollama not found. Install from: https://ollama.ai"
    echo "    brew install ollama"
    exit 1
fi

# Check if Ollama is running
if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "  ✓ Ollama running"
else
    echo "  ⚠ Ollama not running. Starting..."
    ollama serve &
    sleep 3
fi

# Pull model if needed
MODEL="${NEURAL_MODEL:-llama3.1:8b}"
echo "→ Checking model: $MODEL"
if ollama list | grep -q "$MODEL"; then
    echo "  ✓ $MODEL available"
else
    echo "  ↓ Pulling $MODEL (this may take a few minutes)..."
    ollama pull "$MODEL"
fi

# ── 2. Python venv ───────────────────────────────────────────
echo ""
echo "→ Setting up Python environment..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  ✓ Created venv"
fi

source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "  ✓ Dependencies installed"

# ── 3. Create data directory ─────────────────────────────────
DATA_DIR="${NEURAL_DATA_DIR:-$HOME/neural-agent}"
mkdir -p "$DATA_DIR"
echo "  ✓ Data directory: $DATA_DIR"

# ── 4. Done ──────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Setup complete! Start with:                 ║"
echo "║                                              ║"
echo "║  cd backend                                  ║"
echo "║  source venv/bin/activate                    ║"
echo "║  uvicorn main:app --reload --port 8000       ║"
echo "║                                              ║"
echo "║  Then in another terminal:                   ║"
echo "║  npm run dev                                 ║"
echo "║                                              ║"
echo "║  Open: http://localhost:8080                 ║"
echo "╚══════════════════════════════════════════════╝"
