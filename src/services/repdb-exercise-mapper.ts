import type { CatalogExercise, ExerciseImages } from '../models/exercise';

export interface CatalogDiagnostic {
  readonly recordIndex?: number;
  readonly catalogId?: string;
  readonly field: string;
  readonly reason: 'invalid_value' | 'duplicate_id' | 'unsupported_schema' | 'count_mismatch' | 'no_usable_exercises';
}

export type CatalogMappingResult =
  | {
    readonly status: 'success' | 'partial';
    readonly exercises: readonly CatalogExercise[];
    readonly diagnostics: readonly CatalogDiagnostic[];
  }
  | {
    readonly status: 'failure';
    readonly error: 'invalid_response' | 'unsupported_schema' | 'no_usable_exercises';
    readonly exercises: readonly [];
    readonly diagnostics: readonly CatalogDiagnostic[];
  };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText);
}

export function mapRepDbResponse(response: unknown): CatalogMappingResult {
  const exercises: CatalogExercise[] = [];
  const diagnostics: CatalogDiagnostic[] = [];
  if (!isObject(response)) {
    return { status: 'failure', error: 'invalid_response', exercises: [], diagnostics: [{ field: 'response', reason: 'invalid_value' }] };
  }
  if (!Number.isInteger(response.schema_version)) {
    return { status: 'failure', error: 'invalid_response', exercises: [], diagnostics: [{ field: 'schema_version', reason: 'invalid_value' }] };
  }
  if (response.schema_version !== 3) {
    return { status: 'failure', error: 'unsupported_schema', exercises: [], diagnostics: [{ field: 'schema_version', reason: 'unsupported_schema' }] };
  }
  if (!Array.isArray(response.exercises)) {
    return { status: 'failure', error: 'invalid_response', exercises: [], diagnostics: [{ field: 'exercises', reason: 'invalid_value' }] };
  }
  if (!Number.isInteger(response.count) || typeof response.count !== 'number' || response.count < 0) {
    diagnostics.push({ field: 'count', reason: 'invalid_value' });
  } else if (response.count !== response.exercises.length) {
    diagnostics.push({ field: 'count', reason: 'count_mismatch' });
  }
  const idCounts = new Map<string, number>();
  for (const record of response.exercises) {
    if (isObject(record) && isText(record.id)) {
      idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    }
  }
  response.exercises.forEach((record, recordIndex) => {
    const exercise = mapRecord(record, recordIndex, diagnostics);
    if (isObject(record) && isText(record.id) && (idCounts.get(record.id) ?? 0) > 1) {
      diagnostics.push({ recordIndex, catalogId: `repdb:${record.id}`, field: 'id', reason: 'duplicate_id' });
    } else if (exercise) exercises.push(exercise);
  });
  if (exercises.length === 0) {
    diagnostics.push({ field: 'exercises', reason: 'no_usable_exercises' });
    return { status: 'failure', error: 'no_usable_exercises', exercises: [], diagnostics };
  }
  return { status: diagnostics.length ? 'partial' : 'success', exercises, diagnostics };
}

function mapRecord(
  record: unknown,
  recordIndex: number,
  diagnostics: CatalogDiagnostic[],
): CatalogExercise | undefined {
  const catalogId = isObject(record) && isText(record.id) ? `repdb:${record.id}` as const : undefined;
  function invalid(field: string) {
    diagnostics.push({ recordIndex, catalogId, field, reason: 'invalid_value' });
  }
  if (!isObject(record)) {
    invalid('record');
    return;
  }
  const start = diagnostics.length;
  if (!isText(record.id)) invalid('id');
  if (!isText(record.name_en)) invalid('name_en');
  const primary = record.primary_muscles === undefined ? [] : record.primary_muscles;
  const secondary = record.secondary_muscles === undefined ? [] : record.secondary_muscles;
  if (!isTextList(primary)) invalid('primary_muscles');
  if (!isTextList(secondary)) invalid('secondary_muscles');
  const noEquipment = record.equipment === undefined && record.is_bodyweight === true;
  if (!noEquipment && !isText(record.equipment)) invalid('equipment');
  if (diagnostics.length !== start || !catalogId || !isText(record.name_en) ||
      !isTextList(primary) || !isTextList(secondary)) return;
  if (record.instructions_en !== undefined && !isTextList(record.instructions_en)) invalid('instructions_en');
  const instructions = record.instructions_en === undefined ? undefined : isTextList(record.instructions_en) ? [...record.instructions_en] : undefined;
  const translations: NonNullable<CatalogExercise['translations']> = Object.fromEntries(
    (['de', 'es'] as const).flatMap((locale) => {
      const name = record[`name_${locale}`];
      const steps = record[`instructions_${locale}`];
      if (name !== undefined && !isText(name)) invalid(`name_${locale}`);
      if (steps !== undefined && !isTextList(steps)) invalid(`instructions_${locale}`);
      if (!isText(name) && !isTextList(steps)) return [];
      return [[locale, {
        name: isText(name) ? name : record.name_en,
        ...(isTextList(steps) ? { instructions: [...steps] } : instructions ? { instructions: [...instructions] } : {}),
      }]];
    }),
  );
  const images = mapImages(record.images, invalid);
  return {
    catalogId,
    name: record.name_en,
    primaryMuscles: [...primary],
    secondaryMuscles: [...secondary],
    equipment: isText(record.equipment) ? { kind: 'required', name: record.equipment } : { kind: 'none' },
    ...(instructions ? { instructions } : {}),
    ...(Object.keys(translations).length ? { translations } : {}),
    ...(images ? { images } : {}),
  };
}

function mapImages(value: unknown, invalid: (field: string) => void): ExerciseImages | undefined {
  if (value === undefined) return;
  if (!isObject(value) || !isObject(value.flat)) {
    invalid('images.flat');
    return;
  }
  function imageUrl(pose: string): string | undefined {
    const path = isObject(value) && isObject(value.flat) ? value.flat[pose] : undefined;
    if (path === undefined) return;
    if (isText(path)) {
      try {
        const url = new URL(path, 'https://exercise-dataset.com/');
        if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
      } catch { /* Report an invalid URL below. */ }
    }
    invalid(`images.flat.${pose}`);
    return;
  }
  const main = imageUrl('main');
  const start = imageUrl('start');
  const peak = imageUrl('peak');
  if (start && peak) return { preferred: 'pair', pair: { start, peak }, ...(main ? { main } : {}) };
  if (value.flat.start !== undefined || value.flat.peak !== undefined) invalid('images.flat.pair');
  if (main) return { preferred: 'main', main };
  invalid('images.flat');
  return;
}
