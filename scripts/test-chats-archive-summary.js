#!/usr/bin/env node
// test-chats-archive-summary.js — the SUMMARIZE button on the archive pop-up.
//
//   node scripts/test-chats-archive-summary.js
//
// Sophie, 2026-08-15: "when I click archive … it gives me a pop-up saying I'm
// not sure I want to archive and I want a button on there that automatically
// asks the chat to give me like a quick summary of what we accomplished in that
// chat, and if there were still any questions that were open, and this will
// replace my note to self at the top of the chat."
//
// The thing that makes this work at all is that it does NOT ask the chat — the
// session is asleep by then. The server reads the thread the app already stores
// and writes the summary itself, so from her side it is one tap inside the sheet
// she is already standing in: no trip back to the Claude app, nothing to copy.
//
// Drives the REAL public/chats.html headless and asserts:
//   1. the archive sheet carries exactly one Summarize button, wearing the
//      house generate star (the rule: a control that spends a model call wears
//      that glyph and no other),
//   2. tapping it asks the SERVER for the summary — force:true, this chat,
//   3. the summary reads back in the sheet before she commits, with the open
//      questions as their own paragraph,
//   4. the sheet still does its old job afterwards: the name box, the pile
//      tabs and the Archive button all still work,
//   5. CANCEL does not lose the summary — it was written server-side on the
//      tap, so backing out of the archive keeps it (and archives nothing),
//   6. a failing write says so in the sheet instead of dying silently,
//   7. the archive row's expander shows what was left open.
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const LINE = 'Built the archive summary button — one tap in the pop-up, written server-side';
const FULL = 'She asked for a button on the archive pop-up that summarises the chat. '
  + 'The session is asleep by then, so the server reads the thread and writes it with Claude instead. '
  + 'Shipped with the open-questions half on the same call.';
const OPEN = 'whether the summary should overwrite her own note, or only take the line when she has none';

const CHATS = {
  'chat-a': { lastSeen: iso(T0 - 2e5) },
  'chat-old': { lastSeen: iso(T0 - 9e6), archived: true,
    wrapLine: LINE, wrapUp: FULL, wrapOpen: OPEN },
};
const MSGS = [];
for (let i = 0; i < 6; i++) {
  MSGS.push({ id: 'm' + i, chat: 'chat-a', from: i % 3 ? 'claude' : 'sophie',
    created: iso(T0 - 9e5 + i * 1000), postedAt: iso(T0 - 9e5 + i * 1000),
    text: 'message ' + i, tldr: 'tldr ' + i });
}

const wrote = [];        // every /wrapup/write body the page sent
const archived = [];     // every /archive body
let failNext = false;    // flip to make the next write fail

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  const read = (cb) => { let b = ''; req.on('data', (d) => b += d); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));

  if (p === '/api/chatfeed/wrapup/write') return read((b) => {
    wrote.push(b);
    if (failNext) { failNext = false; return json({ error: 'ANTHROPIC_API_KEY is not set on the server' }); }
    // The real route WRITES before it answers, which is the whole reason
    // cancelling the archive cannot lose the summary — so the stub does too.
    CHATS[b.chat] = Object.assign(CHATS[b.chat] || {}, { wrapLine: LINE, wrapUp: FULL, wrapOpen: OPEN });
    json({ ok: true, chat: b.chat, wrapLine: LINE, wrapUp: FULL, wrapOpen: OPEN,
      messages: MSGS.length, unanswered: 1 });
  });
  if (p === '/api/chatfeed/archive') return read((b) => { archived.push(b); json({ ok: true, archived: !!b.archived }); });
  if (p === '/api/chatfeed/thread') return json({ messages: MSGS });
  if (p === '/api/chatfeed') {
    return json({ build: 't', settings: {}, truncated: [], delta: false, chats: CHATS, messages: MSGS });
  }
  if (p.startsWith('/api/')) return read(() => json({ ok: true, assets: [], items: {}, texts: {}, pages: [] }));
  try { return send('text/plain', fs.readFileSync(path.join(PUB, p.slice(1)))); }
  catch (_) { res.writeHead(404); res.end(''); }
});

