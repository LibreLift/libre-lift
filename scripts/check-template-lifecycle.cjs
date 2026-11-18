// Only run against a disposable local project; fixture accounts are removed on exit.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const previous = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, filename);
const { createSupabaseWorkoutService } = require('../src/services/supabase-workout-service.ts');
require.extensions['.ts'] = previous;

async function main() {
  if (!process.env.TEMPLATE_TEST_WORKDIR) throw new Error('Set TEMPLATE_TEST_WORKDIR to a disposable local project.');
  const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir',
    path.resolve(process.env.TEMPLATE_TEST_WORKDIR), '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }));
  assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
  const admin = createClient(settings.API_URL, settings.SECRET_KEY, { auth: { persistSession: false } });
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
  const client = () => createClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const accounts = [];
  async function signIn(target, email) {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    assert.ifError(link.error);
    const verified = await target.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
    assert.ifError(verified.error);
    return verified.data.user;
  }
  try {
    const email = `templates125-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ifError(created.error);
    accounts.push(created.data.user.id);
    const initial = client();
    const owner = await signIn(initial, email);
    assert.ifError((await initial.from('users').insert({ id: owner.id, account_name: 'Lifecycle owner' })).error);
    const service = createSupabaseWorkoutService(() => initial, randomUUID, { accountId: owner.id });
    assert.deepEqual(await service.listTemplates(), []);
    const content = { title: 'Durable template', description: 'Same account and backend', exercises: [{
      id: 'draft-placement', catalogId: 'repdb:press', name: 'Saved press', primaryMuscles: ['Chest'],
      secondaryMuscles: [], equipment: { kind: 'none' }, sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }],
    }] };
    const saved = await service.createTemplate(content, {});
    const reopened = client();
    assert.equal((await reopened.auth.getSession()).data.session.user.id, owner.id);
    const restored = createSupabaseWorkoutService(() => reopened, randomUUID, { accountId: owner.id });
    assert.deepEqual(await restored.getTemplate(saved.id), saved);
    assert.ifError((await reopened.auth.refreshSession()).error);
    assert.deepEqual(await restored.getTemplate(saved.id), saved);
    assert.ifError((await reopened.auth.signOut({ scope: 'local' })).error);
    const fresh = client();
    assert.equal((await fresh.auth.getSession()).data.session, null);
    await signIn(fresh, email);
    const renewed = createSupabaseWorkoutService(() => fresh, randomUUID, { accountId: owner.id });
    assert.deepEqual(await renewed.getTemplate(saved.id), saved);
    const otherEmail = `other-${email}`;
    const other = await admin.auth.admin.createUser({ email: otherEmail, email_confirm: true });
    assert.ifError(other.error);
    accounts.push(other.data.user.id);
    await signIn(fresh, otherEmail);
    assert.ifError((await fresh.from('users').insert({ id: other.data.user.id, account_name: 'Other owner' })).error);
    await assert.rejects(renewed.createTemplate(content, {}), /account changed/i);
    const otherService = createSupabaseWorkoutService(() => fresh, randomUUID, { accountId: other.data.user.id });
    assert.deepEqual(await otherService.listTemplates(), []);
    await signIn(fresh, email);
    assert.deepEqual(await renewed.getTemplate(saved.id), saved);
    console.log('Template restoration, current-token renewal, renewed local access, and account-bound requests passed.');
  } finally {
    for (const id of accounts) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
