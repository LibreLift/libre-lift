/// <reference types="node" />

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import type { TemplateContent } from '../src/models/workout';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { createSqliteWorkoutService } from '../src/services/sqlite-workout-service';
import { authenticatedSession } from '../test-support/authenticated-router';

// Jest replaces the native bridge. SQL still runs against a real, disposable database file.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
let directory: string;
let connections: InstanceType<typeof DatabaseSync>[];

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'openfit-sqlite-'));
  connections = [];
});

afterEach(async () => {
  await cleanup();
  for (const connection of connections) connection.close();
  rmSync(directory, { recursive: true, force: true });
});

function service(loseSaveResponse?: () => boolean) {
  return createSqliteWorkoutService(async () => {
    const db = new DatabaseSync(join(directory, 'training.db'));
    connections.push(db);
    return {
      async execAsync(sql) {
        db.exec(sql);
        if (sql === 'COMMIT' && loseSaveResponse?.()) throw new Error('Save response lost after commit');
      },
      async getAllAsync<T>(sql: string, ...params: (string | number)[]) {
        return db.prepare(sql).all(...params) as T[];
      },
      async getFirstAsync<T>(sql: string, ...params: (string | number)[]) {
        return (db.prepare(sql).get(...params) as T | undefined) ?? null;
      },
      async runAsync(sql, ...params) { db.prepare(sql).run(...params); },
      async closeAsync() { db.close(); connections.splice(connections.indexOf(db), 1); },
    };
  }, randomUUID);
}

async function templates(storage = service(), catalogAvailable = true) {
  const catalogService = createExerciseCatalogService(async () => {
    if (!catalogAvailable) throw new Error('Catalog unavailable');
    return { schema_version: 3, exercises: [{
      id: 'press', name_en: 'Catalog press', equipment: 'barbell',
      primary_muscles: ['pectoralis_major'], instructions_en: ['Lower slowly.'],
      images: { flat: { start: 'images/flat/bench-press-start.webp', peak: 'images/flat/bench-press-peak.webp' } },
    }, { id: 'row', name_en: 'Catalog row', equipment: 'dumbbell' }] };
  });
  await renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout
    workoutServiceFactory={() => storage} catalogService={catalogService} initialSession={authenticatedSession} /> } });
}

