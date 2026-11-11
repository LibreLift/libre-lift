import { mapRepDbResponse } from '../src/services/repdb-exercise-mapper';

const bench = {
  id: 'bench-press',
  name_en: 'Bench press',
  primary_muscles: ['pectoralis-major'],
  secondary_muscles: ['triceps-brachii'],
  equipment: 'barbell',
};

test.each([
  [null, 'invalid_response', 'response'],
  [{ schema_version: 3, exercises: {} }, 'invalid_response', 'exercises'],
  [{ exercises: [bench] }, 'invalid_response', 'schema_version'],
  [{ ...response([bench]), schema_version: 4 }, 'unsupported_schema', 'schema_version'],
  [response([]), 'no_usable_exercises', 'exercises'],
  [response([{ ...bench, name_en: null }]), 'no_usable_exercises', 'exercises'],
])('distinguishes unusable responses: %j', (payload, error, field) => {
  const result = mapRepDbResponse(payload);
  expect(result).toMatchObject({ status: 'failure', error, exercises: [] });
  expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ field })]));
});

test('diagnoses count metadata against supplied records without discarding usable exercises', () => {
  const result = mapRepDbResponse({ ...response([bench]), count: 2 });
  expect(result.status).toBe('partial');
  expect(result.exercises).toHaveLength(1);
  expect(result.diagnostics).toEqual([expect.objectContaining({ field: 'count', reason: 'count_mismatch' })]);
  const mixed = mapRepDbResponse(response([bench, null]));
  expect(mixed.diagnostics.some((entry) => entry.field === 'count')).toBe(false);
});

function response(exercises: unknown[]) {
  return { schema_version: 3, count: exercises.length, exercises };
}

test.each([
  [null, undefined],
  [{ flat: {} }, undefined],
  [{ flat: { start: 'images/start.webp' } }, undefined],
  [{ flat: { main: 'images/main.webp', start: 'images/start.webp', peak: null } }, { preferred: 'main', main: 'https://exercise-dataset.com/images/main.webp' }],
  [{ flat: { main: 'javascript:alert(1)' } }, undefined],
])('diagnoses unusable imagery while retaining the exercise and any usable main fallback: %j', (images, expected) => {
  const result = mapRepDbResponse(response([{ ...bench, images }]));
  expect(result.status).toBe('partial');
  expect(result.exercises).toHaveLength(1);
  expect(result.exercises[0].images).toEqual(expected);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ recordIndex: 0, catalogId: 'repdb:bench-press', reason: 'invalid_value' }),
  ]));
});

test.each([
  [{ main: 'images/flat/hold-main.webp' }, { preferred: 'main', main: 'https://exercise-dataset.com/images/flat/hold-main.webp' }],
  [{ start: 'images/flat/bench-start.webp', peak: 'images/flat/bench-peak.webp' }, {
    preferred: 'pair', pair: { start: 'https://exercise-dataset.com/images/flat/bench-start.webp', peak: 'https://exercise-dataset.com/images/flat/bench-peak.webp' },
  }],
  [{ main: 'images/main.webp', start: 'images/start.webp', peak: 'https://example.org/peak.webp' }, {
    preferred: 'pair', main: 'https://exercise-dataset.com/images/main.webp',
    pair: { start: 'https://exercise-dataset.com/images/start.webp', peak: 'https://example.org/peak.webp' },
  }],
])('preserves usable image forms with pair preference and dataset-relative URLs: %j', (flat, expected) => {
  const result = mapRepDbResponse({ ...response([{ ...bench, images: { flat } }]), homepage: 'https://repdb.co' });
  expect(result.status).toBe('success');
  expect(result.exercises[0].images).toEqual(expected);
});

