import { Brain, MessageSquare, Database, Shield, User, Wrench, LayoutDashboard } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { id: 'memory' as const, label: 'Memory', icon: Database },
  { id: 'rules' as const, label: 'Rules', icon: Shield },
  { id: 'profile' as const, label: 'Profile', icon: User },
  { id: 'skills' as const, label: 'Skills', icon: Wrench },
];

export function AppSidebar() {
  const activeView = useAgentStore((s) => s.activeView);
  const setActiveView = useAgentStore((s) => s.setActiveView);
  const memories = useAgentStore((s) => s.memories);
  const rules = useAgentStore((s) => s.rules);

  return (
    <aside className="w-16 lg:w-56 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-3 lg:p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 glow-primary-sm">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-sm font-semibold text-foreground leading-tight">Neural Agent</h1>
          <p className="text-[10px] text-muted-foreground font-mono">v4.0</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150
                ${active
                  ? 'bg-primary/10 text-primary glow-primary-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }
                active:scale-[0.97]`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="hidden lg:block">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Stats footer */}
      <div className="p-3 lg:p-4 border-t border-sidebar-border">
        <div className="hidden lg:flex flex-col gap-1 text-[11px] font-mono text-muted-foreground">
          <span>{memories.filter((m) => m.type === 'fact').length} facts</span>
          <span>{rules.length} rules</span>
          <span>{memories.filter((m) => m.type === 'episode').length} episodes</span>
        </div>
        <div className="lg:hidden flex justify-center">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        </div>
      </div>
    </aside>
  );
}
