import { fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';

test('opens templates first and navigates template, history, account, and settings screens', async () => {
  const app = await renderRouter('./app');
  const upperBody = await screen.findByRole('button', { name: /Upper body/ });
  expect(app.getPathname()).toBe('/templates');
  await fireEvent.press(upperBody);
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(app.getPathname()).toBe('/templates/upper-body');
  await testRouter.back('/templates');

  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  expect(await screen.findByText('Recorded · 6 reps × 115 lb')).toBeVisible();
  expect(screen.getAllByText('Target · 8 reps × 115 lb')).toHaveLength(2);
  await testRouter.back('/workouts');

  await fireEvent.press(screen.getByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Dark/ })).toBeChecked());
  await testRouter.back('/account');
  await fireEvent.press(screen.getByRole('button', { name: /Sign in/ }));
  expect(screen.getByText('Sign-in is on the way')).toBeVisible();
});

test('an unknown template shows a useful missing-record state', async () => {
  await renderRouter('./app', { initialUrl: '/templates/missing' });
  expect(await screen.findByText('This template couldn’t be found.')).toBeVisible();
});
