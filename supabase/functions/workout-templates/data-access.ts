import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { savedTemplate, savedTemplates, TemplateFailure, type TemplateReadRequest, type TemplateSaveRequest } from '../_shared/template-contract.ts';

export async function saveTemplate(client: SupabaseClient, request: TemplateSaveRequest) {
  const { data, error } = await client.rpc('save_workout_template', {
    p_id: request.id, p_operation: request.operationId, p_content: request.content, p_mode: request.action,
  });
  if (error) {
    if (error.code === 'P0002') throw new TemplateFailure('This template couldn’t be found.', 'missing');
    const invalid = ['22023', '22P02', '23503', '23505', '23514', '42501'].includes(error.code);
    throw new TemplateFailure('Your template could not be saved.', invalid ? 'validation' : 'unavailable');
  }
  return savedTemplate(data);
}

export async function readTemplates(client: SupabaseClient, request: TemplateReadRequest) {
  const { data, error } = await client.rpc('read_workout_templates', { p_id: request.action === 'get' ? request.id : null });
  if (error) throw new TemplateFailure('Your templates could not be loaded. Please try again.', 'unavailable');
  let templates;
  try { templates = savedTemplates(data); }
  catch { throw new TemplateFailure('Saved template data could not be loaded. Please try again.', 'unavailable'); }
  return request.action === 'get' ? templates[0] ?? null : templates;
}
