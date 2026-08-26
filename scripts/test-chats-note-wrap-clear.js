#!/usr/bin/env node
// THREE THINGS SHE ASKED FOR IN ONE EVENING (Aug 2026), all on public/chats.html:
//
//   A. "i want the archive summary to show below my note, as u said, including
//      the down arrow to make it longer" — the wrap-up lived on the ARCHIVE
//      row and only there, which had two consequences she was reading as the
//      summary not existing at all: on a home row `note || wrap` means a note
//      SHE wrote takes the line outright (measured 2026-08-19: 71 of the 312
//      chats carrying a summary also carry a note), and the ⌄ is painted only
//      in the archive's List view, so the 162 not yet archived had nowhere to
//      open one.
//
//   B. "there's supposed to be an extra button to 'clear' the search, but not
//      dismiss the search box" — the action existed (the GLASS starts a new
//      search) but a magnifier does not READ as "clear", so it was a control
//      she had no reason to try. Now the round ✕ inside the field does it.
//
//   C. "can u also put a dividing line between progress and categories in the
//      archive" — the home row has drawn that line since TAGS folded, but the
//      SHEETS handed her one jumbled list.
//
//   D. (2026-08-25) "if there's no note for the chat can you get rid of this
//      thing where it says + note for chat and just put it at the end of the
//      see more area" — the italic placeholder sat at the top of every thread
//      she had never written a note on. Now: a chat WITH a note is unchanged,
//      a chat with a summary and no note carries a small "+ note" INSIDE the
//      opened box, and a chat with neither keeps it in the note row, because
//      otherwise there would be no way in at all.
//
//   E. (2026-08-26) "what you asked can be closer to the top and the font can
//      be a bit bigger and the add a note button should only show up if I
//      click [see more]" — three things about the same two lines. The summary
//      moved up (the rule's air, a bare note row's margin), the type went
//      13.5 → 15px to match her own note above it, and "+ note" now waits
//      behind the expander rather than riding the sentence on every paint.
//      The QUESTIONS button must still get its own taps — the row it sits in
//      gave up its bottom margin, so a full-width line pulled up over it
//      would swallow them.
//
//   npm install playwright-core --no-save && node scripts/test-chats-note-wrap-clear.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
// The archive sheet's progress words, LIFTED from the page rather than typed
// out again here (see THERE ARE TWO PROGRESS LISTS in chats.html). The page's
// script runs inside an IIFE so nothing is on `window`; a hand-kept copy went
// stale the moment she moved a word between the two lists, which is what left
// this check failing on main against `bug fix` · `new feature` · `research` ·
// `quick question` · `failure`.
const ARCHIVE_PROGRESS = (() => {
  const src = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  const m = src.match(/var ARCHIVE_PROGRESS=\[([^\]]*)\]/);
  if (!m) throw new Error('ARCHIVE_PROGRESS is gone from chats.html — this check would measure nothing');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
})();
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const MSGS = [
  { id: 'm1', chat: 'noted', from: 'claude', text: 'a yellow raincoat', tldr: 'the one', created: iso(T0 - 6e5), postedAt: iso(T0 - 6e5) },
  { id: 'm2', chat: 'bare', from: 'claude', text: 'crows at dusk', tldr: 'two', created: iso(T0 - 5e5), postedAt: iso(T0 - 5e5) },
  { id: 'm3', chat: 'summed', from: 'claude', text: 'the pause lengths', tldr: 'three', created: iso(T0 - 4e5), postedAt: iso(T0 - 4e5) },
];
// `noted` has a note AND a full three-depth wrap-up — the case that was
// invisible everywhere. `bare` has neither, and must show no line and no ⌄.
const CHATS = {
  noted: {
    account: '1', sophieNote: 'waiting on the palette',
    wrapLine: 'Built the pause timeline and shipped v7b.',
    wrapUp: 'Built the pause timeline. Shipped v7b. Her lengths are stored per paragraph.',
    wrapOpen: 'Whether the 45 percent line still reads bungled.',
    wrapLong: 'Imported the Cutting Room pause passes rather than re-deriving them.\nBaked room tone once per recording.\nListening is per paragraph, spliced in the browser.',
  },
  bare: { account: '1' },
  // D's case: a summary and NO note, which is where the "+ note" opener she
  // asked for actually lives.
  summed: {
    account: '1',
    // the three-answer shape, i.e. what a real chat carries — so the line is
    // the ASKED answer and wears its bold "What you asked" over it, which is
    // the pair E measures.
    wrapAsked: 'Cut the room tone and re-listened per card.',
    wrapDid: 'Imported the pause passes rather than re-deriving them.',
    wrapNext: 'Whether the 45 percent line still reads bungled.',
    wrapLine: 'Cut the room tone and re-listened per card.',
    wrapUp: 'Cut the room tone. Re-listened per card. Kept every take.',
    wrapLong: 'Imported the pause passes.\nBaked room tone once.\nSpliced in the browser.',
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'b1', chats: CHATS,
      settings: { categories: ['witch', 'stories'] },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/search') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: [{ id: 'm1', chat: 'noted', snippet: 'a yellow raincoat', created: MSGS[0].created }],
      chatMatches: [],
    }));
  }
  if (url.pathname === '/api/chatfeed/thread') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: MSGS }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
