"""
Nexus v6 — FastAPI Backend
Hybrid Compute Engine (Ollama + RunPod), semantic RAG, memory lifecycle,
skill execution, silent learning, inner monologue, auto-updates.
"""

import json
import time
import os
import re
import logging
import importlib
import subprocess
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError
import chromadb
import ollama
import httpx


# ── Config ────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("NEXUS_DATA_DIR", os.path.expanduser("~/Nexus")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR = DATA_DIR / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

MODEL = os.environ.get("NEURAL_MODEL", "llama3.1:8b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MAX_CONTEXT_TOKENS = int(os.environ.get("NEURAL_MAX_CONTEXT", "8192"))
MEMORY_CAP = 500
DECAY_FACTOR = 0.985
DEDUP_THRESHOLD = 0.15
SKILLS_DIR = Path(__file__).parent / "skills"

PROFILE_PATH = DATA_DIR / "profile.json"
RULES_PATH = DATA_DIR / "rules.json"
RELATIONSHIPS_PATH = DATA_DIR / "relationships.json"

APP_VERSION = "6.0.0"
GITHUB_REPO = "deckbuilderbuilders-jpg/agent-nexus-19"

logger = logging.getLogger("nexus")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ── State ─────────────────────────────────────────────────────

class AppState:
    chroma_client: chromadb.PersistentClient
    collection: chromadb.Collection
    tps: float = 0.0
    total_tokens: int = 0
    generating: bool = False
    model: str = MODEL
    last_budget: dict = {}
    skills: dict = {}
    compute_engine: str = "ollama"  # track what engine is being used

state = AppState()


# ── Token Budget ──────────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)

def truncate_to_budget(text: str, max_tokens: int) -> str:
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n[...truncated]"

def allocate_budget(base_tokens: int = 300) -> dict:
    remaining = MAX_CONTEXT_TOKENS - base_tokens
    response_reserve = 1500
    remaining -= response_reserve
    budgets = {
        "base": base_tokens,
        "profile": min(400, remaining // 5),
        "rules": min(300, remaining // 5),
        "memories": min(800, remaining // 3),
        "history": max(200, remaining - 400 - 300 - 800),
        "response_reserve": response_reserve,
    }
    state.last_budget = budgets
    return budgets


# ── Skill Discovery ──────────────────────────────────────────

def discover_skills() -> dict:
    skills = {}
    if not SKILLS_DIR.exists():
        return skills
    for path in SKILLS_DIR.glob("*.py"):
        if path.name.startswith("_") or path.name == "base.py":
            continue
        try:
            spec = importlib.util.spec_from_file_location(path.stem, path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "SKILL_INFO") and hasattr(mod, "run"):
                skills[mod.SKILL_INFO["name"]] = mod
                logger.info(f"✓ Skill loaded: {mod.SKILL_INFO['name']}")
        except Exception as e:
            logger.warning(f"⚠ Failed to load skill {path.name}: {e}")
    return skills


# ── JSON Helpers ──────────────────────────────────────────────

def load_json(path: Path, default=None):
    if path.exists():
        return json.loads(path.read_text())
    return default or {}

def save_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2))

def fix_json(text: str) -> str:
    text = re.sub(r',\s*([}\]])', r'\1', text)
    text = text.replace("'", '"')
    return text


# ── Learning Extraction ──────────────────────────────────────

class LearningsModel(BaseModel):
    facts: list[str] = []
    profileUpdates: dict[str, str] = {}

def extract_learnings(text: str) -> Optional[dict]:
    patterns = [
        r'\[LEARNINGS\]\s*```json?\s*(.*?)\s*```',
        r'\[LEARNINGS\]\s*(\{.*?\})',
        r'```json?\s*(\{[^`]*?"facts"[^`]*?\})\s*```',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            raw = match.group(1)
            for attempt in [raw, fix_json(raw)]:
                try:
                    data = json.loads(attempt)
                    validated = LearningsModel(**data)
                    return validated.model_dump()
                except (json.JSONDecodeError, ValidationError):
                    continue
    return None


# ── Tool Call Extraction ─────────────────────────────────────

def extract_tool_call(text: str) -> Optional[dict]:
    patterns = [
        r'\[TOOL_CALL\]\s*```json?\s*(.*?)\s*```',
        r'\[TOOL_CALL\]\s*(\{.*?\})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(fix_json(match.group(1)))
            except json.JSONDecodeError:
                continue
    return None


# ── Memory Lifecycle ─────────────────────────────────────────

def apply_decay():
    try:
        results = state.collection.get(include=["metadatas"])
        if not results["ids"]:
            return
        updates = []
        for mid, meta in zip(results["ids"], results["metadatas"]):
            old_weight = meta.get("weight", 1.0)
            new_weight = max(0.1, old_weight * DECAY_FACTOR)
            updates.append((mid, {**meta, "weight": new_weight}))
        if updates:
            state.collection.update(
                ids=[u[0] for u in updates],
                metadatas=[u[1] for u in updates],
            )
    except Exception as e:
        logger.warning(f"Decay failed: {e}")

def prune_memories():
    try:
        count = state.collection.count()
        if count <= MEMORY_CAP:
            return
        results = state.collection.get(include=["metadatas"])
        entries = list(zip(results["ids"], results["metadatas"]))
        entries.sort(key=lambda e: e[1].get("weight", 0))
        to_delete = [eid for eid, meta in entries if meta.get("weight", 0) < 0.3]
        if len(to_delete) < count - MEMORY_CAP:
            remaining_to_cut = count - MEMORY_CAP - len(to_delete)
            remaining = [e for e in entries if e[0] not in set(to_delete)]
            to_delete.extend([eid for eid, _ in remaining[:remaining_to_cut]])
        if to_delete:
            state.collection.delete(ids=to_delete)
            logger.info(f"Pruned {len(to_delete)} memories (was {count}, now {count - len(to_delete)})")
    except Exception as e:
        logger.warning(f"Prune failed: {e}")

def deduplicate_and_add(text: str, meta: dict) -> str:
    try:
        existing = state.collection.query(query_texts=[text], n_results=1, include=["metadatas", "distances"])
        if (existing["distances"] and existing["distances"][0]
                and existing["distances"][0][0] < DEDUP_THRESHOLD
                and existing["ids"][0]):
            eid = existing["ids"][0][0]
            old_meta = existing["metadatas"][0][0]
            new_weight = min(5.0, old_meta.get("weight", 1.0) + 0.3)
            state.collection.update(
                ids=[eid],
                metadatas=[{**old_meta, "weight": new_weight}],
            )
            return eid
    except Exception:
        pass

    new_id = f"mem_{int(time.time() * 1000)}_{hash(text) % 10000}"
    state.collection.add(
        documents=[text],
        metadatas=[meta],
        ids=[new_id],
    )
    return new_id


# ── Hybrid Compute Engine ────────────────────────────────────

def should_use_cloud(message: str, compute_mode: str, history: list) -> tuple[bool, str]:
    """Decide whether to route to RunPod based on mode and heuristics."""
    if compute_mode == "local":
        return False, "User selected local-only mode"
    if compute_mode == "cloud":
        return True, "User selected cloud-only mode"

    # Smart hybrid heuristics
    msg_len = len(message)
    history_len = len(history)

    # Long/complex messages
    if msg_len > 800:
        return True, "Long input — routing to cloud for better context handling"

    # Deep work prefix
    if message.strip().startswith("/plan") or message.strip().startswith("/deep"):
        return True, "Deep work mode — routing to cloud"

    # Research-type queries
    research_keywords = ["analyze", "research", "compare", "explain in detail", "write a report",
                         "summarize", "deep dive", "comprehensive", "strategy", "roadmap"]
    if any(kw in message.lower() for kw in research_keywords):
        return True, "Complex/research request — routing to cloud"

    # Long conversation context
    if history_len > 12:
        return True, "Long conversation — routing to cloud for better context"

    # Check if Ollama is responsive
    try:
        ollama.list()
    except Exception:
        return True, "Ollama unavailable — falling back to cloud"

    return False, "Standard request — using local Ollama"


async def stream_from_runpod(messages: list, api_key: str, endpoint: str, model: str):
    """Stream chat completion from RunPod (OpenAI-compatible API)."""
    url = endpoint.rstrip("/")
    if not url.endswith("/chat/completions"):
        url += "/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model or "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "messages": messages,
        "stream": True,
        "max_tokens": 2000,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    continue


# ── Prompt Assembly ──────────────────────────────────────────

def build_system_prompt(req, user_message: str) -> str:
    budgets = allocate_budget()
    parts = []

    base = """You are a personal AI assistant that deeply understands what someone is working on and finds ways to help them succeed.

Your approach:
1. LEARN — Observe what the user is doing, how they work, what they struggle with, and what they care about.
2. THINK — Connect patterns across conversations. Identify bottlenecks, repeated tasks, and opportunities.
3. ACT — When you have skills available, use them to automate work. Don't just advise — do.

Be direct, concise, and action-oriented. Don't over-explain. If you can do something, do it. If you need info, ask.

When you identify genuinely NEW facts, preferences, or profile updates not already in the context below, output them at the end of your response in this format:
[LEARNINGS]
```json
{"facts": ["new fact 1"], "profileUpdates": {"field": "value"}}
```
Only include truly new information. Do not repeat what's already in the context."""
    parts.append(truncate_to_budget(base, budgets["base"]))

    profile = req.profile or load_json(PROFILE_PATH)
    if profile:
        filled = {k: v for k, v in profile.items() if v and (not isinstance(v, (list, dict)) or len(v) > 0)}
        if filled:
            parts.append(truncate_to_budget(f"\n## User Profile\n{json.dumps(filled, indent=2)}", budgets["profile"]))

    rules = req.rules or [r["text"] for r in load_json(RULES_PATH, [])]
    rels = req.relationships or load_json(RELATIONSHIPS_PATH, [])
    for rel in rels:
        if rel.get("strength", 0) > 0.6:
            rules.append(f"[P5] When discussing {rel.get('a', '?')}, also consider implications for {rel.get('b', '?')}")
    if rules:
        rules_text = "\n## Rules (ALWAYS follow these)\n" + "\n".join(f"- {r}" for r in rules)
        parts.append(truncate_to_budget(rules_text, budgets["rules"]))

    memory_parts = []
    try:
        semantic = state.collection.query(
            query_texts=[user_message],
            n_results=15,
            include=["documents", "metadatas", "distances"],
        )
        if semantic["documents"] and semantic["documents"][0]:
            for doc, meta, dist in zip(semantic["documents"][0], semantic["metadatas"][0], semantic["distances"][0]):
                relevance = max(0, 1 - dist)
                memory_parts.append({
                    "text": doc, "type": meta.get("type", "fact"),
                    "weight": meta.get("weight", 1.0), "relevance": relevance,
                })
    except Exception as e:
        logger.warning(f"Semantic retrieval failed: {e}")

    try:
        all_mems = state.collection.get(include=["documents", "metadatas"])
        if all_mems["documents"]:
            weighted = sorted(
                zip(all_mems["documents"], all_mems["metadatas"]),
                key=lambda x: x[1].get("weight", 0), reverse=True,
            )[:5]
            existing_texts = {m["text"] for m in memory_parts}
            for doc, meta in weighted:
                if doc not in existing_texts:
                    memory_parts.append({
                        "text": doc, "type": meta.get("type", "fact"),
                        "weight": meta.get("weight", 1.0), "relevance": 0.5,
                    })
    except Exception:
        pass

    if memory_parts:
        memory_parts.sort(key=lambda m: m["weight"] * 0.4 + m["relevance"] * 0.6, reverse=True)
        mem_text = "\n## Relevant Knowledge"
        for m in memory_parts[:20]:
            mem_text += f"\n- [{m['type']} w:{m['weight']:.1f} r:{m['relevance']:.0%}] {m['text']}"
        parts.append(truncate_to_budget(mem_text, budgets["memories"]))

    if state.skills:
        enabled = {n: s for n, s in state.skills.items() if s.SKILL_INFO.get("enabled", True)}
        if enabled:
            skills_text = "\n## Available Skills\nYou can call skills by outputting:\n[TOOL_CALL]\n```json\n{\"skill\": \"skill_name\", \"params\": {\"param\": \"value\"}}\n```\n\nAvailable skills:"
            for name, mod in enabled.items():
                info = mod.SKILL_INFO
                skills_text += f"\n- **{name}**: {info['description']} — params: {json.dumps(info.get('schema', {}))}"
            parts.append(skills_text)

    return "\n".join(parts)


# ── Startup ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    state.chroma_client = chromadb.PersistentClient(path=str(DATA_DIR / "chromadb"))
    state.collection = state.chroma_client.get_or_create_collection(
        name="agent_memory",
        metadata={"hnsw:space": "cosine"},
    )
    state.skills = discover_skills()
    logger.info(f"Discovered {len(state.skills)} skills")

    try:
        models = ollama.list()
        available = [m.model for m in models.models] if models.models else []
        if any(MODEL in m for m in available):
            logger.info(f"✓ Ollama connected — {MODEL} loaded")
            state.model = MODEL
        else:
            logger.warning(f"Model {MODEL} not found. Available: {available}")
    except Exception as e:
        logger.warning(f"Ollama not reachable: {e}")

    yield

app = FastAPI(title="Nexus v6", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    memories: list[dict] = []
    rules: list[str] = []
    profile: dict = {}
    relationships: list[dict] = []
    compute_mode: str = "local"
    runpod_api_key: Optional[str] = None
    runpod_endpoint: Optional[str] = None
    runpod_model: Optional[str] = None

class MemorySyncRequest(BaseModel):
    memories: list[dict]

class RulesSyncRequest(BaseModel):
    rules: list[dict]

class RelationshipsSyncRequest(BaseModel):
    relationships: list[dict]

class SkillToggleRequest(BaseModel):
    enabled: bool


# ── Inner Monologue ──────────────────────────────────────────

def run_inner_monologue(system_prompt: str, user_message: str, history: list[dict]) -> Optional[str]:
    try:
        plan_prompt = f"""You are an internal planning module. Given the context and user message, think briefly about the best approach.
Consider: Should I use any available skills? What memories are most relevant? What's the user really asking for?
Be concise — max 3 sentences.

Context summary: {system_prompt[:500]}...

User message: {user_message}"""

        response = ollama.chat(
            model=state.model,
            messages=[{"role": "system", "content": plan_prompt}, {"role": "user", "content": "Plan your approach."}],
            options={"num_predict": 150},
        )
        return response.get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Inner monologue failed: {e}")
        return None


# ── Silent Learning ──────────────────────────────────────────

def run_silent_learning(user_message: str, assistant_response: str, existing_context: str) -> int:
    try:
        prompt = f"""Extract any NEW facts about the user, their business, preferences, workflows, or goals from this conversation that are NOT already known.

Already known context (do NOT repeat these):
{existing_context[:1000]}

Conversation:
User: {user_message}
Assistant: {assistant_response[:1000]}

Return a JSON array of new fact strings, or an empty array if nothing new.
Example: ["user prefers bullet points", "their sales cycle is 60 days"]
Return ONLY the JSON array, nothing else."""

        response = ollama.chat(
            model=state.model,
            messages=[{"role": "user", "content": prompt}],
            options={"num_predict": 300},
        )
        content = response.get("message", {}).get("content", "").strip()

        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            facts = json.loads(fix_json(match.group(0)))
            if isinstance(facts, list) and facts:
                count = 0
                for fact in facts[:5]:
                    if isinstance(fact, str) and len(fact) > 10:
                        deduplicate_and_add(fact, {
                            "type": "fact",
                            "weight": 0.8,
                            "source": "auto",
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        })
                        count += 1
                return count
    except Exception as e:
        logger.warning(f"Silent learning failed: {e}")
    return 0


# ── Skill Execution ──────────────────────────────────────────

def execute_skill(name: str, params: dict) -> dict:
    if name not in state.skills:
        return {"success": False, "error": f"Skill '{name}' not found"}
    mod = state.skills[name]
    if not mod.SKILL_INFO.get("enabled", True):
        return {"success": False, "error": f"Skill '{name}' is disabled"}
    try:
        result = mod.run(params)
        return {"success": True, "output": str(result)[:2000]}
    except Exception as e:
        return {"success": False, "error": str(e)[:500]}


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
        "skills_count": len(state.skills),
    }

@app.get("/api/stats")
async def stats():
    return {
        "tps": state.tps,
        "total_tokens": state.total_tokens,
        "model": state.model,
        "generating": state.generating,
        "token_budget": state.last_budget,
        "memory_count": state.collection.count(),
        "compute_engine": state.compute_engine,
    }

@app.get("/api/skills")
async def list_skills():
    return [
        {
            "name": name,
            "description": mod.SKILL_INFO.get("description", ""),
            "schema": mod.SKILL_INFO.get("schema", {}),
            "enabled": mod.SKILL_INFO.get("enabled", True),
        }
        for name, mod in state.skills.items()
    ]

@app.post("/api/skills/{name}/toggle")
async def toggle_skill(name: str, req: SkillToggleRequest):
    if name in state.skills:
        state.skills[name].SKILL_INFO["enabled"] = req.enabled
        return {"ok": True, "enabled": req.enabled}
    return {"ok": False, "error": "Skill not found"}


# ── Chat with Hybrid Compute ─────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    system_prompt = build_system_prompt(req, req.message)
    apply_decay()

    # Decide compute route
    use_cloud, route_reason = should_use_cloud(req.message, req.compute_mode, req.history)
    has_runpod = bool(req.runpod_api_key and req.runpod_endpoint)

    # Fall back to local if no RunPod config
    if use_cloud and not has_runpod:
        use_cloud = False
        route_reason = "Cloud requested but RunPod not configured — using local"

    engine = "runpod" if use_cloud else "ollama"
    state.compute_engine = engine

    async def generate():
        state.generating = True
        full_response = ""
        token_count = 0
        start_time = time.time()

        try:
            # Emit compute route info
            yield f"data: {json.dumps({'compute_route': {'engine': engine, 'reason': route_reason}})}\n\n"

            # Inner monologue (local only — fast planning)
            if not use_cloud:
                approach = run_inner_monologue(system_prompt, req.message, req.history)
                if approach:
                    yield f"data: {json.dumps({'plan_step': {'step': 0, 'total': 1, 'description': 'Planning approach...', 'status': 'done'}})}\n\n"
            else:
                approach = None

            # Build messages array
            messages = [{"role": "system", "content": system_prompt}]
            if approach:
                messages.append({"role": "system", "content": f"[APPROACH] {approach}"})

            budgets = allocate_budget()
            history_budget = budgets["history"]
            history_tokens = 0
            trimmed_history = []
            for msg in reversed(req.history[-16:]):
                msg_tokens = estimate_tokens(msg.get("content", ""))
                if history_tokens + msg_tokens > history_budget:
                    break
                trimmed_history.insert(0, msg)
                history_tokens += msg_tokens

            for msg in trimmed_history:
                messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({"role": "user", "content": req.message})

            # ── Stream from chosen engine ──
            if use_cloud:
                # RunPod (OpenAI-compatible)
                async for content in stream_from_runpod(
                    messages, req.runpod_api_key, req.runpod_endpoint, req.runpod_model or ""
                ):
                    full_response += content
                    token_count += 1
                    elapsed = time.time() - start_time
                    state.tps = token_count / elapsed if elapsed > 0 else 0
                    state.total_tokens += 1
                    yield f"data: {json.dumps({'token': content})}\n\n"

                    tool_call = extract_tool_call(full_response)
                    if tool_call and tool_call.get("skill"):
                        skill_name = tool_call["skill"]
                        params = tool_call.get("params", {})
                        yield f"data: {json.dumps({'tool_call': {'skill': skill_name, 'params': params}})}\n\n"
                        result = execute_skill(skill_name, params)
                        yield f"data: {json.dumps({'tool_result': {'skill': skill_name, **result}})}\n\n"
                        full_response += f"\n[TOOL_RESULT] {skill_name}: {result.get('output', result.get('error', 'No output'))}"
            else:
                # Ollama (local)
                stream = ollama.chat(
                    model=state.model,
                    messages=messages,
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

                        tool_call = extract_tool_call(full_response)
                        if tool_call and tool_call.get("skill"):
                            skill_name = tool_call["skill"]
                            params = tool_call.get("params", {})
                            yield f"data: {json.dumps({'tool_call': {'skill': skill_name, 'params': params}})}\n\n"
                            result = execute_skill(skill_name, params)
                            yield f"data: {json.dumps({'tool_result': {'skill': skill_name, **result}})}\n\n"
                            full_response += f"\n[TOOL_RESULT] {skill_name}: {result.get('output', result.get('error', 'No output'))}"

            # Post-processing (same for both engines)
            learnings = extract_learnings(full_response)
            if learnings:
                yield f"data: {json.dumps({'learnings': learnings})}\n\n"

            deduplicate_and_add(
                f"User asked: {req.message}\nAgent replied: {full_response[:500]}",
                {
                    "type": "episode",
                    "weight": 1.5,
                    "source": "conversation",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
            )

            existing_context = system_prompt[:1000]
            auto_count = run_silent_learning(req.message, full_response, existing_context)
            if auto_count > 0:
                yield f"data: {json.dumps({'auto_learned': auto_count})}\n\n"

            prune_memories()

        except Exception as e:
            logger.error(f"Chat error: {e}")
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
    for mem in req.memories:
        deduplicate_and_add(
            mem["text"],
            {
                "type": mem.get("type", "fact"),
                "weight": mem.get("weight", 1.0),
                "source": mem.get("source", "manual"),
                "timestamp": mem.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ")),
            },
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


# ── Version Check & Update ────────────────────────────────────

@app.get("/api/version/check")
async def version_check():
    """Check GitHub for the latest release version."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                latest = data.get("tag_name", "").lstrip("v")
                return {
                    "version": latest or APP_VERSION,
                    "changelog": data.get("body", ""),
                    "current": APP_VERSION,
                }
    except Exception as e:
        logger.warning(f"Version check failed: {e}")
    return {"version": APP_VERSION, "current": APP_VERSION}


@app.post("/api/version/update")
async def version_update():
    """Pull latest code from GitHub and signal restart."""
    try:
        project_dir = Path(__file__).parent.parent
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            # Reinstall backend deps
            subprocess.run(
                ["pip", "install", "-r", "requirements.txt"],
                cwd=str(project_dir / "backend"),
                capture_output=True,
                timeout=60,
            )
            return {
                "success": True,
                "message": f"Updated successfully. Restart Nexus to use the new version.\n\n{result.stdout}",
            }
        else:
            return {
                "success": False,
                "message": f"Git pull failed: {result.stderr}",
            }
    except Exception as e:
        return {"success": False, "message": str(e)}
