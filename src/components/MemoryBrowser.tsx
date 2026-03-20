import { useState } from 'react';
import { Database, Search, Trash2, Plus, Brain, Clock, BookOpen } from 'lucide-react';
import { useAgentStore, type Memory } from '@/store/agentStore';

const TYPE_LABELS: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  fact: { label: 'Fact', icon: Brain, color: 'text-info' },
  episode: { label: 'Episode', icon: Clock, color: 'text-success' },
  skill_chunk: { label: 'Skill', icon: BookOpen, color: 'text-warning' },
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
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-info" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Memory</h2>
            <p className="text-xs text-muted-foreground">{memories.length} items stored</p>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1.5 text-xs rounded-md transition-all ${!filter ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
          >All</button>
          {Object.entries(TYPE_LABELS).map(([type, { label }]) => (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? null : type)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${filter === type ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Add fact */}
      <div className="flex gap-2 mb-4 animate-fade-up" style={{ animationDelay: '90ms' }}>
        <input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a fact manually..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          onClick={handleAdd}
          disabled={!newFact.trim()}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.map((mem, i) => {
          const typeInfo = TYPE_LABELS[mem.type] || TYPE_LABELS.fact;
          const Icon = typeInfo.icon;
          return (
            <div
              key={mem.id}
              className="group bg-card border border-border rounded-lg p-3 hover:border-primary/20 transition-all animate-fade-up"
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${typeInfo.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{mem.text}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-muted-foreground">
                    <span className={typeInfo.color}>{typeInfo.label}</span>
                    <span>weight: {mem.weight.toFixed(1)}</span>
                    <span>{mem.timestamp.slice(0, 10)}</span>
                    {mem.source && <span>via {mem.source}</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeMemory(mem.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
