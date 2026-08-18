#!/usr/bin/env node
// test-apple-transcripts.js — the Mac-side Apple transcript importer, driven
// end to end without a Mac.
//
//   node scripts/test-apple-transcripts.js
//
// Why this is worth its length: import-apple-transcripts.mjs runs on Sophie's
// laptop, where nobody can watch it fail, against a database whose layout
// Apple has changed between OS versions. So the script DISCOVERS where the
// words live instead of assuming — and this drives that discovery against
// three plausible layouts, plus a stub archive, so "found nothing" can't ship
// looking like "you have no transcripts".
//
// It needs no Mac and no network: `sqlite3` is shimmed onto PATH with
// node:sqlite (the script shells out to the CLI, which every Mac has), and the
// archive is a stub http server on localhost.
//
// What it pins:
//   · a transcript stored as a TEXT COLUMN on the recording row is found
//   · a transcript stored in its OWN TABLE, one row per segment, is found and
//     re-joined in time order
//   · a transcript stored as a BLOB still yields its words
//   · recordings are matched to archive records by stamp|duration — the same
//     key the Mac push uses, never the stamp alone
//   · a record that already has words is never touched
//   · two recordings sharing a minute AND a length are left alone, not guessed
//   · unreadable text is never sent
//   · --dry-run sends nothing

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'import-apple-transcripts.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-tx-test-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });

let failed = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ✓', name); return; }
  failed++;
  console.log('  ✗', name, extra === undefined ? '' : `\n      ${JSON.stringify(extra).slice(0, 400)}`);
}
const eq = (name, a, b) => ok(name, a === b, { got: a, want: b });

// ── a sqlite3 CLI, shimmed ──────────────────────────────────────────────────
// The script shells out to `sqlite3` (present on every Mac). This sandbox has
// no such binary, so stand one up over node:sqlite that speaks the exact two
// arguments the script passes.
const BIN = path.join(TMP, 'bin');
fs.mkdirSync(BIN, { recursive: true });
fs.writeFileSync(path.join(BIN, 'sqlite3'), `#!/usr/bin/env node
const { DatabaseSync } = require('node:sqlite');
const a = process.argv.slice(2);
let sep = '|';
if (a[0] === '-separator') { sep = a[1]; a.splice(0, 2); }
const db = new DatabaseSync(a[0], { readOnly: false });
const out = [];
for (const row of db.prepare(a[1]).all()) {
  out.push(Object.values(row).map(v => (v === null || v === undefined) ? '' : String(v)).join(sep));
}
process.stdout.write(out.join('\\n') + (out.length ? '\\n' : ''));
`);
fs.chmodSync(path.join(BIN, 'sqlite3'), 0o755);
const ENV = { ...process.env, PATH: BIN + ':' + process.env.PATH, NODE_NO_WARNINGS: '1' };

// ── fixture databases ───────────────────────────────────────────────────────
const { DatabaseSync } = require('node:sqlite');
const CORE_DATA_EPOCH = 978307200;                 // Core Data counts from 2001-01-01
const p2 = (n) => String(n).padStart(2, '0');
const stampOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
const zdate = (d) => d.getTime() / 1000 - CORE_DATA_EPOCH;

const LONG = 'So I was walking down by the river this morning and the light was coming through the trees in that way it does in late summer, and I thought I should remember this properly.';
const SEG1 = 'So I was walking down by the river this morning';
const SEG2 = 'and the light was coming through the trees';
const SEG3 = 'in that way it does in late summer, and I thought I should remember this.';

// Three recordings, shared by every layout: one to fill, one already
// transcribed in the archive, one whose minute+length is shared by a twin.
const T_FILL = new Date(2026, 4, 3, 14, 22, 0);
const T_HAVE = new Date(2026, 4, 4, 9, 5, 0);
const T_TWIN = new Date(2026, 4, 5, 18, 40, 0);

