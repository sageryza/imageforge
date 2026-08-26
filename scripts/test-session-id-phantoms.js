#!/usr/bin/env node
// ONE SESSION, THREE SPELLINGS — AND THE PHANTOM `-sessio` CHATS (2026-08-26,
// Sophie: "the chats that are in the more section don't have any messages …
// the button does not lead to the chat or they all say like this session does
// not exist").
//
// A session id arrives bare (`011kWP…`, the hook), as the url's
// `session_011kWP…`, or as the env var's `cse_011kWP…`. resolveChat compared
// them as strings, so a chat posting its status card with the url spelling
// read as a DIFFERENT session from its own hook — and forked a ghost chat
// named `<slug>-sessio`, because sidTail("session_…") is literally "sessio".
// Measured live the day this was found: 17 registry docs carried a prefixed
// sessionId, 12 of them ghosts of a real chat whose bare id owned the pretty
// slug, and the More fold on EVERY account tab was 25 rows of mostly these —
// no messages (the hook posts land in the real chat), no account tag (so they
// show on every tab), and an Open button whose account-3 session the
// account-2 app answers with "this session does not exist".
//
// Two halves:
//   PURE — lift bareSid / sidTail / resolveChat out of chatfeed.js and drive
//   resolveChat over a stub registry: every spelling lands on the same chat,
//   a doc that stored the prefixed spelling is healed to bare on the way
//   past, and no fork is ever minted for a spelling difference. Verified
//   failing against the pre-fix resolveChat (it forks `<slug>-sessio`).
//
//   PAGE — a tombstone row (movedTo, the shape the repaired ghosts take) is
//   OFF every list, because its thread lives at the chat it points to; one
//   that still holds messages in the payload (a half-finished merge) stays.
//
//   node scripts/test-session-id-phantoms.js
const fs = require('fs');
const path = require('path');
const http = require('http');

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; };
const ok = (m) => console.log('  ok — ' + m);

// ---- lift the real functions out of chatfeed.js ----------------------------
const SRC = fs.readFileSync(path.join(__dirname, '..', 'chatfeed.js'), 'utf8');
function lift(name, decl) {
  const at = SRC.indexOf(decl);
  if (at < 0) { fail(decl + ' not found in chatfeed.js — the lift is stale'); return null; }
  // brace-match from the first { after the declaration
  let i = SRC.indexOf('{', at); let depth = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (!depth) return SRC.slice(at, j + 1); }
  }
  fail(decl + ' never closed'); return null;
}
const bareSrc = lift('bareSid', 'function bareSid(session)');
const tailSrc = lift('sidTail', 'function sidTail(session)');
const resolveSrc = lift('resolveChat', 'async function resolveChat(base, session)');
if (!bareSrc || !tailSrc || !resolveSrc) { process.exit(1); }

