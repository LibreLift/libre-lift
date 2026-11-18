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
    assert.equal(message.Subject, 'Your LibreLift code');
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
  assert.deepEqual(await service.updateName('Alex'), { ...session.account, name: 'Alex' });
  console.log('Verified access and name persistence.');
  console.log('New account, code-only email, invalid/reused code rejection, and name save passed. Waiting for the real resend interval…');
  await new Promise((resolve) => setTimeout(resolve, 61000));
  await service.requestCode(email);
  await assert.rejects(service.requestCode(email), /wait/i, 'Repeated returning-account requests must be limited.');
  const returning = await service.verifyCode(email, await emailedCode());
  assert.deepEqual(returning.account, { ...session.account, name: 'Alex' });
  console.log('Returning account and persisted name passed.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