function newDb(name) {
  const file = path.join(TMP, name);
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE ZCLOUDRECORDING (Z_PK INTEGER PRIMARY KEY, ZDATE REAL, ZPATH TEXT, ZCUSTOMLABEL TEXT, ZDURATION REAL);`);
  return { file, db };
}
function addRecordings(db, extraCols = {}) {
  const rows = [
    [1, T_FILL, 3600, 'River walk'],
    [2, T_HAVE, 90, 'Already done'],
    [3, T_TWIN, 45, 'Twin A'],
    [4, T_TWIN, 45, 'Twin B'],
  ];
  for (const [pk, when, dur, label] of rows) {
    db.prepare('INSERT INTO ZCLOUDRECORDING (Z_PK, ZDATE, ZPATH, ZCUSTOMLABEL, ZDURATION) VALUES (?,?,?,?,?)')
      .run(pk, zdate(when), `${pk}.m4a`, label, dur);
  }
  void extraCols;
}

// A — the words sit in a text column on the recording row
const A = newDb('a.db');
A.db.exec('ALTER TABLE ZCLOUDRECORDING ADD COLUMN ZTRANSCRIPTION TEXT;');
addRecordings(A.db);
A.db.prepare('UPDATE ZCLOUDRECORDING SET ZTRANSCRIPTION=? WHERE Z_PK=1').run(LONG);
A.db.prepare('UPDATE ZCLOUDRECORDING SET ZTRANSCRIPTION=? WHERE Z_PK=3').run(LONG);
A.db.prepare('UPDATE ZCLOUDRECORDING SET ZTRANSCRIPTION=? WHERE Z_PK=4').run(LONG);

// B — a table of its own, one row per spoken segment, out of order on purpose
const B = newDb('b.db');
addRecordings(B.db);
B.db.exec('CREATE TABLE ZTRANSCRIPTIONSEGMENT (Z_PK INTEGER PRIMARY KEY, ZRECORDING INTEGER, ZSTARTTIME REAL, ZTEXT TEXT);');
for (const [pk, rec, start, text] of [[1, 1, 12.0, SEG3], [2, 1, 0.0, SEG1], [3, 1, 6.0, SEG2]]) {
  B.db.prepare('INSERT INTO ZTRANSCRIPTIONSEGMENT (Z_PK, ZRECORDING, ZSTARTTIME, ZTEXT) VALUES (?,?,?,?)').run(pk, rec, start, text);
}

// C — an archived blob. plutil is macOS-only, so here it exercises the
// text-runs fallback, which is the path that must never send garbage.
const C = newDb('c.db');
C.db.exec('ALTER TABLE ZCLOUDRECORDING ADD COLUMN ZTRANSCRIPTIONDATA BLOB;');
addRecordings(C.db);
const blob = Buffer.concat([Buffer.from([0x62, 0x70, 0x6c, 0x69, 0x73, 0x74, 0, 0, 1, 2]), Buffer.from(LONG, 'utf8'), Buffer.from([0, 0, 5])]);
C.db.prepare('UPDATE ZCLOUDRECORDING SET ZTRANSCRIPTIONDATA=? WHERE Z_PK=1').run(blob);

// D — nothing anywhere, which must report clearly rather than look like success
const D = newDb('d.db');
addRecordings(D.db);

// ── a stub archive ──────────────────────────────────────────────────────────
const posted = [];
let untranscribed = [];
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/memos/untranscribed')) {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: true, count: untranscribed.length, total: 1137, records: untranscribed }));
  }
  if (req.url.startsWith('/api/memos/transcript') && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      const j = JSON.parse(body || '{}');
      posted.push(j);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, skipped: false, memo: { id: j.id, cat: 'journal' } }));
    });
  }
  res.statusCode = 404;
  res.end('{}');
});

// ASYNC on purpose. execFileSync blocks this process's event loop, and the
// stub archive below lives in this same process — so a synchronous child
// waiting on a fetch to it deadlocks until the timeout kills it. (It did.)
const run = (args) => new Promise((resolve) => {
  const child = spawn('node', [SCRIPT, ...args], { env: ENV });
  let out = '';
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { out += c; });
  const kill = setTimeout(() => child.kill('SIGKILL'), 30000);
  child.on('close', (code) => { clearTimeout(kill); resolve({ out, code: code === null ? 1 : code }); });
});

server.listen(0, '127.0.0.1', async () => {
  const BASE = `http://127.0.0.1:${server.address().port}`;

  // The archive says: the hour-long one has no words, and so do both twins.
  // The 90-second one is not listed, because it already has words.
  const recFor = (when, dur, id) => ({ id, key: `${stampOf(when)}|${dur}`, dur, date: stampOf(when).slice(0, 10), cat: 'toolong', title: null });
  untranscribed = [
    recFor(T_FILL, 3600, '2026-05-03_1422'),
    recFor(T_TWIN, 45, '2026-05-05_1840'),
    { id: '2019-01-01_0000', key: '2019-01-01_0000|30', dur: 30, date: '2019-01-01', cat: 'empty', title: null },
  ];

  console.log('A — the words in a text column on the recording');
  {
    posted.length = 0;
    const { out } = await run(['--db', A.file, '--base', BASE]);
    ok('it says where it read them', /ZCLOUDRECORDING\.ZTRANSCRIPTION/.test(out), out.slice(0, 400));
    eq('one record filled', posted.length, 1);
    eq('the right one', posted[0] && posted[0].id, '2026-05-03_1422');
    eq('with the real words', posted[0] && posted[0].transcript, LONG);
    eq('stamped as Apple’s', posted[0] && posted[0].source, 'apple-voice-memos');
    ok('the already-transcribed one is never touched', !posted.some(p => p.id === '2026-05-04_0905'));
    ok('the shared minute+length pair is left alone, not guessed', /share that minute and length: 1/.test(out), out.slice(-600));
    ok('the record with no recording here is reported', /no matching recording on this Mac: 1/.test(out), out.slice(-600));
  }

  console.log('B — the words in a table of their own, one row per segment');
  {
    posted.length = 0;
    const { out } = await run(['--db', B.file, '--base', BASE]);
    ok('it says which table', /ZTRANSCRIPTIONSEGMENT\.ZTEXT/.test(out), out.slice(0, 500));
    eq('one record filled', posted.length, 1);
    eq('segments re-joined in time order, not row order',
      posted[0] && posted[0].transcript, `${SEG1} ${SEG2} ${SEG3}`);
  }

  console.log('C — the words inside a blob');
  {
    posted.length = 0;
    const { out } = await run(['--db', C.file, '--base', BASE]);
    eq('one record filled', posted.length, 1);
    ok('the words survived the blob', posted[0] && posted[0].transcript.includes('walking down by the river'), posted[0]);
    ok('it says the reading was a fallback', /text-runs|plist/.test(out), out.slice(0, 500));
  }

  console.log('D — no transcripts anywhere');
  {
    posted.length = 0;
    const { out, code } = await run(['--db', D.file, '--base', BASE]);
    eq('nothing sent', posted.length, 0);
    ok('it says so plainly instead of looking successful', /Found no transcript text/.test(out), out.slice(-400));
    ok('and points at --report', /--report/.test(out));
    eq('and exits non-zero', code === 0 ? 0 : 1, 1);
  }

  console.log('the flags');
  {
    posted.length = 0;
    const { out } = await run(['--db', A.file, '--base', BASE, '--dry-run']);
    eq('--dry-run sends nothing', posted.length, 0);
    ok('but still shows what it would send', /Can fill: 1/.test(out), out.slice(-500));

    posted.length = 0;
    const r = await run(['--db', A.file, '--report']);
    eq('--report sends nothing', posted.length, 0);
    ok('--report needs no server at all', r.code === 0, r.out.slice(-300));
    ok('and lists the candidate columns', /ZTRANSCRIPTION/.test(r.out), r.out.slice(0, 400));
  }

  console.log('a missing database');
  {
    const { out } = await run(['--db', path.join(TMP, 'nope.db'), '--base', BASE]);
    ok('says which file, and what to do', /No Voice Memos database at/.test(out) && /Open the Voice Memos app/.test(out), out.slice(0, 300));
  }

  server.close();
  console.log(failed ? `\n${failed} failed` : '\nall good');
  process.exit(failed ? 1 : 0);
});
