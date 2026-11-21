import { createClient } from '@supabase/supabase-js';
import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { namedDisplayStore } from '../test-support/local-router';
import { createSupabaseWorkoutService } from '../src/services/supabase-workout-service';

const template = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Saved plan', description: 'From my account',
  createdAt: '2026-11-18T12:00:00Z', exercises: [{
    id: '00000000-0000-4000-8000-000000000002', catalogId: 'repdb:bench', name: 'Saved bench',
    primaryMuscles: ['Chest'], secondaryMuscles: [], equipment: { kind: 'none' },
    instructions: ['Saved instructions.'], sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }],
  }],
};

function serviceFor(reply: (request: { action: string; id?: string }) => Response) {
  const client = createClient('https://templates.example.com', 'publishable-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (_input, init) => reply(JSON.parse(String(init?.body))) },
  });
  return createSupabaseWorkoutService(() => client);
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

test('persisted template request failures retain Retry and saved detail uses its snapshot', async () => {
  let unavailable = true;
  const service = serviceFor(({ action }) => {
    if (unavailable) return json({ kind: 'unavailable', message: 'Offline' }, 503);
    return json(action === 'list' ? [template] : template);
  });
  await renderRouter({ appDir: './app', overrides: {
    _layout: () => <RootLayout displayNameStore={namedDisplayStore} workoutServiceFactory={() => service} />,
  } });
  expect(await screen.findByText('We couldn’t load this. Please try again.')).toBeVisible();
  expect(screen.queryByText('No templates yet.')).toBeNull();
  unavailable = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Saved plan/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Saved bench. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 8 reps × 12.5 lb')).toBeVisible();
  expect(screen.getByText('Saved bench')).toBeVisible();
});

test('empty accounts and missing persisted details keep the existing creation and missing states', async () => {
  const service = serviceFor(({ action }) => json(action === 'list' ? [] : null));
  await renderRouter({ appDir: './app', overrides: {
    _layout: () => <RootLayout displayNameStore={namedDisplayStore} workoutServiceFactory={() => service} />,
  } });
  expect(await screen.findByText('No templates yet.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create template' })).toBeEnabled();
  await testRouter.navigate(`/templates/${template.id}`);
  expect(await screen.findByText('This template couldn’t be found.')).toBeVisible();
});

test('malformed nested saved descriptions fail visibly instead of becoming trusted template data', async () => {
  const service = serviceFor(() => json([{ ...template, exercises: [{ ...template.exercises[0],
    translations: { de: { name: 'Bankdrücken', instructions: [42] } },
  }] }]));
  await renderRouter({ appDir: './app', overrides: {
    _layout: () => <RootLayout displayNameStore={namedDisplayStore} workoutServiceFactory={() => service} />,
  } });
  expect(await screen.findByText('We couldn’t load this. Please try again.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Saved plan/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
