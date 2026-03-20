import { useState, useCallback } from 'react';
import { Trash2, Plus, Brain, Clock, BookOpen, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useAgentStore, Memory } from '@/store/agentStore';

const TYPE_CONFIG: Record<string, { label: string; emoji: string; icon: typeof Brain; bg: string; border: string; accent: string }> = {
  fact: { label: 'Fact', emoji: '🧠', icon: Brain, bg: 'bg-primary/[0.06]', border: 'border-primary/30', accent: 'text-primary' },
  episode: { label: 'Episode', emoji: '📖', icon: Clock, bg: 'bg-[hsl(var(--info))]/[0.06]', border: 'border-[hsl(var(--info))]/30', accent: 'text-[hsl(var(--info))]' },
  skill_chunk: { label: 'Skill', emoji: '⚡', icon: BookOpen, bg: 'bg-[hsl(var(--warning))]/[0.06]', border: 'border-[hsl(var(--warning))]/30', accent: 'text-[hsl(var(--warning))]' },
};

function WeightStars({ weight, onChange }: { weight: number; onChange: (w: number) => void }) {
  const stars = 5;
  const filled = Math.round((weight / 5) * stars);

  return (
    <div className="flex gap-[2px] items-center">
      {Array.from({ length: stars }).map((_, i) => (
        <button
          key={i}
          onClick={(e) => { e.stopPropagation(); onChange(((i + 1) / stars) * 5); }}
          className="p-0 border-none bg-transparent cursor-pointer transition-transform hover:scale-125 active:scale-95"
          title={`Set importance to ${i + 1}/${stars}`}
        >
          <Star
            className={`w-3.5 h-3.5 transition-colors ${
              i < filled
                ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]'
                : 'fill-transparent text-border hover:text-[hsl(var(--warning))]/50'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function MemoryCard({ mem, expanded, onToggle }: { mem: Memory; expanded: boolean; onToggle: () => void }) {
  const { removeMemory, updateMemoryWeight } = useAgentStore();
  const config = TYPE_CONFIG[mem.type] || TYPE_CONFIG.fact;

  // Scale card visually by weight: higher weight = more prominent
  const prominence = mem.weight / 5; // 0-1
  const scale = 0.92 + prominence * 0.08; // 0.92 - 1.0
  const opacity = 0.7 + prominence * 0.3; // 0.7 - 1.0

  return (
    <div
      onClick={onToggle}
      className={`group relative rounded-[10px] border ${config.border} ${config.bg} 
        cursor-pointer transition-all duration-200 hover:shadow-mid active:scale-[0.98]
        overflow-hidden select-none`}
      style={{ transform: `scale(${scale})`, opacity }}
    >
      {/* Weight bar — visual indicator along top */}
      <div className="h-[3px] bg-border/30 w-full">
        <div
          className="h-full bg-primary rounded-r-full transition-all duration-500"
          style={{ width: `${(mem.weight / 5) * 100}%` }}
        />
      </div>

      <div className="px-3 py-2.5">
        {/* Top row: type badge + stars */}
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-[1px] ${config.accent}`}>
            {config.emoji} {config.label}
          </span>
          <WeightStars weight={mem.weight} onChange={(w) => updateMemoryWeight(mem.id, w)} />
        </div>

        {/* Memory text */}
        <p className={`text-[11px] leading-[1.55] text-foreground font-medium ${!expanded ? 'line-clamp-2' : ''}`}>
          {mem.text}
        </p>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between animate-fade-in">
            <div className="flex gap-3 text-[8px] text-muted-foreground uppercase tracking-[0.5px]">
              <span>{mem.timestamp.slice(0, 10)}</span>
              {mem.source && <span>via {mem.source}</span>}
              <span>weight: {mem.weight.toFixed(1)}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeMemory(mem.id); }}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 
                transition-all active:scale-90"
              title="Forget this memory"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MemoryBrowser() {
  const { memories, addMemory } = useAgentStore();
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newFact, setNewFact] = useState('');
  const [sortBy, setSortBy] = useState<'weight' | 'time'>('weight');

  const filtered = memories
    .filter((m) => !filter || m.type === filter)
    .sort((a, b) => sortBy === 'weight' ? b.weight - a.weight : b.timestamp.localeCompare(a.timestamp));

  const handleAdd = useCallback(() => {
    if (!newFact.trim()) return;
    addMemory({ text: newFact.trim(), type: 'fact', weight: 2.5, timestamp: new Date().toISOString(), source: 'manual' });
    setNewFact('');
  }, [newFact, addMemory]);

  const typeCounts = {
    all: memories.length,
    fact: memories.filter(m => m.type === 'fact').length,
    episode: memories.filter(m => m.type === 'episode').length,
    skill_chunk: memories.filter(m => m.type === 'skill_chunk').length,
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border bg-card shadow-soft shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-bold text-foreground">🧠 Memories</h2>
          <button
            onClick={() => setSortBy(s => s === 'weight' ? 'time' : 'weight')}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] uppercase tracking-[0.8px]
              text-muted-foreground border border-border hover:border-primary hover:text-primary 
              transition-all active:scale-95"
          >
            {sortBy === 'weight' ? <ChevronDown className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {sortBy === 'weight' ? 'By importance' : 'By time'}
          </button>
        </div>

        {/* Type filter pills — big, tappable, clear counts */}
        <div className="flex gap-1.5">
          {[
            { key: null, label: 'All', count: typeCounts.all, emoji: '🌐' },
            { key: 'fact', label: 'Facts', count: typeCounts.fact, emoji: '🧠' },
            { key: 'episode', label: 'Episodes', count: typeCounts.episode, emoji: '📖' },
            { key: 'skill_chunk', label: 'Skills', count: typeCounts.skill_chunk, emoji: '⚡' },
          ].map(({ key, label, count, emoji }) => {
            const active = filter === key;
            return (
              <button
                key={label}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-medium
                  transition-all active:scale-95 ${
                  active
                    ? 'border-primary text-primary bg-primary/[0.08] shadow-sm'
                    : 'border-border text-muted-foreground hover:border-[hsl(var(--border-strong))] hover:bg-secondary'
                }`}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add new memory — prominent and simple */}
      <div className="px-5 py-3 border-b border-border bg-card">
        <div className="flex gap-2">
          <input
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Teach me something new..."
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-[11px]
              placeholder:text-muted-foreground outline-none focus:border-primary 
              focus:shadow-[0_0_0_3px_hsl(var(--accent-light))] transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!newFact.trim()}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold
              uppercase tracking-[0.5px] flex items-center gap-1.5
              disabled:opacity-30 hover:brightness-105 active:scale-95 transition-all accent-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Memory cards — visual, scaled by importance */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 animate-fade-in">
            <span className="text-4xl mb-3">🫧</span>
            <p className="text-sm text-muted-foreground font-medium">No memories yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Start chatting or add one above</p>
          </div>
        ) : (
          filtered.map((mem, i) => (
            <div key={mem.id} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
              <MemoryCard
                mem={mem}
                expanded={expandedId === mem.id}
                onToggle={() => setExpandedId(expandedId === mem.id ? null : mem.id)}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-2 border-t border-border bg-card text-center">
        <p className="text-[8px] text-muted-foreground uppercase tracking-[1px]">
          ⭐ Tap stars to set importance · Click card to expand · Higher importance = bigger card
        </p>
      </div>
    </div>
  );
}
