#!/usr/bin/env node
// test-chats-questions.js — the QUESTIONS button under a chat's header and the
// list it swaps in.
//
//   node scripts/test-chats-questions.js
//
// Sophie, 2026-08-14: "sometimes I ask questions to chat and then it's hard to
// find the answer cause it's buried under other stuff … I want something where
// my question is repeated verbatim and bold and then the answer is right
// underneath it not bold" — on where it goes: "there's hardly any room on that
// screen so I wouldn't put it there. I would just put a little button
// underneath it somewhere that says questions" — and, after the first version
// shipped as a full-screen overlay with an ✕: "it's supposed to basically just
// exchange for the messages same format like you know where it can open and
// then close if I click on it be collapsed I mean, and it's supposed to have
// all the other things above it. Not totally separate not an x. Also, it
// shouldn't have questions that haven't been answered yet."
//
// Drives the REAL public/chats.html headless and asserts:
//   1. the tab row is still the same THREE tabs — the button did not land there,
//   2. a button reading exactly "Questions" sits underneath, on the note row,
//      sharing its line rather than costing one,
//   3. tapping it asks the server for THIS chat's questions,
//   4. it EXCHANGES for the messages — they go, everything above them stays,
//      and there is no overlay and no ✕ anywhere,
//   5. a row is a message row: collapsed to the question, tap opens the answer
//      underneath it, tapping the head collapses it again,
//   6. her question is verbatim and BOLD; the answer is NOT bold,
//   7. the same button swaps the messages back, with the thread intact,
//   8. the note underneath it still opens for editing, button intact.
//
// Unanswered questions are dropped BEFORE the page ever sees them
// (`answeredOnly` in questions.js, applied by the route) — that half is covered
// by scripts/test-questions.js, and the stub here serves what the real route
// would hand over.
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
const HER_Q2 = 'What did the render cost?';
const THE_A2 = 'Six cents at medium.';

