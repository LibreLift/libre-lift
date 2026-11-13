import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';

const bench = {
  id: 'bench', name_en: 'Bench press', equipment: 'barbell',
  primary_muscles: ['pectoralis_major'], secondary_muscles: ['triceps_brachii'],
  instructions_en: ['Lie on the bench.', 'Press the bar upward.'],
  images: { flat: { start: 'images/start.webp', peak: 'images/peak.webp' } },
};

async function openCatalog(records: readonly unknown[] = [bench], initialUrl = '/templates') {
  const request = jest.fn(async () => ({
    ok: true,
    async json() { return { schema_version: 3, count: records.length, exercises: records }; },
  }));
  const service = createExerciseCatalogService(request);
  const app = await renderRouter({
    appDir: './app', overrides: { _layout: () => <RootLayout catalogService={service} /> },
  }, { initialUrl });
  if (initialUrl === '/templates') {
    await fireEvent.press(await screen.findByRole('button', { name: 'Exercise catalog' }));
    await screen.findByText('Bench press');
  }
  return { request, app };
}

test('a catalog card opens image-first details and Back preserves the filtered visit without fetching again', async () => {
  const { request, app } = await openCatalog();
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search exercises' }), 'PRESS');
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: All muscles' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View Bench press. Primary muscles: Chest. Secondary muscles: Triceps. Equipment: Barbell' }));
  expect(app.getPathname()).toBe('/templates/catalog-exercise');
  expect(screen.getByRole('image', { name: 'Bench press — Start image' })).toHaveProp('source', { uri: 'https://exercise-dataset.com/images/start.webp' });
  expect(screen.getByText('Start · 1 of 2')).toBeVisible();
  expect(screen.getByText('Primary muscles: Chest')).toBeVisible();
  expect(screen.getByText('Secondary muscles: Triceps')).toBeVisible();
  expect(screen.getByText('Equipment: Barbell')).toBeVisible();
  expect(screen.getByText('1. Lie on the bench.')).toBeVisible();
  expect(screen.getByText('2. Press the bar upward.')).toBeVisible();
  await testRouter.back('/templates/catalog');
  expect(screen.getByRole('search', { name: 'Search exercises' })).toHaveDisplayValue('PRESS');
  expect(screen.getByRole('button', { name: 'Muscle group: Chest' })).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

test('paired illustrations support swiping and accessible previous/next controls', async () => {
  await openCatalog();
  await fireEvent.press(screen.getByRole('button', { name: /^View Bench press(?:\.|$)/ }));
  expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByText('Peak · 2 of 2')).toBeVisible();
  expect(screen.getByRole('image', { name: 'Bench press — Peak image' })).toHaveProp('source', { uri: 'https://exercise-dataset.com/images/peak.webp' });
  expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Previous image' }));
  expect(screen.getByText('Start · 1 of 2')).toBeVisible();
  await fireEvent(screen.getByLabelText('Exercise images'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: 320, y: 0 }, layoutMeasurement: { width: 320 } },
  });
  expect(screen.getByText('Peak · 2 of 2')).toBeVisible();
});

test('image loading and failure are independent of the other pose and exercise information', async () => {
  await openCatalog();
  await fireEvent.press(screen.getByRole('button', { name: /^View Bench press(?:\.|$)/ }));
  expect(screen.getByLabelText('Loading Start image')).toBeVisible();
  await fireEvent(screen.getByRole('image', { name: 'Bench press — Start image' }), 'error', { nativeEvent: { error: 'offline' } });
  expect(screen.getByText('Image unavailable')).toBeVisible();
  expect(screen.queryByLabelText('Loading Start image')).toBeNull();
  expect(screen.getByText('1. Lie on the bench.')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByLabelText('Loading Peak image')).toBeVisible();
  await fireEvent(screen.getByRole('image', { name: 'Bench press — Peak image' }), 'load');
  expect(screen.queryByLabelText('Loading Peak image')).toBeNull();
  expect(screen.getByRole('image', { name: 'Bench press — Peak image' })).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Previous image' }));
  expect(screen.getByText('Image unavailable')).toBeVisible();
});

test('main-only images use the large illustration without pose controls or missing instructions', async () => {
  await openCatalog([{ ...bench, instructions_en: undefined, images: { flat: { main: 'images/main.webp' } } }]);
  await fireEvent.press(screen.getByRole('button', { name: /^View Bench press(?:\.|$)/ }));
  expect(screen.getByRole('image', { name: 'Bench press — Illustration image' })).toHaveProp('source', { uri: 'https://exercise-dataset.com/images/main.webp' });
  expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
  expect(screen.queryByText('Instructions')).toBeNull();
});

test('an exercise without imagery still opens its information with an unavailable placeholder', async () => {
  await openCatalog([{ ...bench, images: undefined }]);
  await fireEvent.press(screen.getByRole('button', { name: /^View Bench press(?:\.|$)/ }));
  expect(screen.getByText('Image unavailable')).toBeVisible();
  expect(screen.getByText('Equipment: Barbell')).toBeVisible();
  expect(screen.getByText('1. Lie on the bench.')).toBeVisible();
});

test('direct detail entry offers Open catalog without fetching until the user chooses it', async () => {
  const { request, app } = await openCatalog([bench], '/templates/catalog-exercise?catalogId=repdb%3Abench');
  expect(await screen.findByText('Open the catalog to view this exercise')).toBeVisible();
  expect(request).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open catalog' }));
  expect(app.getPathname()).toBe('/templates/catalog');
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

test('detail survives tab changes and selecting another exercise starts its own gallery', async () => {
  const { request } = await openCatalog([bench, { ...bench, id: 'other', name_en: 'Incline press' }]);
  await fireEvent.press(screen.getByRole('button', { name: /^View Bench press(?:\.|$)/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByText('Peak · 2 of 2')).toBeVisible();
  await testRouter.back('/templates/catalog');
  await fireEvent.press(screen.getByRole('button', { name: /^View Incline press(?:\.|$)/ }));
  expect(screen.getByText('Start · 1 of 2')).toBeVisible();
  expect(screen.getByRole('image', { name: 'Incline press — Start image' })).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});
