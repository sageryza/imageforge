#!/usr/bin/env node
// A TURN STARTED BY A BACKGROUND EVENT IS STILL A TURN (Aug 2026).
//
// Sophie: "your last message didn't show up in my chat app" — reported across
// several chats in one week, and the pattern was exact: every turn that
// answered HER posted, and the turns that answered a wake event / task
// notification did not.
//
// The cause was one conflated question in the hook. `<wake …>` was filtered out
// of the TURN BOUNDARY as well as out of "is this Sophie talking", so a reply to
// a background event stayed keyed to the PREVIOUS turn. The server's doc id is
// sha1(session|turn), so that reply UPSERTED onto the already-finished message
// above it — inheriting its `created`, never rising in the thread, reading as
// simply gone. The live-draft pass did the same thing one step worse: it
// re-marked that finished message `working:true`, which is why those chats also
// sat parked in the hidden pile waiting for a reply that had already landed.
//
// The two questions are separate and this test pins both halves:
//   boundary  = ANY non-tool-result user record (machinery included)
//   her words = only what Sophie actually said (machinery is never a message)
//
// It drives the REAL hook against a local capture server — the question is what
// the hook POSTS, which source-shape assertions cannot answer.
// Run: node scripts/test-chats-turn-boundary.js
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'turnkey-'));
const rec = (o) => JSON.stringify(o);
const user = (uuid, text, ts) => rec(Object.assign(uuid ? { uuid } : {}, {
  type: 'user', timestamp: ts || '2026-08-14T01:00:00Z',
  message: { role: 'user', content: [{ type: 'text', text }] },
}));
const asst = (id, text) => rec({
  uuid: 'a' + id, type: 'assistant',
  message: { role: 'assistant', id, content: [{ type: 'text', text }] },
});

const WAKE = '<wake reason="external-event"><event source="github" kind="ci-failure">'
  + 'build failed</event></wake>';
const REPLY1 = 'The deploy is green and healthy, nothing to worry about there at all.';
const REPLY2 = 'CI failed on the lint step. I pushed a fix and it is rebuilding now.';

// ── a capture server standing in for the feed ──────────────────────────────
// It runs as its OWN process on purpose: the hook is driven with execFileSync,
// which blocks this event loop, so an in-process server could never answer the
// hook's curl and every run would time out.
const LOG = path.join(tmp, 'posts.log');
const PORT = 8900 + (process.pid % 900);
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
const feed = () => posts().filter((p) => p.url === '/api/chatfeed');
const replies = () => posts().filter((p) => p.url === '/api/chatfeed/reply');

function scenario(name, lines1, lines2, event2) {
  try { fs.unlinkSync(LOG); } catch (e) { /* first scenario */ }
  const home = fs.mkdtempSync(path.join(tmp, 'home-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const t1 = path.join(tmp, name + '-1.jsonl');
  const t2 = path.join(tmp, name + '-2.jsonl');
  fs.writeFileSync(t1, lines1.join('\n') + '\n');
  fs.writeFileSync(t2, lines2.join('\n') + '\n');
  runHook(t1, name, 'Stop', home);
  runHook(t2, name, event2 || 'Stop', home);
}

(async () => {
  server = spawn('node', [SRC], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => server.stdout.once('data', r));

  // ── 1. the reported bug: a wake turn's reply is its own message ───────────
  const base = [user('U1', 'can you check the deploy'), asst('m1', REPLY1)];
  console.log('a turn started by a background event');
  scenario('wake', base, base.concat([user('W1', WAKE), asst('m2', REPLY2)]));
  await settle();
  {
    const f = feed();
    ok('both turns post as their own message', f.length === 2, 'got ' + f.length);
    const second = f[1] && f[1].body;
    ok('the wake turn carries its OWN turn key',
      !!second && second.turn === 'W1', 'turn=' + (second && second.turn));
    ok('the wake turn does not inherit the previous turn key',
      !!second && second.turn !== 'U1');
    // the regression itself: the reply merged into the message above it
    ok('the wake reply is not glued onto the previous reply',
      !!second && second.text.indexOf(REPLY1) === -1 && second.text.indexOf(REPLY2) === 0,
      JSON.stringify(second && second.text));
    ok('the first turn still posts intact',
      !!f[0] && f[0].body.turn === 'U1' && f[0].body.text.indexOf(REPLY1) === 0);
  }

  // ── 2. …but machinery is still never one of HER messages ─────────────────
  console.log('machinery is a boundary, never a message');
  {
    const r = replies();
    ok('her real message posts as hers', r.length === 1 && r[0].body.text === 'can you check the deploy');
    ok('the wake envelope is NOT filed as her message',
      !r.some((p) => (p.body.text || '').indexOf('<wake') > -1),
      JSON.stringify(r.map((p) => (p.body.text || '').slice(0, 40))));
  }

  // ── 3. the draft pass must not re-open a finished message ────────────────
  // This is the half that left chats parked: a draft posted under the previous
  // turn's key set working:true on a reply Sophie had already been given.
  console.log('a live draft during a background-event turn');
  scenario('draft', base, base.concat([user('W1', WAKE), asst('m2', REPLY2)]), 'PostToolUse');
  await settle();
  {
    const f = feed();
    const draft = f.find((p) => p.body.working);
    ok('the draft posts under the wake turn key',
      !!draft && draft.body.turn === 'W1', 'turn=' + (draft && draft.body.turn));
    ok('no draft is ever posted against the finished turn',
      !f.some((p) => p.body.working && p.body.turn === 'U1'));
    ok('the draft carries only this turn\'s prose',
      !!draft && draft.body.text.indexOf(REPLY1) === -1);
  }

  // ── 4. a machinery record with no uuid still gets a stable key ───────────
  // Without this the turn falls back to the previous key and merges again; the
  // key must also be STABLE, because the hook re-parses the whole transcript on
  // every event and a volatile key would fork the turn's doc.
  console.log('machinery with no uuid');
  {
    const b2 = [user('U1', 'can you check the deploy'), asst('m1', REPLY1)];
    scenario('nouuid', b2, b2.concat([user(null, WAKE, '2026-08-14T02:00:00Z'), asst('m2', REPLY2)]));
    await settle();
    const f = feed();
    const second = f[1] && f[1].body;
    ok('it gets a key of its own', !!second && !!second.turn && second.turn !== 'U1',
      'turn=' + (second && second.turn));
    ok('the key is derived from the timestamp, so it is stable across re-parses',
      !!second && second.turn === 'w:2026-08-14T02:00:00Z', 'turn=' + (second && second.turn));
    ok('its reply is not merged into the previous turn',
      !!second && second.text.indexOf(REPLY1) === -1);
  }

  // ── 5. an ordinary two-turn conversation is untouched ────────────────────
  console.log('an ordinary conversation still behaves');
  {
    const b3 = [user('U1', 'can you check the deploy'), asst('m1', REPLY1)];
    scenario('plain', b3, b3.concat([user('U2', 'and the lint job?'), asst('m2', REPLY2)]));
    await settle();
    const f = feed();
    ok('two turns, two messages, two keys',
      f.length === 2 && f[0].body.turn === 'U1' && f[1].body.turn === 'U2',
      JSON.stringify(f.map((p) => p.body.turn)));
    ok('both of her messages post', replies().length === 2);
  }

  server.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
