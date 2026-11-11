import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import type { WorkoutService } from '../src/services/workout-service';
import { WorkoutProvider } from '../src/viewmodels/workout-provider';
import { useTemplateEditorViewModel } from '../src/viewmodels/template-editor';
import { useTemplatesViewModel } from '../src/viewmodels/workouts';

test('a failed edit keeps the draft for retry and a successful save refreshes list and detail', async () => {
  const storage = createSampleWorkoutService();
  let fail = true;
  const service: WorkoutService = {
    ...storage,
    async updateTemplateDetails(id, details) {
      if (fail) {
        fail = false;
        throw new Error('Offline');
      }
      return storage.updateTemplateDetails(id, details);
    },
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <WorkoutProvider service={service}>{children}</WorkoutProvider>
  );
  const { result } = await renderHook(
    () => ({
      editor: useTemplateEditorViewModel('upper-body'),
      list: useTemplatesViewModel(),
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.editor.state.status).toBe('ready'));
  await act(async () => result.current.editor.startEditing());
  await act(async () => result.current.editor.change('title', 'Push and pull'));
  await act(async () => result.current.editor.save());
  expect(result.current.editor.error).toMatch(/couldn’t be saved/);
  expect(result.current.editor.draft?.title).toBe('Push and pull');
  expect((await storage.getTemplate('upper-body'))?.title).toBe('Upper body');
  await act(async () => result.current.editor.save());
  await waitFor(() =>
    expect(result.current.editor.state).toMatchObject({ status: 'ready', data: { title: 'Push and pull' } }),
  );
  expect(result.current.editor.draft).toBeNull();
  await waitFor(() =>
    expect(result.current.list.state).toMatchObject({
      status: 'ready',
      data: [{ title: 'Push and pull' }, { title: 'Lower body' }],
    }),
  );
});
