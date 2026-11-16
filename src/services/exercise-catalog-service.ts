import { mapRepDbResponse, type CatalogMappingResult } from './repdb-exercise-mapper';

export const REPDB_CATALOG_URL = 'https://exercise-dataset.com/exercises.json';

export type CatalogRequest = (url: string) => Promise<{
  readonly ok: boolean;
  json(): Promise<unknown>;
}>;

export type CatalogLoadResult =
  | (Extract<CatalogMappingResult, { status: 'success' | 'partial' }> & {
      readonly rejectedRecords: number;
    })
  | Extract<CatalogMappingResult, { status: 'failure' }>
  | { readonly status: 'failure'; readonly error: 'network' | 'http' | 'invalid_json' };

export interface ExerciseCatalogService {
  loadCatalog(): Promise<CatalogLoadResult>;
}

export function createExerciseCatalogService(request: CatalogRequest): ExerciseCatalogService {
  return {
    async loadCatalog() {
      let response: Awaited<ReturnType<CatalogRequest>>;
      try {
        response = await request(REPDB_CATALOG_URL);
      } catch {
        return { status: 'failure', error: 'network' };
      }
      if (!response.ok) return { status: 'failure', error: 'http' };
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { status: 'failure', error: 'invalid_json' };
      }
      const result = mapRepDbResponse(payload);
      if (result.status === 'failure') return result;
      // Successful mapping guarantees the envelope has an exercise array. Count
      // records, not diagnostics: optional-field diagnostics also mean partial.
      const records = (payload as { exercises: unknown[] }).exercises;
      return { ...result, rejectedRecords: records.length - result.exercises.length };
    },
  };
}
