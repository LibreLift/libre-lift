import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { WorkoutService } from '../services/workout-service';

export const WorkoutServiceContext = createContext<WorkoutService | null>(null);

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load().then(
      (data) => {
        if (active) setState({ status: 'ready', data });
      },
      () => {
        if (active) setState({ status: 'error', message: 'We couldn’t load this. Please try again.' });
      },
    );
    return () => {
      active = false;
    };
  }, [load, attempt]);
  return { state, retry: () => setAttempt((value) => value + 1) };
}

function useWorkoutService() {
  const service = useContext(WorkoutServiceContext);
  if (!service) throw new Error('WorkoutServiceContext is required.');
  return service;
}

export function useTemplatesViewModel() {
  const service = useWorkoutService();
  return useResource(
    useCallback(async () => {
      const templates = await service.listTemplates();
      return templates.map((template) => {
        const exercises = template.exercises.length;
        const sets = template.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
        return {
          ...template,
          summary: `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'} · ${sets} ${sets === 1 ? 'set' : 'sets'}`,
        };
      });
    }, [service]),
  );
}

export function useTemplateViewModel(id: string) {
  const service = useWorkoutService();
  return useResource(useCallback(() => service.getTemplate(id), [service, id]));
}

export function useSessionsViewModel() {
  const service = useWorkoutService();
  return useResource(useCallback(() => service.listSessions(), [service]));
}

export function useSessionViewModel(id: string) {
  const service = useWorkoutService();
  return useResource(useCallback(() => service.getSession(id), [service, id]));
}

export function sessionSummary(startedAt: string, endedAt: string) {
  const date = new Date(startedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const minutes = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000);
  return `${date} · ${minutes} min`;
}
