import type { SupabaseClient } from '@supabase/supabase-js';
import { savedTemplate, savedTemplates, templateContent, uuid, TemplateFailure, type TemplateRequest } from '../../supabase/functions/_shared/template-contract';
import { AuthSessionEnded } from './auth-service';
import type { TemplateContent, WorkoutTemplate } from '../models/workout';
import type { TemplateSaveContext, WorkoutService } from './workout-service';
import { createSampleWorkoutService } from './sample-workout-service';

export function createSupabaseWorkoutService(getClient: () => SupabaseClient, newId?: () => string): WorkoutService {
  const samples = createSampleWorkoutService();
  const saves = new WeakMap<TemplateSaveContext, { id: string; mode: 'create' | 'update'; placements: Map<string, string>;
    operation?: { id: string; content: string } }>();
  const metadataDrafts = new WeakMap<TemplateSaveContext, WorkoutTemplate>();
  function nextId() {
    if (!newId) throw new TemplateFailure('Saving templates is not configured.', 'unavailable');
    return uuid(newId());
  }
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
  async function save(mode: 'create' | 'update', content: TemplateContent, context: TemplateSaveContext, id?: string) {
    let state = saves.get(context);
    if (!state) {
      state = { id: mode === 'create' ? nextId() : uuid(id), mode, placements: new Map() };
      saves.set(context, state);
    }
    if (state.mode !== mode || (id !== undefined && state.id !== id)) throw new TemplateFailure('This draft belongs to another template.');
    const mapped = templateContent({ ...content, title: content.title.trim(), exercises: content.exercises.map((exercise) => {
      let placementId = state.placements.get(exercise.id);
      if (!placementId) {
        if (mode === 'update') {
          try { placementId = uuid(exercise.id); } catch { /* Unsaved placements need a new saved identity. */ }
        }
        placementId ??= nextId();
        state.placements.set(exercise.id, placementId);
      }
      return { ...exercise, id: placementId };
    }) });
    const fingerprint = JSON.stringify(mapped);
    if (state.operation?.content !== fingerprint) state.operation = { id: nextId(), content: fingerprint };
    return savedTemplate(await request({ action: mode, id: state.id, operationId: state.operation.id, content: mapped }));
  }
  async function getTemplate(id: string) {
    const data = await request({ action: 'get', id });
    return data === null ? null : savedTemplate(data);
  }
  return {
    async listTemplates() { return savedTemplates(await request({ action: 'list' })); },
    getTemplate,
    async createTemplate(content, context = {}) {
      return save('create', content, context);
    },
    async updateTemplate(id, content, context = {}) { return save('update', content, context, id); },
    async updateTemplateDetails(id, details, context = {}) {
      let template = metadataDrafts.get(context);
      if (!template) {
        template = await getTemplate(id) ?? undefined;
        if (!template) throw new TemplateFailure('This template couldn’t be found.', 'missing');
        metadataDrafts.set(context, template);
      }
      if (template.id !== id) throw new TemplateFailure('This draft belongs to another template.');
      return save('update', { ...template, ...details }, context, id);
    },
    async deleteTemplate(id) {
      if (await request({ action: 'delete', id: uuid(id) }) !== null) {
        throw new TemplateFailure('Your template could not be deleted. Please try again.', 'unavailable');
      }
    },
    listSessions: samples.listSessions,
    getSession: samples.getSession,
  };
}
