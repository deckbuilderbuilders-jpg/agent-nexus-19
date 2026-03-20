import { useState } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
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
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center gap-3 mb-6 animate-fade-up">
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Rules</h2>
          <p className="text-xs text-muted-foreground">{rules.length} rules active — these override default behavior</p>
        </div>
      </div>

      {/* Add rule */}
      <div className="flex gap-2 mb-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3">
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">P</span>
          <input
            type="number"
            min={1}
            max={10}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-8 bg-transparent text-sm text-center focus:outline-none font-mono"
          />
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a rule... (e.g., 'Never use emoji in client emails')"
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          onClick={handleAdd}
          disabled={!text.trim()}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {rules
          .sort((a, b) => b.priority - a.priority)
          .map((rule, i) => (
            <div
              key={rule.id}
              className="group bg-card border border-border rounded-lg p-4 hover:border-primary/20 transition-all animate-fade-up"
              style={{ animationDelay: `${90 + i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 font-mono text-xs font-bold
                  ${rule.priority >= 8 ? 'bg-destructive/10 text-destructive' : rule.priority >= 5 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
                  P{rule.priority}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{rule.text}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
                    <span>{rule.category}</span>
                    <span>{rule.created.slice(0, 10)}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
