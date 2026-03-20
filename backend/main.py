"""
Neural Agent v4 — FastAPI Backend
Connects React frontend ↔ Ollama ↔ ChromaDB
"""

import json
import time
import os
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import chromadb
import ollama


# ── Config ────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("NEURAL_DATA_DIR", os.path.expanduser("~/neural-agent")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

MODEL = os.environ.get("NEURAL_MODEL", "llama3.1:8b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

PROFILE_PATH = DATA_DIR / "profile.json"
RULES_PATH = DATA_DIR / "rules.json"
RELATIONSHIPS_PATH = DATA_DIR / "relationships.json"

# ── State ─────────────────────────────────────────────────────

class AppState:
    chroma_client: chromadb.PersistentClient
    collection: chromadb.Collection
    tps: float = 0.0
    total_tokens: int = 0
    generating: bool = False
    model: str = MODEL

state = AppState()

# ── Startup ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init ChromaDB
    state.chroma_client = chromadb.PersistentClient(path=str(DATA_DIR / "chromadb"))
    state.collection = state.chroma_client.get_or_create_collection(
        name="agent_memory",
        metadata={"hnsw:space": "cosine"},
    )
    
    # Verify Ollama
    try:
        models = ollama.list()
        available = [m.model for m in models.models] if models.models else []
        if any(MODEL in m for m in available):
            print(f"✓ Ollama connected — {MODEL} loaded")
            state.model = MODEL
        else:
            print(f"⚠ Model {MODEL} not found. Available: {available}")
            print(f"  Run: ollama pull {MODEL}")
    except Exception as e:
        print(f"⚠ Ollama not reachable: {e}")
        print("  Run: ollama serve")
    
    yield

app = FastAPI(title="Neural Agent v4", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    memories: list[dict] = []
    rules: list[str] = []
    profile: dict = {}
    relationships: list[dict] = []

class MemorySyncRequest(BaseModel):
    memories: list[dict]

class RulesSyncRequest(BaseModel):
    rules: list[dict]

class RelationshipsSyncRequest(BaseModel):
    relationships: list[dict]

# ── Helpers ───────────────────────────────────────────────────

def load_json(path: Path, default=None):
    if path.exists():
        return json.loads(path.read_text())
    return default or {}

def save_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2))

def build_system_prompt(req: ChatRequest) -> str:
    """Assemble context from profile, rules, memories, and relationships."""
    parts = ["""You are a personal AI assistant whose purpose is to deeply understand what someone is working on and find ways to help them succeed.

Your approach:
1. LEARN — Observe what the user is doing, how they work, what they struggle with, and what they care about.
2. THINK — Connect patterns across conversations. Identify bottlenecks, repeated tasks, and opportunities.
3. ACT — Proactively suggest ways to help. When you have skills available, use them to automate work, reduce friction, and improve output quality.

Your goal is to become increasingly useful over time by building a rich understanding of the user's world — their projects, workflows, preferences, and goals. You are not specialized in any domain. You adapt to whatever the user needs.

Be direct, concise, and action-oriented. Don't over-explain. If you can do something, do it. If you need info, ask."""]
    parts.append("You learn from conversations. When you identify new facts, preferences, workflows, or profile updates, output them in a JSON block tagged [LEARNINGS].")
    
    # Profile
    profile = req.profile or load_json(PROFILE_PATH)
    if profile:
        filled = {k: v for k, v in profile.items() if v and (not isinstance(v, (list, dict)) or len(v) > 0)}
        if filled:
            parts.append(f"\n## User Profile\n{json.dumps(filled, indent=2)}")
    
    # Rules
    rules = req.rules or [r["text"] for r in load_json(RULES_PATH, [])]
    if rules:
        parts.append("\n## Rules (ALWAYS follow these)\n" + "\n".join(f"- {r}" for r in rules))
    
    # Relationships (spatial context from memory canvas)
    rels = req.relationships or load_json(RELATIONSHIPS_PATH, [])
    if rels:
        parts.append("\n## Topic Relationships (user-defined, from spatial arrangement)")
        for rel in rels:
            parts.append(f"- {rel.get('a', '?')} ↔ {rel.get('b', '?')} (strength: {rel.get('strength', 0):.0%})")
    
    # Memories (top 20 by weight)
    top_memories = sorted(req.memories, key=lambda m: m.get("weight", 0), reverse=True)[:20]
    if top_memories:
        parts.append("\n## Relevant Knowledge")
        for m in top_memories:
            parts.append(f"- [{m.get('type', 'fact')} w:{m.get('weight', 1):.1f}] {m['text']}")
    
    return "\n".join(parts)

