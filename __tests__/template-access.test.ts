import { AuthSessionEnded } from '../src/services/auth-service';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseWorkoutService } from '../src/services/supabase-workout-service';

const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '10000000-0000-4000-8000-000000000002';
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}
function backend(rejectInitialToken = false, permissionFailure = false, endSessionOnReject = false, onReject?: () => Promise<void>) {
  let renewed = false;
  let id = firstId;
  const credentials: string[] = [];
  const client = createClient('https://access.example.com', 'publishable-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      if (String(input).includes('/auth/v1/token')) renewed = true;
      if (String(input).includes('/auth/v1/verify') || String(input).includes('/auth/v1/token')) return json({
        user: { id, email: 'alex@example.com', aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: '2026-11-18T00:00:00Z' },
        access_token: `${renewed ? 'renewed' : 'access'}-${id}`, refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600,
      });
      credentials.push(new Headers(init?.headers).get('Authorization') ?? '');
      if (permissionFailure) return json({ kind: 'unavailable' }, 403);
      if (rejectInitialToken && !renewed) {
        await onReject?.();
        if (endSessionOnReject) await client.auth.signOut({ scope: 'local' });
        return json({ kind: 'authentication' }, 401);
      }
      return json([]);
    } },
  });
  return { client, credentials, async signIn(next = firstId) {
    id = next;
    const { error } = await client.auth.verifyOtp({ email: 'alex@example.com', token: '123456', type: 'email' });
    if (error) throw error;
  } };
}

test('an account-scoped template service cannot send a previous account draft under new credentials', async () => {
  const { client, signIn, credentials } = backend();
  await signIn();
  const oldService = createSupabaseWorkoutService(() => client, undefined, { accountId: firstId });
  expect(await oldService.listTemplates()).toEqual([]);
  await signIn(secondId);
  await expect(oldService.listTemplates()).rejects.toThrow('account');
  expect(credentials).toEqual([`Bearer access-${firstId}`]);
});

test('a refreshable protected-request rejection renews current credentials without ending account access', async () => {
  const { client, signIn, credentials } = backend(true);
  await signIn();
  const ended: Error[] = [];
  const service = createSupabaseWorkoutService(() => client, undefined, {
    accountId: firstId, onSessionEnded: error => ended.push(error),
  });
  expect(await service.listTemplates()).toEqual([]);
  expect(credentials).toEqual([`Bearer access-${firstId}`, `Bearer renewed-${firstId}`]);
  expect(ended).toEqual([]);
});

test('ordinary permission failures remain retryable without ending account access', async () => {
  const { client, signIn } = backend(false, true);
  await signIn();
  const ended: Error[] = [];
  const service = createSupabaseWorkoutService(() => client, undefined, {
    accountId: firstId, onSessionEnded: error => ended.push(error),
  });
  await expect(service.listTemplates()).rejects.toThrow('try again');
  expect(ended).toEqual([]);
});

test('authentication that ends while a protected request is pending reports definitive loss', async () => {
  const { client, signIn } = backend(true, false, true);
  await signIn();
  const ended: Error[] = [];
  const service = createSupabaseWorkoutService(() => client, undefined, {
    accountId: firstId, onSessionEnded: error => ended.push(error),
  });
  await expect(service.listTemplates()).rejects.toBeInstanceOf(AuthSessionEnded);
  expect(ended).toHaveLength(1);
});

test('a discarded service cannot retry a pending mutation after same-account recovery', async () => {
  let current = true;
  const state = backend(true, false, false, async () => {
    current = false;
    await state.signIn();
  });
  await state.signIn();
  const ended: Error[] = [];
  const service = createSupabaseWorkoutService(() => state.client, undefined, {
    accountId: firstId, isCurrent: () => current, onSessionEnded: error => ended.push(error),
  });
  await expect(service.deleteTemplate('20000000-0000-4000-8000-000000000001')).rejects.toThrow('account');
  expect(state.credentials).toEqual([`Bearer access-${firstId}`]);
  expect(ended).toEqual([]);
});
