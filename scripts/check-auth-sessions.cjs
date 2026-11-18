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
require.extensions['.ts'] = previousLoader;

async function main() {
  if (!process.env.AUTH_TEST_WORKDIR) throw new Error('Set AUTH_TEST_WORKDIR to a disposable local Supabase project.');
  const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir', path.resolve(process.env.AUTH_TEST_WORKDIR), '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }));
  assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
  const admin = createClient(settings.API_URL, settings.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const records = new Map();
  const storage = { getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value); }, removeItem: (key) => { records.delete(key); } };
  function client(store = storage) {
    return createClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
      auth: { storage: store, storageKey: 'auth43-check', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  const email = `session43-${Date.now()}@example.com`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.ifError(created.error);
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
  } finally {
    const removed = await admin.auth.admin.deleteUser(created.data.user.id);
    assert.ifError(removed.error);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