def extract_learnings(text: str) -> Optional[dict]:
    """Extract [LEARNINGS] JSON from response if present."""
    import re
    match = re.search(r'\[LEARNINGS\]\s*```json?\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None

# ── Routes ────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    try:
        ollama.list()
        ollama_ok = True
    except:
        ollama_ok = False
    
    return {
        "ok": ollama_ok,
        "model": state.model,
        "memory_count": state.collection.count(),
        "ollama_connected": ollama_ok,
    }

@app.get("/api/stats")
async def stats():
    return {
        "tps": state.tps,
        "total_tokens": state.total_tokens,
        "model": state.model,
        "generating": state.generating,
    }

@app.post("/api/chat")
async def chat(req: ChatRequest):
    system_prompt = build_system_prompt(req)
    
    async def generate():
        state.generating = True
        full_response = ""
        token_count = 0
        start_time = time.time()
        
        try:
            stream = ollama.chat(
                model=state.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.message},
                ],
                stream=True,
            )
            
            for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    full_response += content
                    token_count += 1
                    elapsed = time.time() - start_time
                    state.tps = token_count / elapsed if elapsed > 0 else 0
                    state.total_tokens += 1
                    yield f"data: {json.dumps({'token': content})}\n\n"
            
            # Check for learnings in the response
            learnings = extract_learnings(full_response)
            if learnings:
                yield f"data: {json.dumps({'learnings': learnings})}\n\n"
            
            # Store episode in ChromaDB
            state.collection.add(
                documents=[f"User asked: {req.message}\nAgent replied: {full_response[:500]}"],
                metadatas=[{"type": "episode", "weight": 1.5, "source": "conversation", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")}],
                ids=[f"ep_{int(time.time() * 1000)}"],
            )
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            state.generating = False
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

# ── Memory CRUD ───────────────────────────────────────────────

@app.get("/api/memories")
async def get_memories():
    results = state.collection.get(include=["documents", "metadatas"])
    memories = []
    if results["documents"]:
        for doc, meta in zip(results["documents"], results["metadatas"]):
            memories.append({
                "text": doc,
                "type": meta.get("type", "fact"),
                "weight": meta.get("weight", 1.0),
                "timestamp": meta.get("timestamp", ""),
                "source": meta.get("source", ""),
            })
    return memories

@app.post("/api/memories/sync")
async def sync_memories(req: MemorySyncRequest):
    """Upsert memories from frontend into ChromaDB."""
    for i, mem in enumerate(req.memories):
        state.collection.upsert(
            documents=[mem["text"]],
            metadatas=[{
                "type": mem.get("type", "fact"),
                "weight": mem.get("weight", 1.0),
                "source": mem.get("source", "manual"),
                "timestamp": mem.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ")),
            }],
            ids=[f"mem_{hash(mem['text']) % 10**12}"],
        )
    return {"synced": len(req.memories)}

# ── Rules sync ────────────────────────────────────────────────

@app.post("/api/rules/sync")
async def sync_rules(req: RulesSyncRequest):
    save_json(RULES_PATH, req.rules)
    return {"synced": len(req.rules)}

# ── Profile sync ──────────────────────────────────────────────

@app.post("/api/profile/sync")
async def sync_profile(profile: dict):
    save_json(PROFILE_PATH, profile)
    return {"ok": True}

# ── Relationships sync ────────────────────────────────────────

@app.post("/api/relationships/sync")
async def sync_relationships(req: RelationshipsSyncRequest):
    save_json(RELATIONSHIPS_PATH, req.relationships)
    return {"synced": len(req.relationships)}
