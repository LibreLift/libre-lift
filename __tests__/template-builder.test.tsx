import { authenticatedSession } from '../test-support/authenticated-router';
import { Alert } from 'react-native';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';
import type { WorkoutService } from '../src/services/workout-service';

const bench = { id: 'bench', name_en: 'Catalog press', equipment: 'barbell', primary_muscles: ['pectoralis_major'] };
async function builder(service = createSampleWorkoutService(), failure = false) {
  const catalogService = createExerciseCatalogService(async () => {
    if (failure) throw new Error('Catalog unavailable');
    return { schema_version: 3, exercises: [bench] };
  });
  const app = await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout workoutServiceFactory={() => service} catalogService={catalogService} initialSession={authenticatedSession} /> } });
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
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 3' }));
  expect(screen.getByLabelText('Exercise 3 set 1 weight (lb)')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Exercise 3 set 1 weight (lb)'), '10');
  await fireEvent.changeText(screen.getByLabelText('Exercise 3 set 1 reps'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await addCatalogExercise();
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 4' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 4 set 1 weight (lb)'), '20');
  await fireEvent.changeText(screen.getByLabelText('Exercise 4 set 1 reps'), '6');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
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

test('create from an empty draft, retry an atomic save and reopen the new template', async () => {
  const storage = createSampleWorkoutService();
  let rejectSave: (error: Error) => void = () => {};
  const pending = new Promise<void>((_, reject) => { rejectSave = reject; });
  let first = true;
  const service: WorkoutService = { ...storage, async createTemplate(content) {
    if (first) { first = false; await pending; }
    return storage.createTemplate(content);
  } };
  const { app } = await builder(service);
  await fireEvent.press(await screen.findByRole('button', { name: 'Create template' }));
  expect(screen.getByLabelText('Template title')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Upper body');
  await addCatalogExercise();
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 weight (lb)'), '0');
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '12');
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByLabelText('Exercise 1 set 1 reps')).toHaveDisplayValue('12');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Workouts, tab/ })).toBeDisabled();
  expect(await storage.listTemplates()).toHaveLength(2);
  await act(async () => rejectSave(new Error('Failed')));
  expect(await screen.findByRole('button', { name: 'Retry save' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  expect(screen.getByLabelText('Exercise 1 set 1 weight (lb)')).toHaveDisplayValue('0');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Catalog press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 12 reps × 0 lb')).toBeVisible();
  expect(app.getPathname()).not.toBe('/templates/new');
  await testRouter.back();
  await testRouter.back('/templates');
  expect(await screen.findByRole('button', { name: /Upper body.*1 exercise · 1 set/ })).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /Upper body.*1 exercise · 1 set/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Catalog press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 12 reps × 0 lb')).toBeVisible();
});

test('new draft validation, discard and Cancel do not create records', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { service, app } = await builder();
  await fireEvent.press(await screen.findByRole('button', { name: 'Create template' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Enter a title for this template.')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Unsaved');
  await testRouter.back();
  expect(app.getPathname()).toBe('/templates/new');
  expect(alert).toHaveBeenCalled();
  await act(async () => alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Discard changes')?.onPress?.());
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  expect(screen.getByLabelText('Template title')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Cancel me');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  expect(await service.listTemplates()).toHaveLength(2);
});

test('a repetition target outside storage range is correctable before saving', async () => {
  const { service } = await builder();
  await editSample();
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '2147483648');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Exercise 1, set 1: enter 2147483647 reps or fewer.')).toBeVisible();
  expect((await service.getTemplate('upper-body'))?.exercises[0].sets[0].targetReps).toBe(8);
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '2147483647');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  expect((await service.getTemplate('upper-body'))?.exercises[0].sets[0].targetReps).toBe(2147483647);
});

test('reordering uses edit-only handles and saves placement order with the original targets', async () => {
  const { service } = await builder();
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  expect(screen.queryByRole('button', { name: 'Reorder exercise 1' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  expect(screen.getByRole('button', { name: 'Reorder exercise 1' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Move exercise 1 up' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 2 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  expect(screen.getByLabelText('Exercise 1 set 1 weight (lb)')).toHaveDisplayValue('35');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('button', { name: 'Edit template details' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Reorder exercise 1' })).toBeNull();
  const saved = await service.getTemplate('upper-body');
  expect(saved?.exercises.map((exercise) => exercise.id)).toEqual(['placement-dumbbell-row', 'placement-bench-press']);
  expect(saved?.exercises[0].sets[0]).toEqual({ setNumber: 1, targetWeight: 35, targetReps: 10 });
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 1 down' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect((await service.getTemplate('upper-body'))?.exercises[0].id).toBe('placement-dumbbell-row');
});

test('delete confirms by name, retains detail on failure, and can remove the last template', async () => {
  const storage = createSampleWorkoutService();
  let first = true;
  const service: WorkoutService = { ...storage, async deleteTemplate(id) {
    if (first) { first = false; throw new Error('Unavailable'); }
    await storage.deleteTemplate(id);
  } };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { app } = await builder(service);
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  expect(alert.mock.calls.at(-1)?.[1]).toContain('Upper body');
  await act(async () => alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Cancel')?.onPress?.());
  expect(await storage.listTemplates()).toHaveLength(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await act(async () => alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Delete')?.onPress?.());
  expect(await screen.findByText('This template couldn’t be deleted. Please try again.')).toBeVisible();
  expect(app.getPathname()).toBe('/templates/upper-body');
  await fireEvent.press(screen.getByRole('button', { name: 'Retry delete' }));
  await act(async () => alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Delete')?.onPress?.());
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  expect(screen.queryByRole('button', { name: /Upper body/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Lower body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await act(async () => alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Delete')?.onPress?.());
  expect(await screen.findByText('No templates yet.')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  expect(screen.getByLabelText('Template title')).toHaveDisplayValue('');
});

test('pending deletion disables duplicate changes and navigation until it settles', async () => {
  const storage = createSampleWorkoutService();
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const service: WorkoutService = { ...storage, async deleteTemplate(id) {
    await pending;
    await storage.deleteTemplate(id);
  } };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { app } = await builder(service);
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await act(async () => alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Delete')?.onPress?.());
  expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Edit template details' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Workouts, tab/ })).toBeDisabled();
  await testRouter.back();
  expect(app.getPathname()).toBe('/templates/upper-body');
  await act(async () => finish());
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
});
