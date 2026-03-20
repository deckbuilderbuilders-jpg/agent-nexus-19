import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Check, X, WifiOff, Brain, Wrench, ChevronDown, ChevronUp, Monitor, Cloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAgentStore } from '@/store/agentStore';
import { streamChat, checkHealth, type ChatRequest } from '@/lib/api';

/** Strip internal blocks from displayed text */
function stripInternalBlocks(text: string): string {
  return text
    .replace(/\[LEARNINGS\][\s\S]*/g, '')
    .replace(/\[TOOL_CALL\]\s*```json?\s*[\s\S]*?```/g, '')
    .replace(/\[TOOL_CALL\]\s*\{[\s\S]*?\}/g, '')
    .replace(/\[APPROACH\][\s\S]*?\n\n/g, '')
    .trimEnd();
}

interface ToolCallDisplay {
  skill: string;
  params?: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  output?: string;
  error?: string;
}

interface PlanStep {
  step: number;
  total: number;
  description: string;
  status: string;
}

export function ChatView() {
  const {
    messages, isThinking, addMessage, setThinking,
    pendingLearnings, confirmLearnings, dismissLearnings, setPendingLearnings,
    memories, rules, profile, topicRelationships,
    autoLearnedCount, setAutoLearnedCount,
    compute,
  } = useAgentStore();
  const [input, setInput] = useState('');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([]);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [computeRoute, setComputeRoute] = useState<{ engine: string; reason: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamContent = useRef('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, toolCalls, planSteps]);

  useEffect(() => {
    checkHealth().then(h => setBackendOnline(h?.ok ?? false));
    const interval = setInterval(() => {
      checkHealth().then(h => setBackendOnline(h?.ok ?? false));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoLearnedCount > 0) {
      const t = setTimeout(() => setAutoLearnedCount(0), 5000);
      return () => clearTimeout(t);
    }
  }, [autoLearnedCount, setAutoLearnedCount]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    addMessage({ role: 'user', content: text });
    setInput('');
    setThinking(true);
    setToolCalls([]);
    setPlanSteps([]);
    setComputeRoute(null);
    setIsPlanning(text.startsWith('/plan'));
    streamContent.current = '';

    if (!backendOnline) {
      setTimeout(() => {
        addMessage({
          role: 'assistant',
          content: '⚠️ Backend offline. To connect:\n\n1. Start Ollama: `ollama serve`\n2. Start the backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload`\n3. Refresh this page.\n\nOnce connected, I\'ll use your local LLM with full memory context.',
        });
        setThinking(false);
      }, 600);
      return;
    }

    const history = messages.slice(-16).map(m => ({ role: m.role, content: m.content }));

    const req: ChatRequest = {
      message: text,
      history,
      memories: memories.map(m => ({ text: m.text, type: m.type, weight: m.weight })),
      rules: rules.map(r => `[P${r.priority}] ${r.text}`),
      profile: profile as unknown as Record<string, unknown>,
      relationships: topicRelationships,
      compute_mode: compute.mode,
      ...(compute.runpodApiKey && { runpod_api_key: compute.runpodApiKey }),
      ...(compute.runpodEndpoint && { runpod_endpoint: compute.runpodEndpoint }),
      ...(compute.runpodModel && { runpod_model: compute.runpodModel }),
    };

    addMessage({ role: 'assistant', content: '' });

    await streamChat(req, {
      onToken: (token) => {
        streamContent.current += token;
        useAgentStore.setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: stripInternalBlocks(streamContent.current) };
          }
          return { messages: msgs };
        });
      },
      onLearnings: (learnings) => {
        const hasProfileUpdates = Object.keys(learnings.profileUpdates).length > 0;
        if (hasProfileUpdates) {
          // Show approval card for profile changes (facts included)
          setPendingLearnings(learnings);
        } else if (learnings.facts.length > 0) {
          // Auto-save fact-only learnings directly to the store
          for (const fact of learnings.facts) {
            useAgentStore.getState().addMemory({
              text: fact,
              type: 'fact',
              weight: 1.5,
              timestamp: new Date().toISOString(),
              source: 'conversation',
            });
          }
          setAutoLearnedCount(learnings.facts.length);
        }
      },
      onToolCall: (call) => setToolCalls(prev => [...prev, { skill: call.skill, params: call.params, status: 'running' }]),
      onToolResult: (result) => {
        setToolCalls(prev => prev.map(tc =>
          tc.skill === result.skill && tc.status === 'running'
            ? { ...tc, status: result.success ? 'success' : 'error', output: result.output, error: result.error }
            : tc
        ));
        useAgentStore.setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            const existing = last.skillResults || [];
            msgs[msgs.length - 1] = { ...last, skillResults: [...existing, result] };
          }
          return { messages: msgs };
        });
      },
      onAutoLearned: (count) => setAutoLearnedCount(count),
      onPlanStep: (step) => {
        setPlanSteps(prev => {
          const idx = prev.findIndex(s => s.step === step.step);
          if (idx >= 0) { const u = [...prev]; u[idx] = step; return u; }
          return [...prev, step];
        });
      },
      onComputeRoute: (route) => setComputeRoute(route),
      onDone: () => { setThinking(false); setIsPlanning(false); },
      onError: (error) => {
        useAgentStore.setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: `Error: ${error}` };
          return { messages: msgs };
        });
        setThinking(false); setIsPlanning(false);
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shadow-soft flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-sm accent-glow">🧠</div>
        <h1 className="font-display text-base font-bold text-foreground">Nexus Console</h1>

        {autoLearnedCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/[0.08] border border-primary/20 animate-fade-in">
            <Brain className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-medium text-primary">+{autoLearnedCount} learned</span>
          </div>
        )}

        {/* Compute route indicator */}
        {computeRoute && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border animate-fade-in">
            {computeRoute.engine === 'ollama' ? <Monitor className="w-3 h-3 text-muted-foreground" /> : <Cloud className="w-3 h-3 text-blue-500" />}
            <span className="text-[8px] font-mono text-muted-foreground">{computeRoute.engine}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-[5px] text-[10px]">
          {backendOnline === null ? (
            <span className="text-muted-foreground">Checking...</span>
          ) : backendOnline ? (
            <><div className="status-dot" /><span className="text-primary">Connected</span></>
          ) : (
            <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Offline — demo mode</span></>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3.5 bg-background">
        {messages.length === 0 && (
          <div className="self-center bg-secondary border border-dashed border-border text-muted-foreground text-[11px] max-w-[90%] text-center rounded-[10px] px-4 py-3 animate-fade-in">
            {backendOnline
              ? 'Nexus initialized · Memory-augmented · Skill execution · Hybrid compute ready'
              : 'Start your backend to enable AI chat. Memory and profile editing work offline.'}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`max-w-[80%] rounded-[14px] px-4 py-3 text-[13px] leading-[1.6] animate-msg-in ${
            msg.role === 'user'
              ? 'self-end bg-primary text-primary-foreground rounded-br-[4px] accent-glow'
              : 'self-start bg-card border border-border rounded-bl-[4px] shadow-soft text-foreground'
          }`}>
            {msg.role === 'assistant' && (
              <div className="text-[9px] text-primary font-semibold uppercase tracking-[1.5px] mb-[5px]">Nexus</div>
            )}
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm prose-neutral max-w-none text-[13px] leading-[1.6] [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_code]:text-[11px] [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-[11px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
            {msg.skillResults && msg.skillResults.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {msg.skillResults.map((sr, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 text-[10px] border ${sr.success ? 'border-primary/20 bg-primary/[0.04]' : 'border-destructive/20 bg-destructive/[0.04]'}`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Wrench className="w-3 h-3" />
                      <span className="font-mono">{sr.skill}</span>
                      <span className={sr.success ? 'text-primary' : 'text-destructive'}>{sr.success ? '✓' : '✗'}</span>
                    </div>
                    {sr.output && <pre className="mt-1 text-[9px] whitespace-pre-wrap text-muted-foreground">{sr.output.slice(0, 500)}</pre>}
                    {sr.error && <p className="mt-1 text-destructive">{sr.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Tool calls, plan steps, thinking — same as before */}
        {toolCalls.length > 0 && (
          <div className="self-start max-w-[80%] animate-fade-in">
            <button onClick={() => setToolsExpanded(!toolsExpanded)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground mb-1 transition-colors">
              <Wrench className="w-3 h-3" />{toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
              {toolsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {toolsExpanded && toolCalls.map((tc, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-[10px] border mb-1 ${tc.status === 'running' ? 'border-primary/30 bg-primary/[0.04]' : tc.status === 'success' ? 'border-primary/20 bg-card' : 'border-destructive/20 bg-destructive/[0.04]'}`}>
                <div className="flex items-center gap-1.5 font-mono font-medium">
                  {tc.status === 'running' && <span className="animate-pulse">⚙️</span>}
                  {tc.status === 'success' && <span>✅</span>}
                  {tc.status === 'error' && <span>❌</span>}
                  {tc.skill}
                </div>
                {tc.output && <pre className="mt-1 text-[9px] whitespace-pre-wrap text-muted-foreground">{tc.output.slice(0, 300)}</pre>}
                {tc.error && <p className="mt-1 text-destructive text-[9px]">{tc.error}</p>}
              </div>
            ))}
          </div>
        )}

        {planSteps.length > 0 && (
          <div className="self-start max-w-[80%] bg-card border border-border rounded-[14px] p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-primary uppercase tracking-[1px]">Deep Work Plan</span>
            </div>
            {planSteps.map((step) => (
              <div key={step.step} className="flex items-start gap-2 mb-1.5 text-[11px]">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${step.status === 'done' ? 'bg-primary text-primary-foreground' : step.status === 'active' ? 'bg-primary/20 text-primary animate-pulse' : 'bg-secondary text-muted-foreground'}`}>{step.step}</span>
                <span className={step.status === 'done' ? 'text-muted-foreground' : 'text-foreground'}>{step.description}</span>
              </div>
            ))}
          </div>
        )}

        {isThinking && messages[messages.length - 1]?.content === '' && (
          <div className="self-start bg-card border border-border rounded-[14px] rounded-bl-[4px] shadow-soft px-4 py-3 flex items-center gap-2 animate-fade-in">
            {isPlanning ? (
              <><Brain className="w-3.5 h-3.5 text-primary animate-pulse" /><span className="text-[10px] text-muted-foreground">Planning approach...</span></>
            ) : (
              <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></>
            )}
          </div>
        )}

        {pendingLearnings && (
          <div className="self-start max-w-[80%] bg-primary/[0.06] border border-primary/20 rounded-[14px] p-4 animate-msg-in">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-primary uppercase tracking-[1px]">Profile Update</span>
            </div>
            {pendingLearnings.facts.length > 0 && pendingLearnings.facts.map((f, i) => (
              <p key={i} className="text-[11px] text-foreground ml-5 mb-1">📝 {f}</p>
            ))}
            {Object.entries(pendingLearnings.profileUpdates).map(([k, v]: [string, string]) => (
              <p key={k} className="text-[11px] text-foreground ml-5 mb-1">👤 {k} = {v}</p>
            ))}
            <div className="flex gap-2 mt-3 ml-5">
              <button onClick={confirmLearnings} className="flex items-center gap-1 px-3 py-1.5 text-[10px] rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-105 active:scale-[0.97] transition-all">
                <Check className="w-3 h-3" /> Save
              </button>
              <button onClick={dismissLearnings} className="flex items-center gap-1 px-3 py-1.5 text-[10px] rounded-md border border-border text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all">
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-3.5 border-t border-border bg-card shadow-[0_-2px_8px_rgba(0,0,0,0.03)]">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={backendOnline ? "Ask anything... (prefix /plan for deep work mode)" : "Start backend to enable AI chat..."}
            className="flex-1 bg-background border border-border rounded-[10px] px-4 py-3 text-foreground text-[12px] placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(163_83%_31%/0.08)]"
          />
          <button onClick={handleSend} disabled={!input.trim() || isThinking}
            className="w-[42px] h-[42px] rounded-[10px] bg-gradient-to-br from-primary to-emerald-400 border-none flex items-center justify-center shrink-0 accent-glow disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 hover:accent-glow-lg active:scale-[0.97] transition-all">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
