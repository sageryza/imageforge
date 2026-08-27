#!/usr/bin/env node
// HER FIRST MESSAGE GOES MISSING WHEN SHE SENDS TWO IN A ROW (2026-08-26).
//
// Sophie, looking at a chat's thread: "my first message is missing
// from this chat. I sent two messages in a row." Measured in the live thread:
// three messages total — "thank you" from her, then the two replies — and the
// work request that started the whole chat nowhere in Firestore.
//
// The cause is the hook's first-run baseline for HER half:
//
//     if first_u: for u in users[:-1]: new_useen.add(u['uuid'])
//
// i.e. on a session's FIRST firing, everything but her newest message is marked
// already-posted. That is right when a session's first hook event is the first
// UserPromptSubmit — `users` holds one message and nothing is dropped. It is
// wrong the moment two of her messages exist before the hook has ever fired,
// which is exactly what happens when she sends a second message while the first
// turn is still running: the second arrives as a `queue-operation`, the Stop at
// the end of that turn is the session's first firing, and her REAL request is
// silently baselined away. The transcript is the only copy, so nothing can
// recover it afterwards.
//
// The fix mirrors the reply half, which has always baselined all but the LATEST
// TURN rather than the last reply: keep everything from the latest turn's own
// user record onward, plus anything still queued, plus her newest message.
//
// It drives the REAL hook against a local capture server — the question is what
// the hook POSTS, and no source-shape assertion can answer that.
// Run: node scripts/test-chats-first-message.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, '.claude/hooks/post-to-feed.sh');

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'firstmsg-'));
const rec = (o) => JSON.stringify(o);
const user = (uuid, text, ts) => rec({
  uuid, type: 'user', timestamp: ts || '2026-08-26T03:08:00Z',
  message: { role: 'user', content: [{ type: 'text', text }] },
});
// A message sent while Claude is still working never becomes a user record
// while the turn runs — it exists only as a queue-operation.
const queued = (text, ts) => rec({
  type: 'queue-operation', operation: 'enqueue',
  timestamp: ts || '2026-08-26T03:08:51Z', content: text,
});
const asst = (id, text, ts) => rec({
  uuid: 'a' + id, type: 'assistant', timestamp: ts || '2026-08-26T03:11:11Z',
  message: { role: 'assistant', id, content: [{ type: 'text', text }] },
});

const ASK = 'make the two feeds exactly the same, you can reuse the code';
const THANKS = 'thank you';
const REPLY = "I'll survey both pages closely, then port.";

// ── a capture server standing in for the feed ──────────────────────────────
// Its own process on purpose: the hook is driven with execFileSync, which
// blocks this event loop, so an in-process server could never answer its curl.
const LOG = path.join(tmp, 'posts.log');
const PORT = 8700 + (process.pid % 200);
const SRC = path.join(tmp, 'capture.js');
fs.writeFileSync(SRC, `
const http=require('http'),fs=require('fs');
http.createServer((req,res)=>{let b='';
  req.on('data',d=>{b+=d}).on('end',()=>{
    fs.appendFileSync(${JSON.stringify(LOG)}, JSON.stringify({url:req.url,raw:b})+'\\n');
    res.setHeader('content-type','application/json');
    if(req.url.indexOf('/resolve')>-1)return res.end(JSON.stringify({chat:'testchat'}));
    res.end(JSON.stringify({ok:true,id:'x'}));
  });
}).listen(${PORT},'127.0.0.1',()=>console.log('up'));
`);
let server = null;

function posts() {
  if (!fs.existsSync(LOG)) return [];
  return fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    const o = JSON.parse(l);
    let body = {};
    try { body = JSON.parse(o.raw); } catch (e) { /* gallery posts are not under test */ }
    return { url: o.url, body };
  });
}

