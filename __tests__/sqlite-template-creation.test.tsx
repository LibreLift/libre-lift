/// <reference types="node" />

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cleanup, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
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
    fixture.exec(`CREATE TRIGGER fail_receipt BEFORE INSERT ON template_creation_receipts
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
