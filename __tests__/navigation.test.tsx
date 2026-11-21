import { renderLocalRouter } from '../test-support/local-router';
import { fireEvent, screen, testRouter, waitFor } from 'expo-router/testing-library';

test('opens templates first and navigates template, sample history and settings screens', async () => {
  const app = await renderLocalRouter();
  const upperBody = await screen.findByRole('button', {
    name: 'Upper body. A little push. A little pull. 2 exercises · 5 sets',
  });
  expect(app.getPathname()).toBe('/templates');
  await fireEvent.press(upperBody);
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(app.getPathname()).toBe('/templates/upper-body');
  await testRouter.back('/templates');

  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Bench press, 3 sets, Primary muscles · Chest · Secondary muscles · Triceps · Equipment · Barbell' }));
  expect(await screen.findByText('Recorded · 6 reps × 115 lb')).toBeVisible();
  expect(screen.getAllByText('Target · 8 reps × 115 lb')).toHaveLength(2);
  await testRouter.back('/workouts');

  await fireEvent.press(screen.getByRole('button', { name: /^Settings, tab/ }));
  expect(app.getPathname()).toBe('/settings');
  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Dark/ })).toBeChecked());
  expect(screen.getByText('Alex')).toBeVisible();
  expect(screen.getByRole('radio', { name: 'Light' })).toBeEnabled();
  expect(screen.getByRole('radio', { name: 'System' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Edit name' })).toBeVisible();
});

test('an unknown template shows a useful missing-record state', async () => {
  await renderLocalRouter( { initialUrl: '/templates/missing' });
  expect(await screen.findByText('This template couldn’t be found.')).toBeVisible();
});

test('session exercises expand independently, survive tab changes, and reset on reopening', async () => {
  await renderLocalRouter( { initialUrl: '/workouts' });
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  const bench = await screen.findByRole('button', { name: 'Bench press, 3 sets, Primary muscles · Chest · Secondary muscles · Triceps · Equipment · Barbell', expanded: false });
  expect(screen.queryByText('Recorded · 6 reps × 115 lb')).toBeNull();
  await fireEvent.press(bench);
  await fireEvent.press(screen.getByRole('button', { name: 'Dumbbell row, 2 sets, Primary muscles · Back · Secondary muscles · Biceps · Equipment · Dumbbell' }));
  expect(screen.getByRole('button', { name: 'Bench press, 3 sets, Primary muscles · Chest · Secondary muscles · Triceps · Equipment · Barbell', expanded: true })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Dumbbell row, 2 sets, Primary muscles · Back · Secondary muscles · Biceps · Equipment · Dumbbell', expanded: true })).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  expect(screen.getByText('Recorded · 6 reps × 115 lb')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Bench press, 3 sets, Primary muscles · Chest · Secondary muscles · Triceps · Equipment · Barbell' }));
  expect(screen.getByRole('button', { name: 'Dumbbell row, 2 sets, Primary muscles · Back · Secondary muscles · Biceps · Equipment · Dumbbell', expanded: true })).toBeVisible();
  await testRouter.back('/workouts');
  await fireEvent.press(screen.getByRole('button', { name: /Upper body/ }));
  expect(await screen.findByRole('button', { name: 'Bench press, 3 sets, Primary muscles · Chest · Secondary muscles · Triceps · Equipment · Barbell', expanded: false })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Dumbbell row, 2 sets, Primary muscles · Back · Secondary muscles · Biceps · Equipment · Dumbbell', expanded: false })).toBeVisible();
});
