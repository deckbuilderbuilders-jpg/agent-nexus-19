import { User, Save } from 'lucide-react';
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
    if (Array.isArray(val)) {
      setEditValue(val.join(', '));
    } else if (typeof val === 'object' && val !== null) {
      setEditValue(Object.entries(val as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(', '));
    } else {
      setEditValue((val as string) || '');
    }
    setEditField(field);
  };

  const saveEdit = () => {
    if (!editField) return;
    const meta = FIELD_LABELS[editField];
    if (meta.type === 'list') {
      updateProfile(editField, editValue.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (meta.type === 'map') {
      const obj: Record<string, string> = {};
      editValue.split(',').forEach((pair) => {
        const [k, v] = pair.split(':').map((s) => s.trim());
        if (k && v) obj[k] = v;
      });
      updateProfile(editField, obj);
    } else {
      updateProfile(editField, editValue || null);
    }
    setEditField(null);
    setEditValue('');
  };

  const filledCount = Object.entries(profile).filter(([, v]) => v && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'object' || Object.keys(v).length > 0)).length;
  const totalFields = Object.keys(FIELD_LABELS).length;

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center gap-3 mb-6 animate-fade-up">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-xs text-muted-foreground">{filledCount}/{totalFields} fields filled — the more I know, the better I get</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(filledCount / totalFields) * 100}%` }} />
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {Object.entries(FIELD_LABELS).map(([field, meta], i) => {
          const val = profile[field as keyof typeof profile];
          const isEmpty = !val || (Array.isArray(val) && val.length === 0) || (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as object).length === 0);
          const isEditing = editField === field;

          let display = '';
          if (Array.isArray(val)) display = val.join(', ');
          else if (typeof val === 'object' && val !== null) display = Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(' · ');
          else display = (val as string) || '';

          return (
            <div
              key={field}
              className="bg-card border border-border rounded-lg p-3 hover:border-primary/20 transition-all animate-fade-up cursor-pointer"
              style={{ animationDelay: `${90 + i * 30}ms` }}
              onClick={() => !isEditing && startEdit(field)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{meta.label}</span>
                {meta.type !== 'text' && (
                  <span className="text-[10px] font-mono text-muted-foreground">{meta.type === 'list' ? 'comma-separated' : 'key: value pairs'}</span>
                )}
              </div>
              {isEditing ? (
                <div className="flex gap-2 mt-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditField(null); }}
                    className="flex-1 bg-muted rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button onClick={saveEdit} className="p-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 active:scale-95 transition-all">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className={`text-sm ${isEmpty ? 'text-muted-foreground/50 italic' : 'text-foreground'}`}>
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
