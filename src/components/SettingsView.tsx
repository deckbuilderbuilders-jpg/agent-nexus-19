import { useState } from 'react';
import { Monitor, Cloud, Zap, Key, Eye, EyeOff, Server, ArrowRight, Check, RefreshCw, Download, Info, Wifi } from 'lucide-react';
import { useAgentStore, type ComputeMode } from '@/store/agentStore';
import { checkForUpdates, triggerUpdate } from '@/lib/api';

const COMPUTE_OPTIONS: { mode: ComputeMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { mode: 'local', label: 'Always Local', desc: 'Ollama only — free, private, no internet needed', icon: <Monitor className="w-4 h-4" /> },
  { mode: 'hybrid', label: 'Smart Hybrid', desc: 'Local by default, cloud for complex/heavy tasks', icon: <Zap className="w-4 h-4" /> },
  { mode: 'cloud', label: 'Always Cloud', desc: 'RunPod for every request — faster, bigger models', icon: <Cloud className="w-4 h-4" /> },
];

export function SettingsView() {
  const { compute, setComputeMode, setRunpodConfig, markComputeSetupComplete, appVersion, setLatestVersion } = useAgentStore();
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(compute.runpodApiKey || '');
  const [endpoint, setEndpoint] = useState(compute.runpodEndpoint || '');
  const [model, setModel] = useState(compute.runpodModel || '');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  const saveRunpodConfig = () => {
    setSaving(true);
    setRunpodConfig({ apiKey: apiKey || null, endpoint: endpoint || null, model: model || null });
    if (apiKey) markComputeSetupComplete();
    setTimeout(() => setSaving(false), 500);
  };

  const testConnection = async () => {
    if (!apiKey || !endpoint) {
      setTestStatus('error');
      setTestMsg('Enter an API key and endpoint first.');
      return;
    }
    setTestStatus('testing');
    setTestMsg('');
    try {
      const url = endpoint.replace(/\/$/, '') + (endpoint.includes('/chat/completions') ? '' : '/chat/completions');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
          messages: [{ role: 'user', content: 'Say hi' }],
          max_tokens: 5,
        }),
      });
      if (res.ok) {
        setTestStatus('success');
        setTestMsg('Connected successfully!');
      } else {
        setTestStatus('error');
        setTestMsg(`Error ${res.status}: ${res.statusText}`);
      }
    } catch (e) {
      setTestStatus('error');
      setTestMsg(e instanceof Error ? e.message : 'Connection failed');
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateMsg(null);
    const result = await checkForUpdates();
    if (result?.version) {
      setLatestVersion(result.version);
      if (result.version === appVersion.current) {
        setUpdateMsg('You\'re on the latest version!');
      }
    } else {
      setUpdateMsg('Could not check for updates (backend offline?)');
    }
    setChecking(false);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    const result = await triggerUpdate();
    setUpdateMsg(result?.message || 'Update started — app will restart shortly');
    setUpdating(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 shrink-0">
        <h2 className="font-display text-[13px] font-bold text-foreground">⚙️ Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 bg-background">

        {/* ── Compute Engine ─────────────────────────────── */}
        <section className="animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-primary" />
            <h3 className="font-display text-[12px] font-bold text-foreground uppercase tracking-[1px]">Compute Engine</h3>
          </div>

          <div className="flex flex-col gap-2">
            {COMPUTE_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => setComputeMode(opt.mode)}
                className={`flex items-start gap-3 p-3 rounded-[10px] border text-left transition-all active:scale-[0.98] ${
                  compute.mode === opt.mode
                    ? 'border-primary bg-primary/[0.06] shadow-soft'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className={`mt-0.5 ${compute.mode === opt.mode ? 'text-primary' : 'text-muted-foreground'}`}>
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-display font-bold text-foreground">{opt.label}</span>
                    {opt.mode === 'hybrid' && (
                      <span className="px-1.5 py-[1px] text-[7px] rounded bg-primary/[0.12] text-primary font-bold uppercase">Recommended</span>
                    )}
                    {compute.mode === opt.mode && <Check className="w-3 h-3 text-primary ml-auto" />}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Hybrid info */}
          {compute.mode === 'hybrid' && (
            <div className="mt-2 p-2.5 rounded-lg bg-primary/[0.04] border border-primary/15 flex items-start gap-2">
              <Info className="w-3 h-3 text-primary mt-0.5 shrink-0" />
              <p className="text-[9px] text-muted-foreground leading-snug">
                Smart Hybrid routes to RunPod when: the request is complex/long, Ollama is slow or OOM, or you pick a model that needs more compute. Everything else stays local and free.
              </p>
            </div>
          )}
        </section>

        {/* ── RunPod API Key ─────────────────────────────── */}
        {(compute.mode === 'hybrid' || compute.mode === 'cloud') && (
          <section className="animate-fade-up" style={{ animationDelay: '60ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-primary" />
              <h3 className="font-display text-[12px] font-bold text-foreground uppercase tracking-[1px]">RunPod Configuration</h3>
              {compute.setupComplete && <span className="text-[8px] text-primary font-bold">✓ Configured</span>}
            </div>

            <div className="bg-card border border-border rounded-[10px] p-3.5 flex flex-col gap-3">
              {/* API Key */}
              <div>
                <label className="text-[8px] font-semibold uppercase tracking-[1px] text-muted-foreground mb-1 block">API Key</label>
                <div className="flex gap-1.5">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="rp_xxxxxxxxxxxxxxxx"
                    className="flex-1 bg-secondary rounded-[6px] px-2.5 py-1.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="p-1.5 rounded-[6px] bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-[8px] text-muted-foreground mt-1">
                  Get your key at <span className="text-primary font-mono">runpod.io/console/user/settings</span>
                </p>
              </div>

              {/* Endpoint */}
              <div>
                <label className="text-[8px] font-semibold uppercase tracking-[1px] text-muted-foreground mb-1 block">Endpoint URL <span className="font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://api.runpod.ai/v2/your-endpoint-id"
                  className="w-full bg-secondary rounded-[6px] px-2.5 py-1.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Model */}
              <div>
                <label className="text-[8px] font-semibold uppercase tracking-[1px] text-muted-foreground mb-1 block">Model <span className="font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. meta-llama/Meta-Llama-3.1-70B-Instruct"
                  className="w-full bg-secondary rounded-[6px] px-2.5 py-1.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <button
                onClick={saveRunpodConfig}
                disabled={saving}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </section>
        )}

        {/* ── Updates ─────────────────────────────────────── */}
        <section className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-primary" />
            <h3 className="font-display text-[12px] font-bold text-foreground uppercase tracking-[1px]">Updates</h3>
          </div>

          <div className="bg-card border border-border rounded-[10px] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-mono text-foreground">Nexus v{appVersion.current}</span>
                {appVersion.lastChecked && (
                  <span className="text-[8px] text-muted-foreground ml-2">
                    Checked {new Date(appVersion.lastChecked).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                onClick={handleCheckUpdates}
                disabled={checking}
                className="flex items-center gap-1 px-2.5 py-1 text-[9px] rounded-md border border-border text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                Check Now
              </button>
            </div>

            {appVersion.updateAvailable && (
              <div className="mt-2 p-2.5 rounded-lg bg-primary/[0.06] border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-display font-bold text-primary">Update Available</span>
                    <span className="text-[9px] text-muted-foreground ml-2">v{appVersion.latest}</span>
                  </div>
                  <button
                    onClick={handleUpdate}
                    disabled={updating}
                    className="flex items-center gap-1 px-3 py-1.5 text-[9px] rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    {updating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    Update Now
                  </button>
                </div>
                <p className="text-[8px] text-muted-foreground mt-1.5">
                  Your memories, profile, rules, and chat history are preserved during updates.
                </p>
              </div>
            )}

            {updateMsg && !appVersion.updateAvailable && (
              <p className="text-[9px] text-muted-foreground mt-2">{updateMsg}</p>
            )}

            <div className="mt-3 p-2 rounded-lg bg-secondary/50 flex items-start gap-2">
              <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[8px] text-muted-foreground leading-snug">
                Updates download new code and restart cleanly. All user data lives in <span className="font-mono text-primary">~/Nexus</span> and localStorage — it's never touched during updates.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
