import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Check, X, WifiOff } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';
import { streamChat, checkHealth, type ChatRequest } from '@/lib/api';

export function ChatView() {
  const {
    messages, isThinking, addMessage, setThinking,
    pendingLearnings, confirmLearnings, dismissLearnings, setPendingLearnings,
    memories, rules, profile, topicRelationships,
  } = useAgentStore();
  const [input, setInput] = useState('');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamContent = useRef('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Check backend health on mount
  useEffect(() => {
    checkHealth().then(h => setBackendOnline(h?.ok ?? false));
    const interval = setInterval(() => {
      checkHealth().then(h => setBackendOnline(h?.ok ?? false));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    addMessage({ role: 'user', content: text });
    setInput('');
    setThinking(true);
    streamContent.current = '';

    if (!backendOnline) {
      // Demo fallback when backend is offline
      setTimeout(() => {
        addMessage({
          role: 'assistant',
          content: '⚠️ Backend offline. To connect:\n\n1. Start Ollama: `ollama serve`\n2. Start the backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload`\n3. Refresh this page.\n\nOnce connected, I\'ll use your local LLM with full memory context.',
        });
        setThinking(false);
      }, 600);
      return;
    }

    const req: ChatRequest = {
      message: text,
      memories: memories.map(m => ({ text: m.text, type: m.type, weight: m.weight })),
      rules: rules.map(r => `[P${r.priority}] ${r.text}`),
      profile: profile as unknown as Record<string, unknown>,
      relationships: topicRelationships,
    };

    // Create placeholder assistant message
    addMessage({ role: 'assistant', content: '' });

    await streamChat(req, {
      onToken: (token) => {
        streamContent.current += token;
        // Update the last assistant message in place
        useAgentStore.setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: streamContent.current };
          }
          return { messages: msgs };
        });
      },
      onLearnings: (learnings) => {
        setPendingLearnings(learnings);
      },
      onDone: () => {
        setThinking(false);
      },
      onError: (error) => {
        useAgentStore.setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: `Error: ${error}` };
          }
          return { messages: msgs };
        });
        setThinking(false);
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shadow-soft flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-sm accent-glow">
          🧠
        </div>
        <h1 className="font-display text-base font-bold text-foreground">Neural Console</h1>
        <div className="ml-auto flex items-center gap-[5px] text-[10px]">
          {backendOnline === null ? (
            <span className="text-muted-foreground">Checking...</span>
          ) : backendOnline ? (
            <>
              <div className="status-dot" />
              <span className="text-primary">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Offline — demo mode</span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3.5 bg-background">
        {messages.length === 0 && (
          <div className="self-center bg-secondary border border-dashed border-border text-muted-foreground text-[11px] max-w-[90%] text-center rounded-[10px] px-4 py-3 animate-fade-in">
            {backendOnline
              ? 'Agent initialized · Memory-augmented · Persistent knowledge base'
              : 'Start your backend to enable AI chat. Memory and profile editing work offline.'}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] rounded-[14px] px-4 py-3 text-[13px] leading-[1.6] animate-msg-in
              ${msg.role === 'user'
                ? 'self-end bg-primary text-primary-foreground rounded-br-[4px] accent-glow'
                : 'self-start bg-card border border-border rounded-bl-[4px] shadow-soft text-foreground'
              }`}
          >
            {msg.role === 'assistant' && (
              <div className="text-[9px] text-primary font-semibold uppercase tracking-[1.5px] mb-[5px]">Neural Agent</div>
            )}
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}

        {isThinking && messages[messages.length - 1]?.content === '' && (
          <div className="self-start bg-card border border-border rounded-[14px] rounded-bl-[4px] shadow-soft px-4 py-3 flex gap-[5px] animate-fade-in">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        {/* Learning proposal */}
        {pendingLearnings && (
          <div className="self-start max-w-[80%] bg-primary/[0.06] border border-primary/20 rounded-[14px] p-4 animate-msg-in">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-primary uppercase tracking-[1px]">Proposed Learning</span>
            </div>
            {pendingLearnings.facts.map((f, i) => (
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
            placeholder={backendOnline ? "Ask about campaigns, outreach, positioning..." : "Start backend to enable AI chat..."}
            className="flex-1 bg-background border border-border rounded-[10px] px-4 py-3 text-foreground text-[12px]
              placeholder:text-muted-foreground outline-none transition-all
              focus:border-primary focus:shadow-[0_0_0_3px_hsl(163_83%_31%/0.08)]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="w-[42px] h-[42px] rounded-[10px] bg-gradient-to-br from-primary to-emerald-400 border-none
              flex items-center justify-center shrink-0 accent-glow
              disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 hover:accent-glow-lg active:scale-[0.97] transition-all"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
