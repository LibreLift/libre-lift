import { Alert } from 'react-native';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';
import type { WorkoutService } from '../src/services/workout-service';

const bench = { id: 'bench', name_en: 'Catalog press', equipment: 'barbell', primary_muscles: ['pectoralis_major'] };
async function builder(service = createSampleWorkoutService(), failure = false) {
  const catalogService = createExerciseCatalogService(async () => ({ ok: !failure,
    async json() { return { schema_version: 3, exercises: [bench] }; },
  }));
  const app = await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout service={service} catalogService={catalogService} /> } });
  return { app, service };
}
async function editSample() {
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
}
async function addCatalogExercise() {
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^View Catalog press/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add to template' }));
}
afterEach(() => jest.restoreAllMocks());

test('catalog browsing and explicit addition preserve drafts and add independent repeated placements', async () => {
  const { service } = await builder();
  await editSample();
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'My changed draft');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await screen.findByText('Catalog press');
  await testRouter.back();
  expect(screen.getByDisplayValue('My changed draft')).toBeVisible();
  await addCatalogExercise();
  expect(screen.getByLabelText('Exercise 3 set 1 weight (lb)')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Exercise 3 set 1 weight (lb)'), '10');
  await fireEvent.changeText(screen.getByLabelText('Exercise 3 set 1 reps'), '8');
  await addCatalogExercise();
  await fireEvent.changeText(screen.getByLabelText('Exercise 4 set 1 weight (lb)'), '20');
  await fireEvent.changeText(screen.getByLabelText('Exercise 4 set 1 reps'), '6');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('My changed draft')).toBeVisible();
  const saved = await service.getTemplate('upper-body');
  expect(saved?.exercises.slice(2).map((exercise) => ({ catalogId: exercise.catalogId, sets: exercise.sets }))).toEqual([
    { catalogId: 'repdb:bench', sets: [{ setNumber: 1, targetWeight: 10, targetReps: 8 }] },
    { catalogId: 'repdb:bench', sets: [{ setNumber: 1, targetWeight: 20, targetReps: 6 }] },
  ]);
  expect(saved?.exercises[2].id).not.toBe(saved?.exercises[3].id);
});

test('catalog failure and standalone browsing cannot lose or mutate the open draft', async () => {
  await builder(createSampleWorkoutService(), true);
  await editSample();
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Keep me');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await screen.findByText('We couldn’t load the exercise catalog.');
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByDisplayValue('Keep me')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByDisplayValue('Keep me')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await testRouter.back('/templates');
  await fireEvent.press(screen.getByRole('button', { name: 'Exercise catalog' }));
  await screen.findByText('We couldn’t load the exercise catalog.');
  expect(screen.queryByRole('button', { name: 'Add to template' })).toBeNull();
});