// ---- PURE: the spellings are one session -----------------------------------
(async () => {
  // stub registry the shape resolveChat reads, plus a write log
  const REGDATA = { chats: {} };
  const writes = [];
  const sandbox = `
    ${bareSrc}
    ${tailSrc}
    async function registry(){ return REGDATA; }
    function regRef(chat){
      return { set(patch){ writes.push({ chat: String(chat).slice(0,60), patch });
        Object.assign(REGDATA.chats[chat] = REGDATA.chats[chat] || {}, patch);
        return Promise.resolve(); } };
    }
    async function followMoves(c){
      let cur = String(c || '').slice(0, 60);
      while (REGDATA.chats[cur] && REGDATA.chats[cur].movedTo) cur = REGDATA.chats[cur].movedTo;
      return cur;
    }
    ${resolveSrc}
    return { resolveChat, bareSid, sidTail };
  `;
  const { resolveChat, bareSid, sidTail } = new Function('REGDATA', 'writes', sandbox)(REGDATA, writes);

  // bareSid: the three spellings, idempotence, junk
  if (bareSid('session_01AbC') !== '01AbC') fail('bareSid left the url prefix on');
  if (bareSid('cse_01AbC') !== '01AbC') fail('bareSid left the env-var prefix on');
  if (bareSid('01AbC') !== '01AbC') fail('bareSid mangled a bare id');
  if (bareSid(bareSid('session_01AbC')) !== '01AbC') fail('bareSid is not idempotent');
  if (bareSid('') !== '' || bareSid(null) !== '') fail('bareSid invented an id from nothing');
  ok('bareSid: three spellings → one id');

  // the ghost's name, pinned: this IS why the forks all said "-sessio"
  if (sidTail('session_01AbC') !== 'sessio') fail('sidTail of a prefixed id changed — update the story above');

  // a real chat owned by its hook's bare id…
  REGDATA.chats['textbox-padding'] = { sessionId: '01SidOne', account: '3' };
  // …whose own status card arrives with the url spelling: SAME chat, no fork
  const home = await resolveChat('textbox-padding', 'session_01SidOne');
  if (home !== 'textbox-padding') fail('the prefixed spelling forked away to ' + home);
  else ok('a prefixed post lands on the chat the bare id owns');
  if (REGDATA.chats['textbox-padding-sessio']) fail('a -sessio ghost was minted anyway');

  // the cse_ spelling too
  if (await resolveChat('textbox-padding', 'cse_01SidOne') !== 'textbox-padding')
    fail('the cse_ spelling forked away');

  // a doc that STORED the prefixed spelling (the 17 found live) is matched by
  // its own session's bare id — and healed to bare on the way past
  REGDATA.chats['playground-toggle-bug-wyul2j'] = { sessionId: 'session_01SidTwo' };
  const healedHome = await resolveChat('playground-toggle-bug-wyul2j', '01SidTwo');
  if (healedHome !== 'playground-toggle-bug-wyul2j')
    fail('a doc storing the prefixed spelling no longer matches its own session: ' + healedHome);
  if (REGDATA.chats['playground-toggle-bug-wyul2j'].sessionId !== '01SidTwo')
    fail('the stored prefixed sessionId was not healed to bare');
  else ok('a stored prefixed sessionId heals to bare on the next post');

  // a genuinely DIFFERENT session still forks — normalizing must not merge
  // two real sessions that share a slug
  const fork = await resolveChat('textbox-padding', '01Other');
  if (fork === 'textbox-padding') fail('a genuinely different session was merged into the owner');
  else ok('a different session still forks (' + fork + ')');

  // an unclaimed slug is claimed with the BARE id whatever spelling arrived
  const fresh = await resolveChat('fresh-slug', 'session_01SidNew');
  if (fresh !== 'fresh-slug') fail('an unclaimed slug was not kept: ' + fresh);
  if ((REGDATA.chats['fresh-slug'] || {}).sessionId !== '01SidNew')
    fail('a fresh claim stored the prefixed spelling: ' + JSON.stringify(REGDATA.chats['fresh-slug']));
  else ok('a fresh claim stores the bare id');

  // ---- PAGE: a tombstone row is off the list -------------------------------
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP page half: playwright not installed'); return done(); } }

  const PUB = path.join(__dirname, '..', 'public');
  const T0 = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const MSGS = [
    { id: 'm1', chat: 'alive', from: 'claude', text: 'hello', tldr: 'hi',
      created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
    // a half-finished merge: the tombstone still HOLDS a message
    { id: 'm2', chat: 'half-moved', from: 'claude', text: 'stranded words', tldr: 's',
      created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  ];
  const CHATS = {
    'alive': { lastSeen: MSGS[0].created },
    // the repaired ghost's shape: movedTo, no messages → no row anywhere
    'textbox-padding-sessio': { movedTo: 'textbox-padding' },
    'half-moved': { movedTo: 'alive' },
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/chatfeed') {
      return json({ build: 'b1', chats: CHATS, settings: {}, truncated: [],
        messages: url.searchParams.get('since') ? [] : MSGS, delta: !!url.searchParams.get('since') });
    }
    if (url.pathname === '/api/chatfeed/thread') return json({ messages: [] });
    if (url.pathname === '/api/gallery/assets/recent') return json({ assets: [] });
    if (url.pathname === '/api/chatfeed/pages-recent') return json({ pages: [] });
    if (url.pathname === '/chats') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8')); }
    json({});
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="alive"]', { timeout: 8000 });
  await page.evaluate(() => window.__setMoreOpen(true));
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#grid [data-chat]'))
    .map(r => r.dataset.chat));
  if (rows.includes('textbox-padding-sessio')) fail('an empty tombstone still draws a row');
  else ok('an empty tombstone draws no row');
  if (!rows.includes('half-moved')) fail('a tombstone still holding messages lost its row — words stranded');
  else ok('a tombstone still holding messages keeps its row');
  await browser.close();
  server.close();
  done();

  function done() {
    if (failed) { console.error(failed + ' failing'); process.exit(1); }
    console.log('OK: one session, three spellings — and no more -sessio ghosts');
  }
})();