(async () => {
  let pw; try { pw = require('playwright'); }
  catch (_) { try { pw = require('playwright-core'); } catch (_2) { console.log('playwright not installed — skipping'); process.exit(0); } }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((f) => { try { fs.accessSync(f); return true; } catch (_) { return false; } });
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || preinstalled || undefined, args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };

  const openSheet = async () => {
    await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
    await page.click('.crow[data-chat="chat-a"]');
    await page.waitForTimeout(400);
    await page.click('#thread .archlink.arch-g');
    await page.waitForSelector('.askwrap .arcsum', { timeout: 4000 });
  };

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await openSheet();

  // ---- 1: the button, and the glyph on it ---------------------------------
  ok(await page.$$eval('.askwrap .arcsum', (n) => n.length) === 1, 'exactly one Summarize button on the sheet');
  ok((await page.$eval('.askwrap .arcsum span', (n) => n.textContent.trim())) === 'Summarize',
     'it says "Summarize"');
  ok(await page.$eval('.askwrap .arcsum', (n) => !!n.querySelector('svg')),
     'it wears a glyph, not bare text');
  // The house rule is ONE generate glyph everywhere — the hand-fitted sparkles
  // star from witch.html, which is the original copy.
  const witch = fs.readFileSync(path.join(PUB, 'witch.html'), 'utf8');
  const wStar = witch.slice(witch.indexOf("const STAR = '") + 14);
  const wPath = (wStar.slice(0, wStar.indexOf("';")).match(/ d="([^"]+)"/) || [])[1] || '';
  const mine = await page.$eval('.askwrap .arcsum svg path', (n) => n.getAttribute('d'));
  ok(!!wPath && mine === wPath, 'and it is the HOUSE generate star, verbatim from witch.html');
  ok(await page.$$eval('.askwrap .askrow button', (n) => n.map((x) => x.textContent.trim()).join('·'))
     === 'Cancel·Archive', 'the decision row is still just Cancel / Archive');
  ok(await page.$eval('.askwrap .arcout', (n) => n.offsetParent === null),
     'nothing is shown until she asks for it');

  // ---- 2/3: the tap, and what comes back ----------------------------------
  await page.click('.askwrap .arcsum');
  await page.waitForFunction(() => {
    const o = document.querySelector('.askwrap .arcout');
    return o && o.offsetParent !== null && o.textContent.length > 40;
  }, null, { timeout: 8000 });
  ok(wrote.length === 1 && wrote[0].chat === 'chat-a', 'it asked the server for THIS chat: ' + JSON.stringify(wrote[0] || {}));
  ok(wrote[0] && wrote[0].force === true, 'with force — a deliberate tap re-writes an existing wrap-up');
  const shown = await page.$eval('.askwrap .arcout', (n) => n.textContent);
  ok(shown.indexOf(FULL) === 0, 'the summary reads back in the sheet');
  ok(shown.indexOf('Still open: ' + OPEN) > 0, 'and what was left open, in its own paragraph');
  ok((await page.$eval('.askwrap .arcsum span', (n) => n.textContent.trim())) === 'Rewrite',
     'the button offers a rewrite once one exists');
  ok(await page.$eval('.askwrap .askrow button.go', (n) => !n.disabled),
     'Archive stayed armed the whole time — she is never made to wait on it');

  // ---- 5: Cancel keeps the summary and archives nothing --------------------
  await page.click('.askwrap .askrow button:not(.go)');
  await page.waitForTimeout(250);
  ok(await page.$$eval('.askwrap', (n) => n.length) === 0, 'Cancel closes the sheet');
  ok(archived.length === 0, 'and archives nothing');
  // It was written on the tap, not on the way past — so a client that knows
  // nothing but what the server holds still shows it on the chat's row. The
  // cache is dropped first on purpose: a warm reload paints from localStorage
  // and only polls for new MESSAGES (see the launch block in chats.html), so a
  // freshly written wrap-up reaches an already-open phone on its next Refresh.
  // That is existing behaviour for every registry field, not this button's.
  await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"] .cr-note', { timeout: 8000 });
  ok((await page.$eval('.crow[data-chat="chat-a"] .cr-note', (n) => n.textContent.trim())) === LINE,
     'and the summary survives it — backing out of the archive cannot unwrite it');
  ok(wrote.length === 1, 'no second write went out behind her');

  // ---- 4: the sheet still does its old job --------------------------------
  // (The name box and the BUILT / OTHER piles came OUT of this sheet in the Aug
  // 2026 v3 pass — her tags replaced them, and renaming went back to being the
  // pencil in the thread header only. scripts/test-chats-archive-tags.js owns
  // what stands there now; this one stays on the Summarize button.)
  await openSheet();
  ok(await page.$$eval('.askwrap .arctags .catchip', (n) => n.length) > 0,
     'the tag row stands beside it');
  await page.click('.askwrap .askrow button.go');
  await page.waitForTimeout(500);
  ok(archived.length === 1 && archived[0].chat === 'chat-a' && archived[0].archived === true,
     'Archive still archives');

  // ---- 6: a failed write says so ------------------------------------------
  failNext = true;
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await openSheet();
  await page.click('.askwrap .arcsum');
  await page.waitForFunction(() => {
    const o = document.querySelector('.askwrap .arcout');
    return o && o.offsetParent !== null && /Couldn/.test(o.textContent);
  }, null, { timeout: 8000 });
  ok(true, 'a failed write says so in the sheet');
  ok((await page.$eval('.askwrap .arcsum span', (n) => n.textContent.trim())) === 'Summarize',
     'and the button comes back so she can try again');
  ok(!(await page.$eval('.askwrap .arcsum', (n) => n.disabled)), 'unlocked, not stuck mid-write');
  await page.click('.askwrap .askrow button:not(.go)');
  await page.waitForTimeout(200);

  // ---- 7: the archive row shows what was left open ------------------------
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#archlink', { timeout: 8000 });
  await page.click('#archlink');
  await page.waitForTimeout(400);
  ok(await page.$$eval('.crow[data-chat="chat-old"] ~ .wrapmore', (n) => n.length) >= 1,
     'the archived row has its expander');
  await page.click('.crow[data-chat="chat-old"] ~ .wrapmore');
  await page.waitForTimeout(200);
  const body = await page.$eval('.wrapfull', (n) => ({ t: n.textContent, vis: n.offsetParent !== null }));
  ok(body.vis, 'it opens');
  ok(body.t.indexOf(FULL) === 0, 'showing the whole account');
  ok(body.t.indexOf('Still open: ' + OPEN) > 0, 'with the open question under it');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
