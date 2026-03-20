import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  skillResults?: SkillResult[];
}

export interface SkillResult {
  skill: string;
  success: boolean;
  output?: string;
  error?: string;
}

export interface Memory {
  id: string;
  text: string;
  type: 'fact' | 'episode' | 'skill_chunk';
  weight: number;
  timestamp: string;
  source?: string;
}

export interface Rule {
  id: string;
  text: string;
  priority: number;
  category: string;
  created: string;
}

export interface UserProfile {
  name: string | null;
  role: string | null;
  company: string | null;
  industry: string | null;
  company_size: string | null;
  icp: string | null;
  goals: string[];
  tone_preferences: string | null;
  tools: string[];
  competitors: string[];
  key_metrics: Record<string, string>;
  notes: string[];
}

export interface SkillInfo {
  name: string;
  description: string;
  schema: Record<string, string>;
  requires_credentials: string[];
  enabled: boolean;
}

interface AgentState {
  // Chat
  messages: Message[];
  isThinking: boolean;
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  setThinking: (v: boolean) => void;

  // Memories
  memories: Memory[];
  addMemory: (mem: Omit<Memory, 'id'>) => void;
  removeMemory: (id: string) => void;
  updateMemoryWeight: (id: string, weight: number) => void;

  // Spatial relationships between topics (set by user dragging bubbles near each other)
  topicRelationships: { a: string; b: string; strength: number }[];
  setTopicRelationships: (rels: { a: string; b: string; strength: number }[]) => void;

  // Rules
  rules: Rule[];
  addRule: (rule: Omit<Rule, 'id'>) => void;
  removeRule: (id: string) => void;

  // Profile
  profile: UserProfile;
  updateProfile: (field: string, value: unknown) => void;

  // Skills
  skills: SkillInfo[];

  // Active view
  activeView: 'chat' | 'memory' | 'rules' | 'profile' | 'skills' | 'dashboard';
  setActiveView: (v: AgentState['activeView']) => void;

  // Pending learnings
  pendingLearnings: { facts: string[]; profileUpdates: Record<string, string>; } | null;
  setPendingLearnings: (l: AgentState['pendingLearnings']) => void;
  confirmLearnings: () => void;
  dismissLearnings: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 10);

// Demo data
const DEMO_MEMORIES: Memory[] = [
  { id: '1', text: 'Target market is B2B SaaS companies with 50-200 employees', type: 'fact', weight: 4.2, timestamp: '2025-03-15T10:00:00Z', source: 'conversation' },
  { id: '2', text: 'CAC is currently $47, goal is to reduce to $35 by Q3', type: 'fact', weight: 3.8, timestamp: '2025-03-14T14:00:00Z', source: 'conversation' },
  { id: '3', text: 'Worked on cold email sequence for enterprise segment. Decided on 4-touch approach with case study in email 2.', type: 'episode', weight: 5.0, timestamp: '2025-03-18T09:00:00Z' },
  { id: '4', text: 'Preferred tone: professional but not stiff. Use data to back claims. Avoid buzzwords.', type: 'fact', weight: 3.5, timestamp: '2025-03-12T16:00:00Z', source: 'manual' },
  { id: '5', text: 'Main competitor Rival Corp just launched a freemium tier — discussed counter-positioning strategy', type: 'episode', weight: 4.7, timestamp: '2025-03-17T11:00:00Z' },
];

const DEMO_RULES: Rule[] = [
  { id: '1', text: 'Always use formal tone in client-facing copy', priority: 9, category: 'voice', created: '2025-03-10T08:00:00Z' },
  { id: '2', text: 'Never mention competitor names in outbound emails', priority: 8, category: 'outreach', created: '2025-03-11T09:00:00Z' },
  { id: '3', text: 'Include a clear CTA in every piece of content', priority: 7, category: 'content', created: '2025-03-12T10:00:00Z' },
  { id: '4', text: 'Our ICP is VP Marketing at mid-market B2B SaaS', priority: 6, category: 'targeting', created: '2025-03-13T11:00:00Z' },
];

const DEMO_PROFILE: UserProfile = {
  name: null,
  role: null,
  company: null,
  industry: 'B2B SaaS',
  company_size: null,
  icp: 'VP Marketing at mid-market B2B SaaS (50-200 employees)',
  goals: ['Reduce CAC to $35 by Q3', 'Launch partner program'],
  tone_preferences: 'Professional, data-driven, no buzzwords',
  tools: ['HubSpot', 'LinkedIn Sales Navigator'],
  competitors: ['Rival Corp'],
  key_metrics: { CAC: '$47', 'Email open rate': '34%' },
  notes: [],
};

const DEMO_SKILLS: SkillInfo[] = [
  { name: 'inject_knowledge', description: 'Inject a text file as searchable knowledge', schema: { filepath: 'string' }, requires_credentials: [], enabled: true },
  { name: 'web_search', description: 'Search the web for current information', schema: { query: 'string' }, requires_credentials: ['SERPAPI_KEY'], enabled: false },
  { name: 'email_send', description: 'Send emails via SMTP', schema: { to: 'string', subject: 'string', body: 'string' }, requires_credentials: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'], enabled: false },
  { name: 'web_fetch', description: 'Fetch and parse a URL', schema: { url: 'string' }, requires_credentials: [], enabled: false },
];

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  isThinking: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, { ...msg, id: genId(), timestamp: new Date() }] })),
  setThinking: (v) => set({ isThinking: v }),

  memories: DEMO_MEMORIES,
  addMemory: (mem) => set((s) => ({ memories: [{ ...mem, id: genId() }, ...s.memories] })),
  removeMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
  updateMemoryWeight: (id, weight) => set((s) => ({ memories: s.memories.map((m) => m.id === id ? { ...m, weight } : m) })),

  topicRelationships: [],
  setTopicRelationships: (rels) => set({ topicRelationships: rels }),

  addRule: (rule) => set((s) => ({ rules: [{ ...rule, id: genId() }, ...s.rules] })),
  removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

  profile: DEMO_PROFILE,
  updateProfile: (field, value) => set((s) => ({ profile: { ...s.profile, [field]: value } })),

  skills: DEMO_SKILLS,

  activeView: 'chat',
  setActiveView: (v) => set({ activeView: v }),

  pendingLearnings: null,
  setPendingLearnings: (l) => set({ pendingLearnings: l }),
  confirmLearnings: () => {
    const { pendingLearnings } = get();
    if (!pendingLearnings) return;
    for (const fact of pendingLearnings.facts) {
      get().addMemory({ text: fact, type: 'fact', weight: 1.5, timestamp: new Date().toISOString(), source: 'conversation' });
    }
    if (Object.keys(pendingLearnings.profileUpdates).length) {
      for (const [k, v] of Object.entries(pendingLearnings.profileUpdates)) {
        get().updateProfile(k, v);
      }
    }
    set({ pendingLearnings: null });
  },
  dismissLearnings: () => set({ pendingLearnings: null }),
}));
