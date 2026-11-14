import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import type { TemplateContent, WorkoutTemplate } from '../models/workout';
import type { WorkoutService } from '../services/workout-service';

interface WorkoutContextValue {
  service: WorkoutService;
  templatesVersion: number;
  savingTemplate: boolean;
  saveTemplate(id: string, details: TemplateContent): Promise<WorkoutTemplate>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ service, children }: PropsWithChildren<{ service: WorkoutService }>) {
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
    <WorkoutContext.Provider value={{ service, templatesVersion, savingTemplate, saveTemplate }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkouts() {
  const value = useContext(WorkoutContext);
  if (!value) throw new Error('WorkoutProvider is required.');
  return value;
}
