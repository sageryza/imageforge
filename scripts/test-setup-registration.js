#!/usr/bin/env node
// The pasted Setup script's settings registration — extracted from the REAL
// generated public/setup.sh, never copied here, and driven against fixture
// files. Exists because the paste is meant to be the LAST one (2026-08-28,
// Sophie: "it's gotta be an easier way than paste every time", and her
// correction that session init has no network, so the field cannot fetch):
// the registered command prefers the imageforge CHECKOUT's hook, which is
// cloned fresh from main every session — so hook fixes ride the deploy and
// the pasted copy never goes stale again. If the command or the upgrade rule
// drifts, the paste stops being the last one, silently.
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const setup = fs.readFileSync(path.join(__dirname, '..', 'public', 'setup.sh'), 'utf8');
const m = setup.match(/python3 - << 'PY_SETTINGS' \|\| true\n([\s\S]*?)\nPY_SETTINGS/);
if (!m) { console.error('PY_SETTINGS block not found in public/setup.sh'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { console.log('  ok   ' + label); pass++; }
  else { console.log('  FAIL ' + label + (extra ? '\n       ' + extra : '')); fail++; }
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setupreg-'));
const sfile = path.join(root, 'settings.json');
const block = m[1].replaceAll('/home/user/.claude/settings.json', sfile);

// a stale environment: the old fixed-path command already registered
fs.writeFileSync(sfile, JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: 'command',
    command: 'bash /home/user/.claude/hooks/post-to-feed.sh' }] }] },
  outputStyle: 'Concise',
}));
execFileSync('python3', ['-c', block], { stdio: 'pipe' });
const s1 = JSON.parse(fs.readFileSync(sfile, 'utf8'));
execFileSync('python3', ['-c', block], { stdio: 'pipe' });
const s2 = JSON.parse(fs.readFileSync(sfile, 'utf8'));

console.log('the registration upgrades a stale environment');
ok('running twice changes nothing (idempotent)', JSON.stringify(s1) === JSON.stringify(s2));
let cmd = '';
for (const ev of ['Stop', 'UserPromptSubmit', 'PostToolUse']) {
  const arr = (s1.hooks || {})[ev] || [];
  ok(ev + ': exactly one entry, and it names the checkout',
    arr.length === 1 && JSON.stringify(arr[0]).includes('imageforge/.claude/hooks'),
    JSON.stringify(arr));
  cmd = arr[0].hooks[0].command;
}
ok('an unrelated hook survives the upgrade', (() => {
  fs.writeFileSync(sfile, JSON.stringify({ hooks: { Stop: [
    { hooks: [{ type: 'command', command: 'bash /somewhere/else.sh' }] },
    { hooks: [{ type: 'command', command: 'bash /home/user/.claude/hooks/post-to-feed.sh' }] },
  ] } }));
  execFileSync('python3', ['-c', block], { stdio: 'pipe' });
  const s = JSON.parse(fs.readFileSync(sfile, 'utf8'));
  return s.hooks.Stop.length === 2 && JSON.stringify(s.hooks.Stop[0]).includes('/somewhere/else.sh');
})());

console.log('\nthe registered command routes to the right copy');
const fx = path.join(root, 'fx');
fs.mkdirSync(path.join(fx, 'imageforge', '.claude', 'hooks'), { recursive: true });
fs.mkdirSync(path.join(fx, '.claude', 'hooks'), { recursive: true });
const run = (input) => execFileSync('bash', ['-c', cmd.replaceAll('/home/user', fx)],
  { encoding: 'utf8', input: input || '' }).trim();
fs.writeFileSync(path.join(fx, 'imageforge', '.claude', 'hooks', 'post-to-feed.sh'), 'echo CHECKOUT');
fs.writeFileSync(path.join(fx, '.claude', 'hooks', 'post-to-feed.sh'), 'echo BAKED');
ok('the checkout copy wins when it exists', run() === 'CHECKOUT');
fs.rmSync(path.join(fx, 'imageforge', '.claude', 'hooks', 'post-to-feed.sh'));
ok('the baked copy is the fallback', run() === 'BAKED');
fs.writeFileSync(path.join(fx, '.claude', 'hooks', 'post-to-feed.sh'), 'cat');
ok('stdin passes through (hooks read their JSON there)', run('{"x":1}') === '{"x":1}');

fs.rmSync(root, { recursive: true, force: true });
console.log('\n' + (fail ? fail + ' FAILED' : 'all passed') + ' (' + pass + ' checks)');
process.exit(fail ? 1 : 0);
