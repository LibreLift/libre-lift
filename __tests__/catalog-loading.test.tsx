import { namedDisplayStore } from '../test-support/local-router';
import { act, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import { createExerciseCatalogService, type CatalogPayloadLoader } from '../src/services/exercise-catalog-service';

const bench = {
  id: 'bench', name_en: 'Bench press', equipment: 'barbell',
  primary_muscles: ['pectoralis_major'], secondary_muscles: ['triceps_brachii'],
};

function payload(exercises: readonly unknown[]) {
  return { schema_version: 3, count: exercises.length, exercises };
}

async function openCatalog(loadPayload: CatalogPayloadLoader) {
  const catalogService = createExerciseCatalogService(loadPayload);
  const app = await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout workoutServiceFactory={createSampleWorkoutService} displayNameStore={namedDisplayStore} catalogService={catalogService} /> } });
  await fireEvent.press(await screen.findByRole('button', { name: 'Exercise catalog' }));
  return app;
}

test('the catalog shows loading before displaying alphabetized exercises', async () => {
  let finish: (value: unknown) => void = () => {};
  const pending = new Promise<unknown>((resolve) => { finish = resolve; });
  const loadPayload = jest.fn(() => pending);
  const app = await openCatalog(loadPayload);
  expect(app.getPathname()).toBe('/templates/catalog');
  expect(screen.getByLabelText('Loading exercise catalog')).toBeVisible();
  await act(async () => finish(payload([
    { ...bench, id: 'z', name_en: 'Z press', primary_muscles: ['anterior_deltoid', 'lateral_deltoid'], secondary_muscles: ['serratus_anterior', 'pectoralis_major', 'supraspinatus', 'forearms'] },
    bench,
    { id: 'a', name_en: 'Air squat', is_bodyweight: true },
  ])));
  expect(await screen.findByText('Air squat')).toBeVisible();
  const names = screen.getAllByText(/^(Air squat|Bench press|Z press)$/).map((node) => node.props.children);
  expect(names).toEqual(['Air squat', 'Bench press', 'Z press']);
  expect(screen.getByText('Primary muscles: Shoulders')).toBeVisible();
  expect(screen.getByText('Secondary muscles: Chest · Shoulders · Forearms')).toBeVisible();
  expect(screen.getByText('Primary muscles: Not specified')).toBeVisible();
  expect(screen.getByText('Equipment: No equipment')).toBeVisible();
  expect(screen.getAllByText(/^Secondary muscles:/)).toHaveLength(2);
  expect(screen.getAllByText('Equipment: Barbell')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Exercise data by RepDB' })).toBeVisible();
  expect(screen.queryByText(/pectoralis|deltoid|serratus/)).toBeNull();
  expect(screen.queryByText('Some exercises couldn’t be loaded')).toBeNull();
});

test('all approved muscle values use familiar deduplicated groups', async () => {
  await openCatalog(async () => payload([{
    ...bench,
    primary_muscles: [
      'pectoralis_major', 'latissimus_dorsi', 'rhomboids', 'trapezius', 'infraspinatus_teres_minor',
      'erector_spinae', 'quadratus_lumborum', 'anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid',
      'biceps_brachii', 'brachialis', 'triceps_brachii', 'brachioradialis', 'forearm_extensors', 'forearm_flexors',
      'rectus_abdominis', 'transverse_abdominis', 'obliques', 'gluteus_maximus', 'gluteus_medius',
      'quadriceps', 'hamstrings', 'adductors', 'abductors', 'hip_flexors', 'gastrocnemius', 'soleus', 'tibialis_anterior',
    ],
    secondary_muscles: ['forearms', 'serratus_anterior', 'supraspinatus'],
  }]));
  expect(await screen.findByText('Primary muscles: Chest · Upper back · Lower back · Shoulders · Biceps · Triceps · Forearms · Abs · Glutes · Quads · Hamstrings · Inner thighs · Outer hips · Hip flexors · Calves · Shins')).toBeVisible();
  expect(screen.getByText('Secondary muscles: Forearms · Chest · Shoulders')).toBeVisible();
});

test('partial responses omit rejected records and duplicate identities with a quiet notice', async () => {
  await openCatalog(async () => payload([
    bench,
    { ...bench, id: 'invalid', name_en: 'Invalid equipment', equipment: null },
    { ...bench, id: 'duplicate', name_en: 'First duplicate' },
    { ...bench, id: 'duplicate', name_en: 'Second duplicate' },
  ]));
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(screen.getByText('Some exercises couldn’t be loaded')).toBeVisible();
  expect(screen.queryByText(/Invalid equipment|First duplicate|Second duplicate/)).toBeNull();
});

test('optional-content and count diagnostics do not report rejected exercises', async () => {
  await openCatalog(async () => ({
    schema_version: 3, count: 99, exercises: [{ ...bench, images: null, instructions_en: 42, name_de: false }],
  }));
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(screen.queryByText('Some exercises couldn’t be loaded')).toBeNull();
});

test('unrecognized upstream muscle values cannot become presentation groups', async () => {
  await openCatalog(async () => payload([{
    ...bench, primary_muscles: ['constructor', 'toString', 'new_upstream_muscle'],
    secondary_muscles: ['__proto__'],
  }]));
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(screen.getByText('Primary muscles: Not specified')).toBeVisible();
  expect(screen.queryByText(/^Secondary muscles:/)).toBeNull();
});

test('secondary-only aliases never create primary filter matches', async () => {
  await openCatalog(async () => payload([{
    ...bench,
    primary_muscles: ['forearms', 'serratus_anterior', 'supraspinatus'],
    secondary_muscles: ['forearms', 'serratus_anterior', 'supraspinatus'],
  }]));
  expect(await screen.findByText('Primary muscles: Not specified')).toBeVisible();
  expect(screen.getByText('Secondary muscles: Forearms · Chest · Shoulders')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: All muscles' }));
  expect(screen.queryByRole('button', { name: 'Chest' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Forearms' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Shoulders' })).toBeNull();
});

const failures: readonly [string, CatalogPayloadLoader][] = [
  ['unavailable payload', async () => { throw new Error('Catalog unavailable'); }],
  ['envelope', async () => ({ exercises: [bench] })],
  ['schema', async () => ({ schema_version: 4, count: 1, exercises: [bench] })],
  ['no usable exercises', async () => payload([{ ...bench, name_en: null }])],
];

test.each(failures)('%s failure is defined, exposes no exercise data, and allows Back without retry', async (_name, failure) => {
  const loadPayload = jest.fn(failure);
  const app = await openCatalog(loadPayload);
  expect(await screen.findByText('We couldn’t load the exercise catalog.')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
  expect(screen.queryByLabelText('Loading exercise catalog')).toBeNull();
  expect(screen.queryByRole('button', { name: /retry|try again/i })).toBeNull();
  expect(loadPayload).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(app.getPathname()).toBe('/templates');
  expect(await screen.findByRole('button', { name: /Upper body/ })).toBeVisible();
});

test('the open catalog retains results across tab changes and a new visit loads afresh', async () => {
  const loadPayload = jest.fn<ReturnType<CatalogPayloadLoader>, Parameters<CatalogPayloadLoader>>()
    .mockResolvedValueOnce(payload([bench]))
    .mockResolvedValueOnce(payload([{ ...bench, name_en: 'New catalog exercise' }]));
  await openCatalog(loadPayload);
  expect(await screen.findByText('Bench press')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByText('Bench press')).toBeVisible();
  expect(loadPayload).toHaveBeenCalledTimes(1);
  await testRouter.back('/templates');
  await fireEvent.press(screen.getByRole('button', { name: 'Exercise catalog' }));
  expect(await screen.findByText('New catalog exercise')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
  expect(loadPayload).toHaveBeenCalledTimes(2);
});

test('a departed visit cannot overwrite a later visit when its response arrives late', async () => {
  let finishOld: (value: unknown) => void = () => {};
  const old = new Promise<unknown>((resolve) => { finishOld = resolve; });
  const loadPayload = jest.fn<ReturnType<CatalogPayloadLoader>, Parameters<CatalogPayloadLoader>>()
    .mockReturnValueOnce(old)
    .mockResolvedValueOnce(payload([{ ...bench, name_en: 'Current catalog exercise' }]));
  await openCatalog(loadPayload);
  await testRouter.back('/templates');
  await fireEvent.press(screen.getByRole('button', { name: 'Exercise catalog' }));
  expect(await screen.findByText('Current catalog exercise')).toBeVisible();
  await act(async () => finishOld(payload([bench])));
  expect(screen.getByText('Current catalog exercise')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
});
