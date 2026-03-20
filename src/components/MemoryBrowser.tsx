import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useAgentStore, Memory } from '@/store/agentStore';

/* ── Topic clustering ─────────────────────────────────────────── */

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memories: Memory[];
  avgWeight: number;
  x: number;
  y: number;
  radius: number;       // computed from weight + count
  userRadius?: number;   // user override
  color: string;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Market': ['market', 'icp', 'segment', 'b2b', 'saas', 'enterprise', 'mid-market', 'employees'],
  'Costs': ['cac', 'cost', 'spend', 'budget', 'price', '$', 'revenue', 'reduce'],
  'Outreach': ['email', 'cold', 'sequence', 'touch', 'outbound', 'campaign'],
  'Tone': ['tone', 'voice', 'professional', 'buzzword', 'data-driven', 'formal'],
  'Competition': ['competitor', 'rival', 'freemium', 'positioning', 'counter'],
  'Strategy': ['strategy', 'goal', 'plan', 'approach', 'framework', 'decision'],
  'Content': ['content', 'copy', 'cta', 'case study', 'blog'],
  'Metrics': ['metric', 'rate', 'open rate', 'conversion', '%', 'kpi'],
};

const TYPE_COLORS: Record<string, string> = {
  fact: 'hsl(163 83% 31%)',       // primary teal
  episode: 'hsl(217 91% 60%)',    // blue
  skill_chunk: 'hsl(38 92% 50%)', // amber
};

function clusterMemories(memories: Memory[]): Topic[] {
  const topics: Map<string, Memory[]> = new Map();
  const assigned = new Set<string>();

  // Assign memories to topics by keyword match
  for (const mem of memories) {
    const text = mem.text.toLowerCase();
    let matched = false;
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        if (!topics.has(topic)) topics.set(topic, []);
        topics.get(topic)!.push(mem);
        assigned.add(mem.id);
        matched = true;
        break; // first match wins
      }
    }
  }

  // Unassigned go to "Other"
  const unassigned = memories.filter(m => !assigned.has(m.id));
  if (unassigned.length > 0) {
    topics.set('Other', unassigned);
  }

  // Convert to Topic objects with spatial layout
  const topicList = Array.from(topics.entries());
  const centerX = 400;
  const centerY = 300;
  const orbitRadius = 180;

  return topicList.map(([label, mems], i): Topic => {
    const angle = (i / topicList.length) * Math.PI * 2 - Math.PI / 2;
    const avgWeight = mems.reduce((s, m) => s + m.weight, 0) / mems.length;
    const countFactor = Math.sqrt(mems.length); // more items = bigger
    const weightFactor = avgWeight / 5;
    const baseRadius = 30 + countFactor * 18 + weightFactor * 15;

    // Dominant type determines color
    const typeCounts: Record<string, number> = {};
    mems.forEach(m => { typeCounts[m.type] = (typeCounts[m.type] || 0) + 1; });
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];

    return {
      id: label,
      label,
      keywords: TOPIC_KEYWORDS[label] || [],
      memories: mems,
      avgWeight,
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
      radius: baseRadius,
      color: TYPE_COLORS[dominantType] || TYPE_COLORS.fact,
    };
  });
}

function findConnections(topics: Topic[]): [string, string, number][] {
  const connections: [string, string, number][] = [];
  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i];
      const b = topics[j];
      // Check if any memories share keywords across topics
      const aText = a.memories.map(m => m.text.toLowerCase()).join(' ');
      const bKeywords = b.keywords.length > 0 ? b.keywords : [b.label.toLowerCase()];
      const overlap = bKeywords.filter(k => aText.includes(k)).length;
      if (overlap > 0) {
        connections.push([a.id, b.id, Math.min(overlap / 3, 1)]);
      }
    }
  }
  return connections;
}

/* ── Draggable Topic Bubble ───────────────────────────────────── */

