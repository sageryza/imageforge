// Tests for install-memo-autopush.sh — the generation half, which is all that
// can run off the Mac: the installer is pointed at a scratch HOME
// (AUTOPUSH_TEST_HOME), where it writes the runner and the launchd plist and
// skips launchctl. No network, no launchd, no Mac.
//
//   node scripts/test-memo-autopush.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let failed = 0;
const ok = (cond, name) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name);
  if (!cond) failed++;
};

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'autopush-test-'));
const script = path.join(__dirname, 'install-memo-autopush.sh');

execFileSync('bash', [script], {
  env: { ...process.env, AUTOPUSH_TEST_HOME: home, FORGE_BASE: 'https://example.test' },
  stdio: 'pipe',
});

const dir = path.join(home, 'Library/Application Support/ImageForge');
const runner = path.join(dir, 'run-push-memos.sh');
const plist = path.join(home, 'Library/LaunchAgents/com.imageforge.push-memos.plist');

ok(fs.existsSync(runner), 'runner is written');
ok(fs.existsSync(plist), 'plist is written');
ok((fs.statSync(runner).mode & 0o100) !== 0, 'runner is executable');

// The runner must be valid bash with everything install-time baked in:
// an ABSOLUTE node path (launchd has no login PATH) and the base URL.
execFileSync('bash', ['-n', runner]);
ok(true, 'runner parses as bash');
const rtext = fs.readFileSync(runner, 'utf8');
const nodeMatch = rtext.match(/exec "([^"]+)"/);
ok(nodeMatch && path.isAbsolute(nodeMatch[1]), 'node path is baked in absolute');
ok(rtext.includes('https://example.test/push-memos.mjs'), 'FORGE_BASE is honored');
ok(rtext.includes(`CACHE="${dir}/push-memos.mjs"`), 'cache path is baked in (spaces quoted)');
ok(/if \[ ! -f "\$CACHE" \]/.test(rtext), 'offline fallback: cached copy runs when the download fails');

// The plist: well-formed XML with the schedule Sophie asked for — every login
// (RunAtLoad) plus once a day — and its output captured to the log.
const ptext = fs.readFileSync(plist, 'utf8');
ok(ptext.includes('<key>Label</key><string>com.imageforge.push-memos</string>'), 'label');
ok(ptext.includes('<key>RunAtLoad</key><true/>'), 'runs at login');
ok(ptext.includes('StartCalendarInterval'), 'runs on a daily schedule');
ok(ptext.includes(`<string>${runner}</string>`), 'plist points at the runner');
ok(ptext.includes('imageforge-push-memos.log'), 'log path is set');
ok(ptext.split('StandardOutPath').length === 2 && ptext.split('StandardErrorPath').length === 2,
  'stdout and stderr both captured');

// Re-running must be safe: same files, no duplicates, no errors.
execFileSync('bash', [script], {
  env: { ...process.env, AUTOPUSH_TEST_HOME: home, FORGE_BASE: 'https://example.test' },
  stdio: 'pipe',
});
ok(fs.readFileSync(plist, 'utf8') === ptext, 're-running rewrites the same plist');

fs.rmSync(home, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED` : '\nall good');
process.exit(failed ? 1 : 0);
