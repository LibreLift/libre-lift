// Opt-in service/HTTP/database checks. Use only a disposable local Supabase project.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, filename);
const { createSupabaseWorkoutService } = require('../src/services/supabase-workout-service.ts');
require.extensions['.ts'] = previousLoader;

async function main() {
  if (!process.env.TEMPLATE_TEST_WORKDIR) throw new Error('Set TEMPLATE_TEST_WORKDIR to a disposable local Supabase project.');
  const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir', path.resolve(process.env.TEMPLATE_TEST_WORKDIR), '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }));
  assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(settings.API_URL, settings.SECRET_KEY, options);
  const accountIds = [];
  try {
    const email = `templates-${Date.now()}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ifError(created.error);
    accountIds.push(created.data.user.id);
    const actor = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, options);
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    assert.ifError(link.error);
    assert.ifError((await actor.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })).error);
    assert.ifError((await actor.from('users').insert({ id: created.data.user.id, account_name: 'Template check' })).error);
    const service = createSupabaseWorkoutService(() => actor);
    assert.deepEqual(await service.listTemplates(), []);
    console.log('An authenticated empty account returns no sample templates.');
    const templateId = randomUUID();
    const placementId = randomUUID();
    const snapshot = { name: 'Saved bench', primaryMuscles: ['pectoralis major'], secondaryMuscles: ['triceps'],
      equipment: { kind: 'none' }, instructions: ['Keep the saved description.'],
      images: { preferred: 'pair', pair: { start: 'https://example.com/start.jpg', peak: 'https://example.com/peak.jpg' }, main: 'https://example.com/main.jpg' },
      translations: { de: { name: 'Bankdrücken', instructions: ['Gespeicherte Anleitung.'] }, es: { name: 'Press de banca' } } };
    assert.ifError((await actor.from('workout_templates').insert({ id: templateId, user_id: created.data.user.id,
      title: 'Saved template', description: null, created_at: '2026-11-18T12:00:00Z' })).error);
    assert.ifError((await actor.from('template_exercises').insert({ id: placementId, template_id: templateId, position: 1,
      catalog_id: 'repdb:bench-press', snapshot })).error);
    assert.ifError((await actor.from('template_sets').insert([
      { template_exercise_id: placementId, set_number: 2, target_weight: 12.5, target_reps: 8 },
      { template_exercise_id: placementId, set_number: 1, target_weight: 0, target_reps: 12 },
    ])).error);
    const expected = { id: templateId, title: 'Saved template', description: '', createdAt: '2026-11-18T12:00:00+00:00',
      exercises: [{ id: placementId, catalogId: 'repdb:bench-press', ...snapshot,
        sets: [{ setNumber: 1, targetWeight: 0, targetReps: 12 }, { setNumber: 2, targetWeight: 12.5, targetReps: 8 }] }] };
    assert.deepEqual(await service.listTemplates(), [expected]);
    assert.deepEqual(await service.getTemplate(templateId), expected);
    assert.equal(await service.getTemplate(randomUUID()), null);
    console.log('Saved snapshots, ordered sets, zero/decimal weights, timestamps, and missing detail round-trip.');
    const secondPlacement = randomUUID();
    assert.ifError((await actor.from('template_exercises').insert({ id: secondPlacement, template_id: templateId, position: 2,
      catalog_id: 'repdb:bench-press', snapshot })).error);
    assert.ifError((await actor.from('template_sets').insert({ template_exercise_id: secondPlacement, set_number: 1, target_weight: 50, target_reps: 5 })).error);
    const repeated = await service.getTemplate(templateId);
    assert.equal(repeated.exercises[1].id, secondPlacement);
    assert.deepEqual(repeated.exercises[1].sets, [{ setNumber: 1, targetWeight: 50, targetReps: 5 }]);
    assert.deepEqual(repeated.exercises[0].sets, expected.exercises[0].sets);
    const prefix = randomUUID().slice(0, 24);
    const fixtures = Array.from({ length: 1001 }, (_, index) => ({ id: prefix + (index + 1).toString(16).padStart(12, '0'),
      user_id: created.data.user.id, title: `Batch ${index + 1}`, created_at: '2026-11-19T12:00:00Z' }));
    const placements = fixtures.map(template => ({ id: randomUUID(), template_id: template.id, position: 1,
      catalog_id: 'repdb:bench-press', snapshot: { name: 'Bench', primaryMuscles: [], secondaryMuscles: [], equipment: { kind: 'none' } } }));
    for (let offset = 0; offset < fixtures.length; offset += 200) {
      assert.ifError((await actor.from('workout_templates').insert(fixtures.slice(offset, offset + 200).reverse())).error);
      assert.ifError((await actor.from('template_exercises').insert(placements.slice(offset, offset + 200))).error);
      assert.ifError((await actor.from('template_sets').insert(placements.slice(offset, offset + 200).map(placement => ({
        template_exercise_id: placement.id, set_number: 1, target_weight: 5, target_reps: 5,
      })))).error);
    }
    assert.ifError((await actor.from('template_sets').insert(Array.from({ length: 999 }, (_, index) => ({
      template_exercise_id: placementId, set_number: index + 3, target_weight: 5, target_reps: 5,
    })))).error);
    const all = await service.listTemplates();
    assert.equal(all.length, 1002);
    assert.equal(all[0].id, templateId);
    assert.equal(all[0].exercises[0].sets.length, 1001);
    assert.deepEqual(all[0].exercises[0].sets.at(-1), { setNumber: 1001, targetWeight: 5, targetReps: 5 });
    assert.equal(all[1].title, 'Batch 1');
    assert.equal(all[1001].title, 'Batch 1001');
    console.log('Repeated placements remain independent; lists and child sets beyond 1,000 are complete and deterministically ordered.');
    const secondEmail = `other-${email}`;
    const secondUser = await admin.auth.admin.createUser({ email: secondEmail, email_confirm: true });
    assert.ifError(secondUser.error);
    accountIds.push(secondUser.data.user.id);
    const secondActor = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, options);
    const secondLink = await admin.auth.admin.generateLink({ type: 'magiclink', email: secondEmail });
    assert.ifError(secondLink.error);
    assert.ifError((await secondActor.auth.verifyOtp({ token_hash: secondLink.data.properties.hashed_token, type: 'magiclink' })).error);
    assert.ifError((await secondActor.from('users').insert({ id: secondUser.data.user.id, account_name: 'Other user' })).error);
    const otherService = createSupabaseWorkoutService(() => secondActor);
    assert.deepEqual(await otherService.listTemplates(), []);
    assert.equal(await otherService.getTemplate(templateId), null);
    const anonymous = createSupabaseWorkoutService(() => createClient(settings.API_URL, settings.PUBLISHABLE_KEY, options));
    await assert.rejects(anonymous.listTemplates());
    await assert.rejects(service.getTemplate('invalid-id'));
    const invalidToken = await fetch(`${settings.API_URL}/functions/v1/workout-templates`, {
      method: 'POST', headers: { apikey: settings.PUBLISHABLE_KEY, Authorization: 'Bearer invalid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' }),
    });
    assert.equal(invalidToken.status, 401);
    console.log('Actual anonymous/malformed authentication is rejected; foreign and missing detail are indistinguishable.');

  } finally {
    for (const id of accountIds) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
