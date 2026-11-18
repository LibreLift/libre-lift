import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { templateRequest, TemplateFailure } from '../_shared/template-contract.ts';
import { saveTemplate, readTemplates } from './data-access.ts';

Deno.serve(async (request: Request) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ kind: 'validation', message: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization') ?? '';
  if (!/^Bearer \S+$/i.test(authorization)) return reply({ kind: 'authentication', message: 'Authentication required.' }, 401);
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user) {
      const invalid = !authError || authError.status === 401 ||
        ['bad_jwt', 'session_not_found', 'user_not_found', 'user_banned'].includes(authError.code ?? '');
      return reply({ kind: invalid ? 'authentication' : 'unavailable', message: 'Account access unavailable.' }, invalid ? 401 : 503);
    }
    let payload: unknown;
    try { payload = await request.json(); } catch { throw new TemplateFailure('Invalid request JSON.'); }
    const parsed = templateRequest(payload);
    return reply(await (parsed.action === 'create' || parsed.action === 'update' ? saveTemplate(client, parsed) : readTemplates(client, parsed)));
  } catch (error) {
    const kind = error instanceof TemplateFailure ? error.kind : 'unavailable';
    return reply({ kind, message: error instanceof TemplateFailure ? error.message : 'Your templates could not be loaded. Please try again.' },
      kind === 'validation' ? 400 : kind === 'missing' ? 404 : 503);
  }
});
