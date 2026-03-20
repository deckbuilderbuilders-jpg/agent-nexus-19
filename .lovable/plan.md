
# Neural Agent v5 — Implementation Complete

## What Changed

### Frontend (React/Vite/Zustand)
1. **App.tsx** — Removed `@tanstack/react-query` (unused), removed duplicate Radix `<Toaster />` (kept Sonner)
2. **agentStore.ts** — Added Zustand `persist` middleware (localStorage), keeps last 50 messages. Added `autoLearnedCount` for silent learning indicator
3. **api.ts** — Added `history` field to `ChatRequest`, new SSE events: `tool_call`, `tool_result`, `auto_learned`, `plan_step`. New endpoints: `getSkills()`, `toggleSkill()`
4. **ChatView.tsx** — Sends last 16 messages as history. Renders assistant messages as Markdown via `react-markdown`. Shows tool call cards, plan steps, auto-learned indicator. Strips `[LEARNINGS]`/`[TOOL_CALL]`/`[APPROACH]` blocks from display. `/plan` command for deep work mode
5. **SkillsOverview.tsx** — Fetches live skills from backend when online, enable/disable toggles
6. **DashboardView.tsx** — Updated to v5 branding, shows new capabilities grid
7. **ErrorBoundary.tsx** — New. Wraps each view in Index.tsx
8. **useAutoSync.ts** — New. Debounced (2s) auto-sync of memories/rules/profile/relationships to backend
9. **Index.tsx** — Mounts `useAutoSync()`, wraps views in `ErrorBoundary`

### Backend (FastAPI/Ollama/ChromaDB)
1. **main.py** — Full rewrite:
   - Token budget manager with allocate/truncate per section
   - Semantic RAG retrieval (ChromaDB query by message) + 5 pinned high-weight memories
   - Memory lifecycle: weight decay (0.985x per chat), dedup on write (cosine < 0.15), 500-entry cap with auto-prune
   - Skill execution framework: discovers `skills/*.py`, intercepts `[TOOL_CALL]` blocks, executes and streams results
   - Silent background learning: second LLM call after each conversation, auto-commits facts at weight 0.8
   - Inner monologue: planning step before main response (~150 tokens)
   - Relationship-to-rules: canvas relationships >60% strength become synthetic rules
   - Proper logging throughout
2. **skills/base.py** — Skill base class
3. **skills/web_search.py** — DuckDuckGo search (library + HTML fallback)
4. **skills/write_file.py** — Write to outputs directory (path-traversal safe)
5. **skills/read_file.py** — Read files from data directory (sandboxed, 500KB limit)
6. **requirements.txt** — Added `duckduckgo-search>=4.0.0`
