import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { router } from 'expo-router';
import type { AuthEvent, AuthService } from '../src/services/auth-service';
import { createAppSupabaseRuntime } from '../src/services/supabase-client';

const account = { id: '10000000-0000-4000-8000-000000000001', email: 'alex@example.com', name: 'Alex' };
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}
async function setup(authService?: AuthService) {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://production.example.com';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-test';
  await AsyncStorage.clear();
  let rejected = false;
  const request = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).includes('/auth/v1/verify') || String(input).includes('/auth/v1/token')) return json({
      user: { ...account, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-18' },
      access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600,
    });
    if (String(input).includes('/logout')) return json({});
    return rejected ? json({ kind: 'authentication' }, 401) : json([]);
  });
  const runtime = createAppSupabaseRuntime();
  const verified = await runtime.authService.verifyCode(account.email, '123456');
  await renderRouter({ appDir: './app', overrides: {
    _layout: () => <RootLayout authService={authService} initialSession={{ ...verified, account }} />,
  } });
  return { request, reject() { rejected = true; }, async stop() {
    await runtime.getClient().auth.stopAutoRefresh();
    request.mockRestore();
    await AsyncStorage.clear();
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  } };
}

test('production composition loads an empty account instead of sample templates and labels sample history', async () => {
  const app = await setup();
  try {
    expect(await screen.findByText('No templates yet.')).toBeVisible();
    expect(screen.queryByText('Upper body')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
    expect(await screen.findByText('Sample workout history')).toBeVisible();
  } finally { await app.stop(); }
});

test('definitive template authentication failure enters account recovery after a guarded renewal attempt', async () => {
  const app = await setup();
  try {
    await screen.findByText('No templates yet.');
    app.reject();
    await act(() => router.push('/templates/00000000-0000-4000-8000-000000000001'));
    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  } finally { await app.stop(); }
});

test('an old account request cannot sign out the newly loaded account when its rejection arrives late', async () => {
  let listener: ((event: AuthEvent) => void) | undefined;
  const service: AuthService = {
    async restoreSession() { return null; }, async signOut() {}, setForeground() {},
    subscribe(callback) { listener = callback; return () => { listener = undefined; }; },
    async requestCode() {}, async verifyCode() { throw new Error('Not used'); },
    async loadAccount(value) { return value; }, async updateName(name, value) { return { ...value, name }; },
  };
  const app = await setup(service);
  try {
    await screen.findByText('No templates yet.');
    const original = app.request.getMockImplementation()!;
    let release!: (response: Response) => void;
    let attempts = 0;
    app.request.mockImplementation(async (input, init) => {
      if (String(input).includes('/functions/')) {
        attempts++;
        if (attempts === 1) return new Promise<Response>(resolve => { release = resolve; });
        return json({ kind: 'authentication' }, 401);
      }
      return original(input, init);
    });
    await act(() => router.push('/templates/00000000-0000-4000-8000-000000000001'));
    await waitFor(() => expect(attempts).toBe(1));
    await act(() => listener?.({ type: 'signed-in', session: {
      account: { id: '10000000-0000-4000-8000-000000000002', email: 'blair@example.com', name: 'Blair' },
      accessToken: 'other-access', refreshToken: 'other-refresh', expiresAt: 4102444800,
    } }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
    expect(await screen.findByText('blair@example.com')).toBeVisible();
    await act(() => release(json({ kind: 'authentication' }, 401)));
    await waitFor(() => expect(attempts).toBe(2));
    expect(screen.getByText('blair@example.com')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue with email' })).toBeNull();
  } finally { await app.stop(); }
});
