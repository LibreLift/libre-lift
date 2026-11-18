import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'open-fit-db-'));
const backend = join(scratch, 'supabase');
const migrations = join(backend, 'migrations');
mkdirSync(migrations, { recursive: true });
// Config validation resolves email templates even for a database-only stack.
cpSync(join(root, 'supabase/templates'), join(backend, 'templates'), { recursive: true });
cpSync(join(root, 'supabase/functions'), join(backend, 'functions'), { recursive: true });

// Only this generated project can be reset or stopped; no linked/hosted state is copied.
let config = readFileSync(join(root, 'supabase/config.toml'), 'utf8')
  .replace(/^project_id = .*$/m, `project_id = "open-fit-verify-${process.pid}"`)
  .replace('[functions.health]\nenabled = true', '[functions.health]\nenabled = false');
for (const original of [54320, 54321, 54322, 54323, 54324, 8083]) {
  const server = createServer();
  await new Promise((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise(done => server.close(done));
  config = config.replace(new RegExp(`\\b${original}\\b`, 'g'), String(port));
}
writeFileSync(join(backend, 'config.toml'), config);

function cli(...args) {
  const result = spawnSync('npx', ['--yes', 'supabase@3.1.0', ...args, '--workdir', scratch], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Supabase ${args.slice(0, 2).join(' ')} failed (${result.status})`);
}
function sql(statement) {
  const path = join(scratch, 'check.sql');
  writeFileSync(path, statement);
  cli('db', 'query', '--file', path);
}
function check(condition, message) {
  sql(`do $$ begin if not (${condition}) then raise exception '${message}'; end if; end $$;`);
}
function apply(filename) {
  copyFileSync(join(root, 'supabase/migrations', filename), join(migrations, filename));
  cli('migration', 'up');
}
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  const result = spawnSync('npx', ['--yes', 'supabase@3.1.0', 'stop', '--no-backup', '--workdir', scratch], { stdio: 'inherit' });
  if (result.status === 0) rmSync(scratch, { recursive: true, force: true });
  else {
    console.error(`Cleanup failed; isolated project configuration retained at ${scratch}`);
    process.exitCode = 1;
  }
}
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });

const account = '40000000-0000-4000-8000-000000000001';
const template = '40000000-0000-4000-8000-000000000002';
const placement = '40000000-0000-4000-8000-000000000003';
try {
  console.log('Starting an isolated database; existing local and hosted projects are untouched.');
  cli('start', '--exclude', 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor');
  sql(`insert into auth.users (id, email, aud, role, email_confirmed_at)
    values ('${account}', 'migration@example.test', 'authenticated', 'authenticated', now());`);
  const files = readdirSync(join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
  apply(files[0]);
  check(`exists (select 1 from auth.users where id = '${account}' and email = 'migration@example.test'
    and role = 'authenticated' and email_confirmed_at is not null) and not exists (select 1 from public.users)`,
    'Initial migration must preserve Auth accounts without inventing application Users');
  sql(`insert into public.users values ('${account}', 'Migration sentinel');`);
  apply(files[1]);
  check(`exists (select 1 from public.users where id = '${account}' and account_name = 'Migration sentinel')`,
    'Incremental migration lost the application User');
  sql(`do $$ begin insert into public.workout_templates (id, user_id, title, description, created_at)
      values ('${template}', '${account}', 'Sentinel template', 'Retained description', '2026-11-17T12:00:00Z');
    insert into public.template_exercises (id, template_id, position, catalog_id, snapshot)
      values ('${placement}', '${template}', 1, 'repdb:bench-press',
        '{"name":"Bench press","primaryMuscles":["pectoralis major"],"secondaryMuscles":[],"equipment":{"kind":"none"}}');
    insert into public.template_sets values ('${placement}', 1, 12.5, 8); end $$;`);
  // Later feature migrations must preserve an already-populated M1 aggregate.
  for (const filename of files.slice(2)) apply(filename);
  cli('migration', 'up');
  check(`exists (select 1 from public.users u join public.workout_templates t on t.user_id = u.id
    join public.template_exercises e on e.template_id = t.id
    join public.template_sets s on s.template_exercise_id = e.id
    where u.id = '${account}' and u.account_name = 'Migration sentinel'
      and t.id = '${template}' and t.title = 'Sentinel template' and t.description = 'Retained description'
      and t.created_at = '2026-11-17T12:00:00Z'::timestamptz
      and e.id = '${placement}' and e.position = 1 and e.catalog_id = 'repdb:bench-press'
      and e.snapshot->>'name' = 'Bench press' and s.set_number = 1 and s.target_weight = 12.5 and s.target_reps = 8)`,
    'Migration application changed or lost saved template data');
  console.log('Populated migration checks passed. Rebuilding from committed migrations.');
  cli('db', 'reset', '--no-seed');
  cli('test', 'db', join(root, 'supabase/tests/database'));
  console.log('Clean rebuild, populated migrations, and database behavior tests passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
