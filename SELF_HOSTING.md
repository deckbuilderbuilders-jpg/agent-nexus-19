# Neural Agent v4 — Self-Hosting Guide

## Architecture

```
Browser (localhost:8080)
  → Vite dev server (proxies /api → :8000)
    → FastAPI (localhost:8000)
      → Ollama (localhost:11434)
      → ChromaDB (~/neural-agent/chromadb/)
      → JSON files (~/neural-agent/*.json)
```

Nothing leaves your machine. No cloud, no API keys, no external calls.

## Prerequisites

- **macOS** with Homebrew
- **Python 3.11+** (`python3 --version`)
- **Node.js 18+** (`node --version`)
- **32GB RAM** (8B model uses ~5GB, leaves plenty for ChromaDB + browser)

## Quick Start

### 1. Install Ollama

```bash
brew install ollama
ollama serve          # starts the Ollama service
ollama pull llama3.1:8b  # downloads the model (~4.7GB)
```

### 2. Set up the backend

```bash
cd backend
chmod +x setup.sh
./setup.sh
```

Or manually:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

You should see:
```
✓ Ollama connected — llama3.1:8b loaded
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Start the frontend

In a **second terminal**:

```bash
npm install
npm run dev
```

### 5. Open the app

Go to **http://localhost:8080**

The status indicator should show "Connected" (green dot).

## Data Storage

All data persists in `~/neural-agent/`:

| File | Contents |
|---|---|
| `chromadb/` | Vector database (memories, episodes) |
| `profile.json` | User profile |
| `rules.json` | Behavioral rules |
| `relationships.json` | Topic spatial relationships |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEURAL_MODEL` | `llama3.1:8b` | Ollama model name |
| `NEURAL_DATA_DIR` | `~/neural-agent` | Where data is stored |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |

## Upgrading to a GPU / Bigger Model

When you get a GPU-equipped machine:

```bash
# Pull a larger model
ollama pull llama3.1:70b    # needs ~40GB VRAM
# or
ollama pull deepseek-r1:32b  # strong reasoning, ~20GB VRAM
# or
ollama pull qwen2.5:32b      # good general purpose

# Set the model
export NEURAL_MODEL="llama3.1:70b"

# Restart backend
uvicorn main:app --reload --port 8000
```

For NVIDIA GPUs, Ollama auto-detects CUDA. For Apple Silicon, it uses Metal (your M-series GPU) automatically.

### Model Recommendations by Hardware

| RAM/VRAM | Model | Notes |
|---|---|---|
| 16GB (M1/M2) | `llama3.1:8b` | Good baseline |
| 32GB (M2 Pro/Max) | `llama3.1:8b` or `qwen2.5:14b` | Room for larger context |
| 48GB+ (M2 Ultra) | `deepseek-r1:32b` | Strong reasoning |
| 24GB VRAM (4090) | `llama3.1:70b` (quantized) | Near frontier quality |
| 80GB VRAM (A100) | `llama3.1:70b` | Full precision |

## Troubleshooting

**"Ollama not reachable"**
```bash
ollama serve  # start the service
```

**"Model not found"**
```bash
ollama pull llama3.1:8b
```

**"Connection refused on :8000"**
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```

**Frontend shows "Offline — demo mode"**
The backend isn't running. Start it first, then refresh the page.

**Slow responses**
On CPU-only machines, 8B models run at ~5-15 tok/s. The Performance HUD shows real-time speed. For faster inference, use Apple Silicon (Metal) or an NVIDIA GPU.
