

# Neural Agent v5 — Supercharged Update

## Overview

Merging both perspectives with the original v5 plan into **7 grouped changes**. The first 3 are infrastructure (make the engine reliable). The last 4 are agency (make the engine do real work). Together they take this from "chatbot with memory" to "second brain with hands."

---

## Change 1: Multi-Turn History + Token Budget Manager

**Problem:** Stateless — every request sends only the latest message. "Expand on that" breaks.

**What changes:**
- `src/lib/api.ts` — Add `history` field to `ChatRequest`
- `src/components/ChatView.tsx` — Slice last 16 messages from store, include in request
- `backend/main.py` — Accept `history`, insert between system prompt and user message. Add `token_budget()` helper (~4 chars/token heuristic) that allocates: base 300t, profile 400t, rules 300t, memories 800t, history gets remainder minus 1500t response reserve. Truncate each section to budget.

---

## Change 2: Zustand Persistence + Debounced Auto-Sync

**Problem:** Page refresh = data loss. Sync is manual.

**What changes:**
- `src/store/agentStore.ts` — Add Zustand `persist` middleware writing to `localStorage` (messages, profile, rules, memories, relationships)
- New `src/hooks/useAutoSync.ts` — Watches store slices, debounces 2s, fires sync endpoints. Dirty-flag per slice to skip unchanged data.
- `src/pages/Index.tsx` — Mount `useAutoSync()` hook

---

## Change 3: Memory Lifecycle (Decay + Dedup + Semantic RAG + Cap)

**Problem:** Memories never decay, duplicates pile up, retrieval ignores relevance.

**What changes in `backend/main.py`:**
- **Semantic retrieval:** Replace top-20-by-weight with `collection.query(query_texts=[message], n_results=15)` + top 5 pinned by weight
- **Weight decay:** On each `/api/chat`, batch update all memories: `weight = max(0.1, weight * 0.985)`
- **Dedup on write:** Before adding memory, query closest match. If cosine distance < 0.15, update existing entry + boost weight by 0.3
- **Hard cap:** 500 entries max. Prune below weight 0.3, then lowest-weight if still over

---

## Change 4: Skill Execution Framework (The 3x Multiplier)

**Problem:** Skills are UI mockups. The agent tells you what to do instead of doing it.

**What changes:**
- `backend/main.py` — Add tool-calling loop: system prompt describes available skills with schemas. When LLM outputs `[TOOL_CALL]{"skill": "...", "params": {...}}`, backend intercepts, executes the skill, injects result back, lets LLM continue.
- New `backend/skills/` directory with base class and 3 starter skills:
  - `web_search.py` — DuckDuckGo HTML scraper, returns snippets
  - `write_file.py` — Writes to `~/neural-agent/outputs/`
  - `read_file.py` — Reads local files for analysis
- `src/store/agentStore.ts` — Populate `skillResults` on messages (already typed, never used)
- `src/components/ChatView.tsx` — Render skill results inline (collapsible cards showing tool name, status, output)
- `src/lib/api.ts` — Handle new `tool_call` and `tool_result` SSE events
- `src/components/SkillsOverview.tsx` — Fetch actual skills from backend instead of hardcoded list. Add enable/disable toggles.

---

## Change 5: Silent Background Learning

**Problem:** Learning only fires when LLM outputs `[LEARNINGS]` AND user clicks Save. Two bottlenecks.

**What changes:**
- `backend/main.py` — After every conversation, run a second lightweight LLM call: "Extract new facts not already in context. Return JSON or empty." Auto-commit results at low weight (0.8) with `source: 'auto'`.
- Keep approval flow only for **profile updates** (high-stakes). Facts accumulate silently.
- `src/components/ChatView.tsx` — Update learning card to only show profile updates for approval. Add a subtle "Auto-learned 3 facts" indicator instead of blocking cards for facts.
- New SSE event `auto_learned` sent from backend with count of silently stored facts.

---

## Change 6: Inner Monologue / Planning Step

**Problem:** Single-pass responses. Complex requests get shallow answers.

**What changes:**
- `backend/main.py` — Before main response, make a fast LLM call (~150 tokens): "Given this message and context, what's the best approach? Should I use tools? What memories matter most?" Store result as `[APPROACH]` in the main prompt.
- Add `/plan` command detection: if message starts with `/plan`, force multi-step ReAct loop (max 8 steps: plan → tool → reflect → next). Store plan + artifacts as `skill_chunk` memory.
- `src/components/ChatView.tsx` — Show a subtle "Thinking..." indicator during planning phase. Render `/plan` results with step-by-step progress UI.

---

## Change 7: Proactive Context + Relationship-to-Rules + Cleanup

**Problem:** Agent is purely reactive. Canvas relationships are hints, not behavior.

**What changes:**
- `backend/main.py` — In `build_system_prompt`, query recent episodes and prepend a `## Recent Context` section summarizing last session's key points (~200 tokens). Convert topic relationships with strength > 60% into synthetic rules: "When discussing {A}, also consider implications for {B}" at P5-P6 priority.
- **Cleanup across codebase:**
  - `src/App.tsx` — Remove `QueryClientProvider` and `@tanstack/react-query` (unused). Remove duplicate Radix `<Toaster />` (keep Sonner).
  - Add `react-markdown` dependency for rendering assistant messages with proper formatting.
  - `src/components/ChatView.tsx` — Render assistant messages through `<ReactMarkdown>` with prose styling.
  - New `src/components/ErrorBoundary.tsx` — Wrap each view in `Index.tsx`.
  - `src/components/DashboardView.tsx` — Update version to v5, update description.

---

## Files Summary

```text
MODIFIED:
  backend/main.py                  — Changes 1,3,4,5,6,7 (major rewrite)
  backend/requirements.txt         — Add duckduckgo-search
  src/lib/api.ts                   — Changes 1,4 (history, tool events)
  src/store/agentStore.ts          — Changes 2,4 (persist, skill results)
  src/components/ChatView.tsx      — Changes 1,4,5,6,7 (history, tools, markdown)
  src/components/SkillsOverview.tsx — Change 4 (live skill list)
  src/components/DashboardView.tsx — Change 7 (v5 branding)
  src/pages/Index.tsx              — Changes 2,7 (auto-sync, error boundaries)
  src/App.tsx                      — Change 7 (cleanup)
  package.json                     — Add react-markdown, remove @tanstack/react-query

NEW:
  src/hooks/useAutoSync.ts         — Change 2
  src/components/ErrorBoundary.tsx  — Change 7
  backend/skills/__init__.py       — Change 4
  backend/skills/base.py           — Change 4
  backend/skills/web_search.py     — Change 4
  backend/skills/write_file.py     — Change 4
  backend/skills/read_file.py      — Change 4
```

## Implementation Order

I'll build these in dependency order: Changes 7 (cleanup) → 2 (persistence) → 1 (history) → 3 (memory lifecycle) → 4 (skills) → 5 (silent learning) → 6 (planning). Each change is self-contained — the app works after each step.

## Risk Notes

- Token budget prevents context overflow from stacking history + memories + tools
- Silent learning uses low weight (0.8) so auto-facts don't dominate human-approved ones
- Skill execution is subprocess-based with timeout — a hung skill won't block the server
- All backend changes are in Python files the user copies locally. Frontend changes are testable here in Lovable (will show offline/demo mode but UI is fully functional)

