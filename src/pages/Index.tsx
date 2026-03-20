import { AppSidebar } from '@/components/AppSidebar';
import { ChatView } from '@/components/ChatView';
import { MemoryBrowser } from '@/components/MemoryBrowser';
import { RulesManager } from '@/components/RulesManager';
import { ProfileEditor } from '@/components/ProfileEditor';
import { SkillsOverview } from '@/components/SkillsOverview';
import { DashboardView } from '@/components/DashboardView';
import { useAgentStore } from '@/store/agentStore';

const VIEWS = {
  dashboard: DashboardView,
  chat: ChatView,
  memory: MemoryBrowser,
  rules: RulesManager,
  profile: ProfileEditor,
  skills: SkillsOverview,
};

const Index = () => {
  const activeView = useAgentStore((s) => s.activeView);
  const ActiveComponent = VIEWS[activeView];

  return (
    <div className="h-screen grid overflow-hidden" style={{ gridTemplateColumns: '1fr 310px' }}>
      <main className="overflow-hidden relative">
        <ActiveComponent />
      </main>
      <AppSidebar />
    </div>
  );
};

export default Index;
