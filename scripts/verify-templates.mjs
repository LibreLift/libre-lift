import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'open-fit-templates-'));
const backend = join(scratch, 'supabase');
mkdirSync(backend);
for (const part of ['migrations', 'functions', 'templates']) {
  cpSync(join(root, 'supabase', part), join(backend, part), { recursive: true });
}
const ports = new Map();
for (const original of [54320, 54321, 54322, 54323, 54324, 8083]) {
  let port;
  do {
    const server = createServer();
    await new Promise((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
    port = server.address().port;
    await new Promise(done => server.close(done));
  } while ([...ports.values()].includes(port));
  ports.set(original, port);
}
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8')
  .replace(/^project_id = .*$/m, `project_id = "open-fit-templates-${process.pid}"`)
  .replace(/\b(54320|54321|54322|54323|54324|8083)\b/g, value => String(ports.get(Number(value))));
writeFileSync(join(backend, 'config.toml'), config);
// Startup output contains local credentials; keep it private and out of normal test output.
const log = openSync(join(scratch, 'backend.log'), 'w', 0o600);
const args = ['--yes', 'supabase@3.1.0'];
let functions;
function cli(...command) {
  const result = spawnSync('npx', [...args, ...command, '--workdir', scratch], { stdio: ['ignore', log, log] });
  if (result.error || result.status !== 0) throw new Error(`Local Supabase ${command[0]} failed. See ${scratch}/backend.log.`);
}
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (functions?.pid) {
    try { process.kill(-functions.pid, 'SIGTERM'); } catch { /* Server already exited. */ }
  }
  const stopped = spawnSync('npx', [...args, 'stop', '--no-backup', '--workdir', scratch], { stdio: ['ignore', log, log] });
  if (stopped.status === 0 && !process.exitCode) rmSync(scratch, { recursive: true, force: true });
  else {
    console.error(`Verification files retained at ${scratch}.`);
    if (stopped.status !== 0) { console.error('Disposable backend cleanup failed.'); process.exitCode = 1; }
  }
}
process.once('SIGINT', () => { process.exitCode = 130; cleanup(); process.exit(130); });
process.once('SIGTERM', () => { process.exitCode = 143; cleanup(); process.exit(143); });
try {
  console.log('Starting a disposable template backend; existing local and hosted projects are untouched.');
  cli('start', '--exclude', 'realtime,storage-api,imgproxy,postgres-meta,studio,logflare,vector,supavisor');
  functions = spawn('npx', [...args, 'functions', 'serve', '--workdir', scratch], {
    detached: true, stdio: ['ignore', log, log],
  });
  const health = `http://127.0.0.1:${ports.get(54321)}/functions/v1/health`;
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { ready = (await fetch(health)).ok; } catch { /* Wait for the disposable function server. */ }
    if (ready) break;
    await new Promise(done => setTimeout(done, 300));
  }
  if (!ready) throw new Error(`Disposable function startup timed out. See ${scratch}/backend.log.`);
  for (const script of ['check-templates.cjs', 'check-template-updates.cjs', 'check-template-lifecycle.cjs']) {
    const result = spawnSync(process.execPath, [join(root, 'scripts', script)], {
      cwd: root, env: { ...process.env, TEMPLATE_TEST_WORKDIR: scratch }, stdio: 'inherit',
    });
    if (result.error || result.status !== 0) throw new Error(`${script} failed.`);
  }
  console.log('Template CRUD, isolation, retries, rollback, and account lifecycle checks passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
