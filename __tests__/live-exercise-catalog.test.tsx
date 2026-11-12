import { act, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createExerciseCatalogService, REPDB_CATALOG_URL, type CatalogRequest } from '../src/services/exercise-catalog-service';

const bench = {
  id: 'bench', name_en: 'Bench press', equipment: 'barbell',
  primary_muscles: ['pectoralis_major'], secondary_muscles: ['triceps_brachii'],
};

function response(exercises: readonly unknown[]) {
  return { ok: true, async json() { return { schema_version: 3, count: exercises.length, exercises }; } };
}

async function openCatalog(request: CatalogRequest) {
  const catalogService = createExerciseCatalogService(request);
  const app = await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout catalogService={catalogService} /> } });
  await fireEvent.press(await screen.findByRole('button', { name: 'Exercise catalog' }));
  return app;
}

test('the injected HTTP request reaches the real mapper and alphabetized catalog UI', async () => {
  let finish: (value: Awaited<ReturnType<CatalogRequest>>) => void = () => {};
  const pending = new Promise<Awaited<ReturnType<CatalogRequest>>>((resolve) => { finish = resolve; });
  const request = jest.fn(() => pending);
  const app = await openCatalog(request);
  expect(app.getPathname()).toBe('/templates/catalog');
  expect(screen.getByLabelText('Loading exercise catalog')).toBeVisible();
  expect(request).toHaveBeenCalledWith(REPDB_CATALOG_URL);
  await act(async () => finish(response([
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
  await openCatalog(async () => response([{
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
  await openCatalog(async () => response([
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
    ok: true,
    async json() {
      return { schema_version: 3, count: 99, exercises: [{ ...bench, images: null, instructions_en: 42, name_de: false }] };
    },
  }));
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(screen.queryByText('Some exercises couldn’t be loaded')).toBeNull();
});

test('unrecognized upstream muscle values cannot become presentation groups', async () => {
  await openCatalog(async () => response([{
    ...bench, primary_muscles: ['constructor', 'toString', 'new_upstream_muscle'],
    secondary_muscles: ['__proto__'],
  }]));
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(screen.getByText('Primary muscles: Not specified')).toBeVisible();
  expect(screen.queryByText(/^Secondary muscles:/)).toBeNull();
});

const failures: readonly [string, CatalogRequest][] = [
  ['network', async () => { throw new Error('offline'); }],
  ['HTTP', async () => ({ ok: false, async json() { throw new Error('HTTP body must not be decoded'); } })],
  ['JSON', async () => ({ ok: true, async json() { throw new SyntaxError('invalid JSON'); } })],
  ['envelope', async () => ({ ok: true, async json() { return { exercises: [bench] }; } })],
  ['schema', async () => ({ ok: true, async json() { return { schema_version: 4, count: 1, exercises: [bench] }; } })],
  ['no usable exercises', async () => response([{ ...bench, name_en: null }])],
];

test.each(failures)('%s failure is defined, exposes no exercise data, and allows Back without retry', async (_name, failure) => {
  const request = jest.fn(failure);
  const app = await openCatalog(request);
  expect(await screen.findByText('We couldn’t load the exercise catalog.')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
  expect(screen.queryByLabelText('Loading exercise catalog')).toBeNull();
  expect(screen.queryByRole('button', { name: /retry|try again/i })).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(app.getPathname()).toBe('/templates');
  expect(await screen.findByRole('button', { name: /Upper body/ })).toBeVisible();
});

test('the open catalog retains results across tab changes and a new visit loads afresh', async () => {
  const request = jest.fn<ReturnType<CatalogRequest>, Parameters<CatalogRequest>>()
    .mockResolvedValueOnce(response([bench]))
    .mockResolvedValueOnce(response([{ ...bench, name_en: 'New catalog exercise' }]));
  await openCatalog(request);
  expect(await screen.findByText('Bench press')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByText('Bench press')).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
  await testRouter.back('/templates');
  await fireEvent.press(screen.getByRole('button', { name: 'Exercise catalog' }));
  expect(await screen.findByText('New catalog exercise')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
  expect(request).toHaveBeenCalledTimes(2);
});

test('a departed visit cannot overwrite a later visit when its response arrives late', async () => {
  let finishOld: (value: Awaited<ReturnType<CatalogRequest>>) => void = () => {};
  const old = new Promise<Awaited<ReturnType<CatalogRequest>>>((resolve) => { finishOld = resolve; });
  const request = jest.fn<ReturnType<CatalogRequest>, Parameters<CatalogRequest>>()
    .mockReturnValueOnce(old)
    .mockResolvedValueOnce(response([{ ...bench, name_en: 'Current catalog exercise' }]));
  await openCatalog(request);
  await testRouter.back('/templates');
  await fireEvent.press(screen.getByRole('button', { name: 'Exercise catalog' }));
  expect(await screen.findByText('Current catalog exercise')).toBeVisible();
  await act(async () => finishOld(response([bench])));
  expect(screen.getByText('Current catalog exercise')).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
});
