import { Wrench, Lock, Check, ExternalLink } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

export function SkillsOverview() {
  const skills = useAgentStore((s) => s.skills);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center gap-3 mb-6 animate-fade-up">
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-success" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Skills</h2>
          <p className="text-xs text-muted-foreground">
            {skills.filter((s) => s.enabled).length} active · {skills.filter((s) => !s.enabled).length} available — drop a .py file in skills/ to add more
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {skills.map((skill, i) => (
          <div
            key={skill.name}
            className={`bg-card border rounded-lg p-4 transition-all animate-fade-up ${skill.enabled ? 'border-success/30' : 'border-border'}`}
            style={{ animationDelay: `${60 + i * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium text-foreground">{skill.name}</span>
                {skill.enabled ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-success/10 text-success font-medium">
                    <Check className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground font-medium">
                    <Lock className="w-3 h-3" /> Needs setup
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{skill.description}</p>

            {/* Schema */}
            {Object.keys(skill.schema).length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Parameters</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(skill.schema).map(([param, type]) => (
                    <span key={param} className="px-2 py-0.5 text-[11px] font-mono rounded bg-muted text-muted-foreground">
                      {param}: <span className="text-info">{type}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Credentials */}
            {skill.requires_credentials.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Credentials needed</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {skill.requires_credentials.map((cred) => (
                    <span key={cred} className="px-2 py-0.5 text-[11px] font-mono rounded bg-destructive/10 text-destructive">
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add skill CTA */}
        <div className="border border-dashed border-border rounded-lg p-6 text-center animate-fade-up" style={{ animationDelay: `${60 + skills.length * 50}ms` }}>
          <p className="text-sm text-muted-foreground mb-1">Want more skills?</p>
          <p className="text-xs text-muted-foreground">
            Create a <span className="font-mono text-primary">.py</span> file in <span className="font-mono text-primary">skills/</span> implementing the <span className="font-mono text-primary">Skill</span> base class. Auto-discovered on restart.
          </p>
        </div>
      </div>
    </div>
  );
}
