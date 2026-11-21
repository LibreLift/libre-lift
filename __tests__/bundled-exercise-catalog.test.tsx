import { fireEvent, screen, testRouter } from 'expo-router/testing-library';
import { renderLocalRouter } from '../test-support/local-router';

afterEach(() => jest.restoreAllMocks());

test('the default catalog can be searched and inspected without a network connection', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
  const app = await renderLocalRouter({ initialUrl: '/templates' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Exercise catalog' }));
  expect(await screen.findByRole('link', { name: 'Exercise data by RepDB' })).toBeVisible();
  await fireEvent.changeText(await screen.findByRole('search', { name: 'Search exercises' }), 'BARBELL BENCH PRESS');
  await fireEvent.press(screen.getByRole('button', { name: 'Muscle group: All muscles' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
  await fireEvent.press(screen.getByRole('button', { name: /^View Barbell Bench Press\./ }));
  expect(app.getPathname()).toBe('/templates/catalog-exercise');
  expect(screen.getByText('1. Lie flat on a bench with your eyes under the bar.')).toBeVisible();
  await testRouter.back('/templates/catalog');
  expect(screen.getByRole('search', { name: 'Search exercises' })).toHaveDisplayValue('BARBELL BENCH PRESS');
  expect(screen.getByRole('button', { name: 'Muscle group: Chest' })).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

test('both poses use packaged images when browsing and after saving a template', async () => {
  const app = await renderLocalRouter({ initialUrl: '/templates' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Create template' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Paired poses');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.changeText(await screen.findByRole('search', { name: 'Search exercises' }), 'BARBELL BENCH PRESS');
  await fireEvent.press(screen.getByRole('button', { name: /^View Barbell Bench Press\./ }));
  expect(app.getSearchParams().catalogId).toBe('repdb:bench-press');
  await expectBundledPoses();
  await fireEvent.press(screen.getByRole('button', { name: 'Add to template' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 weight (lb)'), '10');
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Bench Press. 1 set' }));
  expect(app.getPathname()).toBe('/templates/exercise');
  expect(screen.getByLabelText('Set 1: 8 reps × 10 lb')).toBeVisible();
  await expectBundledPoses();
});

async function expectBundledPoses() {
  const localSource = [expect.objectContaining({ __packager_asset: true })];
  expect(screen.getByRole('image', { name: 'Barbell Bench Press — Start image' })).toHaveProp('source', localSource);
  await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByRole('image', { name: 'Barbell Bench Press — Peak image' })).toHaveProp('source', localSource);
}
