import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus, ZoomIn, ZoomOut, RotateCcw, Link2 } from 'lucide-react';
import { useAgentStore, Memory } from '@/store/agentStore';

/* ── Types ────────────────────────────────────────────────────── */

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memories: Memory[];
  avgWeight: number;
  x: number;
  y: number;
  radius: number;
  userRadius?: number;
  color: string;
}

interface ProximityLink {
  a: string;
  b: string;
  strength: number; // 0-1, based on distance
}

/* ── Constants ────────────────────────────────────────────────── */

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
  fact: 'hsl(163 83% 31%)',
  episode: 'hsl(217 91% 60%)',
  skill_chunk: 'hsl(38 92% 50%)',
};

const PROXIMITY_THRESHOLD = 250; // px distance to form a relationship

/* ── Clustering ───────────────────────────────────────────────── */

function clusterMemories(memories: Memory[]): Topic[] {
  const topics: Map<string, Memory[]> = new Map();
  const assigned = new Set<string>();

  for (const mem of memories) {
    const text = mem.text.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        if (!topics.has(topic)) topics.set(topic, []);
        topics.get(topic)!.push(mem);
        assigned.add(mem.id);
        break;
      }
    }
  }

  const unassigned = memories.filter(m => !assigned.has(m.id));
  if (unassigned.length > 0) topics.set('Other', unassigned);

  const topicList = Array.from(topics.entries());
  const centerX = 450;
  const centerY = 320;
  const orbitRadius = 200;

  return topicList.map(([label, mems], i): Topic => {
    const angle = (i / topicList.length) * Math.PI * 2 - Math.PI / 2;
    const avgWeight = mems.reduce((s, m) => s + m.weight, 0) / mems.length;
    const baseRadius = 35 + Math.sqrt(mems.length) * 20 + (avgWeight / 5) * 18;

    const typeCounts: Record<string, number> = {};
    mems.forEach(m => { typeCounts[m.type] = (typeCounts[m.type] || 0) + 1; });
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];

    return {
      id: label, label, keywords: TOPIC_KEYWORDS[label] || [], memories: mems, avgWeight,
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
      radius: baseRadius,
      color: TYPE_COLORS[dominantType] || TYPE_COLORS.fact,
    };
  });
}

/* ── Proximity detection ──────────────────────────────────────── */

function computeProximityLinks(topics: Topic[]): ProximityLink[] {
  const links: ProximityLink[] = [];
  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const dist = Math.hypot(topics[i].x - topics[j].x, topics[i].y - topics[j].y);
      const combinedR = (topics[i].userRadius ?? topics[i].radius) + (topics[j].userRadius ?? topics[j].radius);
      const effectiveDist = dist - combinedR; // edge-to-edge distance
      if (effectiveDist < PROXIMITY_THRESHOLD) {
        const strength = Math.max(0, 1 - effectiveDist / PROXIMITY_THRESHOLD);
        links.push({ a: topics[i].id, b: topics[j].id, strength });
      }
    }
  }
  return links;
}

/* ── Sync relationships to agent store ────────────────────────── */

function syncRelationshipsToAgent(
  links: ProximityLink[],
  setTopicRelationships: (rels: { a: string; b: string; strength: number }[]) => void
) {
  setTopicRelationships(links.filter(l => l.strength > 0.15).map(l => ({
    a: l.a, b: l.b, strength: Math.round(l.strength * 100) / 100,
  })));
}

/* ── Expanded Topic Panel ─────────────────────────────────────── */

