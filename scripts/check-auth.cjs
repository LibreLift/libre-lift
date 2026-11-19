// Opt-in check against a disposable local stack. No external email is sent.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

// Load the same TypeScript service used by the app without loading native UI modules.
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, filename);
const { createSupabaseAuthService } = require('../src/services/supabase-auth-service.ts');
require.extensions['.ts'] = previousLoader;

async function main() {
  const workdir = process.env.AUTH_TEST_WORKDIR;
  if (!workdir) throw new Error('Set AUTH_TEST_WORKDIR to a disposable local Supabase project.');
  const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir', path.resolve(workdir), '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }));
  assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1', 'Only a local test stack is supported.');
  const email = `auth42-${Date.now()}@example.com`;
  const client = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const service = createSupabaseAuthService(() => client);
  async function emailedCode() {
    const listing = await fetch(`${settings.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((r) => r.json());
    assert.ok(listing.messages.length, 'The test account must receive an email.');
    const message = await fetch(`${settings.MAILPIT_URL}/api/v1/message/${listing.messages[0].ID}`).then((r) => r.json());
    assert.equal(message.Subject, 'Your OpenFit code');
    assert.ok(!message.HTML.includes('href='), 'Email must contain a code, not a sign-in link.');
    const match = message.HTML.match(/<strong>(\d{6})<\/strong>/);
    assert.ok(match, 'Email must contain a six-digit code.');
    return match[1];
  }
  await service.requestCode(email);
  const code = await emailedCode();
  const expiry = Number(process.env.AUTH_TEST_EXPIRY_SECONDS);
  if (Number.isFinite(expiry) && expiry > 0) {
    console.log('Waiting for the configured test code to expire…');
    await new Promise((resolve) => setTimeout(resolve, (expiry + 1) * 1000));
    await assert.rejects(service.verifyCode(email, code), /invalid or expired/i, 'An unused expired code must fail.');
    console.log('Time-expired code rejection passed.');
    return;
  }
  await assert.rejects(service.verifyCode(email, code === '000000' ? '111111' : '000000'), /invalid or expired/i, 'Wrong or reused codes must fail.');
  const session = await service.verifyCode(email, code);
  assert.deepEqual(session.account, { id: session.account.id, email, name: null });
  assert.ok(session.accessToken && session.refreshToken);
  await assert.rejects(service.verifyCode(email, code), /invalid or expired/i, 'Wrong or reused codes must fail.');
  async function storedUser() {
    const { data, error } = await client.from('users').select('id, account_name').eq('id', session.account.id).maybeSingle();
    assert.ifError(error);
    return data;
  }
  assert.equal(await storedUser(), null, 'Verification must not create an application User.');
  const { error: metadataError } = await client.auth.updateUser({ data: { name: 'Old metadata name' } });
  assert.ifError(metadataError);
  assert.deepEqual(await service.loadAccount(session.account), session.account,
    'Metadata alone must not bypass name onboarding.');
  assert.equal(await storedUser(), null, 'Loading an absent User must not create one.');
  await assert.rejects(service.updateName('   ', session.account), /name/i);
  const created = await service.updateName('  Alex  ', session.account);
  assert.deepEqual(created, { ...session.account, name: 'Alex' });
  assert.deepEqual(await storedUser(), { id: session.account.id, account_name: 'Alex' });
  // The first insert may succeed even when its response is lost. Reconcile a retry.
  assert.deepEqual(await service.updateName('Different draft', session.account), created,
    'An onboarding retry must recover the stored User instead of overwriting it.');
  const edited = await service.updateName('Alex Rivera', created);
  assert.deepEqual(edited, { ...created, name: 'Alex Rivera' });
  assert.deepEqual(await storedUser(), { id: session.account.id, account_name: 'Alex Rivera' });
  assert.deepEqual(await service.loadAccount(session.account), edited,
    'Application User names must take precedence over differing Auth metadata.');
  const outsider = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const anonymous = await outsider.from('users').select('account_name');
  assert.ok(anonymous.error, 'Anonymous reads must be rejected.');
  // Provision another authenticated actor locally without sending email.
  const admin = createClient(settings.API_URL, settings.SECRET_KEY, { auth: { persistSession: false } });
  const otherEmail = `other-${email}`;
  const provisioned = await admin.auth.admin.createUser({ email: otherEmail, email_confirm: true });
  assert.ifError(provisioned.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: otherEmail });
  assert.ifError(link.error);
  const otherAuth = await outsider.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
  assert.ifError(otherAuth.error);
  const otherService = createSupabaseAuthService(() => outsider);
  const otherAccount = { id: otherAuth.data.user.id, email: otherEmail, name: null };
  await otherService.updateName('Another User', otherAccount);
  const foreign = await outsider.from('users').select('account_name').eq('id', session.account.id);
  assert.ifError(foreign.error);
  assert.deepEqual(foreign.data, [], 'A different User cannot read the account name.');
  await assert.rejects(otherService.updateName('Intrusion', edited), /unavailable/i,
    'A different User cannot edit the stored account name.');
  assert.equal((await storedUser()).account_name, 'Alex Rivera');
  console.log('Verified access and name persistence.');
  console.log('New account, code-only email, invalid/reused code rejection, and name save passed. Waiting for the real resend interval…');
  await new Promise((resolve) => setTimeout(resolve, 61000));
  await service.requestCode(email);
  await assert.rejects(service.requestCode(email), /wait/i, 'Repeated returning-account requests must be limited.');
  const returning = await service.verifyCode(email, await emailedCode());
  assert.deepEqual(await service.loadAccount(returning.account), { ...session.account, name: 'Alex Rivera' });
  console.log('Returning account and persisted name passed.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