test('keeps core exercises and diagnoses invalid optional guidance and translations', () => {
  const result = mapRepDbResponse(response([{
    ...bench, instructions_en: ['Valid step.', 42],
    name_de: '', instructions_de: null,
    instructions_es: ['Paso uno.'],
  }]));
  expect(result.status).toBe('partial');
  expect(result.exercises).toHaveLength(1);
  expect(result.exercises[0].instructions).toBeUndefined();
  expect(result.exercises[0].translations?.es).toEqual({ name: 'Bench press', instructions: ['Paso uno.'] });
  expect(result.diagnostics.map((entry) => entry.field)).toEqual(expect.arrayContaining(['instructions_en', 'name_de', 'instructions_de']));
});

test('preserves ordered English guidance and optional translations with English fallback', () => {
  const raw = {
    ...bench, instructions_en: ['Lie down.', 'Press up.'],
    name_de: 'Bankdrücken', instructions_de: ['Hinlegen.', 'Hochdrücken.'],
    name_es: 'Press de banca',
  };
  const result = mapRepDbResponse(response([raw]));
  expect(result.status).toBe('success');
  expect(result.exercises[0]).toMatchObject({
    name: 'Bench press', instructions: ['Lie down.', 'Press up.'],
    translations: {
      de: { name: 'Bankdrücken', instructions: ['Hinlegen.', 'Hochdrücken.'] },
      es: { name: 'Press de banca', instructions: ['Lie down.', 'Press up.'] },
    },
  });
  raw.instructions_en[0] = 'Changed';
  raw.instructions_de[0] = 'Changed';
  expect(result.exercises[0].instructions).toEqual(['Lie down.', 'Press up.']);
  expect(result.exercises[0].translations?.de?.instructions).toEqual(['Hinlegen.', 'Hochdrücken.']);
});

test.each([false, true])('rejects every duplicate catalog identity regardless of input order (reverse: %s)', (reverse) => {
  const records = [bench, { ...bench, name_en: '' }, { ...bench, id: 'row', name_en: 'Row' }];
  const result = mapRepDbResponse(response(reverse ? records.reverse() : records));
  expect(result.status).toBe('partial');
  expect(result.exercises.map((exercise) => exercise.catalogId)).toEqual(['repdb:row']);
  expect(result.diagnostics.filter((entry) => entry.reason === 'duplicate_id')).toHaveLength(2);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ catalogId: 'repdb:bench-press', field: 'id', reason: 'duplicate_id' }),
  ]));
});

test('maps provider data into a catalog exercise with stable identity and distinct muscle targets', () => {
  expect(mapRepDbResponse(response([bench]))).toEqual({
    status: 'success',
    exercises: [{
      catalogId: 'repdb:bench-press',
      name: 'Bench press',
      primaryMuscles: ['pectoralis-major'],
      secondaryMuscles: ['triceps-brachii'],
      equipment: { kind: 'required', name: 'barbell' },
    }],
    diagnostics: [],
  });
});

test('keeps usable exercises and diagnoses rejected required data without inventing targets or equipment', () => {
  const result = mapRepDbResponse(response([
    { id: 'corpse-pose', name_en: 'Corpse Pose', is_bodyweight: true },
    { ...bench, id: 'bad-muscles', primary_muscles: [''] },
    { ...bench, id: 'missing-equipment', equipment: undefined },
    { ...bench, id: '', name_en: ' ' },
    null,
  ]));
  expect(result.status).toBe('partial');
  expect(result.exercises).toEqual([{
    catalogId: 'repdb:corpse-pose', name: 'Corpse Pose',
    primaryMuscles: [], secondaryMuscles: [], equipment: { kind: 'none' },
  }]);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ recordIndex: 1, catalogId: 'repdb:bad-muscles', field: 'primary_muscles', reason: 'invalid_value' }),
    expect.objectContaining({ recordIndex: 2, field: 'equipment', reason: 'invalid_value' }),
    expect.objectContaining({ recordIndex: 3, field: 'id', reason: 'invalid_value' }),
    expect.objectContaining({ recordIndex: 3, field: 'name_en', reason: 'invalid_value' }),
    expect.objectContaining({ recordIndex: 4, field: 'record', reason: 'invalid_value' }),
  ]));
});
