// Opt-in integration check: only use a disposable local Supabase stack.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, filename);
const { createSupabaseAuthService } = require('../src/services/supabase-auth-service.ts');
const { AuthSessionEnded } = require('../src/services/auth-service.ts');
require.extensions['.ts'] = previousLoader;

async function main() {
  if (!process.env.AUTH_TEST_WORKDIR) throw new Error('Set AUTH_TEST_WORKDIR to a disposable local Supabase project.');
  const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir', path.resolve(process.env.AUTH_TEST_WORKDIR), '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }));
  assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
  const admin = createClient(settings.API_URL, settings.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const records = new Map();
  const storage = { getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value); }, removeItem: (key) => { records.delete(key); } };
  function client(store = storage, request = fetch) {
    return createClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
      global: { fetch: request },
      auth: { storage: store, storageKey: 'auth43-check', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  const email = `session43-${Date.now()}@example.com`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.ifError(created.error);
  let otherUserId;
  try {
    const first = client();
    const access = createSupabaseAuthService(() => first);
    assert.equal(await access.restoreSession(), null);
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    assert.ifError(link.error);
    // Local provisioning avoids email delivery; the app's account-access flow remains email OTP.
    const verified = await first.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
    assert.ifError(verified.error);
    const session = await access.restoreSession();
    assert.equal(session.account.id, created.data.user.id);
    const named = await access.updateName('Session check', session.account);
    const reopened = client();
    const restoredAccess = createSupabaseAuthService(() => reopened);
    const restored = await restoredAccess.restoreSession();
    assert.equal(restored.account.id, named.id);
    assert.deepEqual(await restoredAccess.loadAccount(restored.account), named);
    console.log('Persisted restoration and authenticated application User loading passed.');
    const renewed = await reopened.auth.refreshSession();
    assert.ifError(renewed.error);
    const current = await restoredAccess.restoreSession();
    assert.ok(current.accessToken === renewed.data.session.access_token && current.refreshToken === renewed.data.session.refresh_token,
      'Restoration must expose the credentials returned by renewal.');
    assert.equal(current.account.id, named.id);
    assert.deepEqual(await restoredAccess.loadAccount(current.account), named);
    await restoredAccess.updateName('After refresh', named);
    assert.equal((await access.loadAccount(named)).name, 'After refresh');
    console.log('Real token renewal and protected requests using current identity passed.');
    const otherEmail = `other-${email}`;
    const other = await admin.auth.admin.createUser({ email: otherEmail, email_confirm: true });
    assert.ifError(other.error);
    otherUserId = other.data.user.id;
    const otherLink = await admin.auth.admin.generateLink({ type: 'magiclink', email: otherEmail });
    assert.ifError(otherLink.error);
    const otherVerified = await reopened.auth.verifyOtp({ token_hash: otherLink.data.properties.hashed_token, type: 'magiclink' });
    assert.ifError(otherVerified.error);
    const switched = await restoredAccess.restoreSession();
    assert.equal(switched.account.id, otherUserId);
    await restoredAccess.updateName('Other account', switched.account);
    assert.equal((await restoredAccess.loadAccount(switched.account)).name, 'Other account');
    assert.equal((await restoredAccess.loadAccount(named)).name, null);
    await assert.rejects(restoredAccess.updateName('Wrong identity', named));
    const returned = await reopened.auth.setSession({ access_token: current.accessToken, refresh_token: current.refreshToken });
    assert.ifError(returned.error);
    assert.equal((await restoredAccess.loadAccount(named)).name, 'After refresh');
    console.log('Protected requests follow the current account after switching identities.');


    const separateRecords = new Map();
    const separate = client({ getItem: (key) => separateRecords.get(key) ?? null,
      setItem: (key, value) => { separateRecords.set(key, value); }, removeItem: (key) => { separateRecords.delete(key); } });
    const secondLink = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    assert.ifError(secondLink.error);
    const secondSession = await separate.auth.verifyOtp({ token_hash: secondLink.data.properties.hashed_token, type: 'magiclink' });
    assert.ifError(secondSession.error);
    // Use a distinct persisted store for the second device/session.
    const offline = client(storage, (url, options) => String(url).includes('/logout')
      ? Promise.resolve(new Response(JSON.stringify({ message: 'Service unavailable' }), { status: 500 }))
      : fetch(url, options));
    await createSupabaseAuthService(() => offline).signOut();
    assert.equal(await createSupabaseAuthService(() => client()).restoreSession(), null);
    const otherRefresh = await separate.auth.refreshSession();
    assert.ifError(otherRefresh.error);
    assert.equal(otherRefresh.data.user.id, named.id);
    console.log('Local sign-out despite server failure and separate-session survival passed.');
    // Reinstate the valid independent session to exercise durable removal failure/retry.
    await reopened.auth.setSession(otherRefresh.data.session);
    let removalFails = true;
    const unreliable = client({ ...storage, removeItem(key) {
      if (removalFails) throw new Error('storage unavailable');
      storage.removeItem(key);
    } });
    const unreliableAccess = createSupabaseAuthService(() => unreliable);
    await assert.rejects(unreliableAccess.signOut(), /sign-out/i);
    removalFails = false;
    await unreliableAccess.signOut();
    assert.equal(await createSupabaseAuthService(() => client()).restoreSession(), null);
    console.log('Credential cleanup failure and retry passed.');
    // Local sign-out revoked this cloned session. Force its stored access expiry
    // so restoration must exercise the real rejected refresh-token path.
    const revoked = JSON.parse(separateRecords.get('auth43-check'));
    separateRecords.set('auth43-check', JSON.stringify({ ...revoked, expires_at: Math.floor(Date.now() / 1000) - 10 }));
    const expired = client({ getItem: (key) => separateRecords.get(key) ?? null,
      setItem: (key, value) => { separateRecords.set(key, value); }, removeItem: (key) => { separateRecords.delete(key); } });
    let invalid = null;
    try { invalid = await createSupabaseAuthService(() => expired).restoreSession(); }
    catch (error) { assert.ok(error instanceof AuthSessionEnded); }
    assert.ok(invalid === null, 'Revoked authentication must not restore an account.');
    console.log('Revoked stored authentication is not restored.');
  } finally {
    if (otherUserId) assert.ifError((await admin.auth.admin.deleteUser(otherUserId)).error);
    const removed = await admin.auth.admin.deleteUser(created.data.user.id);
    assert.ifError(removed.error);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
