// Opt-in service/HTTP/database checks. Use only a disposable local Supabase project.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
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
  const scratch = mkdtempSync(path.join(tmpdir(), 'template-check-'));
  function sql(statement) {
    const file = path.join(scratch, 'fault.sql');
    writeFileSync(file, `do $check$ begin ${statement} end; $check$;`);
    execFileSync('npx', ['--yes', 'supabase@3.1.0', 'db', 'query', '--workdir', process.env.TEMPLATE_TEST_WORKDIR,
      '--file', file], { stdio: 'inherit' });
  }
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

    const creating = createSupabaseWorkoutService(() => actor, randomUUID);
    const draft = { title: '  New plan  ', description: 'Saved together', exercises: [
      { id: 'draft-press', catalogId: 'repdb:bench-press', ...snapshot,
        sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 8 }] },
      { id: 'draft-press-again', catalogId: 'repdb:bench-press', ...snapshot,
        sets: [{ setNumber: 1, targetWeight: 0, targetReps: 12 }] },
    ] };
    for (const invalidSnapshot of [
      { images: { preferred: 'main', main: ' \t\n' } },
      { images: { preferred: 'main', main: '\u00a0\ufeff' } },
      { images: { preferred: 'pair', pair: { start: ' \t', peak: snapshot.images.pair.peak } } },
      { images: { preferred: 'pair', pair: { start: snapshot.images.pair.start, peak: '\n\r' } } },
      { images: { preferred: 'pair', pair: snapshot.images.pair, main: ' \u00a0' } },
      { name: '\u00a0' },
      { equipment: { kind: 'required', name: '\ufeff' } },
      { translations: { de: { name: '\u00a0' } } },
      { catalogId: 'repdb:bench-press\u00a0' },
    ]) {
      const imageId = randomUUID();
      const imageOperation = randomUUID();
      const imageContent = { ...draft, exercises: draft.exercises.map(exercise => ({ ...exercise, id: randomUUID() })) };
      Object.assign(imageContent.exercises[0], invalidSnapshot);
      const invalidImage = await actor.rpc('save_workout_template', {
        p_id: imageId, p_operation: imageOperation, p_content: imageContent, p_mode: 'create',
      });
      assert.equal(invalidImage.error?.code, '22023', 'Direct saves must reject descriptions the canonical model cannot read.');
      assert.equal(await creating.getTemplate(imageId), null);
      imageContent.exercises[0] = { ...draft.exercises[0], id: imageContent.exercises[0].id };
      const correctedImage = await actor.rpc('save_workout_template', {
        p_id: imageId, p_operation: imageOperation, p_content: imageContent, p_mode: 'create',
      });
      assert.ifError(correctedImage.error);
      assert.deepEqual((await creating.getTemplate(imageId)).exercises[0].images, snapshot.images);
      await creating.deleteTemplate(imageId);
    }
    console.log('Invalid direct snapshot saves leave neither an aggregate nor a successful-save identity.');
    const rangeId = randomUUID();
    const rangeOperation = randomUUID();
    const rangeContent = { ...draft, exercises: draft.exercises.map(exercise => ({ ...exercise, id: randomUUID() })) };
    rangeContent.exercises[0].sets = [{ setNumber: 1, targetWeight: 12.5, targetReps: 2147483648 }];
    const invalidRange = await actor.functions.invoke('workout-templates', {
      body: { action: 'create', id: rangeId, operationId: rangeOperation, content: rangeContent },
    });
    assert.equal(invalidRange.error?.context.status, 400, 'Storage-range input errors must be validation failures.');
    assert.equal((await invalidRange.error.context.json()).kind, 'validation');
    assert.equal(await creating.getTemplate(rangeId), null);
    rangeContent.exercises[0].sets[0].targetReps = 8;
    const correctedRange = await actor.functions.invoke('workout-templates', {
      body: { action: 'create', id: rangeId, operationId: rangeOperation, content: rangeContent },
    });
    assert.ifError(correctedRange.error);
    assert.equal((await creating.getTemplate(rangeId)).exercises[0].sets[0].targetReps, 8);
    await creating.deleteTemplate(rangeId);
    console.log('Out-of-range repetition input is validation, with no partial save or committed retry identity.');
    const context = {};
    const saved = await creating.createTemplate(draft, context);
    assert.equal(saved.title, 'New plan');
    assert.match(saved.id, /^[0-9a-f-]{36}$/);
    assert.notEqual(saved.exercises[0].id, saved.exercises[1].id);
    assert.deepEqual(await creating.getTemplate(saved.id), saved);
    assert.deepEqual(await creating.createTemplate(structuredClone(draft), context), saved);
    assert.notEqual((await creating.createTemplate(draft, {})).id, saved.id);
    console.log('Complete creation, independent UUID placements, duplicate names and unchanged retries round-trip.');

    const concurrentDraft = { ...draft, title: `Concurrent ${randomUUID()}` };
    const concurrentContext = {};
    const simultaneous = await Promise.all([creating.createTemplate(concurrentDraft, concurrentContext),
      creating.createTemplate(structuredClone(concurrentDraft), concurrentContext)]);
    assert.deepEqual(simultaneous[0], simultaneous[1]);
    assert.equal((await creating.listTemplates()).filter(template => template.title === concurrentDraft.title).length, 1);
    const session = (await actor.auth.getSession()).data.session;
    let dropResponse = true;
    const unreliable = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, { ...options, global: { fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (String(url).includes('/functions/v1/workout-templates') && JSON.parse(init.body).action === 'create' && dropResponse) {
        dropResponse = false;
        assert.equal(response.status, 200);
        throw new Error('Lost response after the server committed');
      }
      return response;
    } } });
    assert.ifError((await unreliable.auth.setSession(session)).error);
    const uncertain = createSupabaseWorkoutService(() => unreliable, randomUUID);
    const uncertainContext = {};
    const uncertainDraft = { ...draft, title: `Uncertain ${randomUUID()}` };
    await assert.rejects(uncertain.createTemplate(uncertainDraft, uncertainContext));
    const committed = (await creating.listTemplates()).filter(template => template.title === uncertainDraft.title);
    assert.equal(committed.length, 1);
    assert.deepEqual(await uncertain.createTemplate(structuredClone(uncertainDraft), uncertainContext), committed[0]);
    assert.deepEqual(await createSupabaseWorkoutService(() => actor).getTemplate(committed[0].id), committed[0]);
    console.log('Concurrent identical saves and a real committed-but-lost response recover one durable template.');

    const wireContent = { ...draft, title: 'Wire creation', exercises: draft.exercises.map(exercise => ({ ...exercise, id: randomUUID() })) };
    const wire = { action: 'create', id: randomUUID(), operationId: randomUUID(), content: wireContent };
    const firstWire = await actor.functions.invoke('workout-templates', { body: wire });
    assert.ifError(firstWire.error);
    assert.equal((await actor.functions.invoke('workout-templates', { body: {
      ...wire, content: { ...wireContent, title: 'Changed operation content' },
    } })).error.context.status, 400);
    const foreignReplay = await secondActor.functions.invoke('workout-templates', { body: wire });
    assert.equal(foreignReplay.error.context.status, 400);
    assert.deepEqual(await otherService.listTemplates(), []);
    assert.deepEqual(await creating.getTemplate(wire.id), firstWire.data);
    await assert.rejects(createSupabaseWorkoutService(() => createClient(settings.API_URL, settings.PUBLISHABLE_KEY, options), randomUUID)
      .createTemplate(draft, {}));
    for (const content of [
      { ...wireContent, title: '  ' }, { ...wireContent, exercises: [] },
      { ...wireContent, exercises: [{ ...wireContent.exercises[0], sets: [] }] },
      { ...wireContent, exercises: [{ ...wireContent.exercises[0], primaryMuscles: 'not an array' }] },
      ...[{ setNumber: 1, targetWeight: -1, targetReps: 8 }, { setNumber: 1, targetWeight: 0, targetReps: 0 },
        { setNumber: 2, targetWeight: 0, targetReps: 8 }].map(set => ({ ...wireContent,
        exercises: [{ ...wireContent.exercises[0], sets: [set] }] })),
    ]) {
      const rejected = await actor.functions.invoke('workout-templates', { body: { ...wire, id: randomUUID(), operationId: randomUUID(), content } });
      assert.equal(rejected.error.context.status, 400);
    }
    const invalidRpc = await actor.rpc('save_workout_template', { p_id: randomUUID(), p_operation: randomUUID(),
      p_content: { ...wireContent, exercises: [] } });
    assert.equal(invalidRpc.error.code, '22023');
    const anonymousRpc = await createClient(settings.API_URL, settings.PUBLISHABLE_KEY, options).rpc('save_workout_template', {
      p_id: randomUUID(), p_operation: randomUUID(), p_content: wireContent,
    });
    assert.equal(anonymousRpc.error.code, '42501');
    const privateMetadata = await actor.schema('template_private').from('save_operations').select('*');
    assert.ok(privateMetadata.error, 'Retry recognition is not an exposed table API.');
    console.log('Operation-content reuse, foreign replay, anonymous creation and invalid whole-template payloads are rejected.');

    const rollbackDraft = { ...draft, title: `Rollback ${randomUUID()}`, exercises: draft.exercises.map(exercise => ({ ...exercise,
      sets: [{ setNumber: 1, targetWeight: 5, targetReps: 777 }] })) };
    const rollbackContext = {};
    sql(`create function public.template_check_fail_set() returns trigger language plpgsql as $$ begin
      if auth.uid() = '${created.data.user.id}'::uuid and new.target_reps = 777 then raise exception 'Injected later set write failure'; end if;
      return new; end $$;
      create trigger template_check_fail_set before insert on public.template_sets for each row execute function public.template_check_fail_set();`);
    try {
      await assert.rejects(creating.createTemplate(rollbackDraft, rollbackContext));
      assert.equal((await creating.listTemplates()).filter(template => template.title === rollbackDraft.title).length, 0);
    } finally { sql('drop trigger if exists template_check_fail_set on public.template_sets; drop function if exists public.template_check_fail_set();'); }
    const recovered = await creating.createTemplate(rollbackDraft, rollbackContext);
    assert.equal(recovered.title, rollbackDraft.title);
    assert.deepEqual(await creating.getTemplate(recovered.id), recovered);
    await creating.deleteTemplate(wire.id);
    const deletedReplay = await actor.functions.invoke('workout-templates', { body: wire });
    assert.equal(deletedReplay.error.context.status, 404);
    const deletedContinuation = await actor.functions.invoke('workout-templates', { body: { ...wire, operationId: randomUUID() } });
    assert.equal(deletedContinuation.error.context.status, 404);
    assert.equal(await creating.getTemplate(wire.id), null);
    console.log('A failure after earlier aggregate writes rolls back completely and retries; deleted creations cannot be resurrected.');

    const deleted = await creating.createTemplate({ ...draft, title: 'Delete this plan' }, {});
    const history = await creating.listSessions();
    await otherService.deleteTemplate(deleted.id);
    assert.deepEqual(await creating.getTemplate(deleted.id), deleted);
    await otherService.deleteTemplate(randomUUID());
    await assert.rejects(anonymous.deleteTemplate(deleted.id));
    await assert.rejects(creating.deleteTemplate('not-a-uuid'));
    const invalidDelete = await actor.functions.invoke('workout-templates', { body: { action: 'delete', id: 'not-a-uuid' } });
    assert.equal(invalidDelete.error.context.status, 400);
    const deniedDelete = await createClient(settings.API_URL, settings.PUBLISHABLE_KEY, options).rpc('delete_workout_template', { p_id: deleted.id });
    assert.equal(deniedDelete.error.code, '42501');
    await creating.deleteTemplate(deleted.id);
    assert.equal(await creating.getTemplate(deleted.id), null);
    await creating.deleteTemplate(deleted.id);
    assert.deepEqual(await creating.listSessions(), history);
    console.log('Owner deletion, missing/foreign no-op outcomes, anonymous rejection and invalid IDs preserve account isolation and sample history.');

    const cascade = await creating.createTemplate({ ...draft, title: 'Atomic cascade deletion' }, {});
    sql(`create function public.template_check_fail_delete() returns trigger language plpgsql as $$ begin
      if auth.uid() = '${created.data.user.id}'::uuid and old.template_exercise_id = '${cascade.exercises[0].id}'::uuid
        then raise exception 'Injected child deletion failure'; end if;
      return old; end $$;
      create trigger template_check_fail_delete before delete on public.template_sets for each row execute function public.template_check_fail_delete();`);
    try {
      await assert.rejects(creating.deleteTemplate(cascade.id));
      assert.deepEqual(await creating.getTemplate(cascade.id), cascade);
    } finally { sql('drop trigger if exists template_check_fail_delete on public.template_sets; drop function if exists public.template_check_fail_delete();'); }
    await creating.deleteTemplate(cascade.id);
    assert.equal(await creating.getTemplate(cascade.id), null);
    console.log('A child cascade failure preserves the complete template; retry removes it atomically.');

    const lostDelete = await creating.createTemplate({ ...draft, title: 'Lost delete response' }, {});
    let dropDelete = true;
    const deletingClient = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, { ...options, global: { fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (String(url).includes('/functions/v1/workout-templates') && JSON.parse(init.body).action === 'delete' && dropDelete) {
        dropDelete = false;
        assert.equal(response.status, 200);
        throw new Error('Delete response lost after commit');
      }
      return response;
    } } });
    assert.ifError((await deletingClient.auth.setSession(session)).error);
    const deleting = createSupabaseWorkoutService(() => deletingClient);
    await assert.rejects(deleting.deleteTemplate(lostDelete.id));
    assert.equal(await creating.getTemplate(lostDelete.id), null);
    await deleting.deleteTemplate(lostDelete.id);

    const raceContext = {};
    const raceDraft = { ...draft, title: 'Concurrent retry and delete' };
    const raceTemplate = await creating.createTemplate(raceDraft, raceContext);
    const race = await Promise.allSettled([creating.createTemplate(raceDraft, raceContext), creating.deleteTemplate(raceTemplate.id)]);
    assert.equal(race[1].status, 'fulfilled');
    if (race[0].status === 'fulfilled') assert.deepEqual(race[0].value, raceTemplate);
    else assert.equal(race[0].reason.kind, 'missing');
    assert.equal(await creating.getTemplate(raceTemplate.id), null);
    await assert.rejects(creating.createTemplate(raceDraft, raceContext), error => error.kind === 'missing');
    console.log('Lost delete responses retry safely; concurrent creation replay and deletion never resurrect a committed template.');

  } finally {
    for (const id of accountIds) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
    rmSync(scratch, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
