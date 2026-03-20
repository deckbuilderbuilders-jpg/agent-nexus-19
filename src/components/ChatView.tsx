import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Check, X } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

const DEMO_RESPONSES = [
  "Based on your ICP (VP Marketing at mid-market B2B SaaS), I'd recommend a 4-touch cold email sequence:\n\n**Email 1 — Pain point hook**\nSubject: \"[Company] spending too much on acquisition?\"\nLead with the industry average CAC ($65) vs your client's results.\n\n**Email 2 — Case study**\nSubject: \"How [Similar Company] cut CAC by 38%\"\nSocial proof with specific numbers.\n\n**Email 3 — Value add**\nShare a relevant insight or micro-report. No ask.\n\n**Email 4 — Direct CTA**\nSubject: \"Quick question, [Name]\"\n15-min call offer with a specific time.\n\nWant me to draft the full copy for any of these?",
  "Looking at your current metrics — $47 CAC with a 34% email open rate — here are three levers to pull:\n\n1. **Tighten targeting** — Your open rate is decent but your CAC suggests you're casting too wide.\n\n2. **A/B test subject lines** — At 34% opens, you have room to push to 42%+.\n\n3. **Shorten the funnel** — If your demo-to-close is more than 2 steps, look for friction.\n\nWhich of these do you want to dig into first?",
  "Given that Rival Corp just launched a freemium tier, here's how I'd position against it:\n\n**Don't compete on price — compete on outcome.**\n\nFreemium attracts tire-kickers. Your positioning should emphasize:\n- Time-to-value\n- Support quality (freemium = self-serve, you = white-glove)\n- Integration depth\n\n**Messaging framework:**\n\"[Your Product] isn't the cheapest option. It's the one that actually works.\"\n\nShall I draft a battle card for your sales team?",
];

export function ChatView() {
  const { messages, isThinking, addMessage, setThinking, pendingLearnings, confirmLearnings, dismissLearnings, setPendingLearnings } = useAgentStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const responseIndex = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    addMessage({ role: 'user', content: text });
    setInput('');
    setThinking(true);

    setTimeout(() => {
      const response = DEMO_RESPONSES[responseIndex.current % DEMO_RESPONSES.length];
      responseIndex.current += 1;
      addMessage({ role: 'assistant', content: response });
      setThinking(false);

      if (responseIndex.current % 2 === 0) {
        setTimeout(() => {
          setPendingLearnings({
            facts: ['Prefers battle cards for sales enablement'],
            profileUpdates: {},
          });
        }, 800);
      }
    }, 1200 + Math.random() * 800);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shadow-soft flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-sm accent-glow">
          🧠
        </div>
        <h1 className="font-display text-base font-bold text-foreground">Neural Console</h1>
        <div className="ml-auto flex items-center gap-[5px] text-[10px] text-primary">
          <div className="status-dot" />
          Connected
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3.5 bg-background">
        {messages.length === 0 && (
          <div className="self-center bg-secondary border border-dashed border-border text-muted-foreground text-[11px] max-w-[90%] text-center rounded-[10px] px-4 py-3 animate-fade-in">
            Agent initialized · Memory-augmented · Persistent knowledge base
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

        {isThinking && (
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
            placeholder="Ask about campaigns, outreach, positioning..."
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
