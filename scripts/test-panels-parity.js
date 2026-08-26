#!/usr/bin/env node
/**
 * PANELS ↔ PLAYGROUND PARITY — the feed Sophie asked for, driven for real.
 *
 * 2026-08-26, Sophie: "panels has some differences between it and the
 * playground — for example, there's no heart or X button or I don't think
 * there's a way to leave a note … I don't think it shows tiles or icons
 * either. I asked the person who made it to make it exactly the same as the
 * playground except for that it's panels."
 *
 * The tiles view DID exist; everything else in that sentence did not. So this
 * pins the ported set, and it pins it by DRIVING THE REAL PAGE rather than by
 * grepping for a class name — a ♥ that renders and posts nothing is exactly
 * the shape of what she was looking at.
 *
 * It never makes a model call and needs no Firebase: a stub server answers the
 * four routes the page talks to, and /feedkit.js, /tritoggle.* and
 * /asset-lightbox.js come off disk the way express.static serves them.
 *
 *   node scripts/test-panels-parity.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'public', 'panels.html'), 'utf8');
const LAB = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── the source: the shared pieces are SHARED, not copied ──────────────────
console.log('\nboth feeds are built out of the one kit\n');
ok(/<script src="\/feedkit\.js">/.test(PAGE) && /<script src="\/feedkit\.js">/.test(LAB),
  'both pages link /feedkit.js');
for (const fn of ['qparse', 'qmatch', 'liveInput', 'enterSubmits', 'syncChildren']) {
  const re = new RegExp('function ' + fn + '\\(');
  ok(!re.test(PAGE) && !re.test(LAB),
    `neither page keeps its own ${fn} — the kit owns it`);
}
// thumbFor is the one the Playground still NAMES, because it binds its own
// THUMB_W — a one-line adapter over the kit, not a copy. What must not come
// back is the RULE: the url it builds, and the list of hosts worth deriving a
// copy for, live in exactly one file.
const buildsThumb = (src) => /['"]\/api\/story\/thumb\?w=/.test(src);
ok(!buildsThumb(PAGE) && !buildsThumb(LAB),
  'and neither page rebuilds the thumb url itself');
// The one shared thing that MUST still be hand-declared per page: /tritoggle.js
// is a hard dependency of the aim rule and each page carries one cycling line
// as its floor. That is a deliberate degraded-but-working fallback, not a copy.
ok(/window\.triNext \|\| function/.test(PAGE), 'the toggle floor is still one line');
ok(!/1\/tritoggle/.test(PAGE), 'and nothing re-implements the aim');

// A GIF pixel, so a picture really decodes and the lightbox really opens.
const PX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const LONG = 'a crow on a fence in the rain with a very long dictated sentence that '
  + 'runs past the two-line cap the card puts on her words so the opener has to appear';
const RUNS = [
  { id: 'r1', status: 'done', grid: 4, shape: 'portrait', res: '4k', quality: 'medium',
    style: 'dreamy', count: 4, sheetSize: '2336x3504', cellSize: '1168x1752',
    cellAspectRatio: '2:3', ms: 3000, prefix: 'PRE', suffix: 'SUF',
    panels: [LONG, 'a fox', 'a hare', 'a moth'], sheetUrl: PX,
    images: [
      { cell: 'top-left', url: PX + '#1', prompt: LONG },
      { cell: 'top-right', url: PX + '#2', prompt: 'a fox' },
      { cell: 'bottom-left', url: PX + '#3', prompt: 'a hare' },
      { cell: 'bottom-right', url: PX + '#4', prompt: 'a moth' },
    ],
    votes: { 'top-right': 'like' } },
  { id: 'r2', status: 'done', grid: 2, shape: 'landscape', res: '2k', quality: 'low',
    style: 'dreamy', count: 2, sheetSize: '3264x2448', cellSize: '1632x2448',
    cellAspectRatio: '2:3', ms: 2000, prefix: 'PRE', suffix: 'SUF',
    panels: ['a whale', 'a gull'], sheetUrl: PX,
    images: [{ cell: 'left', url: PX + '#5', prompt: 'a whale' },
             { cell: 'right', url: PX + '#6', prompt: 'a gull' }],
    votes: { left: 'dislike' } },
];
const OLDER = { id: 'r0', status: 'done', grid: 4, shape: 'portrait', res: '4k',
  quality: 'high', style: 'dreamy', count: 4, sheetSize: '2336x3504',
  cellSize: '1168x1752', cellAspectRatio: '2:3', ms: 5, prefix: 'PRE', suffix: 'SUF',
  panels: ['an older sheet nobody has scrolled back to', 'b', 'c', 'd'], sheetUrl: PX,
  images: [{ cell: 'top-left', url: PX + '#9', prompt: 'an older sheet' }], votes: {} };

const CONFIG = {
  grids: [
    { id: 2, label: 'two', across: 2, down: 1, count: 2, cells: ['left', 'right'] },
    { id: 4, label: 'four', across: 2, down: 2, count: 4,
      cells: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
  ],
  shapes: [{ id: 'portrait', label: 'Portrait', aspectRatio: '2:3' },
           { id: 'landscape', label: 'Landscape', aspectRatio: '3:2' }],
  tiers: ['1k', '2k', '4k'],
  qualities: ['low', 'medium', 'high'],
  plans: { '4|portrait|4k': { sheet: '2336x3504', cell: '1168x1752', count: 4,
    cents: { medium: { sheet: '11.7', each: '2.9' } } },
    '2|portrait|4k': { sheet: '3264x2448', cell: '1632x2448', count: 2, cents: {} } },
  styles: [{ id: 'dreamy', label: 'Dreamy', prefix: 'PRE', suffix: 'RAW SUF',
    sheetSuffix: 'SUF', refs: ['a.jpg'] }],
  gridLines: { 4: 'GRIDLINE FOUR', 2: 'GRIDLINE TWO' },
  defaults: { grid: 4, shape: 'portrait', res: '4k', quality: 'medium', style: 'dreamy' },
  model: 'gpt-image-2',
};

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    console.log('\nSKIP the page half: playwright not installed\n');
    console.log(fails ? fails + ' FAILED' : 'all pass');
    process.exit(fails ? 1 : 0);
  }

  const posted = { votes: [], notes: [] };
  let noteThread = [];
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/panels/config') return json(CONFIG);
    if (url.pathname === '/api/panels' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const before = Number(url.searchParams.get('before')) || 0;
      if (before) return json({ runs: [OLDER], more: false });
      if (q) return json({ runs: RUNS.concat([OLDER])
        .filter((r) => (r.panels || []).join(' ').toLowerCase().includes(q)), more: false });
      return json({ runs: RUNS, more: true });
    }
    if (/^\/api\/panels\/[^/]+\/vote$/.test(url.pathname)) {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        posted.votes.push({ path: url.pathname, body: JSON.parse(body || '{}') });
        json({ ok: true });
      });
    }
    if (url.pathname === '/api/gallery/assets/note') {
      if (req.method === 'GET') return json({ url: url.searchParams.get('url'), thread: noteThread });
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        const b = JSON.parse(body || '{}');
        posted.notes.push(b);
        noteThread = noteThread.concat([{ from: 'sophie', text: b.text, at: 'now' }]);
        json({ ok: true, thread: noteThread });
      });
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  let b;
  try { b = await chromium.launch(); }
  catch { b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  p.on('pageerror', (e) => fatal.push(e.message));
  await p.goto(base + '/panels', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('#feed .run').length === 2,
    { timeout: 15000 });

  console.log('\nthe feed bar — the Playground\'s, whole\n');
  ok(await p.isVisible('#viewseg [data-view="list"]') && await p.isVisible('#viewseg [data-view="tiles"]'),
    'List and Tiles are both on screen');
  ok((await p.textContent('#v-cols')).trim() === '3', 'the third segment says the number');
  await p.click('#v-cols');
  ok((await p.textContent('#v-cols')).trim() === '4', 'and tapping it steps 3 → 4');
  // MEASURED on the real wall, not read off the variable: a wrong `--cols` and
  // a wrong `repeat()` both compute to plausible-looking text, and only the
  // boxes say how many actually sit on a row. It has to be SHOWING to have any
  // — #tiles is `hidden` in list view, where a grid computes to `none`.
  await p.click('#viewseg [data-view="tiles"]');
  await p.waitForFunction(() => document.querySelectorAll('#tiles .pic').length === 6,
    { timeout: 8000 });
  ok(await p.$eval('#tiles', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length === 4),
    'the wall really lays out four across');
  ok(await p.$$eval('#tiles .pic img', (els) => {
    const tops = [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))];
    return els.filter((e) => Math.round(e.getBoundingClientRect().top) === tops[0]).length === 4;
  }), 'and four pictures really share the first row');
  await p.click('#v-cols');
  ok(await p.$('#tiles .pic .badge.like'), 'the wall wears the marks too');
  await p.click('#viewseg [data-view="list"]');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run').length === 2,
    { timeout: 8000 });
  ok(await p.isVisible('#v-liked') && await p.isVisible('#v-hidex'), 'both mark filters are there');
  ok(await p.isVisible('#q'), 'and the search box');
  // The row must not run under the injected pill's reserved column.
  ok(await p.$eval('.feedbar', (el) => getComputedStyle(el).paddingRight === '56px'),
    'the bar reserves the pill\'s column');
  ok(await p.$eval('.feedbar', (el) => getComputedStyle(el).position === 'sticky'),
    'and it is sticky, reachable from anywhere in a long feed');

  console.log('\nher words are on the card, behind the house opener\n');
  const head = await p.textContent('#feed .run .p');
  ok(head.includes('a fox') && head.includes('a moth'), 'the card carries every cell she wrote');
  ok(await p.isVisible('#feed .run .moretxt'), 'a cut prompt grows the "… more" opener');
  ok(await p.$eval('#feed .run .moretxt', (el) => getComputedStyle(el).borderStyle === 'none'
    && getComputedStyle(el).textDecorationLine === 'underline'),
    'and it is an underlined word, never a button');
  await p.click('#feed .run .moretxt');
  ok(!(await p.$eval('#feed .run .p', (el) => el.classList.contains('clamp'))), 'it opens the words');
  await p.click('#feed .run .moretxt');

  console.log('\n♥ / ✕ — the mark, the badge and the POST\n');
  ok(await p.$('#feed .run .cuts figure .badge.like'), 'a mark already on file paints its badge');
  ok(await p.$('#feed .run:nth-child(2) .cuts figure .badge.dislike'), 'and a ✕ paints the grey one');
  await p.click('#feed .run .cuts figure:nth-child(1) img');
  await p.waitForSelector('#clightbox .vote.heart', { timeout: 8000 });
  ok(true, 'tapping a picture opens the shared Assets lightbox');
  ok(await p.isVisible('#clightbox .vote.nope'), 'with the ✕ beside the ♥');
  ok(await p.isVisible('#clightbox .lbnote input'), 'and a note box under the picture');
  await p.click('#clightbox .vote.heart');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run .cuts .badge.like').length === 2,
    { timeout: 8000 });
  ok(posted.votes.length === 1 && posted.votes[0].body.cell === 'top-left'
    && posted.votes[0].body.vote === 'like', 'the ♥ posts the CELL name and the vote');
  ok(true, 'and the badge lands on the tile behind it');
  await p.click('#clightbox .vote.heart');
  ok(posted.votes[1] && posted.votes[1].body.vote === '', 'tapping the lit mark again clears it');

  console.log('\na note on a picture\n');
  await p.fill('#clightbox .lbnote input', 'more rain in this one');
  await p.click('#clightbox .lbnote .notesend');
  await p.waitForFunction(() => true);
  await new Promise((r) => setTimeout(r, 400));
  ok(posted.notes.length === 1 && posted.notes[0].text === 'more rain in this one',
    'it posts to the picture\'s own thread');
  ok(posted.notes[0].chat === 'my-creations',
    'in my-creations, where panels.js files every panel');
  ok(posted.notes[0].from === 'sophie', 'as hers');
  // Leave the lightbox the way she does.
  await p.click('#clightbox', { position: { x: 5, y: 5 } });
  await new Promise((r) => setTimeout(r, 300));

  console.log('\nthe filters actually filter\n');
  await p.click('#v-liked');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run .cuts figure').length === 1,
    { timeout: 8000 });
  ok(true, 'hearts only leaves the one hearted panel');
  ok(await p.$$eval('#feed .run', (els) => els.length === 1), 'and a run with nothing left drops out');
  await p.click('#v-liked');
  await p.click('#v-hidex');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run .cuts figure').length === 5,
    { timeout: 8000 });
  ok(true, 'the ✕ filter drops the crossed-out one and keeps the rest');
  await p.click('#v-hidex');

  console.log('\nsearch — over the whole history, not the loaded page\n');
  await p.fill('#q', 'whale');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run').length === 1,
    { timeout: 8000 });
  ok(true, 'typing narrows the feed instantly');
  ok(await p.isVisible('#qclear'), 'and the clear ✕ appears only with words to wipe');
  await p.fill('#q', 'nobody has scrolled back');
  await p.waitForFunction(() => {
    const t = document.querySelector('#feed .run .p');
    return t && t.textContent.indexOf('older sheet') >= 0;
  }, { timeout: 8000 });
  ok(true, 'and the server answers with a run this feed had never paged in');
  await p.click('#qclear');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run').length === 2,
    { timeout: 8000 });
  ok(true, 'the ✕ clears it and the feed comes back');

  console.log('\n"Older", and putting the prompts back in the boxes\n');
  ok(await p.isVisible('#more .morebtn'), 'the feed offers Older while the server has more');
  await p.click('#more .morebtn');
  await p.waitForFunction(() => document.querySelectorAll('#feed .run').length === 3,
    { timeout: 8000 });
  ok(true, 'and it pages backwards through time');
  await p.click('#feed .run:nth-child(2) .copybtn');
  ok(await p.$eval('#cells textarea', (el) => el.value.indexOf('a whale') === 0),
    'the copy button restores that sheet\'s words');
  ok(await p.$$eval('#cells textarea', (els) => els.length === 2),
    'and the GRID it was drawn on, or the words would land in the wrong cells');

  console.log('\nthe prompt panel, and the bigger box\n');
  await p.click('#promptbtn');
  await p.waitForSelector('#ppanel.on #ppre', { timeout: 8000 });
  ok(await p.inputValue('#ppre') === 'PRE', 'it shows the SERVED prefix');
  ok(await p.inputValue('#ppost') === 'SUF',
    'and the tail as a SHEET really sends it, not the style\'s raw one');
  ok((await p.textContent('#ppanel')).includes('GRIDLINE TWO'),
    'with the line this tool adds, disclosed');
  ok(!/PRE|SUF|GRIDLINE/.test(PAGE.replace(/PRESS|SUFFIX/g, '')),
    'and none of it is baked into the page');
  await p.fill('#ppre', 'MINE');
  await new Promise((r) => setTimeout(r, 100));
  ok(await p.$eval('#promptbtn', (el) => el.classList.contains('edited')),
    'her edit MARKS the button — she can never be running her own wording silently');
  await p.click('#preset');
  await p.waitForFunction(() => document.getElementById('ppre').value === 'PRE', { timeout: 8000 });
  ok(!(await p.$eval('#promptbtn', (el) => el.classList.contains('edited'))), 'and Reset puts it back');
  await p.click('#promptbtn');

  const small = await p.$eval('#cells textarea', (el) => el.getBoundingClientRect().height);
  await p.click('#cells .pbig');
  const big = await p.$eval('#cells textarea', (el) => el.getBoundingClientRect().height);
  ok(big > small * 2, `the bigger-box toggle really grows the box (${Math.round(small)} → ${Math.round(big)})`);
  // The button must not sit on top of her last line.
  ok(await p.$eval('#cells textarea', (el) => parseFloat(getComputedStyle(el).paddingBottom) >= 26),
    'and the box reserves that corner, so nothing is typed under it');
  await p.click('#cells .pbig');

  ok(!fatal.length, 'no page errors' + (fatal.length ? ': ' + fatal[0] : ''));

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED\n` : '\nall pass\n');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });
