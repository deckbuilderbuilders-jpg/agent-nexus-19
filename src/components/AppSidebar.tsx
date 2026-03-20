import { Brain, MessageSquare, Database, Shield, User, Wrench, LayoutDashboard, Settings } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Home', icon: LayoutDashboard },
  { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { id: 'memory' as const, label: 'Memory', icon: Database },
  { id: 'rules' as const, label: 'Rules', icon: Shield },
  { id: 'profile' as const, label: 'Profile', icon: User },
  { id: 'skills' as const, label: 'Skills', icon: Wrench },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const activeView = useAgentStore((s) => s.activeView);
  const setActiveView = useAgentStore((s) => s.setActiveView);

  return (
    <aside className="w-[310px] h-screen bg-card border-l border-border flex flex-col shrink-0 order-2 shadow-soft">
      {/* View toggle row */}
      <div className="p-3 border-b border-border flex gap-1 shrink-0 flex-wrap">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex-1 min-w-0 py-[7px] px-1 rounded-[7px] border text-[9px] font-display font-semibold
                uppercase tracking-[0.6px] text-center transition-all duration-200 active:scale-[0.97]
                ${active
                  ? 'bg-primary/[0.08] text-primary border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-[hsl(var(--border-strong))] hover:bg-secondary'
                }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        <SidebarStats />
      </div>
    </aside>
  );
}

function SidebarStats() {
  const memories = useAgentStore((s) => s.memories);
  const rules = useAgentStore((s) => s.rules);
  const skills = useAgentStore((s) => s.skills);
  const compute = useAgentStore((s) => s.compute);

  const factCount = memories.filter((m) => m.type === 'fact').length;
  const episodeCount = memories.filter((m) => m.type === 'episode').length;

  const computeLabel = compute.mode === 'local' ? 'Local (Ollama)' : compute.mode === 'hybrid' ? 'Hybrid' : 'Cloud (RunPod)';

  return (
    <>
      <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] text-muted-foreground pb-1.5 border-b border-border">
        Engine
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-secondary border border-border rounded-[7px] p-2 text-center">
          <div className="font-display text-[15px] font-bold text-foreground">{factCount}</div>
          <div className="text-[7px] uppercase tracking-[0.8px] text-muted-foreground mt-0.5">Facts</div>
        </div>
        <div className="bg-secondary border border-border rounded-[7px] p-2 text-center">
          <div className="font-display text-[15px] font-bold text-foreground">{rules.length}</div>
          <div className="text-[7px] uppercase tracking-[0.8px] text-muted-foreground mt-0.5">Rules</div>
        </div>
        <div className="bg-secondary border border-border rounded-[7px] p-2 text-center">
          <div className="font-display text-[15px] font-bold text-foreground">{episodeCount}</div>
          <div className="text-[7px] uppercase tracking-[0.8px] text-muted-foreground mt-0.5">Episodes</div>
        </div>
        <div className="bg-secondary border border-border rounded-[7px] p-2 text-center">
          <div className="font-display text-[15px] font-bold text-foreground">{skills.filter((s) => s.enabled).length}</div>
          <div className="text-[7px] uppercase tracking-[0.8px] text-muted-foreground mt-0.5">Skills</div>
        </div>
      </div>

      <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] text-muted-foreground pb-1.5 border-b border-border mt-2">
        Compute
      </div>
      <div className="bg-secondary border border-border rounded-lg p-2">
        {[
          { k: 'Mode', v: computeLabel },
          { k: 'Local', v: 'Ollama' },
          { k: 'Cloud', v: compute.runpodApiKey ? 'RunPod ✓' : 'Not configured' },
          { k: 'Memory', v: 'ChromaDB' },
        ].map((row, i, arr) => (
          <div key={row.k} className={`flex justify-between py-[3px] text-[9px] ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
            <span className="text-muted-foreground">{row.k}</span>
            <span className="text-foreground font-medium">{row.v}</span>
          </div>
        ))}
      </div>

      <div className="font-display text-[10px] font-bold uppercase tracking-[1.5px] text-muted-foreground pb-1.5 border-b border-border mt-2">
        Recency
      </div>
      <div className="flex flex-col gap-1">
        {[
          { label: 'Last hour', color: 'bg-primary', glow: true },
          { label: 'Last 24h', color: 'bg-blue-500', glow: false },
          { label: 'Last week', color: 'bg-amber-500', glow: false },
          { label: 'Older', color: 'bg-gray-400', glow: false },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <div className={`w-[7px] h-[7px] rounded-full ${item.color} ${item.glow ? 'shadow-[0_0_5px_hsl(163_83%_31%/0.5)]' : ''}`} />
            {item.label}
          </div>
        ))}
      </div>
    </>
  );
}
