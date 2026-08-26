#!/usr/bin/env node
// "THEY SEEM TO EXIST, BUT THEIR BUTTON TAKES ME NOWHERE" (2026-08-26, Sophie,
// naming image-panel-pipeline-ui and chat-archival-review).
//
// Two different faults produce the same dead Open button, and both were live:
//
//   1. A SESSION ID THAT COULD NEVER BE ONE. Measured over all 486 ids on file:
//      480 are exactly `01` + 22 more characters — the shape claude.ai/code
//      answers to. The other six are four LOCAL transcript uuids (the hook's
//      fallback when CLAUDE_CODE_REMOTE_SESSION_ID is unset), the literal
//      string `none`, and an unexpanded `$SID`. None of those six chats had a
//      stored url either, so its button was built ENTIRELY out of the broken
//      derivation. Empty is the honest answer — the empty state already
//      promises "no button rather than an invented one".
//
//   2. NO ACCOUNT TAG. `account` is stamped only by a finished REPLY, so a chat
//      whose turn started and never posted one — exactly the empty chats behind
//      MORE — carries no tag, and its link was fired blind into whichever
//      account the app was on. On the wrong one the Claude app dead-ends with
//      "this session does not exist" and no way forward; the browser either
//      opens it or offers the account it lives on. Her two are this one: both
//      ids are the real 24-char shape.
//
// Plus the two halves that stop it recurring: the /working ping carries
// FORGE_ACCOUNT (server + hook), and a junk session key can no longer fork a
// ghost chat.
//
//   node scripts/test-chat-door.js
const fs = require('fs');
const path = require('path');
const http = require('http');

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; };
const ok = (m) => console.log('  ok — ' + m);

// ---- the server + hook halves, read as source -------------------------------
const CF = fs.readFileSync(path.join(__dirname, '..', 'chatfeed.js'), 'utf8');
const HOOK = fs.readFileSync(path.join(__dirname, '..', '.claude', 'hooks', 'post-to-feed.sh'), 'utf8');

// usableSid, lifted and driven
const at = CF.indexOf('function usableSid(sid)');
if (at < 0) fail('usableSid is gone from chatfeed.js');
else {
  const usableSid = new Function('return ' + CF.slice(at, CF.indexOf('}', at) + 1) + '; ')();
  const cases = [
    ['011kWP3BDFodD9BG6VQ8Xv3y', true, 'a remote session id'],
    ['f8a64269-cc27-5ce0-98e8-118b3fefd506', true, 'a LOCAL transcript uuid is still an identity'],
    ['$SID', false, 'an unexpanded shell variable'],
    ['none', false, 'the literal string none'],
    ['', false, 'nothing at all'],
  ];
  cases.forEach(([sid, want, what]) => {
    if (usableSid(sid) !== want) fail('usableSid(' + JSON.stringify(sid) + ') should be ' + want + ' — ' + what);
  });
  ok('usableSid: an id-shaped key passes, a shell sigil does not');
}
// it is actually WIRED into resolveChat, or the rule is decoration
if (!/if \(!chat \|\| !sid \|\| !usableSid\(sid\)\) return chat;/.test(CF))
  fail('resolveChat no longer guards on usableSid — a junk key can fork a ghost again');
else ok('resolveChat refuses to fork on a junk session key');

// the /working ping stores an account, and the hook sends one
if (!/router\.post\('\/working'[\s\S]{0,3000}?reg\.account = acct;/.test(CF))
  fail('POST /working no longer stamps the account');
else ok('POST /working stamps the account it is sent');
if (!/FEED\/working[\s\S]{0,400}?FORGE_ACCOUNT/.test(HOOK))
  fail('the hook’s /working ping no longer carries FORGE_ACCOUNT');
else ok('the hook’s turn-start ping carries FORGE_ACCOUNT');

// ---- the page half, in a real browser ---------------------------------------
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
catch { console.log('SKIP page half: playwright not installed'); done(); } }

