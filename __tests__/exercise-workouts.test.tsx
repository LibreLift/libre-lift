import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { createTemplateExercise, createSessionExercise, type WorkoutTemplate, type WorkoutSession } from '../src/models/workout';
import { mapRepDbResponse } from '../src/services/repdb-exercise-mapper';
import type { WorkoutService } from '../src/services/workout-service';
import RootLayout from '../app/_layout';
import { TemplateDetailScreen } from '../src/views/templates';
import { WorkoutDetailScreen } from '../src/views/workouts';

test.each(['/templates/plan', '/workouts/log'])('saved exercises remain readable and distinct at %s after source changes', async (initialUrl) => {
  const raw = {
    id: 'bench-press', name_en: 'Bench press', equipment: 'barbell',
    primary_muscles: ['chest'], secondary_muscles: ['triceps'],
  };
  const result = mapRepDbResponse({ schema_version: 3, count: 2, exercises: [raw, { ...raw, id: 'broken', name_en: '' }] });
  expect(result.status).toBe('partial');
  const exercise = {
    ...result.exercises[0], instructions: ['English step.'],
    translations: { de: { name: 'Bankdrücken', instructions: ['Deutscher Schritt.'] }, es: undefined },
    images: { preferred: 'pair' as const, pair: { start: 'https://example.org/start.webp', peak: 'https://example.org/peak.webp' } },
  };
  const sets = [{ setNumber: 1, targetWeight: 95, targetReps: 8 }];
  const first = createTemplateExercise('placement-a', exercise, sets);
  const second = createTemplateExercise('placement-b', exercise, [{ ...sets[0], targetReps: 12 }]);
  const template: WorkoutTemplate = { id: 'plan', title: 'Plan', description: '', exercises: [first, second] };
  const editable = { ...first, sets: first.sets.map((set) => ({ ...set })), primaryMuscles: [...first.primaryMuscles] };
  const session: WorkoutSession = {
    id: 'log', title: 'Log', startedAt: '2026-11-06T17:00:00Z', endedAt: '2026-11-06T17:42:00Z',
    exercises: [createSessionExercise('session-a', editable, editable.sets.map((set) => ({ ...set, actualReps: 6, actualWeight: 95 }))), createSessionExercise('session-b', second, second.sets.map((set) => ({ ...set, actualReps: 10, actualWeight: 95 })))],
  };
  expect(template.exercises.map((entry) => [entry.id, entry.catalogId])).toEqual([
    ['placement-a', 'repdb:bench-press'], ['placement-b', 'repdb:bench-press'],
  ]);
  expect(session.exercises.map((entry) => [entry.id, entry.catalogId])).toEqual([
    ['session-a', 'repdb:bench-press'], ['session-b', 'repdb:bench-press'],
  ]);
  raw.name_en = 'Renamed upstream';
  raw.primary_muscles[0] = 'changed target';
  sets[0].targetReps = 99;
  exercise.instructions[0] = 'Changed guidance';
  exercise.translations.de.instructions[0] = 'Changed translation';
  exercise.images.pair.start = 'https://example.org/changed.webp';
  editable.name = 'Edited template';
  editable.sets[0].targetReps = 100;
  editable.primaryMuscles[0] = 'Changed template muscle';
  const service: WorkoutService = {
    async listTemplates() { return [template]; }, async getTemplate() { return template; },
    async updateTemplateDetails(_id, details) { return { ...template, ...details }; },
    async listSessions() { return [session]; }, async getSession() { return session; },
  };
  for (const saved of [(await service.getTemplate('plan'))!, (await service.getSession('log'))!]) {
    expect(saved.exercises[0]).toMatchObject({
      name: 'Bench press', instructions: ['English step.'],
      translations: { de: { name: 'Bankdrücken', instructions: ['Deutscher Schritt.'] } },
      images: { pair: { start: 'https://example.org/start.webp' } },
    });
  }
  await renderRouter({
    _layout: () => <RootLayout service={service} />,
    'templates/[id]': TemplateDetailScreen,
    'workouts/[id]': WorkoutDetailScreen,
  }, { initialUrl });
  expect(await screen.findAllByText('Bench press')).toHaveLength(2);
  expect(screen.queryByText('Renamed upstream')).toBeNull();
  expect(screen.queryByText(/99 reps/)).toBeNull();
  expect(screen.getAllByText(/Chest/)).toHaveLength(2);
  if (initialUrl.startsWith('/templates')) {
    expect(screen.getByText('Set 1 · 8 reps × 95 lb')).toBeVisible();
    expect(screen.getByText('Set 1 · 12 reps × 95 lb')).toBeVisible();
  } else {
    for (const placement of screen.getAllByRole('button', { name: /^Bench press,/ })) {
      await fireEvent.press(placement);
    }
    expect(screen.getByText('Target · 8 reps × 95 lb')).toBeVisible();
    expect(screen.getByText('Target · 12 reps × 95 lb')).toBeVisible();
  }
});
