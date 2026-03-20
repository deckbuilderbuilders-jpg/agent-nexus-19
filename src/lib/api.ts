/**
 * API service layer — connects the React frontend to the FastAPI backend.
 * In production (self-hosted), calls localhost:8000.
 * In dev via Lovable preview, falls back to demo mode.
 */

const API_BASE = '/api';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch {
    return null;
  }
}

// ── Chat (streaming) ──────────────────────────────────────────

export interface ChatRequest {
  message: string;
  memories: { text: string; type: string; weight: number }[];
  rules: string[];
  profile: Record<string, unknown>;
  relationships: { a: string; b: string; strength: number }[];
}

export interface ChatStreamCallbacks {
  onToken: (token: string) => void;
  onLearnings: (learnings: { facts: string[]; profileUpdates: Record<string, string> }) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamChat(req: ChatRequest, cb: ChatStreamCallbacks): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok || !res.body) {
      cb.onError(`Server error: ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line || !line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') { cb.onDone(); return; }

        try {
          const evt = JSON.parse(payload);
          if (evt.token) cb.onToken(evt.token);
          if (evt.learnings) cb.onLearnings(evt.learnings);
          if (evt.error) cb.onError(evt.error);
        } catch { /* partial JSON, skip */ }
      }
    }
    cb.onDone();
  } catch (err) {
    cb.onError(err instanceof Error ? err.message : 'Connection failed');
  }
}

// ── Health check ──────────────────────────────────────────────

export interface HealthStatus {
  ok: boolean;
  model: string;
  memory_count: number;
  ollama_connected: boolean;
}

export async function checkHealth(): Promise<HealthStatus | null> {
  return apiFetch('/health');
}

// ── Stats (for HUD) ──────────────────────────────────────────

export interface PerfStatsResponse {
  tps: number;
  total_tokens: number;
  model: string;
  generating: boolean;
}

export async function fetchStats(): Promise<PerfStatsResponse | null> {
  return apiFetch('/stats');
}

// ── Memory CRUD ──────────────────────────────────────────────

export async function syncMemories(memories: { text: string; type: string; weight: number; source?: string }[]) {
  return apiFetch('/memories/sync', { method: 'POST', body: JSON.stringify({ memories }) });
}

export async function getMemories() {
  return apiFetch<{ text: string; type: string; weight: number; timestamp: string; source?: string }[]>('/memories');
}

// ── Rules ────────────────────────────────────────────────────

export async function syncRules(rules: { text: string; priority: number; category: string }[]) {
  return apiFetch('/rules/sync', { method: 'POST', body: JSON.stringify({ rules }) });
}

// ── Profile ──────────────────────────────────────────────────

export async function syncProfile(profile: Record<string, unknown>) {
  return apiFetch('/profile/sync', { method: 'POST', body: JSON.stringify(profile) });
}

// ── Relationships ────────────────────────────────────────────

export async function syncRelationships(rels: { a: string; b: string; strength: number }[]) {
  return apiFetch('/relationships/sync', { method: 'POST', body: JSON.stringify({ relationships: rels }) });
}