// Dictation, faithfully: the text lands in the field and NO event is fired.
const dictate = (page, sel, text) => page.evaluate(([s, t]) => {
  const el = document.querySelector(s); el.focus(); el.value = t;
}, [sel, text]);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('the page threw: ' + e.message));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="noted"]');

  // ---- A. the wrap-up under her note, in the thread ---------------------
  await page.click('#grid [data-chat="noted"]');
  await page.waitForSelector('#thread .noterow');
  const order = await page.evaluate(() => {
    const n = document.querySelector('#thread .noterow');
    const w = document.querySelector('#thread .threadwrap');
    if (!w) return { missing: true };
    return {
      below: !!(n.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING),
      note: (n.textContent || '').trim(),
      line: (w.querySelector('.twline') || {}).textContent || '',
      hasToggle: !!w.querySelector('.wrapmore'),
      bodyHidden: (w.querySelector('.wrapfull') || {}).hidden,
    };
  });
  if (order.missing) fail('no wrap-up block in the thread at all');
  else {
    if (!order.below) fail('the summary is not BELOW her note');
    if (!/waiting on the palette/.test(order.note)) fail('her note stopped showing: ' + order.note);
    if (!/pause timeline/.test(order.line)) fail('the summary line is wrong: ' + order.line);
    if (!order.hasToggle) fail('no ⌄ to open the longer version');
    if (order.bodyHidden !== true) fail('the longer version is open before she taps it');
  }
  // …and the ⌄ opens the three sentences, with MORE for the long one
  await page.click('#thread .threadwrap .wrapmore');
  const opened = await page.evaluate(() => {
    const b = document.querySelector('#thread .threadwrap .wrapfull');
    return { hidden: b.hidden, text: b.textContent || '', more: !!b.querySelector('.wrapmore2') };
  });
  if (opened.hidden) fail('the ⌄ did not open the summary');
  if (!/stored per paragraph/.test(opened.text)) fail('the three-sentence version is missing: ' + opened.text);
  if (!/Still open: .*bungled/.test(opened.text)) fail('the still-open half is missing: ' + opened.text);
  if (!opened.more) fail('no MORE for the long version');
  await page.click('#thread .threadwrap .wrapmore2');
  const long = await page.$eval('#thread .threadwrap .wrapfull', (b) => ({
    text: b.textContent || '', bullets: b.querySelectorAll('.wrapbul').length,
  }));
  if (!/Baked room tone/.test(long.text)) fail('MORE did not show the long version');
  if (long.bullets < 3) fail('the long version is not bulleted: ' + long.bullets);

  // ---- D. the "+ note" opener, and the placeholder that is gone ---------
  // A chat that HAS a note offers nothing to add — she already answered.
  if (await page.$('#thread .addnote')) fail('a chat with a note is still offering "+ note"');
  await page.click('#back');
  await page.waitForSelector('#grid [data-chat="summed"]');
  await page.click('#grid [data-chat="summed"]');
  await page.waitForSelector('#thread .noterow');
  const summed = await page.evaluate(() => {
    const n = document.querySelector('#thread .noterow');
    const line = document.querySelector('#thread .threadwrap .twline');
    const add = document.querySelector('#thread .threadwrap .addnote');
    const box = document.querySelector('#thread .threadwrap .wrapfull');
    const row = add && add.closest('.addnoterow');
    return {
      noteText: (n.textContent || '').trim(),
      inRow: !!n.querySelector('.addnote'),
      inLine: !!(line && line.querySelector('.addnote')),
      exists: !!add,
      shown: !!(add && add.getBoundingClientRect().height > 0),
      // it is the last thing in the expander's own area, under the box
      afterBox: !!(row && box && (box.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)),
    };
  });
  if (/note for this chat/.test(summed.noteText)) fail('the "+ note for this chat" placeholder is still on the note row');
  if (summed.inRow) fail('the opener stayed in the note row even though there is a summary to hang it on');
  if (summed.inLine) fail('"+ note" is back on the summary sentence — it belongs behind "See more…"');
  if (!summed.exists) fail('no "+ note" anywhere on a chat with a summary and no note');
  if (summed.shown) fail('"+ note" is showing before she taps "See more…"');
  if (!summed.afterBox) fail('"+ note" is not at the end of the see-more area');
  // …the expander is what reveals it
  await page.click('#thread .threadwrap .wrapmore');
  if (!await page.$eval('#thread .threadwrap .addnote', (n) => n.getBoundingClientRect().height > 0)) {
    fail('"See more…" did not reveal the "+ note" opener');
  }
  // …and it opens the same box, in the note row above it
  await page.click('#thread .threadwrap .addnote');
  await page.waitForSelector('#thread .noterow textarea', { timeout: 2000 })
    .catch(() => fail('"+ note" did not open the note box'));
  if (await page.$('#thread .threadwrap .addnote')) fail('the opener is still on the line while she is typing');
  await page.$eval('#thread .noterow textarea', (n) => n.blur());
  await page.waitForTimeout(250);
  if (!await page.$('#thread .threadwrap .addnote')) fail('a blank save lost the opener for good');

  // ---- E. closer to the top, bigger, and the button underneath still taps --
  // Measured on the real boxes: a chat with a summary and NO note is exactly
  // the screen she sent (header · QUESTIONS · "What you asked"), so the gap
  // under the header is the number she was pointing at. It was 50px.
  const top = await page.evaluate(() => {
    const px = (v) => Math.round(parseFloat(v));
    const hd = document.querySelector('#thread header').getBoundingClientRect();
    const w = document.querySelector('#thread .threadwrap').getBoundingClientRect();
    const q = document.querySelector('#thread .noterow .qbtn').getBoundingClientRect();
    const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    const line = document.querySelector('#thread .twline');
    const ask = document.querySelector('#thread .twq');
    const note = document.querySelector('#thread .noterow');
    return {
      gap: Math.round(w.top - hd.bottom),
      line: px(getComputedStyle(line).fontSize),
      ask: px(getComputedStyle(ask).fontSize),
      noteFont: px(getComputedStyle(note).fontSize),
      qhit: hit ? (hit.className || hit.tagName) + '' : 'nothing',
      overlap: Math.round(document.querySelector('#thread .noterow').getBoundingClientRect().bottom - w.top),
    };
  });
  if (top.gap > 36) fail('"What you asked" is still ' + top.gap + 'px under the header (was 50, wanted well under)');
  if (top.line < 15 || top.ask < 15) fail('the summary type did not get bigger: ' + JSON.stringify(top));
  if (top.line !== top.noteFont) fail('the summary reads at a different size from her own note: ' + JSON.stringify(top));
  if (!/qbtn/.test(top.qhit)) fail('the QUESTIONS button no longer gets its own tap — ' + top.qhit + ' is over it');
  if (top.overlap > 0) fail('the summary block is pulled up ON TOP of the note row by ' + top.overlap + 'px');
  await page.click('#back');

  // a chat with no wrap-up shows nothing rather than an empty caption
  await page.waitForSelector('#grid [data-chat="bare"]');
  await page.click('#grid [data-chat="bare"]');
  await page.waitForSelector('#thread .noterow');
  const bare = await page.evaluate(() => {
    const w = document.querySelector('#thread .threadwrap');
    const n = document.querySelector('#thread .noterow');
    return { there: !!w, shown: !!(w && !w.hidden && w.textContent.trim()),
      opener: !!n.querySelector('.addnote'), text: (n.textContent || '').trim() };
  });
  if (bare.shown) fail('a chat with no summary is showing an empty wrap-up block');
  // …and with NO summary the opener falls back to the note row — otherwise a
  // chat that has never been summarised could never be given a note.
  if (!bare.opener) fail('no way to add a note on a chat with no summary line');
  if (/note for this chat/.test(bare.text)) fail('the old placeholder sentence is still there: ' + bare.text);
  await page.click('#back');
  await page.waitForSelector('#grid [data-chat="noted"]');

  // ---- B. clear the words WITHOUT dismissing the bar --------------------
  await page.click('#searchbtn');
  await page.waitForSelector('#qsearch', { state: 'visible' });
  if (await page.$eval('#qwipe', (n) => getComputedStyle(n).display !== 'none')) {
    fail('the clear button is showing on an empty box');
  }
  await dictate(page, '#qsearch', 'raincoat');
  await page.press('#qsearch', 'Enter');
  await page.waitForSelector('#searchresults .sres', { timeout: 4000 })
    .catch(() => fail('the search never ran'));
  await page.evaluate(() => document.getElementById('qsearch').focus());
  await page.waitForFunction(() => document.getElementById('qwipe').classList.contains('on'), null, { timeout: 3000 })
    .catch(() => fail('the clear button never appeared with words in the box'));
  await page.click('#qwipe');
  const wiped = await page.evaluate(() => ({
    words: document.getElementById('qsearch').value,
    barOpen: document.getElementById('searchrow').classList.contains('on'),
    focused: document.activeElement === document.getElementById('qsearch'),
    results: document.getElementById('searchresults').style.display,
    grid: getComputedStyle(document.getElementById('grid')).display,
    wipeShown: document.getElementById('qwipe').classList.contains('on'),
  }));
  if (wiped.words !== '') fail('the clear button left words in the box: ' + JSON.stringify(wiped.words));
  if (!wiped.barOpen) fail('the clear button DISMISSED the search box — that is the ✕\'s job, not this one');
  if (!wiped.focused) fail('the clear button dropped the keyboard');
  if (wiped.results !== 'none') fail('the stale results are still up');
  if (wiped.grid === 'none') fail('the chat list did not come back');
  if (wiped.wipeShown) fail('the clear button is still showing on the now-empty box');
  // and the ✕ still LEAVES, one tap, as before
  await page.click('#qclear');
  if (await page.$eval('#searchrow', (n) => n.classList.contains('on'))) fail('the ✕ stopped closing the bar');

  // ---- C. a line between the progress words and the categories ----------
  await page.click('#grid [data-chat="noted"]');
  await page.waitForSelector('#thread .archlink.arch-r, #thread .archlink');
  await page.$$eval('#thread .archlink', (ns) => { (ns.find((n) => /archive/i.test(n.getAttribute('aria-label') || '')) || ns[0]).click(); });
  await page.waitForSelector('.askbox .arctags .catchip');
  const sheet = await page.$$eval('.askbox .arctags > *', (ns) => ns.map((n) => ({
    div: n.classList.contains('catdiv'),
    label: (n.textContent || '').trim(),
    chip: n.classList.contains('catchip'),
  })));
  const dv = sheet.findIndex((x) => x.div);
  if (dv < 0) fail('no dividing line in the archive sheet');
  else {
    // DERIVED from the page's own list, never a second copy of it: the archive
    // sheet offers `ARCHIVE_PROGRESS` (see THERE ARE TWO PROGRESS LISTS in
    // chats.html), and a hand-kept list here went stale the moment she moved a
    // word between the two — which is exactly what happened to the five
    // work-kind words.
    const TASK = ARCHIVE_PROGRESS.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    const above = sheet.slice(0, dv).filter((x) => x.chip).map((x) => x.label);
    const below = sheet.slice(dv + 1).filter((x) => x.chip).map((x) => x.label);
    if (!above.length || !below.length) fail('the line has nothing on one side of it');
    above.forEach((w) => { if (TASK.indexOf(w) < 0) fail('"' + w + '" is a category but sits above the line'); });
    below.forEach((w) => { if (TASK.indexOf(w) > -1) fail('"' + w + '" is a progress word but sits below the line'); });
    if (!/categor/i.test(sheet[dv].label)) fail('the divider does not name the group below it: ' + sheet[dv].label);
    // and it really breaks the line in a flex row, rather than sitting beside a chip
    const full = await page.$eval('.askbox .arctags .catdiv', (n) =>
      Math.round(n.getBoundingClientRect().width) >= Math.round(n.parentNode.getBoundingClientRect().width) - 2);
    if (!full) fail('the divider does not span the row, so it sits beside a chip instead of breaking the line');
  }

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the summary sits under her note with its ⌄, the words clear without losing the bar, and the sheet is ruled off');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
