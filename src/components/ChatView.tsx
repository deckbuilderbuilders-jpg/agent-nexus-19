import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, ChevronDown, Check, X } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';

const DEMO_RESPONSES = [
  "Based on your ICP (VP Marketing at mid-market B2B SaaS), I'd recommend a 4-touch cold email sequence:\n\n**Email 1 — Pain point hook**\nSubject: \"[Company] spending too much on acquisition?\"\nLead with the industry average CAC ($65) vs your client's results.\n\n**Email 2 — Case study**\nSubject: \"How [Similar Company] cut CAC by 38%\"\nSocial proof with specific numbers.\n\n**Email 3 — Value add**\nShare a relevant insight or micro-report. No ask.\n\n**Email 4 — Direct CTA**\nSubject: \"Quick question, [Name]\"\n15-min call offer with a specific time.\n\nWant me to draft the full copy for any of these?",
  "Looking at your current metrics — $47 CAC with a 34% email open rate — here are three levers to pull:\n\n1. **Tighten targeting** — Your open rate is decent but your CAC suggests you're casting too wide. Filter by company size *and* recent funding signals.\n\n2. **A/B test subject lines** — At 34% opens, you have room to push to 42%+. Test curiosity-gap vs. data-driven subjects.\n\n3. **Shorten the funnel** — If your demo-to-close is more than 2 steps, look for friction. Can you offer a self-serve trial instead?\n\nWhich of these do you want to dig into first?",
  "Given that Rival Corp just launched a freemium tier, here's how I'd position against it:\n\n**Don't compete on price — compete on outcome.**\n\nFreemium attracts tire-kickers. Your positioning should emphasize:\n- Time-to-value (how fast do paying customers see ROI?)\n- Support quality (freemium = self-serve, you = white-glove)\n- Integration depth (freemium tiers always gate integrations)\n\n**Messaging framework:**\n\"[Your Product] isn't the cheapest option. It's the one that actually works.\"\n\nShall I draft a battle card for your sales team?",
];

export function ChatView() {
  const { messages, isThinking, addMessage, setThinking, pendingLearnings, confirmLearnings, dismissLearnings, setPendingLearnings } = useAgentStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

    // Simulate response
    setTimeout(() => {
      const response = DEMO_RESPONSES[responseIndex.current % DEMO_RESPONSES.length];
      responseIndex.current += 1;
      addMessage({ role: 'assistant', content: response });
      setThinking(false);

      // Simulate learning proposal every 3 messages
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 glow-primary">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Neural Agent v4</h2>
            <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
              Your self-improving marketing strategist. I remember your business, learn your preferences, and get sharper with every conversation.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
              {['Draft a cold email sequence', 'Analyze my funnel metrics', 'Counter-position against competitor'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground 
                    hover:border-primary/40 hover:text-primary transition-all duration-200 active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div className={`max-w-[75%] ${msg.role === 'user'
              ? 'bg-primary/10 border border-primary/20 text-foreground'
              : 'bg-card border border-border text-foreground'
            } rounded-xl px-4 py-3 text-sm leading-relaxed`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}

        {/* Learning proposal */}
        {pendingLearnings && (
          <div className="animate-fade-up bg-primary/5 border border-primary/20 rounded-xl p-4 max-w-[75%]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">I'd like to remember</span>
            </div>
            {pendingLearnings.facts.map((f, i) => (
              <p key={i} className="text-sm text-foreground ml-6 mb-1">📝 {f}</p>
            ))}
            {Object.entries(pendingLearnings.profileUpdates).map(([k, v]: [string, string]) => (
              <p key={k} className="text-sm text-foreground ml-6 mb-1">👤 {k} = {v}</p>
            ))}
            <div className="flex gap-2 mt-3 ml-6">
              <button onClick={confirmLearnings} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:brightness-110 active:scale-95 transition-all">
                <Check className="w-3 h-3" /> Save
              </button>
              <button onClick={dismissLearnings} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground active:scale-95 transition-all">
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about marketing, outreach, positioning..."
              rows={1}
              className="w-full resize-none bg-card border border-border rounded-xl px-4 py-3 pr-12 text-sm 
                placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 
                focus:border-primary/40 transition-all"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center
              disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
