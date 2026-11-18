import { Alert, AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import { createManualClock } from '../test-support/auth-clock';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import { AuthSessionEnded, type AuthEvent, type AuthService, type AuthSession } from '../src/services/auth-service';

const session: AuthSession = {
  account: { id: 'alex', email: 'alex@example.com', name: 'Alex' },
  accessToken: 'access', refreshToken: 'refresh', expiresAt: 4102444800,
};
const service = {
  async restoreSession(): Promise<AuthSession | null> { return null; },
  async signOut() {},
  subscribe() { return () => {}; },
  setForeground() {},
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
function renderAccess(authService: AuthService, initialUrl = '/', props: Parameters<typeof RootLayout>[0] = {}) {
  return renderRouter({ appDir: './app', overrides: { _layout: () => <RootLayout authService={authService} {...props} /> } }, { initialUrl });
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
  await act(() => testRouter.back());
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

test('sign-out ends local access and Back cannot reopen the previous account', async () => {
  let stored: AuthSession | null = session;
  const app = await renderAccess({ ...service, async restoreSession() { return stored; }, async signOut() { stored = null; } });
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
  expect(screen.queryByText('alex@example.com')).toBeNull();
  expect(testRouter.canGoBack()).toBe(false);
  await app.unmount();
  await renderAccess({ ...service, async restoreSession() { return stored; } });
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
});

test('failed device cleanup blocks access until retry succeeds', async () => {
  let attempts = 0;
  await renderAccess({ ...service, async restoreSession() { return session; }, async signOut() {
    if (++attempts === 1) throw new Error('storage unavailable');
  } });
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Device sign-out incomplete')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Continue with email' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry sign-out' }));
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
});

test('sign-out confirms unsaved drafts and re-entry gets a fresh sample service', async () => {
  const confirmation = jest.spyOn(Alert, 'alert');
  const app = await renderAccess({ ...service, async restoreSession() { return session; } }, '/templates/upper-body');
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Private draft');
  await fireEvent.press(screen.getByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  expect(confirmation).toHaveBeenCalled();
  const buttons = confirmation.mock.calls.at(-1)![2]!;
  await act(() => buttons.find((button) => button.text === 'Keep editing')?.onPress?.());
  expect(screen.getByText('alex@example.com')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await act(() => confirmation.mock.calls.at(-1)![2]!.find((button) => button.text === 'Sign out')?.onPress?.());
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  expect(screen.queryByText('Private draft')).toBeNull();
  confirmation.mockRestore();
});

test('forced sign-out overrides a pending name save and ignores its late result', async () => {
  let notify!: (event: import('../src/services/auth-service').AuthEvent) => void;
  const saved = deferred<AuthSession['account']>();
  await renderAccess({ ...service, async restoreSession() { return session; }, updateName: () => saved.promise,
    subscribe(listener) { notify = listener; return () => {}; } });
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit name' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Pending private name');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
  await act(() => notify({ type: 'signed-out' }));
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
  await act(() => saved.resolve({ ...session.account, name: 'Pending private name' }));
  expect(screen.queryByText('Pending private name')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});

test('account switching drops seeded history and ignores a late old-account history response', async () => {
  let notify!: (event: AuthEvent) => void;
  const oldHistory = deferred<Awaited<ReturnType<ReturnType<typeof createSampleWorkoutService>['listSessions']>>>();
  const other = { ...session, account: { id: 'blair', email: 'blair@example.com', name: 'Blair' } };
  await renderAccess({ ...service, async restoreSession() { return session; }, async loadAccount(account) { return account; },
    subscribe(listener) { notify = listener; return () => {}; } }, '/', {
    workoutServiceFactory(account) {
      const sample = createSampleWorkoutService();
      return { ...sample, async listTemplates() {
        return (await sample.listTemplates()).map((template) => ({ ...template, title: `${account?.id} template` }));
      }, listSessions: account?.id === 'alex' ? () => oldHistory.promise : async () =>
        (await sample.listSessions()).map((workout) => ({ ...workout, title: 'Blair history' })) };
    },
  });
  expect((await screen.findAllByText('alex template')).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  await act(() => notify({ type: 'signed-in', session: other }));
  expect((await screen.findAllByText('blair template')).length).toBeGreaterThan(0);
  await act(async () => oldHistory.resolve((await createSampleWorkoutService().listSessions()).map((workout) => ({ ...workout, title: 'Alex private history' }))));
  await fireEvent.press(screen.getByRole('button', { name: /^Workouts, tab/ }));
  expect((await screen.findAllByText('Blair history')).length).toBeGreaterThan(0);
  expect(screen.queryByText('Alex private history')).toBeNull();
  expect(screen.queryByText('alex template')).toBeNull();
});

test('saved sample mutations are discarded after sign-out and same-account re-entry', async () => {
  await renderAccess({ ...service, async restoreSession() { return session; } }, '/templates/upper-body');
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Private saved sample');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Private saved sample')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByText('Upper body')).toBeVisible();
  expect(screen.queryByText('Private saved sample')).toBeNull();
});

test('routine same-account refresh preserves the open draft and route', async () => {
  let notify!: (event: AuthEvent) => void;
  const app = await renderAccess({ ...service, async restoreSession() { return session; },
    subscribe(listener) { notify = listener; return () => {}; } }, '/templates/upper-body');
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Draft survives refresh');
  await act(() => notify({ type: 'refreshed', session: { ...session, accessToken: 'renewed', expiresAt: session.expiresAt + 3600 } }));
  expect(screen.getByDisplayValue('Draft survives refresh')).toBeVisible();
  expect(app.getPathname()).toBe('/templates/upper-body');
});

test('expired unusable access gates training and recovery discards drafts and navigation', async () => {
  const clock = createManualClock();
  const expiring = { ...session, expiresAt: 2 };
  let attempts = 0;
  const app = await renderAccess({ ...service, async restoreSession() {
    attempts++;
    if (attempts === 2) throw new Error('Connection unavailable');
    return attempts === 1 ? expiring : session;
  } }, '/templates/upper-body', { authClock: clock });
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Lost after expiry');
  await act(() => clock.advance(3000));
  expect(await screen.findByText('Connection unavailable')).toBeVisible();
  expect(screen.queryByLabelText('Template title')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry account access' }));
  expect(await screen.findByText('Your account was reloaded. Unsaved changes were discarded.')).toBeVisible();
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  await fireEvent.press(await screen.findByRole('button', { name: /^Upper body\./ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  expect(screen.getByDisplayValue('Upper body')).toBeVisible();
  expect(screen.queryByDisplayValue('Lost after expiry')).toBeNull();
});

test('cleanup failure cannot be bypassed by a late refreshed session', async () => {
  let notify!: (event: AuthEvent) => void;
  await renderAccess({ ...service, async restoreSession() { return session; },
    async signOut() { throw new Error('storage unavailable'); },
    subscribe(listener) { notify = listener; return () => {}; } });
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Device sign-out incomplete')).toBeVisible();
  await act(() => notify({ type: 'refreshed', session }));
  expect(screen.getByText('Device sign-out incomplete')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});

test('a newer account replaces an unresolved restoration and its late User result is ignored', async () => {
  let notify!: (event: AuthEvent) => void;
  const oldUser = deferred<AuthSession['account']>();
  const other = { ...session, account: { id: 'blair', email: 'blair@example.com', name: 'Blair' } };
  await renderAccess({ ...service, async restoreSession() { return session; },
    loadAccount(account) { return account.id === 'alex' ? oldUser.promise : Promise.resolve(account); },
    subscribe(listener) { notify = listener; return () => {}; } });
  expect(await screen.findByText('Loading your account')).toBeVisible();
  await act(() => notify({ type: 'signed-in', session: other }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  expect(await screen.findByText('blair@example.com')).toBeVisible();
  await act(() => oldUser.resolve(session.account));
  expect(screen.getByText('blair@example.com')).toBeVisible();
  expect(screen.queryByText('alex@example.com')).toBeNull();
});

test('sign-out remains available while verified account loading is stuck', async () => {
  const account = deferred<AuthSession['account']>();
  await renderAccess({ ...service, loadAccount: () => account.promise });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
  await act(() => account.resolve(session.account));
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});

test('foregrounding checks expired access even when background clock notifications were suspended', async () => {
  let changed!: (state: AppStateStatus) => void;
  const nativeSubscribe = jest.mocked(AppState.addEventListener);
  const originalListener = nativeSubscribe.getMockImplementation()!;
  nativeSubscribe.mockImplementation((_event, callback) => { changed = callback; return { remove() {} }; });
  let now = 0;
  let attempts = 0;
  const app = await renderAccess({ ...service, async restoreSession() {
    if (++attempts === 1) return { ...session, expiresAt: 2 };
    throw new AuthSessionEnded('Your account access ended. Please sign in again.');
  } }, '/', { authClock: { now: () => now, subscribe: () => () => {} } });
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
  await act(() => changed('background'));
  now = 3000;
  await act(() => changed('active'));
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(/access ended/);
  await app.unmount();
  nativeSubscribe.mockImplementation(originalListener);
});

test('forced authentication loss removes a pending template save without a discard prompt', async () => {
  let notify!: (event: AuthEvent) => void;
  const sample = createSampleWorkoutService();
  const template = await sample.getTemplate('upper-body');
  const saved = deferred<NonNullable<typeof template>>();
  const alert = jest.spyOn(Alert, 'alert');
  await renderAccess({ ...service, async restoreSession() { return session; },
    subscribe(listener) { notify = listener; return () => {}; } }, '/templates/upper-body', {
    workoutServiceFactory: () => ({ ...sample, updateTemplate: () => saved.promise }),
  });
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Pending template');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await act(() => notify({ type: 'signed-out' }));
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
  expect(alert).not.toHaveBeenCalled();
  await act(() => saved.resolve({ ...template!, title: 'Pending template' }));
  expect(screen.queryByText('Pending template')).toBeNull();
  expect(testRouter.canGoBack()).toBe(false);
  alert.mockRestore();
});

test('name-save completion preserves credentials renewed while the save was pending', async () => {
  let notify!: (event: AuthEvent) => void;
  const clock = createManualClock();
  const saved = deferred<AuthSession['account']>();
  const app = await renderAccess({ ...service, async restoreSession() { return { ...session, expiresAt: 2 }; },
    updateName: () => saved.promise, subscribe(listener) { notify = listener; return () => {}; } }, '/', { authClock: clock });
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit name' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Alex updated');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await act(() => notify({ type: 'refreshed', session: { ...session, expiresAt: 100 } }));
  await act(() => saved.resolve({ ...session.account, name: 'Alex updated' }));
  await act(() => clock.advance(3000));
  expect(screen.getByText('Alex updated')).toBeVisible();
  expect(app.getPathname()).toBe('/account');
  expect(screen.queryByText('Your account was reloaded. Unsaved changes were discarded.')).toBeNull();
});

test('a late token refresh cannot reopen access after forced sign-out', async () => {
  let notify!: (event: AuthEvent) => void;
  await renderAccess({ ...service, async restoreSession() { return session; },
    subscribe(listener) { notify = listener; return () => {}; } });
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
  await act(() => notify({ type: 'signed-out' }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
  await act(() => notify({ type: 'refreshed', session }));
  expect(screen.getByLabelText('Email')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});

test('stalled restored account loading offers appearance Settings and sign-out', async () => {
  const account = deferred<AuthSession['account']>();
  await renderAccess({ ...service, async restoreSession() { return session; }, loadAccount: () => account.promise });
  expect(await screen.findByText('Loading your account')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Dark' }));
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to account loading' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByLabelText('Email')).toBeVisible();
  await act(() => account.resolve(session.account));
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});

test.each(['pending', 'retry'])('refresh during %s verified account loading preserves the draft after the old expiry', async (loading) => {
  let notify!: (event: AuthEvent) => void;
  const clock = createManualClock();
  const account = deferred<AuthSession['account']>();
  let lookups = 0;
  const app = await renderAccess({ ...service, async verifyCode() { return { ...session, expiresAt: 2 }; },
    loadAccount: () => {
      if (++lookups === 1 && loading === 'retry') return Promise.reject(new Error('Lookup unavailable'));
      return account.promise;
    }, subscribe(listener) { notify = listener; return () => {}; } }, '/', { authClock: clock });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByText('Loading your account')).toBeVisible();
  if (loading === 'retry') expect(await screen.findByText('Lookup unavailable')).toBeVisible();
  await act(() => notify({ type: 'refreshed', session: { ...session, expiresAt: 100 } }));
  if (loading === 'retry') await fireEvent.press(screen.getByRole('button', { name: 'Retry loading account' }));
  await act(() => account.resolve(session.account));
  await fireEvent.press(await screen.findByRole('button', { name: /^Upper body\./ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit template details' }));
  await fireEvent.changeText(screen.getByLabelText('Template title'), 'Newly opened draft');
  await act(() => clock.advance(3000));
  expect(screen.getByDisplayValue('Newly opened draft')).toBeVisible();
  expect(app.getPathname()).toBe('/templates/upper-body');
  expect(screen.queryByText('Your account was reloaded. Unsaved changes were discarded.')).toBeNull();
});