function TopicBubble({
  topic,
  selected,
  onSelect,
  onDrag,
  onResize,
}: {
  topic: Topic;
  selected: boolean;
  onSelect: () => void;
  onDrag: (dx: number, dy: number) => void;
  onResize: (dr: number) => void;
}) {
  const dragRef = useRef<{ startX: number; startY: number; mode: 'move' | 'resize' } | null>(null);
  const r = topic.userRadius ?? topic.radius;
  const memCount = topic.memories.length;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    // If near edge (outer 20%), resize mode. Otherwise move.
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const edgeThreshold = (rect.width / 2) * 0.75;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      mode: dist > edgeThreshold ? 'resize' : 'move',
    };
  }, [onSelect]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (dragRef.current.mode === 'move') {
      onDrag(dx, dy);
    } else {
      // Resize: use radial distance change
      onResize(dx * 0.3);
    }
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
  }, [onDrag, onResize]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Sub-memory dots arranged in a circle inside the bubble
  const dotAngleStep = (Math.PI * 2) / Math.max(memCount, 1);
  const dotOrbit = r * 0.45;

  return (
    <g
      transform={`translate(${topic.x}, ${topic.y})`}
      style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Glow ring when selected */}
      {selected && (
        <circle r={r + 8} fill="none" stroke={topic.color} strokeWidth="2" opacity="0.25">
          <animate attributeName="r" values={`${r + 6};${r + 12};${r + 6}`} dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Main bubble */}
      <circle
        r={r}
        fill={topic.color}
        opacity={0.12}
        stroke={topic.color}
        strokeWidth={selected ? 2 : 1}
      />

      {/* Inner fill — weight indicator */}
      <circle
        r={r * (topic.avgWeight / 5)}
        fill={topic.color}
        opacity={0.08}
      />

      {/* Sub-memory dots */}
      {topic.memories.map((mem, i) => {
        const angle = dotAngleStep * i - Math.PI / 2;
        const dx = Math.cos(angle) * dotOrbit;
        const dy = Math.sin(angle) * dotOrbit;
        const dotR = 2 + (mem.weight / 5) * 3;
        return (
          <circle
            key={mem.id}
            cx={dx}
            cy={dy}
            r={dotR}
            fill={TYPE_COLORS[mem.type]}
            opacity={0.6 + (mem.weight / 5) * 0.4}
          >
            <title>{mem.text.slice(0, 60)}</title>
          </circle>
        );
      })}

      {/* Label — max 2 words */}
      <text
        y={2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        className="text-foreground"
        fontSize={Math.max(10, Math.min(14, r * 0.22))}
        fontFamily="var(--font-display)"
        fontWeight="700"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {topic.label}
      </text>

      {/* Count badge */}
      <text
        y={r * 0.35}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={topic.color}
        fontSize="8"
        fontFamily="var(--font-mono)"
        fontWeight="500"
        opacity="0.7"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {memCount} item{memCount !== 1 ? 's' : ''}
      </text>

      {/* Resize hint ring (outer edge) */}
      <circle
        r={r}
        fill="none"
        stroke={topic.color}
        strokeWidth="0"
        className="hover:!stroke-[1px]"
        opacity="0.3"
        strokeDasharray="3 3"
      />
    </g>
  );
}

/* ── Main Canvas ──────────────────────────────────────────────── */

