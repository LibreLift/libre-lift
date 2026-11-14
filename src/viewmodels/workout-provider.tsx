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
  saveTemplate(id: string, details: TemplateContent): Promise<WorkoutTemplate>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ service, children }: PropsWithChildren<{ service: WorkoutService }>) {
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
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
  const saveTemplate = useCallback(
    async (id: string, details: TemplateContent) => {
      if (saving.current) throw new Error('A template is already being saved.');
      saving.current = true;
      setSavingTemplate(true);
      try {
        const template = await service.updateTemplate(id, details);
        setTemplatesVersion((value) => value + 1);
        return template;
      } finally {
        saving.current = false;
        setSavingTemplate(false);
      }
    },
    [service],
  );
  return (
    <WorkoutContext.Provider value={{ drafts, setDraft, service, templatesVersion, savingTemplate, saveTemplate }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkouts() {
  const value = useContext(WorkoutContext);
  if (!value) throw new Error('WorkoutProvider is required.');
  return value;
}
