import { createSampleWorkoutService } from '../src/services/sample-workout-service';

test('saved template details are read consistently without changing exercise targets or history', async () => {
  const service = createSampleWorkoutService();
  const original = await service.getTemplate('upper-body');
  const history = await service.listSessions();
  const updated = await service.updateTemplateDetails('upper-body', {
    title: 'Push and pull',
    description: '',
  });
  expect(updated).toEqual({ ...original, title: 'Push and pull', description: '' });
  expect(await service.getTemplate('upper-body')).toEqual(updated);
  expect((await service.listTemplates())[0]).toEqual(updated);
  expect(await service.listSessions()).toEqual(history);
  expect((await createSampleWorkoutService().getTemplate('upper-body'))?.title).toBe('Upper body');
});

test('a blank title cannot replace saved template details', async () => {
  const service = createSampleWorkoutService();
  await expect(
    service.updateTemplateDetails('upper-body', { title: '  ', description: 'Changed' }),
  ).rejects.toThrow('Enter a title');
  expect((await service.getTemplate('upper-body'))?.title).toBe('Upper body');
});
