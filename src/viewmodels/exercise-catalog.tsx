import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { CatalogExercise } from '../models/exercise';
import type { CatalogLoadResult, ExerciseCatalogService } from '../services/exercise-catalog-service';
import { groupMuscles } from './catalog-muscle-groups';

interface CatalogContextValue {
  readonly service: ExerciseCatalogService;
  readonly selectedExercise: CatalogExerciseSummary | null;
  selectExercise(exercise: CatalogExerciseSummary | null): void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function ExerciseCatalogProvider({ service, children }: PropsWithChildren<{ service: ExerciseCatalogService }>) {
  const [selectedExercise, selectExercise] = useState<CatalogExerciseSummary | null>(null);
  return (
    <CatalogContext.Provider value={{ service, selectedExercise, selectExercise }}>
      {children}
    </CatalogContext.Provider>
  );
}

function useCatalogContext() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('ExerciseCatalogProvider is required.');
  return context;
}

export function useCatalogExerciseDetailViewModel(catalogId: string | undefined) {
  const { selectedExercise } = useCatalogContext();
  return selectedExercise?.exercise.catalogId === catalogId ? selectedExercise : null;
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
  const { service, selectExercise } = useCatalogContext();
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
          primaryGroups: groupMuscles(exercise.primaryMuscles, 'primary'),
          secondaryGroups: groupMuscles(exercise.secondaryMuscles, 'secondary'),
          equipment: exercise.equipment.kind === 'none' ? 'No equipment' : equipmentLabel(exercise.equipment.name),
        }));
      setState({ status: 'ready', exercises, rejectedRecords: result.rejectedRecords });
    });
    return () => {
      active = false;
      // Detail shares only this visit's selected record. Leaving the catalog
      // releases it rather than keeping an app-wide catalog cache.
      selectExercise(null);
    };
  }, [service, selectExercise]);
  const search = query.trim().toLowerCase();
  const exercises = state.status === 'ready' ? state.exercises : [];
  const visibleExercises = exercises.filter((item) => {
    const matchesName = item.exercise.name.toLowerCase().includes(search);
    const matchesGroup = selectedGroup === null || item.primaryGroups.includes(selectedGroup);
    return matchesName && matchesGroup;
  });
  const groups = [...new Set(exercises.flatMap((item) => item.primaryGroups))].sort();
  return {
    state: state.status === 'ready' ? { ...state, exercises: visibleExercises } : state,
    groups,
    query,
    setQuery,
    selectedGroup,
    setSelectedGroup,
    selectExercise,
  };
}

function equipmentLabel(value: string) {
  const words = value.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
