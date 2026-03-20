import { Save } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';
import { useState } from 'react';

const FIELD_LABELS: Record<string, { label: string; type: 'text' | 'list' | 'map' }> = {
  name: { label: 'Name', type: 'text' },
  role: { label: 'Role', type: 'text' },
  company: { label: 'Company', type: 'text' },
  industry: { label: 'Industry', type: 'text' },
  company_size: { label: 'Company Size', type: 'text' },
  icp: { label: 'Ideal Customer Profile', type: 'text' },
  tone_preferences: { label: 'Tone Preferences', type: 'text' },
  goals: { label: 'Goals', type: 'list' },
  tools: { label: 'Tools & Platforms', type: 'list' },
  competitors: { label: 'Competitors', type: 'list' },
  key_metrics: { label: 'Key Metrics', type: 'map' },
  notes: { label: 'Notes', type: 'list' },
};

export function ProfileEditor() {
  const { profile, updateProfile } = useAgentStore();
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (field: string) => {
    const val = profile[field as keyof typeof profile];
    if (Array.isArray(val)) setEditValue(val.join(', '));
    else if (typeof val === 'object' && val !== null) setEditValue(Object.entries(val as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(', '));
    else setEditValue((val as string) || '');
    setEditField(field);
  };

  const saveEdit = () => {
    if (!editField) return;
    const meta = FIELD_LABELS[editField];
    if (meta.type === 'list') updateProfile(editField, editValue.split(',').map(s => s.trim()).filter(Boolean));
    else if (meta.type === 'map') {
      const obj: Record<string, string> = {};
      editValue.split(',').forEach(pair => { const [k, v] = pair.split(':').map(s => s.trim()); if (k && v) obj[k] = v; });
      updateProfile(editField, obj);
    } else updateProfile(editField, editValue || null);
    setEditField(null);
  };

  const filledCount = Object.entries(profile).filter(([, v]) => v && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'object' || Object.keys(v).length > 0)).length;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 shrink-0">
        <h2 className="font-display text-[13px] font-bold text-foreground">👤 Profile</h2>
        <span className="text-[9px] text-muted-foreground ml-1">{filledCount}/12 fields — the more I know, the better I get</span>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 border-b border-border bg-card">
        <div className="w-full h-[5px] bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(filledCount / 12) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-background">
        {Object.entries(FIELD_LABELS).map(([field, meta], i) => {
          const val = profile[field as keyof typeof profile];
          const isEmpty = !val || (Array.isArray(val) && val.length === 0) || (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as object).length === 0);
          const isEditing = editField === field;

          let display = '';
          if (Array.isArray(val)) display = val.join(', ');
          else if (typeof val === 'object' && val !== null) display = Object.entries(val as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(' · ');
          else display = (val as string) || '';

          return (
            <div
              key={field}
              className="bg-card border border-border rounded-[8px] p-2.5 hover:shadow-mid transition-all cursor-pointer animate-fade-up"
              style={{ animationDelay: `${i * 20}ms` }}
              onClick={() => !isEditing && startEdit(field)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-semibold uppercase tracking-[1px] text-muted-foreground">{meta.label}</span>
                {meta.type !== 'text' && (
                  <span className="text-[7px] text-muted-foreground">{meta.type === 'list' ? 'comma-separated' : 'key: value'}</span>
                )}
              </div>
              {isEditing ? (
                <div className="flex gap-1.5 mt-1">
                  <input
                    autoFocus value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditField(null); }}
                    className="flex-1 bg-secondary rounded-[5px] px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button onClick={saveEdit} className="p-1 rounded-[5px] bg-primary text-primary-foreground hover:brightness-105 active:scale-[0.97] transition-all">
                    <Save className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <p className={`text-[10px] leading-[1.5] ${isEmpty ? 'text-muted-foreground/50 italic' : 'text-foreground'}`}>
                  {isEmpty ? 'Click to set...' : display}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
