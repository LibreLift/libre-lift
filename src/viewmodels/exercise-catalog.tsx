import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { CatalogExercise } from '../models/exercise';
import type { CatalogLoadResult, ExerciseCatalogService } from '../services/exercise-catalog-service';
import { groupMuscles } from './catalog-muscle-groups';

const CatalogContext = createContext<ExerciseCatalogService | null>(null);

export function ExerciseCatalogProvider({ service, children }: PropsWithChildren<{ service: ExerciseCatalogService }>) {
  return <CatalogContext.Provider value={service}>{children}</CatalogContext.Provider>;
}

export interface CatalogExerciseSummary {
  readonly exercise: CatalogExercise;
  readonly primaryGroups: readonly string[];
  readonly secondaryGroups: readonly string[];
  readonly equipment: string;
}

type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'failure'; readonly error: Extract<CatalogLoadResult, { status: 'failure' }>['error'] }
  | { readonly status: 'ready'; readonly exercises: readonly CatalogExerciseSummary[]; readonly rejectedRecords: number };

export function useExerciseCatalogViewModel() {
  const service = useContext(CatalogContext);
  if (!service) throw new Error('ExerciseCatalogProvider is required.');
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void service.loadCatalog().then((result) => {
      if (!active) return;
      if (result.status === 'failure') {
        setState({ status: 'failure', error: result.error });
        return;
      }
      const exercises = [...result.exercises]
        .sort((a, b) => a.name.localeCompare(b.name, 'en'))
        .map((exercise) => ({
          exercise,
          primaryGroups: groupMuscles(exercise.primaryMuscles),
          secondaryGroups: groupMuscles(exercise.secondaryMuscles),
          equipment: exercise.equipment.kind === 'none' ? 'No equipment' : equipmentLabel(exercise.equipment.name),
        }));
      setState({ status: 'ready', exercises, rejectedRecords: result.rejectedRecords });
    });
    return () => { active = false; };
  }, [service]);
  const search = query.trim().toLowerCase();
  return {
    state: state.status === 'ready'
      ? { ...state, exercises: state.exercises.filter((item) =>
          item.exercise.name.toLowerCase().includes(search)
          && (selectedGroup === null || item.primaryGroups.includes(selectedGroup))) }
      : state,
    groups: state.status === 'ready'
      ? [...new Set(state.exercises.flatMap((item) => item.primaryGroups))].sort()
      : [],
    query,
    setQuery,
    selectedGroup,
    setSelectedGroup,
  };
}

function equipmentLabel(value: string) {
  const words = value.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
