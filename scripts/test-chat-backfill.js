#!/usr/bin/env node
// THE BACKFILL FLAG — the hook posts a chat's WHOLE history only when it is
// asked to, and baselines it away every other time.
//
// Both halves matter and they pull against each other, which is why they are
// pinned together: without the baseline, every session that heals its hook
// would dump its backlog into the feed; without the flag, a chat that never
// posted at all (account 3 — measured 2026-08-22, zero chats ever tagged "3")
// can never be recovered, because the first firing throws the history away.
//
// Runs the REAL hook against a fixture transcript, with a throwaway server
// standing in for the feed. No network, no Firestore. `node scripts/test-chat-backfill.js`
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'post-to-feed.sh');
const TURNS = 3;
let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-'));
const recs = [];
const uid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
for (let i = 1; i <= TURNS; i++) {
  recs.push({ uuid: uid(i), timestamp: '2026-08-20T0' + i + ':00:00.000Z', type: 'user',
    message: { role: 'user', content: 'sophie message ' + i } });
  recs.push({ uuid: uid(100 + i), timestamp: '2026-08-20T0' + i + ':30:00.000Z', type: 'assistant',
    message: { id: 'msg_' + i, role: 'assistant', content: [{ type: 'text', text: 'reply number ' + i }] } });
}
const transcript = path.join(dir, 't.jsonl');
fs.writeFileSync(transcript, recs.map((r) => JSON.stringify(r)).join('\n') + '\n');

// The recorder runs as its OWN PROCESS: the hook is driven with execFileSync,
// which blocks this event loop, so a server living here could never answer it
// and every post would sit out its 75s curl timeout instead.
const LOG = path.join(dir, 'hits.log');
const RECORDER = path.join(dir, 'recorder.js');
fs.writeFileSync(RECORDER, `
const http=require('http'), fs=require('fs');
http.createServer((q,s)=>{let d='';q.on('data',c=>d+=c).on('end',()=>{
  fs.appendFileSync(${JSON.stringify(LOG)}, JSON.stringify({url:q.url,body:d})+'\\n');
  s.setHeader('content-type','application/json'); s.end('{"ok":true}');});
}).listen(0,'127.0.0.1',function(){ console.log(this.address().port); });
`);
fs.writeFileSync(LOG, '');

function readHits() {
  return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
let PORT = 0;
function fire(sid, home, extraEnv) {
  fs.writeFileSync(LOG, '');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  execFileSync('bash', [HOOK], {
    input: JSON.stringify({ session_id: sid, transcript_path: transcript, hook_event_name: 'Stop' }),
    env: Object.assign({}, process.env, {
      HOME: home,
      FORGE_FEED_URL: 'http://127.0.0.1:' + PORT + '/api/chatfeed',
      FORGE_GALLERY_URL: 'http://127.0.0.1:' + PORT + '/api/gallery',
      FORGE_CHAT: 'bftest', FORGE_ACCOUNT: '3',
    }, extraEnv),
    timeout: 90000,
  });
  const hits = readHits();
  return {
    replies: hits.filter((h) => h.url.endsWith('/reply')).map((h) => JSON.parse(h.body)),
    posts: hits.filter((h) => h.url === '/api/chatfeed').map((h) => JSON.parse(h.body)),
  };
}
function run(sid, extraEnv) { return fire(sid, path.join(dir, 'home-' + sid), extraEnv); }

const rec = spawn(process.execPath, [RECORDER], { stdio: ['ignore', 'pipe', 'inherit'] });
rec.stdout.once('data', (buf) => {
  PORT = parseInt(String(buf).trim(), 10);
  console.log('the baseline (no flag) — a fresh session posts only its latest turn');
  const a = run('sid-baseline', {});
  ok(a.posts.length === 1, 'one reply posted (' + a.posts.length + ')');
  ok(a.posts[0] && a.posts[0].text === 'reply number ' + TURNS, 'and it is the LATEST turn');
  ok(a.replies.length === 1, "one of Sophie's messages posted (" + a.replies.length + ')');

  console.log('FORGE_BACKFILL=1 — the whole history goes, oldest first');
  const b = run('sid-backfill', { FORGE_BACKFILL: '1' });
  ok(b.posts.length === TURNS, 'every turn posted (' + b.posts.length + ' of ' + TURNS + ')');
  ok(b.posts.map((p) => p.text).join('|') === [1, 2, 3].map((i) => 'reply number ' + i).join('|'),
    'in transcript order, oldest first');
  ok(b.replies.length === TURNS, 'every message of hers posted too — not a monologue');
  // one doc per turn: the server upserts on sha1(session|turn), so a re-run
  // lands on the same message rather than doubling the thread
  ok(new Set(b.posts.map((p) => p.turn)).size === TURNS, 'each turn carries its own turn key');
  ok(b.posts.every((p) => p.account === '3'), 'each post carries the account tag');
  // A BACKFILLED REPLY KEEPS ITS REAL TIME (hook v15, 2026-08-24). Her messages
  // have always carried `at`; the replies carried nothing, so the server stamped
  // NOW and a recovered thread came back with her half in order and Claude's half
  // piled at the moment of the backfill. The app sorts by `created`.
  ok(b.posts.every((p, i) => p.created === '2026-08-20T0' + (i + 1) + ':30:00.000Z'),
    'each reply carries its own real time, not the moment of the backfill');
  // …and each reply lands AFTER the message it answers, which is the ordering
  // the whole field exists for
  ok(b.posts.every((p, i) => p.created > b.replies[i].created),
    'every reply sorts after the message it answered');

  console.log('re-running a backfilled session posts nothing new');
  const again = fire('sid-backfill', path.join(dir, 'home-sid-backfill'), { FORGE_BACKFILL: '1' });
  ok(again.posts.length === 0, 'the ledger holds — nothing re-posted');

  rec.kill();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
});
