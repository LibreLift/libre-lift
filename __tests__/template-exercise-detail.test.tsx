import { renderAuthenticatedRouter, authenticatedSession } from '../test-support/authenticated-router';
import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';

test('saved template overview opens an exercise image and compact read-only sets from saved snapshots', async () => {
  const service = createSampleWorkoutService();
  const template = (await service.listTemplates())[0];
  await service.updateTemplate(template.id, { ...template, exercises: template.exercises.map((exercise) => ({
    ...exercise, images: { preferred: 'main', main: 'https://example.org/saved-exercise.webp' },
  })) });
  const app = await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout workoutServiceFactory={() => service} initialSession={authenticatedSession} /> } });
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  expect(screen.getByRole('button', { name: 'Bench press. 3 sets' })).toBeVisible();
  expect(screen.queryByText(/95 lb/)).toBeNull();
  expect(screen.queryByRole('image')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Bench press. 3 sets' }));
  expect(app.getPathname()).toBe('/templates/exercise');
  expect(await screen.findByRole('image', { name: 'Bench press — Illustration image' })).toHaveProp('source', [{ uri: 'https://example.org/saved-exercise.webp' }]);
  expect(screen.getByLabelText('Set 1: 8 reps × 95 lb')).toBeVisible();
  expect(screen.getByLabelText('Set 3: 8 reps × 115 lb')).toBeVisible();
  expect(screen.queryByLabelText('Exercise 1 set 1 reps')).toBeNull();
  expect(screen.queryByRole('button', { name: /Add set|Remove.*set/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByLabelText('Set 1: 8 reps × 95 lb')).toBeVisible();
  await testRouter.back();
  expect(app.getPathname()).toBe('/templates/upper-body');
  expect(screen.getByRole('button', { name: 'Dumbbell row. 2 sets' })).toBeVisible();
});

test('saved exercise detail handles missing imagery and missing placements without exposing editors', async () => {
  await renderAuthenticatedRouter({ initialUrl: '/templates/exercise?templateId=upper-body&exerciseId=placement-bench-press' });
  expect(await screen.findByText('Image unavailable')).toBeVisible();
  expect(screen.getByLabelText('Set 1: 8 reps × 95 lb')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Add set|Save|Sets for/ })).toBeNull();
});

test('an earlier RepDB snapshot uses a matching packaged image and keeps its saved name and targets', async () => {
  const service = createSampleWorkoutService();
  const template = (await service.listTemplates())[0];
  await service.updateTemplate(template.id, {
    ...template,
    exercises: template.exercises.map((exercise) => ({
      ...exercise,
      name: 'Saved bench press',
      images: { preferred: 'main', main: 'https://exercise-dataset.com/images/flat/bench-press-start.webp' },
    })),
  });
  await renderRouter({
    appDir: './app',
    overrides: { _layout: () => <RootLayout workoutServiceFactory={() => service} initialSession={authenticatedSession} /> },
  }, { initialUrl: '/templates/exercise?templateId=upper-body&exerciseId=placement-bench-press' });
  expect(await screen.findByRole('image', { name: 'Saved bench press — Illustration image' })).toHaveProp(
    'source', [expect.objectContaining({ __packager_asset: true })],
  );
  expect(screen.getByLabelText('Set 1: 8 reps × 95 lb')).toBeVisible();
});

test.each([
  'templateId=missing&exerciseId=placement-bench-press',
  'templateId=upper-body&exerciseId=missing',
])('saved exercise detail offers a return path when the record is missing: %s', async (query) => {
  const app = await renderAuthenticatedRouter({ initialUrl: `/templates/exercise?${query}` });
  expect(await screen.findByText('This template exercise couldn’t be found.')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Open templates' }));
  expect(app.getPathname()).toBe('/templates');
});
