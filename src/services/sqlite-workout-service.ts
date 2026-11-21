import { validateTemplate, type TemplateContent, type WorkoutTemplate } from '../models/workout';
import { createLocalDatabase, type LocalSqliteConnection } from './local-database';
import { createSampleWorkoutService } from './sample-workout-service';
import type { TemplateSaveContext, WorkoutService } from './workout-service';

interface TemplateRow {
  id: string;
  created_at: string;
  content: string;
}

interface Creation {
  id: string;
  placements: Map<string, string>;
  operation?: { id: string; content: string };
}

function readTemplate(row: TemplateRow): WorkoutTemplate {
  const content: TemplateContent = JSON.parse(row.content);
  return { ...content, id: row.id, createdAt: row.created_at };
}

function findTemplate(db: LocalSqliteConnection, id: string) {
  return db.getFirstAsync<TemplateRow>('SELECT id, created_at, content FROM workout_templates WHERE id = ?', id);
}

export function createSqliteWorkoutService(
  openConnection: () => Promise<LocalSqliteConnection>,
  newId: () => string,
): WorkoutService {
  const database = createLocalDatabase(openConnection);
  const samples = createSampleWorkoutService();
  const creations = new WeakMap<TemplateSaveContext, Creation>();

  async function unavailable(): Promise<never> {
    throw new Error('Changing a saved local template is not available yet.');
  }

  return {
    listTemplates() {
      return database.read(async db => {
        const rows = await db.getAllAsync<TemplateRow>(
          'SELECT id, created_at, content FROM workout_templates ORDER BY sequence');
        return rows.map(readTemplate);
      });
    },
    getTemplate(id) {
      return database.read(async db => {
        const row = await findTemplate(db, id);
        return row ? readTemplate(row) : null;
      });
    },
    async createTemplate(content, context = {}) {
      const validated = validateTemplate(content);
      let creation = creations.get(context);
      if (!creation) {
        creation = { id: newId(), placements: new Map() };
        creations.set(context, creation);
      }
      const { id, placements } = creation;
      const exercises = validated.exercises.map(exercise => {
        const savedId = placements.get(exercise.id) ?? newId();
        placements.set(exercise.id, savedId);
        return { ...exercise, id: savedId };
      });
      const payload = JSON.stringify({ ...validated, exercises });
      if (creation.operation?.content !== payload) creation.operation = { id: newId(), content: payload };
      const operationId = creation.operation.id;

      return database.write(async db => {
        const existing = await findTemplate(db, id);
        const receipt = await db.getFirstAsync<{ content: string }>(
          'SELECT content FROM template_creation_receipts WHERE template_id = ? AND operation_id = ?', id, operationId);
        if (receipt && existing) return readTemplate({ ...existing, content: receipt.content });

        // Keep the receipts when a template is deleted so a late create retry cannot restore it.
        if (!existing && await db.getFirstAsync(
          'SELECT 1 FROM template_creation_receipts WHERE template_id = ? LIMIT 1', id)) {
          throw new Error('This template couldn’t be found.');
        }
        const createdAt = existing?.created_at ?? new Date().toISOString();
        await db.runAsync(`INSERT INTO workout_templates (id, created_at, content) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET content = excluded.content`, id, createdAt, payload);
        await db.runAsync(`INSERT INTO template_creation_receipts (operation_id, template_id, content)
          VALUES (?, ?, ?)`, operationId, id, payload);
        return readTemplate({ id, created_at: createdAt, content: payload });
      });
    },
    updateTemplate: unavailable,
    updateTemplateDetails: unavailable,
    deleteTemplate: unavailable,
    listSessions: samples.listSessions,
    getSession: samples.getSession,
  };
}
