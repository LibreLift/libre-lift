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

test('full updates validate atomically and isolate saved templates from callers and history', async () => {
  const service = createSampleWorkoutService();
  const original = (await service.listTemplates())[0];
  const history = await service.listSessions();
  await expect(service.updateTemplate(original.id, { ...original, exercises: [] })).rejects.toThrow('Add at least one exercise');
  await expect(service.updateTemplate(original.id, { ...original, exercises: [{ ...original.exercises[0], sets: [] }] })).rejects.toThrow('Add at least one set');
  for (const targets of [
    { targetWeight: NaN, targetReps: 8 }, { targetWeight: Infinity, targetReps: 8 },
    { targetWeight: -1, targetReps: 8 }, { targetWeight: 0, targetReps: 0 },
    { targetWeight: 0, targetReps: 1.5 },
  ]) {
    await expect(service.updateTemplate(original.id, { ...original, exercises: [{ ...original.exercises[0],
      sets: [{ setNumber: 1, ...targets }],
    }] })).rejects.toThrow();
  }
  expect(await service.getTemplate(original.id)).toEqual(original);
  const content = { ...original, title: '  New name  ', exercises: [{ ...original.exercises[0],
    sets: [{ setNumber: 9, targetWeight: 0.5, targetReps: 12 }],
  }] };
  const saved = await service.updateTemplate(original.id, content);
  expect(saved.title).toBe('New name');
  expect(saved.exercises[0].sets).toEqual([{ setNumber: 1, targetWeight: 0.5, targetReps: 12 }]);
  content.exercises[0].sets[0].targetWeight = 900;
  Object.assign(saved.exercises[0], { name: 'Mutated' });
  Object.assign((await service.listTemplates())[0].exercises[0].sets[0], { targetReps: 999 });
  expect((await service.getTemplate(original.id))?.exercises[0]).toMatchObject({ name: 'Bench press', sets: [{ targetWeight: 0.5, targetReps: 12 }] });
  expect(await service.listSessions()).toEqual(history);
  await expect(service.updateTemplate('missing', content)).rejects.toThrow('couldn’t be found');
});

test('creation appends unique templates with duplicate names and resets in a fresh session', async () => {
  const service = createSampleWorkoutService();
  const sample = (await service.listTemplates())[0];
  await expect(service.createTemplate({ ...sample, exercises: [] })).rejects.toThrow();
  const first = await service.createTemplate(sample);
  const second = await service.createTemplate(sample);
  expect(first.id).not.toBe(sample.id);
  expect(second.id).not.toBe(first.id);
  Object.assign(first.exercises[0].sets[0], { targetWeight: 999 });
  expect((await service.getTemplate(first.id))?.exercises[0].sets[0].targetWeight).toBe(95);
  expect((await service.listTemplates()).map((template) => template.id)).toEqual(['upper-body', 'lower-body', first.id, second.id]);
  expect(await createSampleWorkoutService().listTemplates()).toHaveLength(2);
});

test('deletion removes only the requested template, rejects missing IDs, and preserves history', async () => {
  const service = createSampleWorkoutService();
  const history = await service.listSessions();
  await service.deleteTemplate('upper-body');
  expect(await service.getTemplate('upper-body')).toBeNull();
  expect((await service.listTemplates()).map((template) => template.id)).toEqual(['lower-body']);
  await expect(service.deleteTemplate('upper-body')).rejects.toThrow('couldn’t be found');
  expect(await service.listSessions()).toEqual(history);
  expect(await createSampleWorkoutService().listTemplates()).toHaveLength(2);
});
