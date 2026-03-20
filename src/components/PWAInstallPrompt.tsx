import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-20 left-6 z-50 bg-card border border-border rounded-xl shadow-mid px-4 py-3 flex items-center gap-3 animate-fade-up max-w-[320px]">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-sm shrink-0 accent-glow">🧠</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-display font-bold text-foreground">Install Nexus</p>
        <p className="text-[9px] text-muted-foreground">Get a desktop app — works offline, launches instantly.</p>
      </div>
      <button onClick={handleInstall} className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:brightness-105 active:scale-[0.97] transition-all shrink-0">
        <Download className="w-3 h-3 inline mr-1" />Install
      </button>
      <button onClick={() => setDismissed(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
