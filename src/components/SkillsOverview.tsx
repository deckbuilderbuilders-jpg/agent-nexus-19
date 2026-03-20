import { Lock, Check } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

export function SkillsOverview() {
  const skills = useAgentStore((s) => s.skills);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 shrink-0">
        <h2 className="font-display text-[13px] font-bold text-foreground">🔧 Skills</h2>
        <span className="text-[9px] text-muted-foreground ml-1">
          {skills.filter(s => s.enabled).length} active · {skills.filter(s => !s.enabled).length} available
        </span>
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
                  <Lock className="w-[9px] h-[9px]" /> Needs setup
                </span>
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
            Drop a <span className="font-mono text-primary">.py</span> file in <span className="font-mono text-primary">skills/</span> implementing the <span className="font-mono text-primary">Skill</span> base class → auto-discovered on restart.
          </p>
        </div>
      </div>
    </div>
  );
}
