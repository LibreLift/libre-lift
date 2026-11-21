/// <reference types="node" />

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID as mockRandomUUID } from 'node:crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import type { TemplateContent } from '../src/models/workout';
import { createExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { createLocalDatabase } from '../src/services/local-database';
import { createSqliteWorkoutService } from '../src/services/sqlite-workout-service';
import { namedDisplayStore } from '../test-support/local-router';

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn((name: string) => mockOpenDatabase(name)),
}));

// Jest replaces the native bridge. SQL still runs against a real, disposable database file.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
let directory: string;
let connections: InstanceType<typeof DatabaseSync>[];
let beforeWrite: (() => Promise<void>) | undefined;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'openfit-sqlite-'));
  connections = [];
  beforeWrite = undefined;
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  for (const connection of connections) connection.close();
  rmSync(directory, { recursive: true, force: true });
});

async function mockOpenDatabase(name: string, loseSaveResponse?: () => boolean, beforeRead?: (sql: string) => void) {
  const db = new DatabaseSync(join(directory, name));
  connections.push(db);
  return {
    async execAsync(sql: string) {
      db.exec(sql);
      if (sql === 'COMMIT' && loseSaveResponse?.()) throw new Error('Save response lost after commit');
    },
    async getAllAsync<T>(sql: string, ...params: (string | number)[]) {
      beforeRead?.(sql);
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number)[]) {
      beforeRead?.(sql);
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async runAsync(sql: string, ...params: (string | number)[]) {
      if (beforeWrite) await beforeWrite();
      db.prepare(sql).run(...params);
    },
    async closeAsync() { db.close(); connections.splice(connections.indexOf(db), 1); },
  };
}

function service(loseSaveResponse?: () => boolean, beforeRead?: (sql: string) => void) {
  const database = createLocalDatabase(() => mockOpenDatabase('training.db', loseSaveResponse, beforeRead));
  return createSqliteWorkoutService(database, mockRandomUUID);
}

