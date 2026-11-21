import { createClient } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { namedDisplayStore } from '../test-support/local-router';
import { createSupabaseWorkoutService } from '../src/services/supabase-workout-service';

const template = {
    id: '00000000-0000-4000-8000-000000000001', title: 'Saved plan', description: '',
    createdAt: '2026-11-18T12:00:00Z', exercises: [{
      id: '00000000-0000-4000-8000-000000000002', catalogId: 'repdb:bench', name: 'Saved bench',
      primaryMuscles: ['Chest'], secondaryMuscles: [], equipment: { kind: 'none' },
      sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }],
    }],
};

test('persisted deletion keeps detail after a lost response and retries safely through the pending and empty states', async () => {
  let deleted = false;
  let dropResponse = true;
  let finish: () => void = () => {};
  const pendingRetry = new Promise<void>(resolve => { finish = resolve; });
  const client = createClient('https://templates.example.com', 'test-publishable', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.action === 'delete') {
        deleted = true;
        if (dropResponse) { dropResponse = false; throw new Error('Response lost after deletion'); }
        await pendingRetry;
      }
      const result = body.action === 'list' ? deleted ? [] : [template]
        : body.action === 'get' ? deleted ? null : template : null;
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const service = createSupabaseWorkoutService(() => client);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const app = await renderRouter({ appDir: './app', overrides: {
      _layout: () => <RootLayout displayNameStore={namedDisplayStore} workoutServiceFactory={() => service} />,
    } });
    await fireEvent.press(await screen.findByRole('button', { name: /Saved plan/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete template' }));
    expect(alert.mock.calls.at(-1)?.[1]).toContain('Saved plan');
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Cancel')?.onPress?.());
    expect(await service.getTemplate(template.id)).toEqual(template);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Delete')?.onPress?.());
    expect(await screen.findByText('This template couldn’t be deleted. Please try again.')).toBeVisible();
    expect(screen.getByText('Saved plan')).toBeVisible();
    expect(app.getPathname()).toBe(`/templates/${template.id}`);
    expect(await service.getTemplate(template.id)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry delete' }));
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Delete')?.onPress?.());
    expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit template details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Workouts, tab/ })).toBeDisabled();
    await testRouter.back();
    expect(app.getPathname()).toBe(`/templates/${template.id}`);
    await act(async () => finish());
    await waitFor(() => expect(app.getPathname()).toBe('/templates'));
    expect(await screen.findByText('No templates yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create template' })).toBeEnabled();
  } finally { alert.mockRestore(); }
});

test('a malformed deletion acknowledgment retains saved detail and offers retry', async () => {
  const client = createClient('https://templates.example.com', 'test-publishable', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      const result = body.action === 'list' ? [template] : body.action === 'get' ? template : { unexpected: true };
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const service = createSupabaseWorkoutService(() => client);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const app = await renderRouter({ appDir: './app', overrides: {
      _layout: () => <RootLayout displayNameStore={namedDisplayStore} workoutServiceFactory={() => service} />,
    } });
    await fireEvent.press(await screen.findByRole('button', { name: /Saved plan/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete template' }));
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Delete')?.onPress?.());
    expect(await screen.findByRole('button', { name: 'Retry delete' })).toBeEnabled();
    expect(screen.getByText('Saved plan')).toBeVisible();
    expect(app.getPathname()).toBe(`/templates/${template.id}`);
  } finally { alert.mockRestore(); }
});
