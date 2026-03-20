import { Database, Shield, Wrench, ArrowRight, Brain, Zap, Monitor, Cloud, Download } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

export function DashboardView() {
  const memories = useAgentStore((s) => s.memories);
  const rules = useAgentStore((s) => s.rules);
  const skills = useAgentStore((s) => s.skills);
  const profile = useAgentStore((s) => s.profile);
  const compute = useAgentStore((s) => s.compute);
  const setActiveView = useAgentStore((s) => s.setActiveView);

  const factCount = memories.filter((m) => m.type === 'fact').length;
  const episodeCount = memories.filter((m) => m.type === 'episode').length;
  const profileFilled = Object.entries(profile).filter(([, v]) => v && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'object' || Object.keys(v).length > 0)).length;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border bg-card shadow-soft flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-sm accent-glow">🧠</div>
        <div>
          <h1 className="font-display text-base font-bold text-foreground leading-tight">Nexus</h1>
          <p className="text-[9px] text-muted-foreground">Learns · Remembers · Acts — your local AI second brain</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border">
            {compute.mode === 'local' ? <Monitor className="w-3 h-3" /> : compute.mode === 'cloud' ? <Cloud className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
            <span className="text-[8px] font-mono text-muted-foreground">{compute.mode}</span>
          </div>
          <div className="status-dot" />
          <span className="text-primary">Ready</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-background">
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

        <div className="bg-card border border-border rounded-[10px] p-4 shadow-soft animate-fade-up" style={{ animationDelay: '40ms' }}>
          <span className="text-[10px] font-display font-bold uppercase tracking-[1px] text-muted-foreground">Capabilities</span>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { icon: <Brain className="w-3.5 h-3.5" />, label: 'Silent Learning', desc: 'Auto-extracts facts from conversations' },
              { icon: <Zap className="w-3.5 h-3.5" />, label: 'Hybrid Compute', desc: 'Local Ollama + cloud RunPod fallback' },
              { icon: <Wrench className="w-3.5 h-3.5" />, label: 'Skill Execution', desc: 'Runs tools: search, read/write files' },
              { icon: <Shield className="w-3.5 h-3.5" />, label: 'Memory Lifecycle', desc: 'Decay, dedup, and smart pruning' },
              { icon: <Download className="w-3.5 h-3.5" />, label: 'Auto Updates', desc: 'Safe one-click updates, data preserved' },
              { icon: <Monitor className="w-3.5 h-3.5" />, label: 'PWA + Hotkey', desc: 'Install as app, ⌘Space quick chat' },
            ].map(cap => (
              <div key={cap.label} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50">
                <div className="text-primary mt-0.5">{cap.icon}</div>
                <div>
                  <div className="text-[10px] font-display font-bold text-foreground">{cap.label}</div>
                  <div className="text-[9px] text-muted-foreground leading-snug">{cap.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-[10px] p-4 shadow-soft animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-[1px] text-muted-foreground">Profile Completeness</span>
            <span className="text-[10px] font-mono text-primary">{Math.round((profileFilled / 12) * 100)}%</span>
          </div>
          <div className="w-full h-[5px] bg-secondary rounded-full">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(profileFilled / 12) * 100}%` }} />
          </div>
          {profileFilled < 8 && (
            <p className="text-[9px] text-muted-foreground mt-2">
              The more I know, the better.{' '}
              <button onClick={() => setActiveView('profile')} className="text-primary hover:underline">Complete profile →</button>
            </p>
          )}
        </div>

        {memories.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
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
