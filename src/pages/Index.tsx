import { AppSidebar } from '@/components/AppSidebar';
import { ChatView } from '@/components/ChatView';
import { MemoryBrowser } from '@/components/MemoryBrowser';
import { RulesManager } from '@/components/RulesManager';
import { ProfileEditor } from '@/components/ProfileEditor';
import { SkillsOverview } from '@/components/SkillsOverview';
import { DashboardView } from '@/components/DashboardView';
import { SettingsView } from '@/components/SettingsView';
import { PerformanceHUD } from '@/components/PerformanceHUD';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MiniChat, MiniChatFAB } from '@/components/MiniChat';
import { UpdateBanner } from '@/components/UpdateBanner';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { useAgentStore } from '@/store/agentStore';
import { useAutoSync } from '@/hooks/useAutoSync';

const VIEWS = {
  dashboard: DashboardView,
  chat: ChatView,
  memory: MemoryBrowser,
  rules: RulesManager,
  profile: ProfileEditor,
  skills: SkillsOverview,
  settings: SettingsView,
};

const Index = () => {
  const activeView = useAgentStore((s) => s.activeView);
  const ActiveComponent = VIEWS[activeView];

  useAutoSync();

  return (
    <>
      <UpdateBanner />
      <div className="h-screen grid overflow-hidden" style={{ gridTemplateColumns: '1fr 310px' }}>
        <main className="overflow-hidden relative">
          <ErrorBoundary fallbackMessage={`Error in ${activeView} view`}>
            <ActiveComponent />
          </ErrorBoundary>
        </main>
        <AppSidebar />
        <PerformanceHUD />
      </div>
      <MiniChat />
      <MiniChatFAB />
      <PWAInstallPrompt />
    </>
  );
};

export default Index;
