import type { SupabaseClient } from '@supabase/supabase-js';
import { savedTemplate, savedTemplates, TemplateFailure, type TemplateReadRequest } from '../../supabase/functions/_shared/template-contract';
import { AuthSessionEnded } from './auth-service';
import type { WorkoutService } from './workout-service';
import { createSampleWorkoutService } from './sample-workout-service';

export function createSupabaseWorkoutService(getClient: () => SupabaseClient): WorkoutService {
  const samples = createSampleWorkoutService();
  const unsupported = async () => { throw new TemplateFailure('This template operation is not available yet.', 'unavailable'); };
  async function request(body: TemplateReadRequest): Promise<unknown> {
    const { data, error } = await getClient().functions.invoke<unknown>('workout-templates', { body });
    if (error) {
      const response = error.context;
      if (response instanceof Response) {
        let failure: unknown;
        try { failure = await response.json(); } catch { /* Malformed responses remain retryable request failures. */ }
        if (failure && typeof failure === 'object' && 'kind' in failure) {
          if (failure.kind === 'authentication') throw new AuthSessionEnded('Your account access ended. Please sign in again.');
          if (failure.kind === 'validation') throw new TemplateFailure('This template request is invalid.');
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
    createTemplate: unsupported,
    updateTemplate: unsupported,
    updateTemplateDetails: unsupported,
    deleteTemplate: unsupported,
    listSessions: samples.listSessions,
    getSession: samples.getSession,
  };
}
