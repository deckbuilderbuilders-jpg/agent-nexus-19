import { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';
import { checkForUpdates } from '@/lib/api';

export function UpdateBanner() {
  const { appVersion, setLatestVersion, dismissUpdate } = useAgentStore();

  // Check for updates on mount and every 6 hours
  useEffect(() => {
    const check = async () => {
      const result = await checkForUpdates();
      if (result?.version) setLatestVersion(result.version);
    };

    // Check after 5s to not block startup
    const initial = setTimeout(check, 5000);
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [setLatestVersion]);

  if (!appVersion.updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-3 text-[11px] font-display animate-fade-in">
      <Download className="w-3.5 h-3.5" />
      <span>
        <strong>Nexus v{appVersion.latest}</strong> is available (you're on v{appVersion.current})
      </span>
      <button
        onClick={() => useAgentStore.getState().setActiveView('settings')}
        className="px-2.5 py-1 rounded-md bg-primary-foreground/20 hover:bg-primary-foreground/30 font-semibold transition-colors"
      >
        Update Now
      </button>
      <button onClick={dismissUpdate} className="p-1 rounded hover:bg-primary-foreground/20 transition-colors ml-2">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
