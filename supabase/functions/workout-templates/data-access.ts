import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { savedTemplates, TemplateFailure, type TemplateReadRequest } from '../_shared/template-contract.ts';

export async function readTemplates(client: SupabaseClient, request: TemplateReadRequest) {
  const { data, error } = await client.rpc('read_workout_templates', { p_id: request.action === 'get' ? request.id : null });
  if (error) throw new TemplateFailure('Your templates could not be loaded. Please try again.', 'unavailable');
  let templates;
  try { templates = savedTemplates(data); }
  catch { throw new TemplateFailure('Saved template data could not be loaded. Please try again.', 'unavailable'); }
  return request.action === 'get' ? templates[0] ?? null : templates;
}
