import { createContext, useCallback, useContext, useRef, useState, type SetStateAction, type PropsWithChildren } from 'react';
import type { TemplateContent, WorkoutTemplate } from '../models/workout';
import type { TemplateDraft } from './template-editor';
import type { TemplateSaveContext, WorkoutService } from '../services/workout-service';

interface WorkoutContextValue {
  drafts: Readonly<Record<string, TemplateDraft>>;
  setDraft(id: string, update: SetStateAction<TemplateDraft | null>): void;
  nextPlacementId(): string;
  service: WorkoutService;
  templatesVersion: number;
  savingTemplate: boolean;
  deleteTemplate(id: string): Promise<void>;
  saveTemplate(id: string | null, details: TemplateContent): Promise<WorkoutTemplate>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ service, children }: PropsWithChildren<{ service: WorkoutService }>) {
  const [draftRecords, setDraftRecords] = useState<Record<string, { content: TemplateDraft; context: TemplateSaveContext }>>({});
  const drafts = Object.fromEntries(Object.entries(draftRecords).map(([id, draft]) => [id, draft.content]));
  const placementNumber = useRef(0);
  const nextPlacementId = useCallback(() => `placement-${++placementNumber.current}`, []);
  const setDraft = useCallback((id: string, update: SetStateAction<TemplateDraft | null>) => {
    setDraftRecords((current) => {
      const draft = typeof update === 'function' ? update(current[id]?.content ?? null) : update;
      const next = { ...current };
      if (draft) next[id] = { content: draft, context: current[id]?.context ?? {} };
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
    mutate(() => id === null ? service.createTemplate(content, draftRecords.new?.context)
      : service.updateTemplate(id, content, draftRecords[id]?.context)), [mutate, service, draftRecords]);
  const deleteTemplate = useCallback((id: string) => mutate(() => service.deleteTemplate(id)), [mutate, service]);
  return (
    <WorkoutContext.Provider value={{ drafts, setDraft, nextPlacementId, service, templatesVersion, savingTemplate, saveTemplate, deleteTemplate }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkouts() {
  const value = useContext(WorkoutContext);
  if (!value) throw new Error('WorkoutProvider is required.');
  return value;
}
