import { useState } from 'react';
import { Search, Trash2, Plus, Brain, Clock, BookOpen } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

const TYPE_META: Record<string, { label: string; icon: typeof Brain; border: string }> = {
  fact: { label: 'Fact', icon: Brain, border: 'border-l-primary' },
  episode: { label: 'Episode', icon: Clock, border: 'border-l-blue-500' },
  skill_chunk: { label: 'Skill', icon: BookOpen, border: 'border-l-amber-500' },
};

export function MemoryBrowser() {
  const { memories, addMemory, removeMemory } = useAgentStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [newFact, setNewFact] = useState('');

  const filtered = memories
    .filter((m) => !filter || m.type === filter)
    .filter((m) => !search || m.text.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.weight - a.weight);

  const handleAdd = () => {
    if (!newFact.trim()) return;
    addMemory({ text: newFact.trim(), type: 'fact', weight: 1.5, timestamp: new Date().toISOString(), source: 'manual' });
    setNewFact('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar matching original memory-toolbar */}
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 shrink-0">
        <h2 className="font-display text-[13px] font-bold text-foreground">🗺 Memory Browser</h2>
        <div className="flex-1" />
        <div className="flex gap-1">
          {['All', 'Facts', 'Episodes', 'Skills'].map((label) => {
            const type = label === 'All' ? null : label === 'Facts' ? 'fact' : label === 'Episodes' ? 'episode' : 'skill_chunk';
            const active = filter === type;
            return (
              <button
                key={label}
                onClick={() => setFilter(type)}
                className={`px-2.5 py-[5px] rounded-[6px] border text-[9px] uppercase tracking-[0.8px] transition-all
                  ${active
                    ? 'border-primary text-primary bg-primary/[0.08]'
                    : 'border-border text-muted-foreground bg-card hover:border-[hsl(var(--border-strong))] hover:text-foreground hover:bg-secondary'
                  }`}
              >{label}</button>
            );
          })}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-[180px] px-3 py-1.5 rounded-[6px] border border-border bg-background text-[10px] text-foreground
            placeholder:text-muted-foreground outline-none focus:border-primary"
        />
      </div>

      {/* Add fact */}
      <div className="px-4 py-2 border-b border-border bg-card flex gap-2">
        <input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a fact manually..."
          className="flex-1 bg-background border border-border rounded-[8px] px-3 py-2 text-[11px]
            placeholder:text-muted-foreground outline-none focus:border-primary focus:shadow-[0_0_0_3px_hsl(163_83%_31%/0.08)]"
        />
        <button
          onClick={handleAdd}
          disabled={!newFact.trim()}
          className="px-3 py-2 rounded-[8px] bg-primary text-primary-foreground text-[10px] font-semibold
            disabled:opacity-30 hover:brightness-105 active:scale-[0.97] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-[6px] bg-background">
        {filtered.map((mem, i) => {
          const meta = TYPE_META[mem.type] || TYPE_META.fact;
          const ageColor = mem.weight > 4 ? 'bg-primary shadow-[0_0_5px_hsl(163_83%_31%/0.5)]'
            : mem.weight > 3 ? 'bg-blue-500'
            : mem.weight > 2 ? 'bg-amber-500'
            : 'bg-gray-400';

          return (
            <div
              key={mem.id}
              className={`group bg-secondary border-l-[3px] ${meta.border} rounded-[7px] px-[9px] py-[6px] 
                hover:bg-[#e8e5de] transition-all cursor-pointer animate-fade-up`}
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <div className="text-[10px] leading-[1.5] text-foreground">{mem.text}</div>
              <div className="flex items-center gap-[5px] mt-[3px] text-[7px] uppercase tracking-[0.5px] text-muted-foreground">
                <div className={`w-[5px] h-[5px] rounded-full ${ageColor}`} />
                <span>{meta.label}</span>
                <span>·</span>
                <span>w:{mem.weight.toFixed(1)}</span>
                <span>·</span>
                <span>{mem.timestamp.slice(0, 10)}</span>
                {mem.source && <><span>·</span><span>{mem.source}</span></>}
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMemory(mem.id); }}
                    className="p-0.5 rounded hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-[9px] h-[9px]" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
