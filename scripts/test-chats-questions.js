#!/usr/bin/env node
// test-chats-questions.js — the QUESTIONS button under a chat's header and the
// list it opens.
//
//   node scripts/test-chats-questions.js
//
// Sophie, 2026-08-14: "sometimes I ask questions to chat and then it's hard to
// find the answer cause it's buried under other stuff … I want something where
// my question is repeated verbatim and bold and then the answer is right
// underneath it not bold" — and, on where it goes: "there's hardly any room on
// that screen so I wouldn't put it there. I would just put a little button
// underneath it somewhere that says questions."
//
// Drives the REAL public/chats.html headless and asserts:
//   1. the tab row is still the same THREE tabs — the button did not land there,
//   2. a button reading exactly "Questions" sits underneath, on the note row,
//   3. tapping it asks the server for THIS chat's questions,
//   4. her question renders bold and VERBATIM; the answer renders NOT bold,
//   5. an unanswered question is still listed, saying so,
//   6. the overlay locks the background and restores the exact scroll position,
//   7. the note underneath it still opens for editing, button intact.
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Her real question from that day — voice-to-text, and note it carries NO
// question mark. Anything that keys off "?" alone misses it.
const HER_Q = "I'm wondering if this should be part of the message or should be "
  + 'filed separately into a little hidden away tab called questions.';
const THE_A = 'Both — the message carries the shape, and the tab is derived so nobody has to file it.';
const OPEN_Q = 'What did the render cost?';

