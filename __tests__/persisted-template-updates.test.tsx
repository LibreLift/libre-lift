import { createClient } from '@supabase/supabase-js';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { namedDisplayStore } from '../test-support/local-router';
import { createSupabaseWorkoutService } from '../src/services/supabase-workout-service';
import type { WorkoutTemplate } from '../src/models/workout';

test('a lost update retains the draft; a committed update with a failed reload offers read recovery', async () => {
  let saved: WorkoutTemplate = {
    id: '10000000-0000-4000-8000-000000000001', title: 'Original', description: 'Saved description',
    createdAt: '2026-11-18T12:00:00Z', exercises: [1, 2].map(number => ({
      id: `10000000-0000-4000-8000-${String(number + 1).padStart(12, '0')}`,
      catalogId: 'repdb:press', name: `Saved press ${number}`, primaryMuscles: [], secondaryMuscles: [],
      equipment: { kind: 'none' }, sets: [{ setNumber: 1, targetWeight: number * 10, targetReps: 8 }],
    })),
  };
  const originalIds = saved.exercises.map(exercise => exercise.id);
  let loseResponse = true;
  let failReload = false;
  const client = createClient('https://templates.example.com', 'test-publishable', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      let result: unknown;
      if (body.action === 'list') result = [saved];
      else if (body.action === 'get') {
        if (failReload) { failReload = false; throw new Error('Read unavailable after save'); }
        result = saved;
      } else {
        saved = { ...body.content, id: body.id, createdAt: saved.createdAt };
        if (loseResponse) { loseResponse = false; throw new Error('Update response lost after commit'); }
        failReload = true;
        result = saved;
      }
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  let sequence = 10;
  const service = createSupabaseWorkoutService(() => client,
    () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
  await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout
    workoutServiceFactory={() => service} displayNameStore={namedDisplayStore} /> } });
  await fireEvent.press(await screen.findByRole('button', { name: /^Original/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Edited');
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 2 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry save' });
  expect(screen.getByLabelText('Template title')).toHaveDisplayValue('Edited');
  expect((await service.getTemplate(saved.id))?.exercises.map(exercise => exercise.id)).toEqual([...originalIds].reverse());
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull();
  expect(await service.listTemplates()).toEqual([saved]);
  expect(saved.title).toBe('Edited');
  expect(saved.exercises.map(exercise => exercise.id)).toEqual([...originalIds].reverse());
});
