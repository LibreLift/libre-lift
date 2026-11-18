import type { SupabaseClient } from '@supabase/supabase-js';
import { savedTemplate, savedTemplates, templateContent, uuid, TemplateFailure, type TemplateRequest } from '../../supabase/functions/_shared/template-contract';
import { AuthSessionEnded } from './auth-service';
import type { TemplateSaveContext, WorkoutService } from './workout-service';
import { createSampleWorkoutService } from './sample-workout-service';

export function createSupabaseWorkoutService(getClient: () => SupabaseClient, newId?: () => string): WorkoutService {
  const samples = createSampleWorkoutService();
  const creations = new WeakMap<TemplateSaveContext, { id: string; placements: Map<string, string>;
    operation?: { id: string; content: string } }>();
  function nextId() {
    if (!newId) throw new TemplateFailure('Saving templates is not configured.', 'unavailable');
    return uuid(newId());
  }
  const unsupported = async () => { throw new TemplateFailure('This template operation is not available yet.', 'unavailable'); };
  async function request(body: TemplateRequest): Promise<unknown> {
    const { data, error } = await getClient().functions.invoke<unknown>('workout-templates', { body });
    if (error) {
      const response = error.context;
      if (response instanceof Response) {
        let failure: unknown;
        try { failure = await response.json(); } catch { /* Malformed responses remain retryable request failures. */ }
        if (failure && typeof failure === 'object' && 'kind' in failure) {
          if (failure.kind === 'authentication') throw new AuthSessionEnded('Your account access ended. Please sign in again.');
          if (failure.kind === 'validation') throw new TemplateFailure('This template request is invalid.');
          if (failure.kind === 'missing') throw new TemplateFailure('This template couldn’t be found.', 'missing');
        }
      }
      throw new TemplateFailure('Your templates could not be loaded. Please try again.', 'unavailable');
    }
    return data;
  }
  return {
    async listTemplates() { return savedTemplates(await request({ action: 'list' })); },
    async getTemplate(id) {
      const data = await request({ action: 'get', id });
      return data === null ? null : savedTemplate(data);
    },
    async createTemplate(content, context = {}) {
      let creation = creations.get(context);
      if (!creation) {
        creation = { id: nextId(), placements: new Map() };
        creations.set(context, creation);
      }
      const mapped = templateContent({ ...content, title: content.title.trim(), exercises: content.exercises.map((exercise) => {
        let id = creation.placements.get(exercise.id);
        if (!id) { id = nextId(); creation.placements.set(exercise.id, id); }
        return { ...exercise, id };
      }) });
      const fingerprint = JSON.stringify(mapped);
      if (creation.operation?.content !== fingerprint) creation.operation = { id: nextId(), content: fingerprint };
      return savedTemplate(await request({ action: 'create', id: creation.id, operationId: creation.operation.id, content: mapped }));
    },
    updateTemplate: unsupported,
    updateTemplateDetails: unsupported,
    deleteTemplate: unsupported,
    listSessions: samples.listSessions,
    getSession: samples.getSession,
  };
}
