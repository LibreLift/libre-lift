import { createAppSupabaseRuntime } from '../src/services/supabase-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

test('creating an app runtime leaves missing configuration recoverable at account access', async () => {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  try {
    const runtime = createAppSupabaseRuntime();
    await expect(runtime.authService.restoreSession()).rejects.toThrow('Account access is not configured.');
  } finally {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
  }
});

test('feature requests share verified account access and use refreshed credentials', async () => {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://runtime.example.com';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
  await AsyncStorage.clear();
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'alex@example.com',
    aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
    created_at: '2026-11-18T00:00:00Z' };
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/v1/verify') || url.includes('/auth/v1/token')) {
      const refreshed = url.includes('/auth/v1/token');
      return new Response(JSON.stringify({ user, token_type: 'bearer', expires_in: 3600,
        access_token: refreshed ? 'refreshed-access' : 'verified-access', refresh_token: 'refresh-token' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const authorization = new Headers(init?.headers).get('Authorization');
    return new Response(JSON.stringify([{ account_name: authorization === 'Bearer verified-access'
      ? 'Verified account' : authorization === 'Bearer refreshed-access' ? 'Refreshed account' : 'Anonymous' }]),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const runtime = createAppSupabaseRuntime();
  try {
    const verified = await runtime.authService.verifyCode('alex@example.com', '123456');
    expect(verified.account.id).toBe(user.id);
    const featureClient = runtime.getClient();
    const first = await featureClient.from('users').select('account_name');
    expect(first.error).toBeNull();
    expect(first.data).toEqual([{ account_name: 'Verified account' }]);

    const refreshed = await featureClient.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    const next = await runtime.getClient().from('users').select('account_name');
    expect(next.error).toBeNull();
    expect(next.data).toEqual([{ account_name: 'Refreshed account' }]);
  } finally {
    await runtime.getClient().auth.stopAutoRefresh();
    await runtime.getClient().auth.signOut({ scope: 'local' });
    fetch.mockRestore();
    await AsyncStorage.clear();
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
