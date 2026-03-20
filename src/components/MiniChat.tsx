import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Minimize2 } from 'lucide-react';
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

export function MiniChat() {
  const { miniChatOpen, setMiniChatOpen, messages, addMessage, isThinking, setThinking, memories, rules, profile, topicRelationships, compute, setAutoLearnedCount, setPendingLearnings } = useAgentStore();
  const [input, setInput] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);
  const streamContent = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Global hotkey: Cmd/Ctrl + Space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
        e.preventDefault();
        setMiniChatOpen(!miniChatOpen);
      }
      if (e.key === 'Escape' && miniChatOpen) {
        setMiniChatOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [miniChatOpen, setMiniChatOpen]);

  useEffect(() => {
    if (miniChatOpen) {
      inputRef.current?.focus();
      checkHealth().then(h => setBackendOnline(h?.ok ?? false));
    }
  }, [miniChatOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    addMessage({ role: 'user', content: text });
    setInput('');
    setThinking(true);
    streamContent.current = '';

    if (!backendOnline) {
      addMessage({ role: 'assistant', content: '⚠️ Backend offline. Start Ollama + the backend to chat.' });
      setThinking(false);
      return;
    }

    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

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
        if (Object.keys(learnings.profileUpdates).length > 0) setPendingLearnings(learnings);
        else if (learnings.facts.length > 0) setAutoLearnedCount(learnings.facts.length);
      },
      onToolCall: () => {},
      onToolResult: () => {},
      onAutoLearned: (count, facts) => {
        for (const fact of facts) {
          useAgentStore.getState().addMemory({
            text: fact,
            type: 'fact',
            weight: 0.8,
            timestamp: new Date().toISOString(),
            source: 'auto',
          });
        }
        setAutoLearnedCount(count);
      },
      onPlanStep: () => {},
      onComputeRoute: () => {},
      onDone: () => setThinking(false),
      onError: (error) => {
        useAgentStore.setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: `Error: ${error}` };
          return { messages: msgs };
        });
        setThinking(false);
      },
    });
  }, [input, isThinking, messages, memories, rules, profile, topicRelationships, compute, backendOnline, addMessage, setThinking, setAutoLearnedCount, setPendingLearnings]);

  if (!miniChatOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-[380px] h-[480px] bg-card border border-border rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-[10px]">🧠</div>
        <span className="font-display text-[11px] font-bold text-foreground flex-1">Nexus Quick Chat</span>
        <span className="text-[7px] text-muted-foreground font-mono">⌘Space</span>
        <button onClick={() => setMiniChatOpen(false)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
          <Minimize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {messages.slice(-10).map((msg) => (
          <div key={msg.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-[1.5] ${
            msg.role === 'user'
              ? 'self-end bg-primary text-primary-foreground rounded-br-sm'
              : 'self-start bg-secondary text-foreground rounded-bl-sm'
          }`}>
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none text-[11px] [&_p]:mb-1 [&_code]:text-[9px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : msg.content}
          </div>
        ))}
        {isThinking && messages[messages.length - 1]?.content === '' && (
          <div className="self-start bg-secondary rounded-xl px-3 py-2 flex gap-1">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Quick question..."
            className="flex-1 bg-secondary border-none rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={handleSend} disabled={!input.trim() || isThinking}
            className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center disabled:opacity-30 active:scale-[0.95] transition-all">
            <Send className="w-3.5 h-3.5 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Floating button to open mini chat */
export function MiniChatFAB() {
  const { miniChatOpen, setMiniChatOpen } = useAgentStore();

  if (miniChatOpen) return null;

  return (
    <button
      onClick={() => setMiniChatOpen(true)}
      className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-lg shadow-lg accent-glow hover:scale-110 active:scale-95 transition-all z-40"
      title="Quick Chat (⌘Space)"
    >
      🧠
    </button>
  );
}
