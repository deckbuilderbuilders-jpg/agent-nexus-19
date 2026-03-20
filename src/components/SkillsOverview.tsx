import { useState, useEffect } from 'react';
import { Lock, Check, Power, RefreshCw } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';
import { getSkills, toggleSkill, checkHealth } from '@/lib/api';

export function SkillsOverview() {
  const storeSkills = useAgentStore((s) => s.skills);
  const [skills, setSkills] = useState(storeSkills);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Try to fetch live skills from backend
  useEffect(() => {
    checkHealth().then(h => {
      const isOnline = h?.ok ?? false;
      setOnline(isOnline);
      if (isOnline) {
        getSkills().then(s => { if (s) setSkills(s.map(sk => ({ ...sk, requires_credentials: [], schema: sk.schema || {} }))); });
      }
    });
  }, []);

  const handleToggle = async (name: string, currentEnabled: boolean) => {
    if (!online) return;
    setLoading(true);
    const result = await toggleSkill(name, !currentEnabled);
    if (result) {
      setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled: !currentEnabled } : s));
    }
    setLoading(false);
  };

  const refreshSkills = async () => {
    setLoading(true);
    const s = await getSkills();
    if (s) setSkills(s.map(sk => ({ ...sk, requires_credentials: [], schema: sk.schema || {} })));
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 shrink-0">
        <h2 className="font-display text-[13px] font-bold text-foreground">🔧 Skills</h2>
        <span className="text-[9px] text-muted-foreground ml-1">
          {skills.filter(s => s.enabled).length} active · {skills.filter(s => !s.enabled).length} available
        </span>
        <div className="flex-1" />
        {online && (
          <button onClick={refreshSkills} disabled={loading}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors active:scale-90 disabled:opacity-30">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
        <div className={`w-[6px] h-[6px] rounded-full ${online ? 'bg-primary' : 'bg-gray-400'}`} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 bg-background">
        {skills.map((skill, i) => (
          <div
            key={skill.name}
            className={`bg-card border rounded-[10px] p-3.5 transition-all animate-fade-up
              ${skill.enabled ? 'border-primary/30' : 'border-border'}`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono font-medium text-foreground">{skill.name}</span>
              {skill.enabled ? (
                <span className="flex items-center gap-1 px-[6px] py-[2px] text-[8px] rounded bg-primary/[0.08] text-primary font-semibold uppercase tracking-[0.5px]">
                  <Check className="w-[9px] h-[9px]" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 px-[6px] py-[2px] text-[8px] rounded bg-secondary text-muted-foreground font-semibold uppercase tracking-[0.5px]">
                  <Lock className="w-[9px] h-[9px]" /> Inactive
                </span>
              )}
              {online && (
                <button
                  onClick={() => handleToggle(skill.name, skill.enabled)}
                  disabled={loading}
                  className={`ml-auto p-1 rounded transition-all active:scale-90 ${
                    skill.enabled ? 'text-primary hover:text-primary/70' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground leading-[1.5] mb-2.5">{skill.description}</p>

            {Object.keys(skill.schema).length > 0 && (
              <div className="mb-2">
                <span className="text-[7px] uppercase tracking-[1px] text-muted-foreground font-semibold">Params</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {Object.entries(skill.schema).map(([param, type]: [string, string]) => (
                    <span key={param} className="px-1.5 py-[1px] text-[9px] font-mono rounded bg-secondary text-muted-foreground">
                      {param}: <span className="text-blue-500">{type}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {skill.requires_credentials.length > 0 && (
              <div>
                <span className="text-[7px] uppercase tracking-[1px] text-muted-foreground font-semibold">Credentials needed</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {skill.requires_credentials.map((cred) => (
                    <span key={cred} className="px-1.5 py-[1px] text-[9px] font-mono rounded bg-red-50 text-destructive">
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="border border-dashed border-border rounded-[10px] p-5 text-center animate-fade-up" style={{ animationDelay: `${skills.length * 40}ms` }}>
          <p className="text-[10px] text-muted-foreground">
            Drop a <span className="font-mono text-primary">.py</span> file in <span className="font-mono text-primary">backend/skills/</span> implementing the <span className="font-mono text-primary">Skill</span> base class → auto-discovered on restart.
          </p>
        </div>
      </div>
    </div>
  );
}