function ExpandedPanel({
  topic,
  onClose,
  onRemove,
}: {
  topic: Topic;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border
        px-5 py-4 animate-fade-up z-20 max-h-[40%] overflow-y-auto"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-4 rounded-full" style={{ background: topic.color }} />
        <span className="font-display text-base font-bold text-foreground">{topic.label}</span>
        <span className="text-[10px] text-muted-foreground">
          {topic.memories.length} items
        </span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ✕ Close
        </button>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {topic.memories.map(mem => (
          <div
            key={mem.id}
            className="group rounded-lg border px-3 py-2 transition-all hover:shadow-sm"
            style={{
              borderColor: TYPE_COLORS[mem.type] + '40',
              background: TYPE_COLORS[mem.type] + '06',
            }}
          >
            <p className="text-[11px] leading-relaxed text-foreground">
              {mem.text.length > 100 ? mem.text.slice(0, 97) + '…' : mem.text}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted-foreground">
              <span className="uppercase tracking-wide">{mem.type}</span>
              <span>·</span>
              <span>{mem.timestamp.slice(0, 10)}</span>
              <span>·</span>
              <span>w:{mem.weight.toFixed(1)}</span>
              <button
                onClick={() => onRemove(mem.id)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-all"
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Topic Bubble (SVG) ───────────────────────────────────────── */

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

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const edgeThreshold = (rect.width / 2) * 0.7;

    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
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
      onResize(dx * 0.3);
    }
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
  }, [onDrag, onResize]);

  const handlePointerUp = useCallback(() => { dragRef.current = null; }, []);

  // Sub-dots
  const dotAngleStep = (Math.PI * 2) / Math.max(memCount, 1);
  const dotOrbit = r * 0.5;
  const fontSize = Math.max(14, Math.min(22, r * 0.28));

  return (
    <g
      transform={`translate(${topic.x}, ${topic.y})`}
      style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Glow ring */}
      {selected && (
        <circle r={r + 10} fill="none" stroke={topic.color} strokeWidth="2.5" opacity="0.2">
          <animate attributeName="r" values={`${r + 8};${r + 14};${r + 8}`} dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Outer ring */}
      <circle r={r} fill={topic.color} opacity={0.1} stroke={topic.color} strokeWidth={selected ? 2.5 : 1.5} />

      {/* Weight fill */}
      <circle r={r * (topic.avgWeight / 5)} fill={topic.color} opacity={0.06} />

      {/* Sub-memory dots */}
      {topic.memories.map((mem, i) => {
        const angle = dotAngleStep * i - Math.PI / 2;
        const dx = Math.cos(angle) * dotOrbit;
        const dy = Math.sin(angle) * dotOrbit;
        const dotR = 3 + (mem.weight / 5) * 4;
        return (
          <circle key={mem.id} cx={dx} cy={dy} r={dotR}
            fill={TYPE_COLORS[mem.type]} opacity={0.5 + (mem.weight / 5) * 0.5}>
            <title>{mem.text.slice(0, 50)}</title>
          </circle>
        );
      })}

      {/* Label */}
      <text y={-4} textAnchor="middle" dominantBaseline="middle"
        fill="currentColor" className="text-foreground"
        fontSize={fontSize} fontFamily="var(--font-display)" fontWeight="700"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {topic.label}
      </text>

      {/* Count */}
      <text y={fontSize * 0.7} textAnchor="middle" dominantBaseline="middle"
        fill={topic.color} fontSize="12" fontFamily="var(--font-mono)" fontWeight="500"
        opacity="0.6" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {memCount}
      </text>
    </g>
  );
}

/* ── Main Canvas ──────────────────────────────────────────────── */

export function MemoryBrowser() {
  const { memories, addMemory, removeMemory, setTopicRelationships } = useAgentStore();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newFact, setNewFact] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Re-cluster on memory change
  useEffect(() => {
    setTopics(clusterMemories(memories));
  }, [memories]);

  // Proximity-based relationships — recompute when topics move
  const proximityLinks = useMemo(() => computeProximityLinks(topics), [topics]);

  // Sync to agent store whenever proximity links change
  useEffect(() => {
    syncRelationshipsToAgent(proximityLinks, setTopicRelationships);
  }, [proximityLinks, setTopicRelationships]);

  const selectedTopic = topics.find(t => t.id === selectedId);
  const activeRelCount = proximityLinks.filter(l => l.strength > 0.15).length;

  const handleDrag = useCallback((topicId: string, dx: number, dy: number) => {
    setTopics(prev => prev.map(t =>
      t.id === topicId ? { ...t, x: t.x + dx / zoom, y: t.y + dy / zoom } : t
    ));
  }, [zoom]);

  const handleResize = useCallback((topicId: string, dr: number) => {
    setTopics(prev => prev.map(t => {
      if (t.id !== topicId) return t;
      const newR = Math.max(30, (t.userRadius ?? t.radius) + dr);
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
    setSelectedId(null);
  }, [memories]);

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

  const handleCanvasPointerUp = useCallback(() => { isPanning.current = false; }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-3 shrink-0">
        <h2 className="font-display text-base font-bold text-foreground">🧠 Memory</h2>

        {/* Relationship indicator */}
        {activeRelCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/[0.08] border border-primary/20">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-medium text-primary">{activeRelCount} link{activeRelCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="flex-1" />

        <input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Teach me..."
          className="w-48 bg-background border border-border rounded-lg px-3 py-1.5 text-xs
            placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
        />
        <button onClick={handleAdd} disabled={!newFact.trim()}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30
            hover:brightness-105 active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border" />

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
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <svg ref={svgRef} className="w-full h-full relative z-10"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          style={{ cursor: isPanning.current ? 'grabbing' : 'default' }}>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* Proximity relationship lines */}
            {proximityLinks.map(({ a, b, strength }) => {
              const ta = topics.find(t => t.id === a);
              const tb = topics.find(t => t.id === b);
              if (!ta || !tb) return null;
              return (
                <g key={`${a}-${b}`}>
                  {/* Glow line */}
                  <line x1={ta.x} y1={ta.y} x2={tb.x} y2={tb.y}
                    stroke="hsl(163 83% 31%)" strokeWidth={strength * 6}
                    opacity={strength * 0.15} strokeLinecap="round" />
                  {/* Core line */}
                  <line x1={ta.x} y1={ta.y} x2={tb.x} y2={tb.y}
                    stroke="hsl(163 83% 31%)" strokeWidth={1 + strength * 2}
                    opacity={0.2 + strength * 0.5} strokeLinecap="round"
                    strokeDasharray={strength > 0.5 ? 'none' : '6 4'} />
                  {/* Strength label at midpoint */}
                  {strength > 0.3 && (
                    <text
                      x={(ta.x + tb.x) / 2} y={(ta.y + tb.y) / 2 - 8}
                      textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)"
                      fill="hsl(163 83% 31%)" opacity={0.5}>
                      {Math.round(strength * 100)}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Topic bubbles */}
            {topics.map(topic => (
              <TopicBubble key={topic.id} topic={topic}
                selected={selectedId === topic.id}
                onSelect={() => setSelectedId(selectedId === topic.id ? null : topic.id)}
                onDrag={(dx, dy) => handleDrag(topic.id, dx, dy)}
                onResize={(dr) => handleResize(topic.id, dr)} />
            ))}
          </g>
        </svg>

        {/* Expanded sub-items panel */}
        {selectedTopic && (
          <ExpandedPanel
            topic={selectedTopic}
            onClose={() => setSelectedId(null)}
            onRemove={removeMemory}
          />
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex gap-4 text-[10px] text-muted-foreground z-10">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS.fact }} /> Facts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS.episode }} /> Episodes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS.skill_chunk }} /> Skills
          </span>
          <span className="opacity-50">drag near each other to link · click to expand</span>
        </div>
      </div>
    </div>
  );
}
