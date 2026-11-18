import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import type { AuthService, AuthSession } from '../src/services/auth-service';

const session: AuthSession = {
  account: { id: 'alex', email: 'alex@example.com', name: 'Alex' },
  accessToken: 'access', refreshToken: 'refresh', expiresAt: 4102444800,
};
const service = {
  async restoreSession(): Promise<AuthSession | null> { return null; },
  async requestCode() {}, async verifyCode() { return session; },
  async loadAccount(account: AuthSession['account']) { return { ...account, name: 'Alex' }; },
  async updateName(name: string, account: AuthSession['account']) { return { ...account, name }; },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function renderAccess(authService: AuthService, initialUrl = '/') {
  return renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout authService={authService} /> } }, { initialUrl });
}

test('restoration gates training and email entry until the application User loads', async () => {
  const restored = deferred<AuthSession | null>();
  const account = deferred<AuthSession['account']>();
  const app = await renderAccess({ ...service, restoreSession: () => restored.promise, loadAccount: () => account.promise });
  expect(await screen.findByText('Restoring your account')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Continue with email' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await act(() => restored.resolve(session));
  expect(await screen.findByText('Loading your account')).toBeVisible();
  await act(() => account.resolve(session.account));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
});

test('a temporary restoration failure offers Settings and retry without email verification', async () => {
  let attempts = 0;
  await renderAccess({ ...service, async restoreSession() {
    if (++attempts === 1) throw new Error('Connection unavailable');
    return session;
  } });
  expect(await screen.findByText('Connection unavailable')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Continue with email' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('radio', { name: 'Dark' })).toBeVisible();
  await act(() => require('expo-router/testing-library').testRouter.back());
  await fireEvent.press(await screen.findByRole('button', { name: 'Retry account access' }));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
});

test('restored direct links wait for account readiness and missing Users require onboarding', async () => {
  const app = await renderAccess({ ...service, async restoreSession() { return session; } }, '/templates/upper-body');
  expect(await screen.findByText('Bench press')).toBeVisible();
  expect(app.getPathname()).toBe('/templates/upper-body');
  await app.unmount();
  await renderAccess({ ...service, async restoreSession() { return session; }, async loadAccount(account) { return { ...account, name: null }; } });
  expect(await screen.findByText('What should we call you?')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});