(async () => {
  if (!chromium) return;
  const PUB = path.join(__dirname, '..', 'public');
  const T0 = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const MSGS = [{ id: 'm1', chat: 'fresh', from: 'claude', text: 'hi', tldr: 'hi',
    created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) }];
  const CHATS = {
    'fresh': { lastSeen: MSGS[0].created, account: '1' },
    // (1) ids that cannot build a link — her live shapes, verbatim
    'local-uuid': { sessionId: 'f8a64269-cc27-5ce0-98e8-118b3fefd506' },
    'unexpanded': { sessionId: '$SID' },
    'literal-none': { sessionId: 'none' },
    // (2) a REAL id and no account tag — her two chats' exact shape
    'real-untagged': { sessionId: '016BDKhAKR9zJd32mardQbCm' },
    // tagged, same account as the app (1) → straight into the app, unchanged
    'tagged-same': { sessionId: '014yDHYQDKidRTf8jvnxhR9m', account: '1' },
    // tagged, other account → the browser, as it always has
    'tagged-other': { sessionId: '01Lba3abrLhhYrw88SDa5mp3', account: '2' },
    // a STORED url is untouched by the derivation guard, whatever it looks like
    'stored-url': { url: 'https://claude.ai/code/session_whatever-they-stored' },
  };
  const TRUNCATED = Object.keys(CHATS).filter(n => n !== 'fresh');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/chatfeed') return json({ build: 'b1', chats: CHATS,
      settings: { appAccount: '1' }, truncated: TRUNCATED,
      messages: url.searchParams.get('since') ? [] : MSGS, delta: !!url.searchParams.get('since') });
    if (url.pathname === '/api/chatfeed/thread') return json({ messages: [] });
    if (url.pathname === '/api/gallery/assets/recent') return json({ assets: [] });
    if (url.pathname === '/api/chatfeed/pages-recent') return json({ pages: [] });
    if (url.pathname === '/chats') { res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8')); }
    json({});
  });
  await new Promise(r => server.listen(0, r));
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
  await page.goto('http://127.0.0.1:' + server.address().port + '/chats');
  await page.waitForSelector('#grid [data-chat="fresh"]', { timeout: 8000 });

  const href = (n) => page.evaluate((c) =>
    window.__openHref(c, window.__claudeUrlFor(c, [])), n);

  // (1) a broken id builds NO link at all — so the empty state draws no button
  for (const n of ['local-uuid', 'unexpanded', 'literal-none']) {
    const h = await href(n);
    if (h) fail(n + ' still built a door out of an unusable session id: ' + h);
  }
  ok('a uuid, a $SID and a literal "none" build no link at all');

  // …and that really means NO BUTTON on the thread she opens, not a dead one
  await page.evaluate(() => window.__openThread('unexpanded'));
  await page.waitForSelector('#thread .state', { timeout: 4000 })
    .catch(() => fail('the unexpanded-$SID chat did not open on an empty state'));
  if (await page.$('#thread .state .openclaude'))
    fail('a chat whose session id cannot be one was given a door anyway');
  else ok('that chat opens with no door rather than a dead one');
  await page.evaluate(() => document.getElementById('back').click());
  await page.waitForSelector('#grid [data-chat="fresh"]', { timeout: 4000 });

  // (2) HER CASE: a real id, no account tag → the browser, not blind into the app
  const untagged = await href('real-untagged');
  if (untagged !== 'https://claude.ai/code/session_016BDKhAKR9zJd32mardQbCm#no_universal_links')
    fail('an untagged chat’s door still fires blind into the app: ' + untagged);
  else ok('an untagged chat opens in the browser, where the account can be chosen');

  // the two tagged rules are untouched
  const same = await href('tagged-same');
  if (same !== 'https://claude.ai/code/session_014yDHYQDKidRTf8jvnxhR9m')
    fail('a chat on the app’s OWN account lost its direct link: ' + same);
  const other = await href('tagged-other');
  if (other.indexOf('#no_universal_links') < 0)
    fail('a chat on the other account lost the browser fragment: ' + other);
  ok('a tagged chat behaves exactly as before, on either account');

  // a stored url is never second-guessed by the shape guard
  const stored = await href('stored-url');
  if (stored.indexOf('session_whatever-they-stored') < 0)
    fail('a STORED url was thrown away by the derivation guard: ' + stored);
  else ok('a stored url is untouched — the guard is on the derivation only');

  // the derivation itself, asked directly
  const pure = await page.evaluate(() => [
    window.__claudeSessionUrl('011kWP3BDFodD9BG6VQ8Xv3y'),
    window.__claudeSessionUrl('session_011kWP3BDFodD9BG6VQ8Xv3y'),
    window.__claudeSessionUrl('f8a64269-cc27-5ce0-98e8-118b3fefd506'),
    window.__claudeSessionUrl('$SID'),
    window.__claudeSessionUrl(''),
  ]);
  if (pure[0] !== 'https://claude.ai/code/session_011kWP3BDFodD9BG6VQ8Xv3y') fail('bare id built wrong: ' + pure[0]);
  if (pure[1] !== pure[0]) fail('an id already carrying session_ was doubled up: ' + pure[1]);
  if (pure[2] || pure[3] || pure[4]) fail('an unusable id still built a url: ' + JSON.stringify(pure.slice(2)));
  ok('the derivation builds a url only from a real remote session id');

  await browser.close();
  server.close();
  done();
})();

function done() {
  if (failed) { console.error(failed + ' failing'); process.exit(1); }
  console.log('OK: every Open button either goes somewhere or is not drawn');
}
