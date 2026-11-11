import { Alert } from 'react-native';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import type { WorkoutService } from '../src/services/workout-service';

afterEach(() => jest.restoreAllMocks());

test('inline template edits save to both detail and list, while Cancel discards changes', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  expect(screen.getByText('Bench press')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Push and pull');
  await fireEvent.changeText(screen.getByLabelText('Template description'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Push and pull')).toBeVisible();
  expect(screen.queryByLabelText('Template title')).toBeNull();
  await testRouter.back('/templates');
  await fireEvent.press(await screen.findByRole('button', { name: /Push and pull/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Discard me');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Push and pull')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  expect(screen.getByDisplayValue('Push and pull')).toBeVisible();
});

test('drafts survive tab changes and Back requires an explicit discard choice', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter('./app');
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'My draft');
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(screen.getByDisplayValue('My draft')).toBeVisible();
  await testRouter.back();
  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(app.getPathname()).toBe('/templates/upper-body');
  expect(alert.mock.calls.at(-1)?.[2]?.map((button) => button.text)).toEqual([
    'Keep editing',
    'Discard changes',
  ]);
  await act(async () =>
    alert.mock.calls
      .at(-1)?.[2]
      ?.find((button) => button.text === 'Keep editing')
      ?.onPress?.(),
  );
  expect(screen.getByDisplayValue('My draft')).toBeVisible();
  await testRouter.back();
  await act(async () =>
    alert.mock.calls
      .at(-1)?.[2]
      ?.find((button) => button.text === 'Discard changes')
      ?.onPress?.(),
  );
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  await fireEvent.press(screen.getByRole('button', { name: /Upper body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  expect(screen.getByDisplayValue('Upper body')).toBeVisible();
});

test('saving locks fields and all navigation, then a failed save restores the draft for retry', async () => {
  const storage = createSampleWorkoutService();
  let rejectSave: (cause: Error) => void = () => {};
  const pending = new Promise<void>((_, reject) => {
    rejectSave = reject;
  });
  let first = true;
  const service: WorkoutService = {
    ...storage,
    async updateTemplateDetails(id, details) {
      if (first) {
        first = false;
        await pending;
      }
      return storage.updateTemplateDetails(id, details);
    },
  };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter({
    appDir: './app',
    overrides: { _layout: () => <RootLayout service={service} /> },
  });
  await fireEvent.press(await screen.findByRole('button', { name: /Upper body/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Retry this title');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByLabelText('Template title')).toBeDisabled();
  expect(screen.getByLabelText('Template description')).toBeDisabled();
  const workouts = screen.getByRole('button', { name: /^Workouts, tab/ });
  expect(workouts).toBeDisabled();
  await fireEvent.press(workouts);
  await testRouter.back();
  expect(app.getPathname()).toBe('/templates/upper-body');
  expect(alert).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Saving…' }));
  expect((await storage.getTemplate('upper-body'))?.title).toBe('Upper body');
  await act(async () => rejectSave(new Error('Offline')));
  expect(await screen.findByText('Your changes couldn’t be saved. Please try again.')).toBeVisible();
  expect(screen.getByDisplayValue('Retry this title')).toBeVisible();
  expect(screen.getByRole('button', { name: /^Workouts, tab/ })).toBeEnabled();
  expect(screen.getByLabelText('Template title')).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  expect(await screen.findByText('Retry this title')).toBeVisible();
  await testRouter.back('/templates');
  expect(await screen.findByRole('button', { name: /Retry this title/ })).toBeVisible();
});
