import { createContext, useCallback, useContext, useRef, useState, type SetStateAction, type PropsWithChildren } from 'react';
import type { TemplateContent, WorkoutTemplate } from '../models/workout';
import type { TemplateDraft } from './template-editor';
import type { WorkoutService } from '../services/workout-service';

interface WorkoutContextValue {
  drafts: Readonly<Record<string, TemplateDraft>>;
  setDraft(id: string, update: SetStateAction<TemplateDraft | null>): void;
  service: WorkoutService;
  templatesVersion: number;
  savingTemplate: boolean;
  hasUnsavedChanges: boolean;
  setDraftDirty(id: string, dirty: boolean): void;
  deleteTemplate(id: string): Promise<void>;
  saveTemplate(id: string | null, details: TemplateContent): Promise<WorkoutTemplate>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ service, children }: PropsWithChildren<{ service: WorkoutService }>) {
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
  const [dirtyDrafts, setDirtyDrafts] = useState<Readonly<Record<string, boolean>>>({});
  const setDraftDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyDrafts((current) => current[id] === dirty ? current : { ...current, [id]: dirty });
  }, []);
  const setDraft = useCallback((id: string, update: SetStateAction<TemplateDraft | null>) => {
    setDrafts((current) => {
      const draft = typeof update === 'function' ? update(current[id] ?? null) : update;
      const next = { ...current };
      if (draft) next[id] = draft;
      else delete next[id];
      return next;
    });
  }, []);
  const [templatesVersion, setTemplatesVersion] = useState(0);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const saving = useRef(false);
  const mutate = useCallback(async <T,>(operation: () => Promise<T>) => {
    if (saving.current) throw new Error('A template change is already pending.');
    saving.current = true;
    setSavingTemplate(true);
    try {
      const result = await operation();
      setTemplatesVersion((value) => value + 1);
      return result;
    } finally {
      saving.current = false;
      setSavingTemplate(false);
    }
  }, []);
  const saveTemplate = useCallback((id: string | null, content: TemplateContent) =>
    mutate(() => id === null ? service.createTemplate(content) : service.updateTemplate(id, content)), [mutate, service]);
  const deleteTemplate = useCallback((id: string) => mutate(() => service.deleteTemplate(id)), [mutate, service]);
  return (
    <WorkoutContext.Provider value={{ drafts, setDraft, service, templatesVersion, savingTemplate, saveTemplate, deleteTemplate,
      setDraftDirty, hasUnsavedChanges: Object.values(dirtyDrafts).some(Boolean) }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkouts() {
  const value = useContext(WorkoutContext);
  if (!value) throw new Error('WorkoutProvider is required.');
  return value;
}
