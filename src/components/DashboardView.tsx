import { Database, Shield, Wrench, ArrowRight } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

export function DashboardView() {
  const memories = useAgentStore((s) => s.memories);
  const rules = useAgentStore((s) => s.rules);
  const skills = useAgentStore((s) => s.skills);
  const profile = useAgentStore((s) => s.profile);
  const setActiveView = useAgentStore((s) => s.setActiveView);

  const factCount = memories.filter((m) => m.type === 'fact').length;
  const episodeCount = memories.filter((m) => m.type === 'episode').length;
  const profileFilled = Object.entries(profile).filter(([, v]) => v && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'object' || Object.keys(v).length > 0)).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shadow-soft flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-sm accent-glow">
          🧠
        </div>
        <div>
          <h1 className="font-display text-base font-bold text-foreground leading-tight">Neural Agent v4</h1>
          <p className="text-[9px] text-muted-foreground">Self-improving marketing & bizdev assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-[5px] text-[10px] text-primary">
          <div className="status-dot" />
          Ready
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-background">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 animate-fade-up">
          {[
            { label: 'Facts', value: factCount, icon: '📝' },
            { label: 'Rules', value: rules.length, icon: '⚙️' },
            { label: 'Episodes', value: episodeCount, icon: '📋' },
            { label: 'Skills', value: `${skills.filter(s => s.enabled).length}/${skills.length}`, icon: '🔧' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-[8px] p-3 text-center shadow-soft">
              <div className="text-sm mb-1">{stat.icon}</div>
              <div className="font-display text-lg font-bold text-foreground" style={{ lineHeight: '1.1' }}>{stat.value}</div>
              <div className="text-[7px] uppercase tracking-[0.8px] text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Profile progress */}
        <div className="bg-card border border-border rounded-[10px] p-4 shadow-soft animate-fade-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-[1px] text-muted-foreground">Profile Completeness</span>
            <span className="text-[10px] font-mono text-primary">{Math.round((profileFilled / 12) * 100)}%</span>
          </div>
          <div className="w-full h-[5px] bg-secondary rounded-full">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(profileFilled / 12) * 100}%` }} />
          </div>
          {profileFilled < 8 && (
            <p className="text-[9px] text-muted-foreground mt-2">
              The more I know about your business, the better.{' '}
              <button onClick={() => setActiveView('profile')} className="text-primary hover:underline">
                Complete profile →
              </button>
            </p>
          )}
        </div>

        {/* Architecture */}
        <div className="bg-card border border-border rounded-[10px] p-4 shadow-soft animate-fade-up" style={{ animationDelay: '120ms' }}>
          <span className="text-[10px] font-display font-bold uppercase tracking-[1px] text-muted-foreground">Architecture</span>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-display font-bold text-amber-600 mb-1">
                <Shield className="w-3 h-3" /> Rules
              </div>
              <p className="text-[9px] text-muted-foreground leading-[1.5]">
                User-defined constraints. Always loaded, always followed.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-display font-bold text-primary mb-1">
                <Wrench className="w-3 h-3" /> Skills
              </div>
              <p className="text-[9px] text-muted-foreground leading-[1.5]">
                Executable capabilities. Drop a .py file, restart, done.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-display font-bold text-blue-500 mb-1">
                <Database className="w-3 h-3" /> Memory
              </div>
              <p className="text-[9px] text-muted-foreground leading-[1.5]">
                Profile + episodes + facts. All learning is opt-in.
              </p>
            </div>
          </div>
        </div>

        {/* Recent knowledge */}
        {memories.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-display font-bold uppercase tracking-[1px] text-muted-foreground">Recent Knowledge</span>
              <button onClick={() => setActiveView('memory')} className="text-[9px] text-primary hover:underline flex items-center gap-0.5">
                View all <ArrowRight className="w-[9px] h-[9px]" />
              </button>
            </div>
            <div className="flex flex-col gap-[5px]">
              {memories.slice(0, 4).map((mem) => (
                <div key={mem.id} className="bg-secondary rounded-[7px] px-[9px] py-[6px] text-[10px] text-foreground leading-[1.5]">
                  <span className="font-mono text-[8px] text-primary mr-1">[{mem.weight.toFixed(1)}]</span>
                  {mem.text.slice(0, 100)}{mem.text.length > 100 ? '...' : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
