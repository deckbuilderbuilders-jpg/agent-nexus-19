import { useEffect, useRef } from 'react';
import { useAgentStore } from '@/store/agentStore';
import { syncMemories, syncRules, syncProfile, syncRelationships } from '@/lib/api';

/**
 * Watches key store slices and debounces sync to the backend.
 * Each slice has its own dirty flag so unchanged data isn't re-sent.
 */
export function useAutoSync() {
  const memories = useAgentStore((s) => s.memories);
  const rules = useAgentStore((s) => s.rules);
  const profile = useAgentStore((s) => s.profile);
  const relationships = useAgentStore((s) => s.topicRelationships);

  const prevMemories = useRef(memories);
  const prevRules = useRef(rules);
  const prevProfile = useRef(profile);
  const prevRelationships = useRef(relationships);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (memories !== prevMemories.current) {
      prevMemories.current = memories;
      clearTimeout(timers.current.memories);
      timers.current.memories = setTimeout(() => {
        syncMemories(memories.map(m => ({ text: m.text, type: m.type, weight: m.weight, source: m.source })));
      }, 2000);
    }
  }, [memories]);

  useEffect(() => {
    if (rules !== prevRules.current) {
      prevRules.current = rules;
      clearTimeout(timers.current.rules);
      timers.current.rules = setTimeout(() => {
        syncRules(rules.map(r => ({ text: r.text, priority: r.priority, category: r.category })));
      }, 2000);
    }
  }, [rules]);

  useEffect(() => {
    if (profile !== prevProfile.current) {
      prevProfile.current = profile;
      clearTimeout(timers.current.profile);
      timers.current.profile = setTimeout(() => {
        syncProfile(profile as unknown as Record<string, unknown>);
      }, 2000);
    }
  }, [profile]);

  useEffect(() => {
    if (relationships !== prevRelationships.current) {
      prevRelationships.current = relationships;
      clearTimeout(timers.current.relationships);
      timers.current.relationships = setTimeout(() => {
        syncRelationships(relationships);
      }, 2000);
    }
  }, [relationships]);
}
