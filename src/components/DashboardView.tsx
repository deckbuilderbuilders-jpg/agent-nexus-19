import { Brain, Database, Shield, Clock, Wrench, Activity, Cpu, ArrowRight } from 'lucide-react';
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

  const stats = [
    { label: 'Facts', value: factCount, icon: Database, color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Rules', value: rules.length, icon: Shield, color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'Episodes', value: episodeCount, icon: Clock, color: 'text-success', bgColor: 'bg-success/10' },
    { label: 'Skills', value: `${skills.filter((s) => s.enabled).length}/${skills.length}`, icon: Wrench, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight" style={{ lineHeight: '1.1' }}>Neural Agent v4</h1>
            <p className="text-sm text-muted-foreground mt-1">Self-improving marketing & bizdev assistant</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-xl p-4 animate-fade-up"
            style={{ animationDelay: `${60 + i * 50}ms` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div className="text-2xl font-semibold font-mono" style={{ lineHeight: '1.1' }}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Profile completeness */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 animate-fade-up" style={{ animationDelay: '260ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Profile Completeness</h3>
          <span className="text-xs font-mono text-primary">{Math.round((profileFilled / 12) * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full">
          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(profileFilled / 12) * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The more I know about your business, the better my recommendations. {profileFilled < 8 && (
            <button onClick={() => setActiveView('profile')} className="text-primary hover:underline inline-flex items-center gap-1">
              Complete your profile <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </p>
      </div>

      {/* Architecture */}
      <div className="bg-card border border-border rounded-xl p-5 animate-fade-up" style={{ animationDelay: '320ms' }}>
        <h3 className="text-sm font-medium mb-4">How it works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-warning font-medium">
              <Shield className="w-3.5 h-3.5" />
              Tier 1: Rules
            </div>
            <p className="text-muted-foreground leading-relaxed">
              User-defined behavioral constraints. Always loaded, always followed. Override everything else.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-success font-medium">
              <Wrench className="w-3.5 h-3.5" />
              Tier 2: Skills
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Injected expertise + executable capabilities. Drop a .py file, restart, done. Web, email, social — all plugins.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-info font-medium">
              <Database className="w-3.5 h-3.5" />
              Tier 3: Memory
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Profile (structured), episodes (session continuity), facts (semantic recall). All learning is opt-in.
            </p>
          </div>
        </div>
      </div>

      {/* Recent memories */}
      {memories.length > 0 && (
        <div className="mt-6 animate-fade-up" style={{ animationDelay: '380ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Recent Knowledge</h3>
            <button onClick={() => setActiveView('memory')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {memories.slice(0, 3).map((mem) => (
              <div key={mem.id} className="bg-card border border-border rounded-lg p-3 text-sm text-muted-foreground">
                <span className="font-mono text-[10px] text-primary mr-2">[{mem.weight.toFixed(1)}]</span>
                {mem.text.slice(0, 120)}{mem.text.length > 120 ? '...' : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
