import { AuthFailure } from '../src/services/auth-service';
import { createManualClock } from '../test-support/auth-clock';
import { act, fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';

const session = {
  account: { id: 'account-1', email: 'alex@example.com', name: 'Alex' },
  accessToken: 'access', refreshToken: 'refresh', expiresAt: 3600,
};

const service = {
  async restoreSession() { return null; },
  async requestCode() {},
  async verifyCode() { return session; },
  async loadAccount() { return session.account; },
  async updateName(name: string) { return { ...session.account, name }; },
};

function renderAccess(props: Parameters<typeof RootLayout>[0] = {}, initialUrl?: string) {
  return renderRouter({
    appDir: './app',
    overrides: { _layout: () => <RootLayout authService={service} {...props} /> },
  }, { initialUrl });
}

test('a returning user verifies an emailed code before entering Templates', async () => {
  const app = await renderAccess({}, '/templates/upper-body');
  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeVisible();
  expect(screen.queryByText('Bench press')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByText('alex@example.com')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  expect(testRouter.canGoBack()).toBe(false);
});

test('invalid input and failed verification allow correction and retry', async () => {
  let attempts = 0;
  await renderAccess({ authService: { ...service, async verifyCode() {
      if (++attempts === 1) throw new Error('That code is invalid or expired. Try again or request a new code.');
      return session;
    } } });
  await fireEvent.press(await screen.findByRole('button', { name: 'Continue with email' }));
  expect(screen.getByText('Enter a valid email address.')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Verify code' }));
  expect(screen.getByText('Enter the six-digit code from your email.')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Email code'), '111111');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByText(/That code is invalid or expired/)).toBeVisible();
  expect(screen.getByDisplayValue('111111')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
});

test('a failed code request preserves the email and can be retried', async () => {
  let attempts = 0;
  await renderAccess({ authService: { ...service, async requestCode() {
      if (++attempts === 1) throw new Error('Check your connection and try again.');
    } } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByText('Check your connection and try again.')).toBeVisible();
  expect(screen.getByDisplayValue('alex@example.com')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByLabelText('Email code')).toBeVisible();
});

test('appearance Settings is reachable while signed out', async () => {
  await renderAccess();
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('radio', { name: 'Dark' })).toBeVisible();
});

test('a code can be resent after sixty seconds, and Change email starts a fresh attempt', async () => {
  const clock = createManualClock();
  await renderAccess({ authClock: clock });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByRole('button', { name: 'Resend code in 60s' })).toBeDisabled();
  await act(() => clock.advance(59000));
  expect(screen.getByRole('button', { name: 'Resend code in 1s' })).toBeDisabled();
  await act(() => clock.advance(1000));
  await fireEvent.press(screen.getByRole('button', { name: 'Resend code' }));
  expect(await screen.findByRole('button', { name: 'Resend code in 60s' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Change email' }));
  expect(screen.getByDisplayValue('alex@example.com')).toBeVisible();
  expect(screen.queryByLabelText('Email code')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Email'), 'other@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByText('other@example.com')).toBeVisible();
  expect(screen.getByLabelText('Email code')).toHaveDisplayValue('');
});

test('a verified account without a name supplies one before Templates, then can edit it', async () => {
  await renderAccess({ authService: { ...service,
      async loadAccount() { return { ...session.account, name: null }; },
    } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByLabelText('Account name')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Alex');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  expect(await screen.findByText('Alex')).toBeVisible();
  expect(screen.getByText('alex@example.com')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Alex Rivera');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Alex Rivera')).toBeVisible();
});

test('name validation and a failed name save preserve input and allow retry', async () => {
  let saves = 0;
  await renderAccess({ initialSession: session, authService: { ...service, async updateName(name) {
      if (++saves === 1) throw new Error('Your name could not be saved. Please try again.');
      return { ...session.account, name };
    } } }, '/account');
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit name' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), '  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(screen.getByText('Enter an account name.')).toBeVisible();
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Alex Rivera');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Your name could not be saved. Please try again.')).toBeVisible();
  expect(screen.getByDisplayValue('Alex Rivera')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Alex Rivera')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Discard me');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Alex Rivera')).toBeVisible();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  expect(screen.getByLabelText('Account name')).toHaveDisplayValue('Alex Rivera');
});

test('pending code requests lock conflicting actions, and restart ignores their late results', async () => {
  let finish = () => {};
  const delayed = new Promise<void>((resolve) => { finish = resolve; });
  const access = () => <RootLayout authService={{ ...service, requestCode: () => delayed }} />;
  const app = await renderRouter({ appDir: './app', overrides: { _layout: access } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  expect(screen.getByLabelText('Email')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Settings' })).toBeDisabled();
  await app.unmount();
  await renderRouter({ appDir: './app', overrides: { _layout: access } });
  expect(await screen.findByLabelText('Email')).toHaveDisplayValue('');
  await act(() => finish());
  expect(screen.queryByLabelText('Email code')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue with email' })).toBeEnabled();
});

test('rate limits show a wait and allow a fresh request once it ends', async () => {
  const clock = createManualClock();
  let attempts = 0;
  await renderAccess({ authClock: clock, authService: { ...service, async requestCode() {
      if (++attempts === 1) throw new AuthFailure('Too many requests. Please wait before trying again.', 60);
    } } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Too many requests/);
  expect(screen.getByRole('button', { name: 'Continue with email' })).toBeDisabled();
  await act(() => clock.advance(60000));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(await screen.findByLabelText('Email code')).toBeVisible();
});

test('missing backend settings show an actionable error instead of crashing', async () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    await renderRouter('./app');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not configured/);
    expect(screen.getByRole('button', { name: 'Retry account access' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry account access' })).toBeEnabled();
  } finally {
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test('verification rate limits disable verification until the retry deadline', async () => {
  const clock = createManualClock();
  let attempts = 0;
  await renderAccess({ authClock: clock, authService: { ...service, async verifyCode() {
      if (++attempts === 1) throw new AuthFailure('Please wait before verifying again.', 60);
      return session;
    } } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please wait before verifying again.');
  expect(screen.getByRole('button', { name: 'Verify code' })).toBeDisabled();
  await act(() => clock.advance(60000));
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
});

test('name-save rate limits preserve the draft and disable saving until retry is allowed', async () => {
  const clock = createManualClock();
  let attempts = 0;
  await renderAccess({ initialSession: session, authClock: clock, authService: { ...service, async updateName(name) {
      if (++attempts === 1) throw new AuthFailure('Please wait before saving again.', 60);
      return { ...session.account, name };
    } } }, '/account');
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit name' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Alex Rivera');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please wait before saving again.');
  expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
  expect(screen.getByDisplayValue('Alex Rivera')).toBeVisible();
  await act(() => clock.advance(60000));
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Alex Rivera')).toBeVisible();
});


test('a verified user retries account loading without using the consumed code again', async () => {
  let verified = false;
  let lookups = 0;
  const app = await renderAccess({ authService: { ...service,
    async verifyCode() {
      if (verified) throw new Error('The code was already consumed.');
      verified = true;
      return session;
    },
    async loadAccount() {
      if (++lookups <= 2) throw new Error('Your account could not be loaded. Please try again.');
      return { ...session.account, name: 'Stored name' };
    },
  } }, '/templates/upper-body');
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your account could not be loaded. Please try again.');
  expect(screen.queryByLabelText('Account name')).toBeNull();
  expect(screen.queryByLabelText('Email code')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('radio', { name: 'Dark' })).toBeVisible();
  await act(() => testRouter.back());
  await fireEvent.press(await screen.findByRole('button', { name: 'Retry loading account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your account could not be loaded. Please try again.');
  await fireEvent.press(screen.getByRole('button', { name: 'Retry loading account' }));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
  await waitFor(() => expect(app.getPathname()).toBe('/templates'));
  expect(testRouter.canGoBack()).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: /^Account, tab/ }));
  expect(await screen.findByText('Stored name')).toBeVisible();
});

test('pending account lookup gates training and duplicate retries while Settings stays available', async () => {
  let finish = (_account: typeof session.account) => {};
  const delayed = new Promise<typeof session.account>((resolve) => { finish = resolve; });
  await renderAccess({ authService: { ...service, loadAccount: () => delayed } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('button', { name: 'Loading account…' })).toBeDisabled();
  expect(screen.queryByLabelText('Account name')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('radio', { name: 'Dark' })).toBeVisible();
  await act(() => testRouter.back());
  expect(await screen.findByRole('button', { name: 'Loading account…' })).toBeDisabled();
  await act(() => finish(session.account));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
});

test('missing User onboarding preserves the name through a failed pending save and retry', async () => {
  let rejectSave = (_error: Error) => {};
  const delayed = new Promise<typeof session.account>((_resolve, reject) => { rejectSave = reject; });
  let failed = false;
  await renderAccess({ authService: { ...service,
    async loadAccount() { return { ...session.account, name: null }; },
    async updateName(name) {
      if (!failed) { failed = true; return delayed; }
      return { ...session.account, name };
    },
  } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  await fireEvent.changeText(await screen.findByLabelText('Account name'), '  Alex Rivera  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(screen.getByLabelText('Account name')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
  await act(() => rejectSave(new Error('Your name could not be saved. Please try again.')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your name could not be saved. Please try again.');
  expect(screen.getByLabelText('Account name')).toHaveDisplayValue('  Alex Rivera  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Account, tab/ }));
  expect(await screen.findByText('Alex Rivera')).toBeVisible();
});

test('account-loading rate limits preserve verified access until lookup retry is allowed', async () => {
  const clock = createManualClock();
  let limited = true;
  await renderAccess({ authClock: clock, authService: { ...service, async loadAccount() {
    if (limited) { limited = false; throw new AuthFailure('Please wait before loading again.', 60); }
    return session.account;
  } } });
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please wait before loading again.');
  expect(screen.getByRole('button', { name: 'Retry loading account' })).toBeDisabled();
  await act(() => clock.advance(60000));
  await fireEvent.press(screen.getByRole('button', { name: 'Retry loading account' }));
  expect(await screen.findByRole('button', { name: /^Templates, tab/ })).toBeVisible();
});

test('restarting during User loading ignores its late result and returns to email entry', async () => {
  let finish = (_account: typeof session.account) => {};
  const delayed = new Promise<typeof session.account>((resolve) => { finish = resolve; });
  const props = { authService: { ...service, loadAccount: () => delayed } };
  const app = await renderAccess(props);
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'alex@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  await fireEvent.changeText(await screen.findByLabelText('Email code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('button', { name: 'Loading account…' })).toBeDisabled();
  await app.unmount();
  await renderAccess(props, '/templates');
  await act(() => finish(session.account));
  expect(await screen.findByLabelText('Email')).toHaveDisplayValue('');
  expect(screen.queryByRole('button', { name: /^Templates, tab/ })).toBeNull();
});
