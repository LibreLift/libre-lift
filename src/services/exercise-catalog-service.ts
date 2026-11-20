import { mapRepDbResponse, type CatalogMappingResult } from './repdb-exercise-mapper';

export type CatalogLoadResult =
  | (Extract<CatalogMappingResult, { status: 'success' | 'partial' }> & {
      readonly rejectedRecords: number;
    })
  | Extract<CatalogMappingResult, { status: 'failure' }>
  | { readonly status: 'failure'; readonly error: 'unavailable' };

export interface ExerciseCatalogService {
  loadCatalog(): Promise<CatalogLoadResult>;
}

export type CatalogPayloadLoader = () => Promise<unknown>;

export function createExerciseCatalogService(loadPayload: CatalogPayloadLoader): ExerciseCatalogService {
  return {
    async loadCatalog() {
      let payload: unknown;
      try {
        payload = await loadPayload();
      } catch {
        return { status: 'failure', error: 'unavailable' };
      }
      const result = mapRepDbResponse(payload);
      if (result.status === 'failure') return result;
      // Optional-field diagnostics can also produce a partial result.
      const records = (payload as { exercises: unknown[] }).exercises;
      return { ...result, rejectedRecords: records.length - result.exercises.length };
    },
  };
}

export const bundledExerciseCatalogService = createExerciseCatalogService(async () =>
  require('@repdb/exercises/exercises.json'),
);
