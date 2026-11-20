import { createClient } from '@supabase/supabase-js';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { authenticatedSession } from '../test-support/authenticated-router';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { createSupabaseWorkoutService } from '../src/services/supabase-workout-service';
import type { WorkoutTemplate } from '../src/models/workout';

async function builder() {
  const saved = new Map<string, WorkoutTemplate>();
  let loseResponse = true;
  let nextId = 0;
  const client = createClient('https://templates.example.com', 'test-publishable', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      let result: unknown;
      if (body.action === 'list') result = [...saved.values()];
      else if (body.action === 'get') result = saved.get(body.id) ?? null;
      else {
        result = { ...body.content, id: body.id, createdAt: '2026-11-18T12:00:00Z' };
        saved.set(body.id, result as WorkoutTemplate);
        if (loseResponse) { loseResponse = false; throw new Error('Response lost after commit'); }
      }
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const service = createSupabaseWorkoutService(() => client, () => `10000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`);
  const catalogService = createExerciseCatalogService(async () => ({
    schema_version: 3, exercises: [{ id: 'press', name_en: 'Catalog press', equipment: 'barbell', primary_muscles: ['pectoralis_major'] }],
  }));
  await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout
    workoutServiceFactory={() => service} catalogService={catalogService} initialSession={authenticatedSession} /> } });
  return service;
}
async function draft(title: string) {
  await fireEvent.press(await screen.findByRole('button', { name: 'Create template' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), title);
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^View Catalog press/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add to template' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 weight (lb)'), '12.5');
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
}

test('retrying a lost creation response keeps the same template rather than creating another', async () => {
  const service = await builder();
  await draft('My plan');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry save' });
  expect(await service.listTemplates()).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  const templates = await service.listTemplates();
  expect(templates).toHaveLength(1);
  expect(templates[0].exercises[0].sets).toEqual([{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }]);
});

test('Cancel after an uncertain creation gives a new draft an independent template identity', async () => {
  const service = await builder();
  await draft('First plan');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry save' });
  const first = (await service.listTemplates())[0];
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await draft('Second plan');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  const templates = await service.listTemplates();
  expect(templates.map(template => template.title)).toEqual(['First plan', 'Second plan']);
  expect(templates[1].id).not.toBe(first.id);
  expect(templates[1].exercises[0].id).not.toBe(first.exercises[0].id);
});