export function MemoryBrowser() {
  const { memories, addMemory, removeMemory, updateMemoryWeight } = useAgentStore();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newFact, setNewFact] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Re-cluster when memories change
  useEffect(() => {
    setTopics(clusterMemories(memories));
  }, [memories]);

  const connections = useMemo(() => findConnections(topics), [topics]);

  const selectedTopic = topics.find(t => t.id === selectedId);

  const handleDrag = useCallback((topicId: string, dx: number, dy: number) => {
    setTopics(prev => prev.map(t =>
      t.id === topicId ? { ...t, x: t.x + dx / zoom, y: t.y + dy / zoom } : t
    ));
  }, [zoom]);

  const handleResize = useCallback((topicId: string, dr: number) => {
    setTopics(prev => prev.map(t => {
      if (t.id !== topicId) return t;
      const newR = Math.max(25, (t.userRadius ?? t.radius) + dr);
      return { ...t, userRadius: newR };
    }));
  }, []);

  const handleAdd = useCallback(() => {
    if (!newFact.trim()) return;
    addMemory({ text: newFact.trim(), type: 'fact', weight: 2.5, timestamp: new Date().toISOString(), source: 'manual' });
    setNewFact('');
  }, [newFact, addMemory]);

  const resetLayout = useCallback(() => {
    setTopics(clusterMemories(memories));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [memories]);

  // Canvas panning
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'svg') {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setSelectedId(null);
    }
  }, [pan]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const handleCanvasPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar — minimal */}
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-3 shrink-0">
        <h2 className="font-display text-sm font-bold text-foreground">🧠 Memory</h2>
        <div className="flex-1" />

        {/* Add input */}
        <input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Teach me..."
          className="w-48 bg-background border border-border rounded-lg px-3 py-1.5 text-[10px]
            placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
        />
        <button
          onClick={handleAdd}
          disabled={!newFact.trim()}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30
            hover:brightness-105 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Zoom controls */}
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors active:scale-90">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors active:scale-90">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={resetLayout}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors active:scale-90"
          title="Reset layout">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <svg
          ref={svgRef}
          className="w-full h-full relative z-10"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          style={{ cursor: isPanning.current ? 'grabbing' : 'default' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Connection lines */}
            {connections.map(([a, b, strength]) => {
              const ta = topics.find(t => t.id === a);
              const tb = topics.find(t => t.id === b);
              if (!ta || !tb) return null;
              return (
                <line
                  key={`${a}-${b}`}
                  x1={ta.x} y1={ta.y} x2={tb.x} y2={tb.y}
                  stroke="hsl(var(--border-strong))"
                  strokeWidth={1 + strength}
                  strokeDasharray="4 4"
                  opacity={0.3 + strength * 0.3}
                />
              );
            })}

            {/* Topic bubbles */}
            {topics.map(topic => (
              <TopicBubble
                key={topic.id}
                topic={topic}
                selected={selectedId === topic.id}
                onSelect={() => setSelectedId(selectedId === topic.id ? null : topic.id)}
                onDrag={(dx, dy) => handleDrag(topic.id, dx, dy)}
                onResize={(dr) => handleResize(topic.id, dr)}
              />
            ))}
          </g>
        </svg>

        {/* Selected topic detail panel — slides in from bottom */}
        {selectedTopic && (
          <div className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border
            p-4 animate-fade-up z-20 max-h-[35%] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: selectedTopic.color }} />
              <span className="font-display text-xs font-bold text-foreground">{selectedTopic.label}</span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-[1px]">
                {selectedTopic.memories.length} memories · avg {selectedTopic.avgWeight.toFixed(1)} weight
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedTopic.memories.map(mem => (
                <div
                  key={mem.id}
                  className="group relative px-2.5 py-1.5 rounded-md border text-[9px] leading-snug
                    transition-all hover:shadow-sm cursor-default max-w-[200px]"
                  style={{
                    borderColor: TYPE_COLORS[mem.type] + '40',
                    background: TYPE_COLORS[mem.type] + '08',
                  }}
                >
                  <span className="text-foreground">{mem.text.length > 80 ? mem.text.slice(0, 77) + '…' : mem.text}</span>
                  <div className="flex items-center gap-2 mt-1 text-[7px] text-muted-foreground">
                    <span>{mem.timestamp.slice(0, 10)}</span>
                    <span>w:{mem.weight.toFixed(1)}</span>
                    <button
                      onClick={() => removeMemory(mem.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend — bottom-left, unobtrusive */}
        <div className="absolute bottom-3 left-3 flex gap-3 text-[8px] text-muted-foreground z-10">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS.fact }} /> Facts
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS.episode }} /> Episodes
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS.skill_chunk }} /> Skills
          </span>
          <span className="opacity-50">drag to move · edge-drag to resize</span>
        </div>
      </div>
    </div>
  );
}