const CHATS = { 'chat-a': { lastSeen: iso(T0 - 2e5), sophieNote: 'questions, formatting' } };
// enough messages that the thread actually scrolls
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
    // The real route drops unanswered ones before they leave the server, so
    // this stub serves what the page will actually be handed.
    return json({ chat: 'chat-a', total: 2, questions: [
      { id: 'q2', replyId: 'r2', at: iso(T0 - 1e5), question: HER_Q2, answer: THE_A2 },
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
  const shown = (sel) => page.$$eval(sel, (ns) => ns.filter((n) => n.offsetParent !== null).length);

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
  const rowH = await page.$eval('#thread .noterow', (n) => n.getBoundingClientRect().height);
  const btnH = await page.$eval('#thread .qbtn', (n) => n.getBoundingClientRect().height);
  ok(rowH < btnH * 2.2, 'it shares the note’s line rather than adding one (' + Math.round(rowH) + 'px)');

  // THE PILL MUST NOT SIT ON THE BUTTON (2026-08-23, from her screenshot: the
  // door to her Questions tab read "QUES" with the rest covered). This row is
  // the thread's last header line and it does not scroll, so its right end sits
  // permanently inside the pill's fixed corner. `elementFromPoint` is the only
  // honest way to ask — the button passes `offsetParent !== null` and every
  // width assertion while it is completely unreachable.
  const pillOn = await page.$$eval('body > .float', (n) => n.filter((x) => x.getClientRects().length).length);
  ok(pillOn === 1, 'the autoscroll pill is on screen (' + pillOn + ')');
  const cover = await page.evaluate(() => {
    const b = document.querySelector('#thread .qbtn').getBoundingClientRect();
    const p = document.querySelector('body > .float').getBoundingClientRect();
    const hit = document.elementFromPoint(b.right - 6, b.top + b.height / 2);
    return { overlap: b.right > p.left && b.bottom > p.top && b.top < p.bottom,
             reaches: !!(hit && hit.closest('.qbtn')), right: Math.round(b.right), pillLeft: Math.round(p.left) };
  });
  ok(!cover.overlap, 'the button ends left of the pill (' + cover.right + ' vs ' + cover.pillLeft + ')');
  ok(cover.reaches, 'and a tap on its right edge reaches the button, not the pill');

  const msgsBefore = await shown('#thread .msg');
  ok(msgsBefore > 5, 'the thread is showing its messages to begin with (' + msgsBefore + ')');

  // ---- 3/4: it EXCHANGES for the messages ---------------------------------
  await page.$eval('#thread .qbtn', (n) => n.click());
  await page.waitForSelector('#thread .qrow', { timeout: 8000 });
  ok(asked.length === 1 && asked[0] === 'chat-a', 'it asked for this chat’s questions: ' + asked.join(','));
  ok(await shown('#thread .qrow') === 2, 'both questions are showing');
  ok(await shown('#thread .msg:not(.qrow)') === 0, 'the messages are gone — it took their place');
  // "Not totally separate not an x"
  ok(await page.$$eval('#qfull', (n) => n.length) === 0, 'there is no overlay');
  ok(await page.$$eval('#thread .qhead .x, #qfull .x', (n) => n.length) === 0, 'and no ✕ to dismiss');
  // "it's supposed to have all the other things above it"
  ok(await shown('#thread .thread-head h1') === 1, 'the chat’s name is still above it');
  ok(await shown('#thread .viewtog button') === 3, 'the tabs are still above it');
  ok(await shown('#thread .noterow') === 1, 'her note is still above it');
  ok(await page.$eval('#thread .qbtn', (n) => n.classList.contains('on')), 'the button reads as lit');
  // the questions must sit where the messages were, not somewhere else
  ok(await page.evaluate(() => {
    const note = document.querySelector('#thread .noterow').getBoundingClientRect().bottom;
    return document.querySelector('#thread .qrow').getBoundingClientRect().top > note;
  }), 'and the list starts below all of it');

  // ---- 5/6: a row is a message row ----------------------------------------
  const first = '#thread .qrow';
  ok(await page.$eval(first, (n) => n.classList.contains('msg')), 'a row IS a message row');
  ok(await page.$eval(first, (n) => !n.classList.contains('open')), 'it starts collapsed');
  ok(await page.$eval(first + ' .m-preview', (n) => n.offsetParent !== null), 'showing the question');
  ok(await page.$eval(first + ' .m-full', (n) => n.offsetParent === null), 'with the answer put away');
  await page.$eval(first + ' .m-preview', (n) => n.click());
  await page.waitForTimeout(150);
  ok(await page.$eval(first, (n) => n.classList.contains('open')), 'tapping it opens');
  const shape = await page.$eval(first + ' .m-full', (n) => {
    const q = n.querySelector('.q-q'), a = n.querySelector('.q-a');
    return { q: q.textContent.trim(), a: a.textContent.trim(),
      qW: getComputedStyle(q).fontWeight, aW: getComputedStyle(a).fontWeight,
      order: q.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING ? 'answer under' : 'answer over' };
  });
  ok(shape.q === HER_Q2, 'the open row still shows her question, verbatim');
  ok(Number(shape.qW) >= 600, 'the question is BOLD (' + shape.qW + ')');
  ok(shape.a === THE_A2, 'the answer is there');
  ok(Number(shape.aW) < 600, 'and NOT bold (' + shape.aW + ')');
  ok(shape.order === 'answer under', 'the answer is underneath the question');
  await page.$eval(first + ' .m-head', (n) => n.click());
  await page.waitForTimeout(150);
  ok(await page.$eval(first, (n) => !n.classList.contains('open')), 'tapping the head collapses it again');

  // ---- 7: the same button swaps back --------------------------------------
  await page.$eval('#thread .qbtn', (n) => n.click());
  await page.waitForTimeout(250);
  ok(await shown('#thread .qrow') === 0, 'the questions go away');
  ok(await shown('#thread .msg') === msgsBefore, 'and every message is back (' + msgsBefore + ')');
  ok(!(await page.$eval('#thread .qbtn', (n) => n.classList.contains('on'))), 'the button is unlit again');
  await page.$eval('#thread .qbtn', (n) => n.click());
  await page.waitForTimeout(250);
  ok(await shown('#thread .qrow') === 2, 'and it swaps again without re-fetching');
  ok(asked.length === 1, 'the second look costs no request');
  await page.$eval('#thread .qbtn', (n) => n.click());
  await page.waitForTimeout(200);

  // ---- 9: the note underneath it still works ------------------------------
  await page.click('#thread .noterow .noteshow');
  await page.waitForTimeout(200);
  ok(await page.$$eval('#thread .noterow textarea', (n) => n.length) === 1, 'the note still opens for editing');
  ok(await page.$$eval('#thread .qbtn', (n) => n.length) === 1, 'and the button survives the edit');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
