import { validateTemplate, type TemplateContent, type TemplateDetails, type WorkoutTemplate } from '../models/workout';
import type { createLocalDatabase, LocalSqliteConnection } from './local-database';
import { createSampleWorkoutService } from './sample-workout-service';
import type { TemplateSaveContext, WorkoutService } from './workout-service';

interface TemplateRow {
  id: string;
  created_at: string;
  content: string;
}

interface SaveDraft {
  id: string;
  mode: 'create' | 'update';
  placements: Map<string, string>;
  operation?: { id: string; content: string };
  metadataExercises?: TemplateContent['exercises'];
}

type TemplateSave =
  | { mode: 'create'; content: TemplateContent }
  | { mode: 'update'; id: string; content: TemplateContent }
  | { mode: 'update'; id: string; details: TemplateDetails };

const savedIdentity = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readTemplate(row: TemplateRow): WorkoutTemplate {
  const content: TemplateContent = JSON.parse(row.content);
  return { ...content, id: row.id, createdAt: row.created_at };
}

function findTemplate(db: LocalSqliteConnection, id: string) {
  return db.getFirstAsync<TemplateRow>('SELECT id, created_at, content FROM workout_templates WHERE id = ?', id);
}

export function createSqliteWorkoutService(
  database: ReturnType<typeof createLocalDatabase>,
  newId: () => string,
): WorkoutService {
  const samples = createSampleWorkoutService();
  const drafts = new WeakMap<TemplateSaveContext, SaveDraft>();

  function save(change: TemplateSave, context: TemplateSaveContext) {
    const { mode } = change;

    return database.write(async db => {
      let draft = drafts.get(context);
      if (!draft) {
        draft = { id: mode === 'create' ? newId() : change.id, mode, placements: new Map() };
        drafts.set(context, draft);
      }
      if (draft.mode !== mode || (mode === 'update' && draft.id !== change.id)) {
        throw new Error('This draft belongs to another template.');
      }
      const { id, placements } = draft;
      const existing = await findTemplate(db, id);
      if (!existing && (mode === 'update' || await db.getFirstAsync(
        'SELECT 1 FROM template_save_receipts WHERE template_id = ? LIMIT 1', id))) {
        // A committed draft can never restore a template after deletion.
        throw new Error('This template couldn’t be found.');
      }

      let content: TemplateContent;
      if ('details' in change && existing) {
        // Reuse the original exercises on retry so an intervening edit cannot change the receipt lookup.
        draft.metadataExercises ??= readTemplate(existing).exercises;
        const { title, description } = change.details;
        content = { title, description, exercises: draft.metadataExercises };
      } else if ('content' in change) {
        content = change.content;
      } else {
        throw new Error('This template couldn’t be found.');
      }
      const validated = validateTemplate(content);
      const exercises = validated.exercises.map(exercise => {
        const savedId = placements.get(exercise.id)
          ?? (mode === 'update' && savedIdentity.test(exercise.id) ? exercise.id : newId());
        placements.set(exercise.id, savedId);
        return { ...exercise, id: savedId };
      });
      const payload = JSON.stringify({ ...validated, exercises });
      if (draft.operation?.content !== payload) draft.operation = { id: newId(), content: payload };
      const operationId = draft.operation.id;

      if (existing) {
        const receipt = await db.getFirstAsync<{ content: string }>(
          'SELECT content FROM template_save_receipts WHERE template_id = ? AND operation_id = ?', id, operationId);
        if (receipt) return readTemplate({ ...existing, content: receipt.content });
      }

      const createdAt = existing?.created_at ?? new Date().toISOString();
      if (existing) {
        await db.runAsync('UPDATE workout_templates SET content = ? WHERE id = ?', payload, id);
      } else {
        await db.runAsync('INSERT INTO workout_templates (id, created_at, content) VALUES (?, ?, ?)',
          id, createdAt, payload);
      }
      await db.runAsync('INSERT INTO template_save_receipts (operation_id, template_id, content) VALUES (?, ?, ?)',
        operationId, id, payload);
      return readTemplate({ id, created_at: createdAt, content: payload });
    });
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
    createTemplate(content, context = {}) {
      return save({ mode: 'create', content }, context);
    },
    updateTemplate(id, content, context = {}) {
      return save({ mode: 'update', id, content }, context);
    },
    updateTemplateDetails(id, details, context = {}) {
      return save({ mode: 'update', id, details }, context);
    },
    deleteTemplate(id) {
      return database.write(async db => {
        // Preserve successful-save receipts so a delayed creation retry cannot resurrect this template.
        await db.runAsync('DELETE FROM workout_templates WHERE id = ?', id);
      });
    },
    listSessions: samples.listSessions,
    getSession: samples.getSession,
  };
}
