import type { PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { sampleWorkoutService } from '../src/services/sample-workout-service';
import { WorkoutServiceContext, useTemplatesViewModel } from '../src/viewmodels/workouts';

test('template summaries count all sets and handle zero, singular, and plural counts', async () => {
  const [sample] = await sampleWorkoutService.listTemplates();
  const service = {
    ...sampleWorkoutService,
    async listTemplates() {
      return [
        { ...sample, id: 'empty', exercises: [] },
        {
          ...sample,
          id: 'single',
          exercises: [{ ...sample.exercises[0], sets: [sample.exercises[0].sets[0]] }],
        },
        sample,
      ];
    },
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <WorkoutServiceContext.Provider value={service}>{children}</WorkoutServiceContext.Provider>
  );
  const { result } = await renderHook(useTemplatesViewModel, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe('ready'));
  expect(result.current.state).toMatchObject({
    status: 'ready',
    data: [
      { summary: '0 exercises · 0 sets' },
      { summary: '1 exercise · 1 set' },
      { summary: '2 exercises · 5 sets' },
    ],
  });
});
