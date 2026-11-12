import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';

const exercises = [
  { id: 'z', name_en: 'Z press', equipment: 'dumbbell', primary_muscles: ['anterior_deltoid'] },
  { id: 'bench', name_en: 'Bench press', equipment: 'barbell', primary_muscles: ['pectoralis_major', 'triceps_brachii'] },
  { id: 'row', name_en: 'Cable row', equipment: 'cable', primary_muscles: ['latissimus_dorsi', 'rhomboids'] },
  { id: 'pushup', name_en: 'Push-up', is_bodyweight: true, primary_muscles: ['pectoralis_major'], secondary_muscles: ['triceps_brachii'] },
];

async function openCatalog() {
  const request = jest.fn(async () => ({
    ok: true,
    async json() { return { schema_version: 3, count: exercises.length, exercises }; },
  }));
  const catalogService = createExerciseCatalogService(request);
  await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout catalogService={catalogService} /> } });
  await fireEvent.press(await screen.findByRole('button', { name: 'Exercise catalog' }));
  await screen.findByText('Bench press');
  return request;
}

test('case-insensitive name search narrows the loaded catalog without another request', async () => {
  const request = await openCatalog();
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search exercises' }), 'PRESS');
  expect(screen.getAllByText(/^(Bench press|Z press)$/).map((node) => node.props.children)).toEqual(['Bench press', 'Z press']);
  expect(screen.queryByText('Cable row')).toBeNull();
  expect(screen.queryByText('Push-up')).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});

test('one primary group combines with name search and excludes secondary-only targets', async () => {
  const request = await openCatalog();
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: All muscles' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Triceps', selected: false }));
  expect(screen.getByText('Bench press')).toBeVisible();
  expect(screen.queryByText('Push-up')).toBeNull();
  expect(screen.queryByText('Z press')).toBeNull();
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search exercises' }), 'PRESS');
  expect(screen.getByText('Bench press')).toBeVisible();
  expect(screen.queryByText('Z press')).toBeNull();
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search exercises' }), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: Triceps' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Upper back', selected: false }));
  expect(screen.getByText('Cable row')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});

test('no matching exercises can be cleared without reloading the catalog', async () => {
  const request = await openCatalog();
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: All muscles' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search exercises' }), 'row');
  expect(screen.getByText('No matching exercises')).toBeVisible();
  expect(screen.queryByText('Cable row')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear search and filter' }));
  expect(screen.getByRole('search', { name: 'Search exercises' })).toHaveDisplayValue('');
  expect(screen.getByRole('button', { name: 'Muscle group: All muscles' })).toBeVisible();
  expect(screen.getByText('Cable row')).toBeVisible();
  expect(screen.getByText('Push-up')).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

test('search and group selection survive tab changes but reset on a fresh visit', async () => {
  const request = await openCatalog();
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search exercises' }), 'press');
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: All muscles' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByRole('search', { name: 'Search exercises' })).toHaveDisplayValue('press');
  expect(screen.getByRole('button', { name: 'Muscle group: Chest' })).toBeVisible();
  expect(screen.queryByText('Z press')).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  await testRouter.back('/templates');
  await fireEvent.press(screen.getByRole('button', { name: 'Exercise catalog' }));
  expect(await screen.findByText('Push-up')).toBeVisible();
  expect(screen.getByRole('search', { name: 'Search exercises' })).toHaveDisplayValue('');
  expect(screen.getByRole('button', { name: 'Muscle group: All muscles' })).toBeVisible();
  expect(screen.getByText('Z press')).toBeVisible();
  expect(request).toHaveBeenCalledTimes(2);
});