async function startDraft(title: string) {
  await fireEvent.press(await screen.findByRole('button', { name: 'Create template' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), title);
}

async function addExercise(name: string, placement: number, targets: [string, string][]) {
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^View ${name}`) }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add to template' }));
  await fireEvent.press(screen.getByRole('button', { name: `Sets for exercise ${placement}` }));
  for (const [index, [weight, reps]] of targets.entries()) {
    if (index > 0) await fireEvent.press(screen.getByRole('button', { name: `Add set to exercise ${placement}` }));
    await fireEvent.changeText(screen.getByLabelText(`Exercise ${placement} set ${index + 1} weight (lb)`), weight);
    await fireEvent.changeText(screen.getByLabelText(`Exercise ${placement} set ${index + 1} reps`), reps);
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
}

test('opens a complete saved template after closing the app and reopening the database', async () => {
  const storage = service();
  await templates(storage);
  expect(await screen.findByText('No templates yet.')).toBeVisible();
  await startDraft('Gym plan');
  await fireEvent.changeText(screen.getByLabelText('Template description'), 'First day');
  await addExercise('Catalog press', 1, [['12.5', '8'], ['15', '6']]);
  await addExercise('Catalog row', 2, [['20', '5']]);
  await addExercise('Catalog press', 3, [['0', '12']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  const [saved] = await storage.listTemplates();
  expect(new Set(saved.exercises.map(exercise => exercise.id)).size).toBe(3);

  await testRouter.back('/templates');
  await startDraft('Another plan');
  await addExercise('Catalog press', 1, [['0', '5']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });

  await cleanup();
  for (const connection of connections.splice(0)) connection.close();
  const reopened = service();
  await templates(reopened, false);
  expect((await reopened.listTemplates()).map(template => template.title)).toEqual(['Gym plan', 'Another plan']);
  await fireEvent.press(await screen.findByRole('button', { name: /Gym plan.*3 exercises · 4 sets/ }));
  expect(await screen.findByText('First day')).toBeVisible();
  expect(screen.getAllByRole('button', { name: /^Catalog (press|row)\. \d sets?$/ })
    .map(button => button.props.accessibilityLabel)).toEqual([
    'Catalog press. 2 sets', 'Catalog row. 1 set', 'Catalog press. 1 set',
  ]);
  await fireEvent.press(screen.getByRole('button', { name: 'Catalog press. 2 sets' }));
  expect(await screen.findByLabelText('Set 1: 8 reps × 12.5 lb')).toBeVisible();
  expect(screen.getByLabelText('Set 2: 6 reps × 15 lb')).toBeVisible();
  const packagedImage = [expect.objectContaining({ __packager_asset: true })];
  expect(screen.getByRole('image', { name: 'Catalog press — Start image' })).toHaveProp('source', packagedImage);
  await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByRole('image', { name: 'Catalog press — Peak image' })).toHaveProp('source', packagedImage);
  expect(await reopened.getTemplate(saved.id)).toEqual(saved);
});


test.each([false, true])('retries a lost save response with the same identity (edited draft: %s)', async (edited) => {
  let loseResponse = false;
  const storage = service(() => {
    const lose = loseResponse;
    loseResponse = false;
    return lose;
  });
  await templates(storage);
  await startDraft('Retry plan');
  await addExercise('Catalog press', 1, [['12.5', '8']]);

  loseResponse = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry save' });
  expect(screen.getByLabelText('Template title')).toHaveDisplayValue('Retry plan');
  const committed = await storage.listTemplates();
  expect(committed).toHaveLength(1);
  const title = edited ? 'Corrected plan' : 'Retry plan';
  if (edited) await fireEvent.changeText(screen.getByLabelText('Template title'), title);

  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  expect(await storage.listTemplates()).toEqual([{ ...committed[0], title }]);
});

test('rolls back the complete save when SQLite rejects the creation receipt', async () => {
  const storage = service();
  await templates(storage);
  expect(await screen.findByText('No templates yet.')).toBeVisible();
  await startDraft('Atomic plan');
  await addExercise('Catalog press', 1, [['0', '12'], ['20', '6']]);

  // Fail after the aggregate has been written, before the transaction can commit.
  const fixture = new DatabaseSync(join(directory, 'training.db'));
  try {
    fixture.exec(`CREATE TRIGGER fail_receipt BEFORE INSERT ON template_save_receipts
      BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;`);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Retry save' });
    expect(await service().listTemplates()).toEqual([]);
    fixture.exec('DROP TRIGGER fail_receipt');
  } finally {
    fixture.close();
  }

  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Catalog press. 2 sets' }));
  expect(await screen.findByLabelText('Set 1: 12 reps × 0 lb')).toBeVisible();
  expect(screen.getByLabelText('Set 2: 6 reps × 20 lb')).toBeVisible();
  expect(await service().listTemplates()).toHaveLength(1);
});

test('cancels a draft and durably saves reordered and replaced exercises in the existing list position', async () => {
  const storage = service();
  await templates(storage);
  await startDraft('Original plan');
  await addExercise('Catalog press', 1, [['12.5', '8'], ['15', '6']]);
  await addExercise('Catalog row', 2, [['20', '5']]);
  await addExercise('Catalog press', 3, [['0', '12']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  const [original] = await storage.listTemplates();
  await storage.createTemplate({ ...original, title: 'Another plan' });

  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Discarded title');
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 3 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText('Original plan')).toBeVisible();
  expect(await storage.getTemplate(original.id)).toEqual(original);

  await fireEvent.press(screen.getByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Edited plan');
  await fireEvent.changeText(screen.getByLabelText('Template description'), 'Second day');
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 3 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 2 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove exercise 3' }));
  await addExercise('Catalog row', 3, [['25', '10']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });

  await cleanup();
  for (const connection of connections.splice(0)) connection.close();
  const reopened = service();
  await templates(reopened, false);
  const [edited, other] = await reopened.listTemplates();
  expect(edited).toMatchObject({
    id: original.id, createdAt: original.createdAt, title: 'Edited plan', description: 'Second day',
    exercises: [original.exercises[2], original.exercises[0], {
      name: 'Catalog row', sets: [{ setNumber: 1, targetWeight: 25, targetReps: 10 }],
    }],
  });
  expect(edited.exercises[2].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(original.exercises.map(exercise => exercise.id)).not.toContain(edited.exercises[2].id);
  expect(other.title).toBe('Another plan');
  await fireEvent.press(await screen.findByRole('button', { name: /Edited plan.*3 exercises · 4 sets/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Catalog press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 12 reps × 0 lb')).toBeVisible();
});

test('replays a metadata save after a lost response without reverting a newer whole-template edit', async () => {
  let loseResponse = false;
  const storage = service(() => {
    const lose = loseResponse;
    loseResponse = false;
    return lose;
  });
  await templates(storage);
  await startDraft('Original plan');
  await addExercise('Catalog press', 1, [['12.5', '8']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  const [original] = await storage.listTemplates();
  const context = {};
  const details = { title: '  Renamed plan  ', description: 'Saved description' };

  loseResponse = true;
  await expect(storage.updateTemplateDetails(original.id, details, context)).rejects.toThrow('Save response lost after commit');
  const renamed = { ...original, title: 'Renamed plan', description: 'Saved description' };
  expect(await storage.getTemplate(original.id)).toEqual(renamed);

  const other = service();
  const newer = await other.updateTemplate(original.id, {
    ...renamed, title: 'Latest plan', exercises: [{
      ...original.exercises[0], sets: [{ setNumber: 1, targetWeight: 25, targetReps: 6 }],
    }],
  });
  expect(await storage.updateTemplateDetails(original.id, details, context)).toEqual(renamed);
  expect(await other.getTemplate(original.id)).toEqual(newer);

  await cleanup();
  await templates(service(), false);
  await fireEvent.press(await screen.findByRole('button', { name: /^Latest plan/ }));
  expect(await screen.findByText('Saved description')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Catalog press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 6 reps × 25 lb')).toBeVisible();
});

test('retains details after a lost delete response and retries without restoring a deleted template', async () => {
  let loseResponse = false;
  const storage = service(() => {
    const lose = loseResponse;
    loseResponse = false;
    return lose;
  });
  const creation = {};
  const content: TemplateContent = {
    title: 'Saved plan', description: '',
    exercises: [{
      id: 'draft-press', catalogId: 'repdb:press', name: 'Saved press', primaryMuscles: [], secondaryMuscles: [],
      equipment: { kind: 'none' }, sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }],
    }],
  };
  const saved = await storage.createTemplate(content, creation);
  const edit = {};
  const changes = { ...saved, title: 'Edited plan' };
  await storage.updateTemplate(saved.id, changes, edit);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    await templates(storage);
    await fireEvent.press(await screen.findByRole('button', { name: /^Edited plan/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete template' }));
    expect(alert).toHaveBeenLastCalledWith('Delete template?', 'Delete “Edited plan”?', expect.any(Array));
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Cancel')?.onPress?.());
    expect(await storage.getTemplate(saved.id)).toEqual(changes);

    loseResponse = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Delete')?.onPress?.());
    await screen.findByRole('button', { name: 'Retry delete' });
    expect(screen.getByText('Edited plan')).toBeVisible();
    expect(await service().getTemplate(saved.id)).toBeNull();
    await expect(storage.updateTemplate(saved.id, changes, edit)).rejects.toThrow('couldn’t be found');
    await expect(storage.updateTemplate(saved.id, { ...changes, title: 'Stale draft' })).rejects.toThrow('couldn’t be found');
    await expect(storage.updateTemplateDetails(saved.id, changes)).rejects.toThrow('couldn’t be found');
    await expect(storage.createTemplate(content, creation)).rejects.toThrow('couldn’t be found');

    await fireEvent.press(screen.getByRole('button', { name: 'Retry delete' }));
    await act(async () => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Delete')?.onPress?.());
    expect(await screen.findByText('No templates yet.')).toBeVisible();
    await cleanup();
    for (const connection of connections.splice(0)) connection.close();
    await templates(service());
    expect(await screen.findByText('No templates yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create template' })).toBeEnabled();
  } finally {
    alert.mockRestore();
  }
});

test('keeps the previous template intact when an edit receipt fails and retains the draft for retry', async () => {
  const storage = service();
  await templates(storage);
  await startDraft('Original plan');
  await addExercise('Catalog press', 1, [['12.5', '8']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  const [original] = await storage.listTemplates();
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Edited plan');
  await addExercise('Catalog row', 2, [['25', '6']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Move exercise 2 up' }));

  const fixture = new DatabaseSync(join(directory, 'training.db'));
  try {
    fixture.exec(`CREATE TRIGGER fail_receipt BEFORE INSERT ON template_save_receipts
      BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;`);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Retry save' });
    expect(await service().getTemplate(original.id)).toEqual(original);
    expect(screen.getByLabelText('Template title')).toHaveDisplayValue('Edited plan');
    expect(screen.getByText('Catalog row')).toBeVisible();
  } finally {
    fixture.exec('DROP TRIGGER IF EXISTS fail_receipt');
    fixture.close();
  }

  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  expect(await screen.findByText('Edited plan')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Catalog row. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 6 reps × 25 lb')).toBeVisible();
});

test('recovers a lost whole-template save in the editor without overwriting a newer save', async () => {
  let loseResponse = false;
  const storage = service(() => {
    const lose = loseResponse;
    loseResponse = false;
    return lose;
  });
  await templates(storage);
  await startDraft('Original plan');
  await addExercise('Catalog press', 1, [['12.5', '8']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  const [original] = await storage.listTemplates();
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'First edit');
  await addExercise('Catalog row', 2, [['25', '6']]);

  loseResponse = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry save' });
  expect(screen.getByLabelText('Template title')).toHaveDisplayValue('First edit');
  const [committed] = await service().listTemplates();
  expect(committed).toMatchObject({
    id: original.id, title: 'First edit',
    exercises: [original.exercises[0], { name: 'Catalog row' }],
  });
  const other = service();
  const newer = await other.updateTemplate(original.id, { ...original, title: 'Newer edit' });
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  expect(await screen.findByText('Newer edit')).toBeVisible();
  expect(screen.queryByText('Catalog row')).toBeNull();
  expect(await service().getTemplate(original.id)).toEqual(newer);
});
