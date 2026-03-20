import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

export function RulesManager() {
  const { rules, addRule, removeRule } = useAgentStore();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState(5);

  const handleAdd = () => {
    if (!text.trim()) return;
    addRule({ text: text.trim(), priority, category: 'general', created: new Date().toISOString() });
    setText('');
    setPriority(5);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 shrink-0">
        <h2 className="font-display text-[13px] font-bold text-foreground">⚙️ Rules</h2>
        <span className="text-[9px] text-muted-foreground ml-1">{rules.length} active — override default behavior</span>
      </div>

      {/* Add rule */}
      <div className="px-4 py-2 border-b border-border bg-card flex gap-2 items-center">
        <div className="flex items-center gap-1 bg-secondary border border-border rounded-[6px] px-2 py-1.5">
          <span className="text-[8px] text-muted-foreground uppercase tracking-wider">P</span>
          <input
            type="number" min={1} max={10} value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-[20px] bg-transparent text-[11px] text-center outline-none font-mono"
          />
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a rule... (e.g., 'Never use emoji in client emails')"
          className="flex-1 bg-background border border-border rounded-[8px] px-3 py-2 text-[11px]
            placeholder:text-muted-foreground outline-none focus:border-primary focus:shadow-[0_0_0_3px_hsl(163_83%_31%/0.08)]"
        />
        <button
          onClick={handleAdd}
          disabled={!text.trim()}
          className="px-3 py-2 rounded-[8px] bg-primary text-primary-foreground text-[10px] font-semibold
            disabled:opacity-30 hover:brightness-105 active:scale-[0.97] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-background">
        {rules
          .sort((a, b) => b.priority - a.priority)
          .map((rule, i) => {
            const urgency = rule.priority >= 8 ? 'border-l-destructive' : rule.priority >= 5 ? 'border-l-amber-500' : 'border-l-gray-400';
            return (
              <div
                key={rule.id}
                className={`group bg-card border border-border border-l-[3px] ${urgency} rounded-[8px] p-3 
                  hover:shadow-mid transition-all animate-fade-up`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-[5px] flex items-center justify-center shrink-0 text-[10px] font-display font-bold
                    ${rule.priority >= 8 ? 'bg-red-50 text-destructive' : rule.priority >= 5 ? 'bg-amber-50 text-amber-600' : 'bg-secondary text-muted-foreground'}`}>
                    P{rule.priority}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-foreground leading-[1.5]">{rule.text}</p>
                    <div className="flex items-center gap-2 mt-1 text-[7px] uppercase tracking-[0.5px] text-muted-foreground">
                      <span>{rule.category}</span>
                      <span>·</span>
                      <span>{rule.created.slice(0, 10)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-[10px] h-[10px]" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