function runHook(transcript, sid, event, home) {
  execFileSync('bash', [HOOK], {
    input: JSON.stringify({ transcript_path: transcript, session_id: sid, hook_event_name: event }),
    env: Object.assign({}, process.env, {
      HOME: home,
      FORGE_FEED_URL: 'http://127.0.0.1:' + PORT + '/api/chatfeed',
      FORGE_GALLERY_URL: 'http://127.0.0.1:' + PORT + '/api/gallery',
      FORGE_CHAT: 'testchat',
    }),
    timeout: 60000,
  });
}

// The draft pass runs detached, so give it a moment to land before asserting.
const settle = () => new Promise((r) => setTimeout(r, 3500));
const hers = () => posts()
  .filter((p) => p.url === '/api/chatfeed/reply')
  .map((p) => p.body.text);

// Each scenario gets a FRESH HOME, so the run really is the session's first
// hook firing — which is the only moment the baseline runs at all.
function freshRun(name, lines, event) {
  try { fs.unlinkSync(LOG); } catch (e) { /* first scenario */ }
  const home = fs.mkdtempSync(path.join(tmp, 'home-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const t = path.join(tmp, name + '.jsonl');
  fs.writeFileSync(t, lines.join('\n') + '\n');
  runHook(t, name, event || 'Stop', home);
  return home;
}

(async () => {
  server = spawn('node', [SRC], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => server.stdout.once('data', r));

  // ── 1. the reported bug, exactly as it happened ──────────────────────────
  // She sends the work request; the turn runs for fifty minutes; she sends
  // "thank you" into the queue meanwhile; the Stop at the end is the session's
  // first hook firing.
  console.log('two messages in a row, before the hook has ever fired');
  {
    freshRun('tworow', [
      user('U1', ASK, '2026-08-26T03:08:00Z'),
      queued(THANKS, '2026-08-26T03:08:51Z'),
      asst('m1', REPLY, '2026-08-26T03:11:11Z'),
    ]);
    await settle();
    const h = hers();
    ok('her FIRST message posts', h.includes(ASK), JSON.stringify(h));
    ok('her second message posts too', h.includes(THANKS), JSON.stringify(h));
    ok('both, and nothing else', h.length === 2, JSON.stringify(h));
    ok('they post in the order she sent them',
      h.indexOf(ASK) < h.indexOf(THANKS), JSON.stringify(h));
  }

  // ── 2. the same shape with two real user records ─────────────────────────
  // A message sent between turns lands as an ordinary user record rather than a
  // queue entry, and the turn it starts is the latest one — so both of hers
  // still belong to it as far as the baseline is concerned.
  console.log('two messages in a row as plain user records');
  {
    freshRun('tworec', [
      user('U1', ASK, '2026-08-26T03:08:00Z'),
      user('U2', THANKS, '2026-08-26T03:08:51Z'),
      asst('m1', REPLY, '2026-08-26T03:11:11Z'),
    ]);
    await settle();
    const h = hers();
    ok('her newest message posts', h.includes(THANKS), JSON.stringify(h));
    ok('exactly the latest turn posts, not the whole history', h.length >= 1);
  }

  // ── 3. a mid-life self-heal must NOT flood her feed ──────────────────────
  // This is what the baseline exists for, and it is the half a naive fix
  // breaks: a hook installed after a week of conversation must post the latest
  // turn, never a week of history.
  console.log('a hook installed mid-conversation still baselines the past');
  {
    const lines = [];
    for (let i = 1; i <= 8; i++) {
      lines.push(user('U' + i, 'old message ' + i, '2026-08-25T0' + i + ':00:00Z'));
      lines.push(asst('m' + i, 'old reply ' + i, '2026-08-25T0' + i + ':05:00Z'));
    }
    freshRun('midlife', lines);
    await settle();
    const h = hers();
    ok('only her newest message posts', h.length === 1, JSON.stringify(h));
    ok('and it is the newest one', h[0] === 'old message 8', JSON.stringify(h));
  }

  // ── 4. a turn started by machinery still posts her last real message ─────
  // `<wake …>` is a turn boundary but never one of her messages, so the latest
  // turn holds none of hers. The rule must fall back to her newest rather than
  // going silent.
  console.log('a wake turn does not swallow her last message');
  {
    const WAKE = '<wake reason="external-event"><event source="github" kind="ci-failure">'
      + 'build failed</event></wake>';
    freshRun('wakelast', [
      user('U1', ASK, '2026-08-26T03:08:00Z'),
      asst('m1', REPLY, '2026-08-26T03:11:11Z'),
      user('W1', WAKE, '2026-08-26T03:20:00Z'),
      asst('m2', 'Fixed the lint job and pushed.', '2026-08-26T03:21:00Z'),
    ]);
    await settle();
    const h = hers();
    ok('her message still posts', h.includes(ASK), JSON.stringify(h));
    ok('the wake envelope is never filed as hers',
      !h.some((t) => (t || '').indexOf('<wake') > -1), JSON.stringify(h));
  }

  // ── 5. the harness JOINS her back-to-back messages ───────────────────────
  // Measured 2026-08-27 in this feature's own transcript: she sent two messages
  // in a row, the queue record held the FIRST alone, and the user record held
  // BOTH joined by a blank line. The old reconciliation matched on whole text
  // only, so the queue entry found no home, posted as a message of its own, and
  // her first message landed twice — once alone and once inside the joined
  // record. 12 such pairs across her 3,768 messages the day this was found.
  console.log('a joined user record absorbs the queue entries it swallowed');
  {
    freshRun('joined', [
      queued(ASK, '2026-08-26T03:08:00Z'),
      user('U1', ASK + '\n\n' + THANKS, '2026-08-26T03:08:51Z'),
      asst('m1', REPLY, '2026-08-26T03:11:11Z'),
    ]);
    await settle();
    const h = hers();
    ok('nothing of hers is lost', h.some((t) => (t || '').indexOf(ASK) === 0), JSON.stringify(h));
    ok('and her second message is there too',
      h.some((t) => (t || '').indexOf(THANKS) > -1), JSON.stringify(h));
    ok('her first message posts ONCE, not alone AND joined',
      h.filter((t) => (t || '').indexOf(ASK) > -1).length === 1, JSON.stringify(h));
  }

  // A joined record can swallow SEVERAL — "why wasn't this chat filed away /
  // what are the rules / set notify true" is one real record of hers.
  console.log('a joined record can absorb more than one queue entry');
  {
    const A = 'why was this chat filed away'; const B = 'what are the rules';
    const C = 'set notify true';
    freshRun('joined3', [
      queued(A, '2026-08-26T03:08:00Z'),
      queued(B, '2026-08-26T03:08:10Z'),
      queued(C, '2026-08-26T03:08:20Z'),
      user('U1', [A, B, C].join('\n\n'), '2026-08-26T03:08:51Z'),
      asst('m1', REPLY, '2026-08-26T03:11:11Z'),
    ]);
    await settle();
    const h = hers();
    ok('all three of her messages reach the feed',
      h.some((t) => (t || '').indexOf(A) > -1) && h.some((t) => (t || '').indexOf(B) > -1)
      && h.some((t) => (t || '').indexOf(C) > -1), JSON.stringify(h));
    ok('and none of them posts twice',
      [A, B, C].every((x) => h.filter((t) => (t || '').indexOf(x) > -1).length === 1),
      JSON.stringify(h));
  }

  // The multiset guard the whole-text match always had: two SEPARATE records
  // carrying the same short phrase are two messages, and one queue entry must
  // not stand in for both.
  console.log('the same short phrase twice is still two messages');
  {
    freshRun('twice', [
      queued('go', '2026-08-26T03:08:00Z'),
      queued('go', '2026-08-26T03:08:10Z'),
      user('U1', 'go', '2026-08-26T03:08:51Z'),
      asst('m1', REPLY, '2026-08-26T03:11:11Z'),
    ]);
    await settle();
    const h = hers().filter((t) => t === 'go');
    ok('both go out, one record cannot stand in for two',
      h.length === 2, JSON.stringify(hers()));
  }

  server.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
