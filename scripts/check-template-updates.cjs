// Opt-in production service/HTTP/database checks; disposable local projects only.
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
  const workdir = process.env.TEMPLATE_TEST_WORKDIR;
  if (!workdir) throw new Error('Set TEMPLATE_TEST_WORKDIR to a disposable local Supabase project.');
  const settings = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.1.0', 'status', '--workdir', path.resolve(workdir), '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }));
  assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(settings.API_URL, settings.SECRET_KEY, options);
  const accounts = [];
  const scratch = mkdtempSync(path.join(tmpdir(), 'template-update-check-'));
  function sql(statement) {
    const file = path.join(scratch, 'fault.sql');
    writeFileSync(file, `do $check$ begin ${statement} end; $check$;`);
    execFileSync('npx', ['--yes', 'supabase@3.1.0', 'db', 'query', '--workdir', workdir, '--file', file], { stdio: 'inherit' });
  }
  async function actor(name, request = fetch) {
    const email = `${name}-${randomUUID()}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ifError(created.error);
    accounts.push(created.data.user.id);
    const client = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, { ...options, global: { fetch: request } });
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    assert.ifError(link.error);
    assert.ifError((await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })).error);
    assert.ifError((await client.from('users').insert({ id: created.data.user.id, account_name: name })).error);
    return client;
  }
  const exercise = (id, weight) => ({ id, catalogId: 'repdb:press', name: 'Saved press',
    primaryMuscles: ['chest'], secondaryMuscles: [], equipment: { kind: 'none' },
    sets: [{ setNumber: 1, targetWeight: weight, targetReps: 8 }] });
  const draft = { title: 'Original', description: 'Saved description', exercises: [exercise('placement-1', 10), exercise('placement-2', 20)] };
  try {
    const requests = [];
    const owner = await actor('update-owner', async (url, init) => {
      if (String(url).includes('/functions/v1/workout-templates')) requests.push(JSON.parse(init.body));
      return fetch(url, init);
    });
    const service = createSupabaseWorkoutService(() => owner, randomUUID);
    const original = await service.createTemplate(draft);
    const edited = await service.updateTemplate(original.id, { ...original, title: 'Edited',
      exercises: [original.exercises[1], { ...original.exercises[0], sets: [{ setNumber: 1, targetWeight: 12.5, targetReps: 6 }] }] }, {});
    assert.equal(edited.title, 'Edited');
    assert.equal(edited.createdAt, original.createdAt);
    assert.deepEqual(edited.exercises.map(exercise => exercise.id), [original.exercises[1].id, original.exercises[0].id]);
    assert.deepEqual(edited.exercises[1].sets, [{ setNumber: 1, targetWeight: 12.5, targetReps: 6 }]);
    assert.deepEqual(await service.getTemplate(original.id), edited);
    console.log('Whole-template edits and order swaps preserve placement identity, targets and creation time.');
    const originalUpdate = requests.find(request => request.action === 'update');
    const changed = await service.updateTemplate(original.id, { ...edited, title: 'Membership changed',
      exercises: [edited.exercises[0], exercise('new-placement', 0)] }, {});
    assert.equal(changed.exercises[0].id, original.exercises[1].id);
    assert.notEqual(changed.exercises[1].id, original.exercises[0].id);
    assert.equal(changed.exercises[1].sets[0].targetWeight, 0);
    assert.deepEqual(await service.getTemplate(original.id), changed);
    const replay = await owner.functions.invoke('workout-templates', { body: originalUpdate });
    assert.ifError(replay.error);
    assert.deepEqual(replay.data, edited);
    assert.deepEqual(await service.getTemplate(original.id), changed);
    const reused = await owner.functions.invoke('workout-templates', { body: { ...originalUpdate,
      content: { ...originalUpdate.content, title: 'Reused operation with different content' } } });
    assert.equal(reused.error.context.status, 400);
    const metadataContext = {};
    let details = await service.updateTemplateDetails(original.id, { title: 'Details only', description: 'Changed notes' }, metadataContext);
    assert.deepEqual(details.exercises, changed.exercises);
    assert.equal(details.createdAt, original.createdAt);
    const laterMetadata = await service.updateTemplate(original.id, { ...details, title: 'Later metadata', exercises: [...details.exercises].reverse() }, {});
    assert.deepEqual(await service.updateTemplateDetails(original.id, { title: 'Details only', description: 'Changed notes' }, metadataContext), details);
    assert.deepEqual(await service.getTemplate(original.id), laterMetadata);
    details = laterMetadata;
    console.log('Membership changes map new placements; old operation replay returns its original result without overwriting newer state.');

    const unrelated = await service.createTemplate({ ...draft, title: 'Another template' });
    await assert.rejects(service.updateTemplate(original.id, { ...details,
      exercises: [unrelated.exercises[0]] }, {}), error => error.kind === 'validation');
    assert.deepEqual(await service.getTemplate(unrelated.id), unrelated);
    assert.deepEqual(await service.getTemplate(original.id), details);
    const other = await actor('update-other');
    const otherService = createSupabaseWorkoutService(() => other, randomUUID);
    const foreign = await otherService.createTemplate(draft);
    await assert.rejects(service.updateTemplate(original.id, { ...details, exercises: [foreign.exercises[0]] }, {}));
    await assert.rejects(otherService.updateTemplate(original.id, details, {}), error => error.kind === 'missing');
    await assert.rejects(otherService.updateTemplate(randomUUID(), details, {}), error => error.kind === 'missing');
    assert.deepEqual(await otherService.getTemplate(foreign.id), foreign);
    assert.deepEqual(await service.getTemplate(original.id), details);
    console.log('Same-owner unrelated placements and foreign placement/parent writes cannot change either aggregate.');

    const versions = [
      { ...details, title: 'Concurrent A', exercises: [{ ...details.exercises[0], sets: [{ setNumber: 1, targetWeight: 31, targetReps: 3 }] }] },
      { ...details, title: 'Concurrent B', exercises: [...details.exercises].reverse().map(value => ({ ...value,
        sets: [{ setNumber: 1, targetWeight: 42, targetReps: 4 }, { setNumber: 2, targetWeight: 43, targetReps: 5 }] })) },
    ];
    const results = await Promise.all(versions.map(version => service.updateTemplate(original.id, version, {})));
    const concurrentSaved = await service.getTemplate(original.id);
    assert.ok(results.some(result => JSON.stringify(result) === JSON.stringify(concurrentSaved)), 'Concurrent writes must not mix aggregates.');
    const last = await service.updateTemplate(original.id, { ...details, title: 'Last committed' }, {});
    assert.deepEqual(await service.getTemplate(original.id), last);
    console.log('Concurrent distinct writes remain whole; the subsequent last committed save becomes the saved version.');

    const session = (await owner.auth.getSession()).data.session;
    const lostCreates = [];
    let loseCreation = true;
    const unreliable = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, { ...options, global: { fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (String(url).includes('/functions/v1/workout-templates') && JSON.parse(init.body).action === 'create') {
        lostCreates.push(JSON.parse(init.body));
        if (loseCreation) { loseCreation = false; assert.equal(response.status, 200); throw new Error('Lost committed creation response'); }
      }
      return response;
    } } });
    assert.ifError((await unreliable.auth.setSession(session)).error);
    const uncertain = createSupabaseWorkoutService(() => unreliable, randomUUID);
    const creationContext = {};
    await assert.rejects(uncertain.createTemplate(draft, creationContext));
    const recovered = await uncertain.createTemplate({ ...draft, title: 'Changed after uncertainty',
      exercises: [draft.exercises[1], exercise('placement-3', 30)] }, creationContext);
    assert.equal(recovered.id, lostCreates[0].id);
    assert.equal(recovered.exercises[0].id, lostCreates[0].content.exercises[1].id);
    const oldCreation = await owner.functions.invoke('workout-templates', { body: lostCreates[0] });
    assert.ifError(oldCreation.error);
    assert.equal(oldCreation.data.title, 'Original');
    assert.deepEqual(await service.getTemplate(recovered.id), recovered);
    console.log('Changed creation drafts continue the same committed template; delayed original creation replay cannot undo them.');

    const ownerId = (await owner.auth.getUser()).data.user.id;
    sql(`create function public.template_update_check_fail_set() returns trigger language plpgsql as $$ begin
      if auth.uid() = '${ownerId}'::uuid and new.target_reps = 777 then raise exception 'Injected later set failure'; end if;
      return new; end $$;
      create trigger template_update_check_fail_set before insert on public.template_sets for each row execute function public.template_update_check_fail_set();`);
    const failing = { ...last, title: 'Must roll back', exercises: [{ ...last.exercises[0], sets: [{ setNumber: 1, targetWeight: 9, targetReps: 777 }] }] };
    const failureContext = {};
    const failedCreationContext = {};
    try {
      await assert.rejects(service.updateTemplate(original.id, failing, failureContext));
      assert.deepEqual(await service.getTemplate(original.id), last);
      await assert.rejects(service.createTemplate({ ...draft, title: 'Failed creation',
        exercises: [exercise('placement-9', 9)].map(value => ({ ...value, sets: [{ setNumber: 1, targetWeight: 9, targetReps: 777 }] })) }, failedCreationContext));
    } finally {
      sql('drop trigger if exists template_update_check_fail_set on public.template_sets; drop function if exists public.template_update_check_fail_set();');
    }
    const afterRollback = await service.updateTemplate(original.id, failing, failureContext);
    assert.deepEqual(await service.getTemplate(original.id), afterRollback);
    const failedCreationWire = requests.filter(request => request.action === 'create' && request.content.title === 'Failed creation').at(-1);
    assert.equal(await service.getTemplate(failedCreationWire.id), null);
    const changedAfterRollback = await service.createTemplate({ ...draft, title: 'Corrected creation' }, failedCreationContext);
    assert.equal(changedAfterRollback.id, failedCreationWire.id);
    assert.deepEqual(await service.getTemplate(changedAfterRollback.id), changedAfterRollback);
    console.log('Late update failure rolls back removed sets and metadata; changed failed creation reuses its identity without a false committed receipt.');

    assert.ifError((await owner.from('workout_templates').delete().eq('id', original.id)).error);
    await assert.rejects(service.updateTemplate(original.id, last, {}), error => error.kind === 'missing');
    assert.equal(await service.getTemplate(original.id), null);
    console.log('An update after deletion is missing and never recreates the template.');
  } finally {
    for (const id of accounts) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
    rmSync(scratch, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