test('requires a local name, then saves and reopens a template with the bundled catalog and no fetch', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
  await renderRouter('./app', { initialUrl: '/workouts' });
  expect(await screen.findByText('Training data is stored on this device. Backup is unavailable.')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
  expect(screen.queryByText('Training data is stored on this device. Backup is unavailable.')).toBeNull();
  const name = await screen.findByLabelText('Display name');
  expect(screen.queryByRole('button', { name: /^Workouts, tab/ })).toBeNull();
  await fireEvent.changeText(name, '   ');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a display name.');

  await fireEvent.changeText(name, '  Alex  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Hi, Alex!')).toBeVisible();
  expect(await screen.findByText('No templates yet.')).toBeVisible();
  await startDraft('Offline plan');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.changeText(await screen.findByRole('search', { name: 'Search exercises' }), 'Barbell bench press');
  await fireEvent.press(screen.getByRole('button', { name: /^View Barbell Bench Press\./ }));
  expect(screen.getByRole('image', { name: 'Barbell Bench Press — Start image' })).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByRole('image', { name: 'Barbell Bench Press — Peak image' })).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Add to template' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sets for exercise 1' }));
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 weight (lb)'), '25');
  await fireEvent.changeText(screen.getByLabelText('Exercise 1 set 1 reps'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  expect(await screen.findByText('Sample workout history')).toBeVisible();

  await cleanup();
  for (const connection of connections.splice(0)) connection.close();
  const app = await renderRouter('./app');
  expect(await screen.findByText('Hi, Alex!')).toBeVisible();
  expect(app.getPathname()).toBe('/templates');
  await fireEvent.press(await screen.findByRole('button', { name: /^Offline plan/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Revised plan');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Revised plan')).toBeVisible();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await act(async () => alert.mock.lastCall?.[2]?.find(button => button.text === 'Delete')?.onPress?.());
  expect(await screen.findByText('No templates yet.')).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

test('a failed SQLite open gates a direct training link until the user retries', async () => {
  jest.mocked(openDatabaseAsync).mockRejectedValueOnce(new Error('Database unavailable'));
  await renderRouter('./app', { initialUrl: '/workouts' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Your local data couldn’t be opened. Please try again.');
  expect(screen.queryByLabelText('Display name')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Workouts, tab/ })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Got it' }));
  expect(await screen.findByLabelText('Display name')).toBeVisible();
});

test('a failed SQLite display-name save retains the input and gates Templates until retry succeeds', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByRole('button', { name: 'Got it' }));
  const name = await screen.findByLabelText('Display name');
  await fireEvent.changeText(name, '  Alex Rivera  ');
  let rejectWrite!: (error: Error) => void;
  const pendingWrite = new Promise<void>((_resolve, reject) => { rejectWrite = reject; });
  beforeWrite = () => pendingWrite;
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByLabelText('Display name')).toBeDisabled();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await act(() => rejectWrite(new Error('Database write unavailable')));
  beforeWrite = undefined;
  expect(await screen.findByRole('alert')).toHaveTextContent('Your display name couldn’t be saved. Please try again.');
  expect(screen.getByLabelText('Display name')).toHaveDisplayValue('  Alex Rivera  ');
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Hi, Alex Rivera!')).toBeVisible();
});

test('an earlier SQLite database keeps its template through onboarding, a rename, and relaunch', async () => {
  const previous = new DatabaseSync(join(directory, 'open-fit.db'));
  try {
    previous.exec(`
      CREATE TABLE workout_templates (
        sequence INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, content TEXT NOT NULL
      );
      CREATE TABLE template_save_receipts (operation_id TEXT PRIMARY KEY NOT NULL, template_id TEXT NOT NULL, content TEXT NOT NULL);
      CREATE INDEX template_creation_receipts_template ON template_save_receipts (template_id);
      PRAGMA user_version = 2;
    `);
    previous.prepare('INSERT INTO workout_templates (id, created_at, content) VALUES (?, ?, ?)').run(
      '10000000-0000-4000-8000-000000000001', '2026-11-19T00:00:00.000Z', JSON.stringify({
        title: 'Earlier plan', description: 'Saved in schema version 2',
        exercises: [{
          id: '20000000-0000-4000-8000-000000000001', catalogId: 'repdb:press', name: 'Saved press',
          primaryMuscles: [], secondaryMuscles: [], equipment: { kind: 'none' },
          sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }],
        }],
      }),
    );
  } finally {
    previous.close();
  }

  await renderRouter('./app');
  await fireEvent.press(await screen.findByRole('button', { name: 'Got it' }));
  const name = await screen.findByLabelText('Display name');
  await fireEvent.changeText(name, 'Alex');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('button', { name: /^Earlier plan/ })).toBeVisible();

  await fireEvent.press(screen.getByRole('button', { name: /^Settings, tab/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  expect(screen.getByLabelText('Display name')).toHaveDisplayValue('Alex');
  await fireEvent.changeText(screen.getByLabelText('Display name'), 'Discard me');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  expect(screen.getByLabelText('Display name')).toHaveDisplayValue('Alex');
  await fireEvent.changeText(screen.getByLabelText('Display name'), ' Blair ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Blair')).toBeVisible();
  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: /^Templates, tab/ }));
  expect(await screen.findByText('Hi, Blair!')).toBeVisible();

  await cleanup();
  for (const connection of connections.splice(0)) connection.close();
  await renderRouter('./app');
  expect(await screen.findByText('Hi, Blair!')).toBeVisible();
  await fireEvent.press(await screen.findByRole('button', { name: /^Earlier plan/ }));
  expect(await screen.findByText('Saved in schema version 2')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Saved press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 8 reps × 12.5 lb')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /^Settings, tab/ }));
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
});

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
    workoutServiceFactory={() => storage} catalogService={catalogService} displayNameStore={namedDisplayStore} /> } });
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
  let failList = true;
  const reopened = service(undefined, sql => {
    if (!failList || !sql.includes('ORDER BY sequence')) return;
    failList = false;
    throw new Error('Template list unavailable');
  });
  await templates(reopened, false);
  expect(await screen.findByText('We couldn’t load this. Please try again.')).toBeVisible();
  expect(screen.queryByText('No templates yet.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: /^Another plan/ })).toBeVisible();
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

test('Cancel after a lost creation response gives the next draft its own saved template', async () => {
  let loseResponse = false;
  await templates(service(() => {
    const lose = loseResponse;
    loseResponse = false;
    return lose;
  }));
  await startDraft('First plan');
  await addExercise('Catalog press', 1, [['12.5', '8']]);
  loseResponse = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Retry save' });
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

  await startDraft('Second plan');
  await addExercise('Catalog press', 1, [['25', '6']]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit template details' });

  await cleanup();
  await templates(service());
  await fireEvent.press(await screen.findByRole('button', { name: /^First plan/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Catalog press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 8 reps × 12.5 lb')).toBeVisible();
  await testRouter.back();
  await testRouter.back('/templates');
  await fireEvent.press(await screen.findByRole('button', { name: /^Second plan/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Catalog press. 1 set' }));
  expect(await screen.findByLabelText('Set 1: 6 reps × 25 lb')).toBeVisible();
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
    await testRouter.navigate(`/templates/${saved.id}`);
    expect(await screen.findByText('This template couldn’t be found.')).toBeVisible();
  } finally {
    alert.mockRestore();
  }
});

test('retries a rolled-back edit and separately recovers a failed reload after the save', async () => {
  let failReloadAfterCommit = false;
  let failReload = false;
  const storage = service(() => {
    failReload = failReloadAfterCommit;
    return false;
  }, sql => {
    if (!failReload || !sql.includes('FROM workout_templates WHERE id =')) return;
    failReload = false;
    throw new Error('Template detail unavailable');
  });
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

  failReloadAfterCommit = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  expect(await screen.findByText('We couldn’t load this. Please try again.')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Edited plan')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull();
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
