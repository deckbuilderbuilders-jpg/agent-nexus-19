import { useState, useRef, useEffect, useCallback } from 'react';
import { Grip, Cpu, Zap, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchStats } from '@/lib/api';

interface PerfStats {
  tps: number;
  peakTps: number;
  avgTps: number;
  totalTokens: number;
  model: string;
  status: 'connected' | 'disconnected' | 'generating';
  tpsHistory: number[];
}

const HISTORY_LEN = 40;

function MiniSparkline({ data, width = 120, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-secondary/50 rounded" />;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="block">
      <polyline points={points} fill="none" stroke="hsl(163 83% 31%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points} fill="none" stroke="hsl(163 83% 31% / 0.3)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PerformanceHUD() {
  const [stats, setStats] = useState<PerfStats>({
    tps: 0, peakTps: 0, avgTps: 0, totalTokens: 0,
    model: 'llama3.1:8b', status: 'disconnected', tpsHistory: [],
  });
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (position.x === -1) {
      setPosition({ x: window.innerWidth - 280, y: window.innerHeight - 220 });
    }
  }, []);

  // Poll backend for stats (goes through vite proxy → FastAPI → Ollama)
  useEffect(() => {
    const poll = async () => {
      const data = await fetchStats();
      if (data) {
        setStats(prev => {
          const newHistory = [...prev.tpsHistory, data.tps || 0].slice(-HISTORY_LEN);
          const validTps = newHistory.filter(t => t > 0);
          return {
            tps: data.tps || 0,
            peakTps: Math.max(prev.peakTps, data.tps || 0),
            avgTps: validTps.length ? validTps.reduce((a, b) => a + b, 0) / validTps.length : 0,
            totalTokens: data.total_tokens ?? prev.totalTokens,
            model: data.model || prev.model,
            status: data.generating ? 'generating' : 'connected',
            tpsHistory: newHistory,
          };
        });
      } else {
        setStats(prev => ({
          ...prev, status: 'disconnected', tps: 0,
          tpsHistory: [...prev.tpsHistory, 0].slice(-HISTORY_LEN),
        }));
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    const rect = hudRef.current?.getBoundingClientRect();
    if (rect) dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const move = (e: MouseEvent) => setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.current.y)),
    });
    const up = () => setIsDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDragging]);

  const statusColor = stats.status === 'generating' ? 'bg-primary' : stats.status === 'connected' ? 'bg-emerald-400' : 'bg-gray-400';

  return (
    <div ref={hudRef} onMouseDown={handleMouseDown}
      className={`fixed z-50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: position.x === -1 ? 'auto' : position.x,
        top: position.y === -1 ? 'auto' : position.y,
        right: position.x === -1 ? 16 : 'auto',
        bottom: position.y === -1 ? 16 : 'auto',
      }}>
      <div className={`bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden
        transition-shadow duration-200 ${isDragging ? 'shadow-xl ring-1 ring-primary/20' : ''}`}
        style={{ width: collapsed ? 200 : 230 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-secondary/40">
          <Grip className="w-3 h-3 text-muted-foreground/50" />
          <div className={`w-[6px] h-[6px] rounded-full ${statusColor} animate-pulse`} />
          <span className="text-[9px] font-display font-bold uppercase tracking-[1px] text-foreground flex-1">Performance</span>
          <button onClick={() => setCollapsed(!collapsed)} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 py-2.5 space-y-2.5">
            <div className="text-center">
              <div className="font-display text-2xl font-extrabold text-primary leading-none">{stats.tps.toFixed(1)}</div>
              <div className="text-[7px] uppercase tracking-[1.2px] text-muted-foreground mt-0.5">tok/sec</div>
            </div>
            <div className="bg-secondary/60 border border-border/50 rounded-lg p-1.5">
              <MiniSparkline data={stats.tpsHistory} width={200} height={24} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'Peak', value: stats.peakTps.toFixed(1), icon: Zap },
                { label: 'Avg', value: stats.avgTps.toFixed(1), icon: Activity },
                { label: 'Tokens', value: stats.totalTokens.toLocaleString(), icon: Cpu },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-secondary/50 border border-border/40 rounded-md p-1.5 text-center">
                  <Icon className="w-2.5 h-2.5 text-muted-foreground mx-auto mb-0.5" />
                  <div className="text-[10px] font-bold text-foreground leading-none">{value}</div>
                  <div className="text-[6px] uppercase tracking-[0.8px] text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[8px] text-muted-foreground px-0.5">
              <span className="uppercase tracking-[0.5px]">{stats.model}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-semibold uppercase tracking-[0.5px] ${
                stats.status === 'generating' ? 'bg-primary/10 text-primary' :
                stats.status === 'connected' ? 'bg-emerald-50 text-emerald-600' :
                'bg-secondary text-muted-foreground'
              }`}>{stats.status}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
