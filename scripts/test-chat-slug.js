#!/usr/bin/env node
// What a session's chat is CALLED — the slug rules at the top of the hook,
// driven against real fixture git repos.
//
// It earns its place because the failure is SILENT and permanent: the server
// binds a session to its slug on the first post and keeps it forever, so a
// chat that starts life as `chat-5d92c228` stays unrecognisable, and a message
// Sophie types into that row is answered by nobody (2026-08-28: three such
// chats in one day, one holding an unanswered message of hers).
//
// The naming block is EXTRACTED from the live hook rather than copied here, so
// this cannot pass against a rule the hook no longer has.
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

// FORGE_HOOK_FILE points the same checks at a doctored copy — that is how the
// pre-fix failure was verified (4 of 12) rather than asserted.
const HOOK = process.env.FORGE_HOOK_FILE ||
  path.join(__dirname, '..', '.claude', 'hooks', 'post-to-feed.sh');
const src = fs.readFileSync(HOOK, 'utf8').split('\n');
const from = src.findIndex(l => l.startsWith('REPO_ROOT='));
const to = src.findIndex(l => l.startsWith('branch_name='));
if (from < 0 || to < 0 || to < from) {
  console.error('could not find the naming block in the hook (REPO_ROOT= … branch_name=)');
  process.exit(1);
}
// …plus the last-resort fallback line that follows it.
const tail = src.slice(to).find(l => l.startsWith('[ -n "$name" ] || name='));
const block = src.slice(from, to + 1).join('\n') + '\n' + tail + '\necho "$name"\n';

let pass = 0, fail = 0;
const ok = (label, got, want) => {
  if (got === want) { console.log('  ok   ' + label); pass++; }
  else { console.log('  FAIL ' + label + '\n         got  ' + JSON.stringify(got) + '\n         want ' + JSON.stringify(want)); fail++; }
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slug-'));
function repo(name, branch) {
  const d = path.join(root, name);
  fs.mkdirSync(d, { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', d, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.writeFileSync(path.join(d, 'f'), 'x');
  git('add', '.'); git('commit', '-qm', 'x');
  if (branch) git('checkout', '-qb', branch);
  return d;
}
// `sid` is a plain shell var in the hook, not an env var, so seed it in-band.
const run = (env) => execFileSync('bash', ['-c', 'sid="' + (env.SID || 'abcd1234efgh') + '"\n' + block], {
  env: { ...process.env, FORGE_REPO_ROOT: root, FORGE_CHAT: env.FORGE_CHAT || '' },
  encoding: 'utf8',
}).trim();

const clean = () => fs.readdirSync(root).forEach(n => fs.rmSync(path.join(root, n), { recursive: true, force: true }));

console.log('a harness-named branch keeps its name and loses its random tail');
clean(); repo('imageforge', 'claude/chat-hooks-issues-j1n844');
ok('claude/<name>-<6 random> → <name>', run({}), 'chat-hooks-issues');

console.log('\nan ordinary working branch is a real name (v19 — the reported bug)');
clean(); repo('imageforge', 'panels-background-draw');
ok('a session that cloned onto its own branch is named after it',
  run({}), 'panels-background-draw');
// The old rule fell through to the session id here, and that is what shipped
// three unreadable chats in one day.
ok('and it is NOT the session id', run({}) === 'chat-abcd1234', false);

console.log('\nthe last word of a hand-named branch survives');
clean(); repo('imageforge', 'fix-bigbox');
ok('no 6-char tail is stripped off a branch the harness did not name',
  run({}), 'fix-bigbox');

console.log('\na default branch says nothing about the work, so it is not a name');
for (const b of ['main', 'master', 'develop', 'trunk']) {
  clean(); repo('imageforge', b === 'master' ? null : b);
  const got = run({});
  ok(b + ' falls through to the session id', got, 'chat-abcd1234');
}

console.log('\nclaude/* still wins over a plain branch, whatever the scan order');
clean(); repo('aaa-first', 'some-other-branch'); repo('zzz-last', 'claude/the-real-one-a1b2c3');
ok('the harness-named branch is preferred', run({}), 'the-real-one');

console.log('\nthe generic names still keep their per-session tail');
clean(); repo('imageforge', 'claude/new-session-x9y8z7');
ok('new-session gets a stable tail so sessions cannot merge',
  run({ SID: 'zz11yy22' }), 'new-session-zz11yy');

console.log('\nno repo at all still has a last resort');
clean();
ok('an empty container falls back to the session id', run({}), 'chat-abcd1234');

console.log('\nFORGE_CHAT still wins outright');
clean(); repo('imageforge', 'panels-background-draw');
ok('an explicit chat name is never overridden', run({ FORGE_CHAT: 'deliberate-name' }), 'deliberate-name');

fs.rmSync(root, { recursive: true, force: true });
console.log('\n' + (fail ? fail + ' FAILED' : 'all passed') + ' (' + pass + ' checks)');
process.exit(fail ? 1 : 0);