const CHATS = { 'chat-a': { lastSeen: iso(T0 - 2e5), sophieNote: 'questions, formatting' } };
// enough messages that the thread actually scrolls (the scroll-restore check)
const MSGS = [];
for (let i = 0; i < 30; i++) {
  MSGS.push({ id: 'f' + i, chat: 'chat-a', from: 'claude', created: iso(T0 - 9e5 + i * 1000),
    postedAt: iso(T0 - 9e5 + i * 1000), text: 'filler reply ' + i + '\n\n' + 'x'.repeat(400), tldr: 'filler ' + i });
}
const asked = [];                    // every /questions request the page made

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  const read = (cb) => { let b = ''; req.on('data', (d) => b += d); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));

  if (p === '/api/chatfeed/questions') {
    asked.push(url.searchParams.get('chat'));
    return json({ chat: 'chat-a', total: 2, questions: [
      { id: 'q2', replyId: '', at: iso(T0 - 1e5), question: OPEN_Q, answer: '' },
      { id: 'q1', replyId: 'r1', at: iso(T0 - 4e5), question: HER_Q, answer: THE_A },
    ] });
  }
  if (p === '/api/chatfeed/thread') return json({ messages: MSGS });
  if (p === '/api/chatfeed/chatnote') return read(() => json({ ok: true }));
  if (p === '/api/chatfeed') {
    return json({ build: 't', settings: {}, truncated: [], delta: false, chats: CHATS, messages: MSGS });
  }
  if (p.startsWith('/api/')) return json({ ok: true, assets: [], items: {}, texts: {}, pages: [] });
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

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForTimeout(500);

  // ---- 1/2: where the button is, and where it ISN'T -----------------------
  const tabs = await page.$$eval('#thread .viewtog button', (n) => n.map((x) => x.textContent.trim()));
  ok(tabs.length === 3 && tabs.join('·') === 'Chat·Assets·Compare',
     'the tab row is untouched — three tabs: ' + tabs.join(' · '));
  ok(await page.$$eval('#thread .qbtn', (n) => n.length) === 1, 'exactly one Questions button');
  ok((await page.$eval('#thread .qbtn', (n) => n.textContent.trim())) === 'Questions',
     'it says "Questions" — her word, not "Q&A"');
  ok(await page.$eval('#thread .qbtn', (n) => !!n.closest('.noterow')),
     'it sits on the note row underneath the header, not in the tab row');
  // "hardly any room on that screen" — the button must not have cost a line.
  const rowH = await page.$eval('#thread .noterow', (n) => n.getBoundingClientRect().height);
  const btnH = await page.$eval('#thread .qbtn', (n) => n.getBoundingClientRect().height);
  ok(rowH < btnH * 2.2, 'it shares the note’s line rather than adding one (' + Math.round(rowH) + 'px)');

  // ---- 6a: scroll position going in --------------------------------------
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(150);
  const yBefore = await page.evaluate(() => window.scrollY);
  ok(yBefore > 200, 'the thread is scrolled before opening (' + Math.round(yBefore) + 'px)');

  // ---- 3: it asks the server for THIS chat --------------------------------
  // Clicked through the DOM, NOT page.click(): Playwright scrolls an element
  // into view before clicking it, and this button lives at the top of the
  // thread — so a real click would scroll the page up first and the
  // scroll-restore check below would be measuring its own setup.
  await page.$eval('#thread .qbtn', (n) => n.click());
  await page.waitForSelector('#qfull .qitem', { timeout: 8000 });
  ok(asked.length === 1 && asked[0] === 'chat-a', 'it asked for this chat’s questions: ' + asked.join(','));

  // ---- it must be OPAQUE, and it must hide the pill -----------------------
  // Both of these shipped broken (2026-08-14): the background was written
  // var(--bg), a token this page does not define, so the whole list rendered
  // transparent over the thread — and the autoscroll pill sat on top of it,
  // because translateZ promotes it to a layer iOS paints above the overlay.
  const bg = await page.$eval('#qfull', (n) => getComputedStyle(n).backgroundColor);
  ok(!/transparent|rgba\(0, 0, 0, 0\)/.test(bg), 'the overlay is opaque (' + bg + ')');
  ok(await page.$eval('#qfull', (n) => {
    const c = getComputedStyle(n).backgroundColor.match(/[\d.]+/g).map(Number);
    const p = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).map(Number);
    return Math.abs(c[0] - p[0]) < 3 && Math.abs(c[1] - p[1]) < 3 && Math.abs(c[2] - p[2]) < 3;
  }), 'and it is the page’s own paper, not some other colour');
  ok(await page.evaluate(() => document.body.classList.contains('ontop')),
     'body.ontop is set — the pill hides and a build reload holds off');
  ok(await page.$eval('.float', (n) => getComputedStyle(n).display) === 'none',
     'the autoscroll pill is not sitting on top of her questions');

  // ---- 4: the shape — bold question, plain answer -------------------------
  const items = await page.$$eval('#qfull .qitem', (ns) => ns.map((n) => {
    const q = n.querySelector('.qq'), a = n.querySelector('.qa'), w = n.querySelector('.qwait');
    return {
      q: q ? q.textContent.trim() : '',
      qWeight: q ? getComputedStyle(q).fontWeight : '',
      a: a ? a.textContent.trim() : '',
      aWeight: a ? getComputedStyle(a).fontWeight : '',
      wait: w ? w.textContent.trim() : '',
    };
  }));
  ok(items.length === 2, 'both questions listed');
  const answered = items[1];
  ok(answered.q === HER_Q, 'her question is verbatim, word for word');
  ok(Number(answered.qWeight) >= 600, 'the question is BOLD (' + answered.qWeight + ')');
  ok(answered.a === THE_A, 'the answer is right underneath it');
  ok(Number(answered.aWeight) < 600, 'the answer is NOT bold (' + answered.aWeight + ')');
  // the question has to read louder than the answer, which is the whole point
  ok(Number(answered.qWeight) > Number(answered.aWeight), 'question outweighs answer');

  // ---- 5: an unanswered one is still there --------------------------------
  ok(items[0].q === OPEN_Q, 'the newest question is first');
  ok(/no answer yet/i.test(items[0].wait), 'an unanswered question says so rather than hiding');

  // ---- 6b: background locked, scroll restored on close --------------------
  ok((await page.evaluate(() => document.body.style.overflow)) === 'hidden',
     'the thread behind it is locked while the list is open');
  await page.evaluate(() => window.scrollBy(0, 400));   // anything nudging the page under the overlay
  await page.$eval('#qfull .qhead .x', (n) => n.click());
  await page.waitForTimeout(250);
  ok(await page.$$eval('#qfull', (n) => n.length) === 0, 'closing removes it');
  ok((await page.evaluate(() => document.body.style.overflow)) === '', 'the lock is released');
  ok(!(await page.evaluate(() => document.body.classList.contains('ontop'))), 'and body.ontop with it');
  ok(await page.$eval('.float', (n) => getComputedStyle(n).display) !== 'none', 'the pill comes back');
  const yAfter = await page.evaluate(() => window.scrollY);
  ok(Math.abs(yAfter - yBefore) < 4,
     'she closes it exactly where she opened it (' + Math.round(yBefore) + ' → ' + Math.round(yAfter) + ')');

  // ---- 7: the note underneath still works ---------------------------------
  await page.click('#thread .noterow .noteshow');
  await page.waitForTimeout(200);
  ok(await page.$$eval('#thread .noterow textarea', (n) => n.length) === 1, 'the note still opens for editing');
  ok(await page.$$eval('#thread .qbtn', (n) => n.length) === 1, 'and the button survives the edit');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
