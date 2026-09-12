#!/usr/bin/env node
/* STITCH — pick clips, put them in order, ffmpeg joins them (2026-09-12,
   Sophie: "something very simple. We're just select clips and then move them
   around and ffmpeg stitches them together … it could be called stitch").

   The pure half is stitch.js: the pickables off the Footage log (a trimmed
   clip's PARTS beside the whole), the order arithmetic (arrows, a typed
   number, ✕, a pick that never doubles), and the cut-model shape the render
   reads. The page keeps a MIRROR of the order rules (`window.__stitchRules`)
   so a tap answers on the spot; the browser half drives that mirror over the
   same fixtures as the module, so the two cannot drift.

   The page half drives the REAL public/stitch.html in headless Chromium
   against a stub that RECORDS what the page really POSTs — a lit tile says
   nothing about what left the phone — and MEASURES the rest: three across
   off the real cells, the shared switch really swapping the two surfaces, a
   control in the pill's band really taking its own tap (elementFromPoint),
   the render row appearing off the poll.

   Run: node scripts/test-stitch.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('STITCH — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('STITCH — ' + pass + ' passed');
}

const S = require('../stitch');

// ── the pure half ────────────────────────────────────────────────────────
const cards = [
  { id: 'a', status: 'done', video: 'https://x/a.mp4', source: 'https://x/a.mp4', poster: 'https://x/a.jpg', prompt: 'same ppl in [Video1] in a doctors office examination room she: "i\'ve been stressed"', seconds: 12, sentAt: '2026-09-12T06:08', project: 'witch', folder: '', trims: [], vote: 'like', chat: 'footage', ratio: '16:9' },
  { id: 'b', status: 'done', video: 'https://x/b-part1.mp4', source: 'https://x/b.mp4', poster: 'https://x/b.jpg', prompt: 'sophie hums as she skips around her suburban neighborhood', seconds: 15, sentAt: '2026-09-12T04:31', project: 'witch', folder: 'chamomile', chat: 'footage', ratio: '9:16',
    trims: [{ key: 'p1', status: 'ready', url: 'https://x/b-part1.mp4', poster: 'https://x/b1.jpg', start: 1, end: 5, seconds: 4 }, { key: 'p2', status: 'ready', url: 'https://x/b-part2.mp4', poster: '', start: 8, end: 14, seconds: 6 }, { key: 'p3', status: 'baking', url: '', start: 0, end: 1 }] },
  { id: 'c', status: 'drawing', video: '', source: '', prompt: 'still drawing', seconds: 4, sentAt: '2026-09-12T07:00', trims: [] },
  { id: 'd', status: 'failed', video: '', source: '', prompt: 'refused', seconds: 4, sentAt: '2026-09-12T07:01', trims: [] },
  { id: 'e', status: 'done', video: 'https://x/e.mp4', source: 'https://x/e.mp4', poster: '', prompt: 'hidden one', seconds: 4, sentAt: '2026-09-12T07:02', hidden: true, trims: [] },
];
const picks = S.pickables(cards);
ok('a drawing, a failed and a hidden clip are not pickable', !picks.some((p) => ['c', 'd', 'e'].includes(p.id)));
ok('a whole clip is one pickable', picks.some((p) => p.id === 'a' && p.url === 'https://x/a.mp4' && p.part === 0 && p.seconds === 12));
ok('every BAKED part is a pickable of its own, and the still-baking one is not',
  picks.filter((p) => p.id.startsWith('b:')).map((p) => p.id).join(',') === 'b:p1,b:p2');
ok('a part carries its own url, poster and length', (() => { const p = picks.find((x) => x.id === 'b:p1'); return p.url === 'https://x/b-part1.mp4' && p.poster === 'https://x/b1.jpg' && p.seconds === 4 && p.part === 1 && p.parts === 2; })());
ok('a part with no poster of its own takes the clip\'s', picks.find((x) => x.id === 'b:p2').poster === 'https://x/b.jpg');
ok('the whole of a trimmed clip is the SOURCE, never the first part', picks.find((x) => x.id === 'b').url === 'https://x/b.mp4' && / whole$/.test(picks.find((x) => x.id === 'b').title));
ok('newest first', picks[0].job === 'a' && picks[picks.length - 1].job === 'b');
ok('the title is the prompt\'s first words, never the url', picks.find((x) => x.id === 'a').title === 'same ppl in [Video1] in a doctors…');
ok('the project, folder, vote and chat ride the pickable', (() => { const p = picks.find((x) => x.id === 'b:p1'); return p.project === 'witch' && p.folder === 'chamomile' && p.chat === 'footage'; })());

// the order arithmetic
const L = [{ key: '1' }, { key: '2' }, { key: '3' }, { key: '4' }];
const keys = (l) => l.map((c) => c.key).join('');
ok('moveBy steps one', keys(S.moveBy(L, 2, -1)) === '1324' && keys(S.moveBy(L, 0, 1)) === '2134');
ok('moveBy clamps at the ends and never loses a clip', keys(S.moveBy(L, 0, -1)) === '1234' && keys(S.moveBy(L, 3, 5)) === '1234' && S.moveBy(L, 9, 1).length === 4);
ok('moveTo takes a 1-based number and clamps', keys(S.moveTo(L, 3, 1)) === '4123' && keys(S.moveTo(L, 0, 99)) === '2341' && keys(S.moveTo(L, 1, 0)) === '2134');
ok('dropAt takes one out; out of range drops nothing', keys(S.dropAt(L, 1)) === '134' && keys(S.dropAt(L, 7)) === '1234');
const p1 = picks.find((x) => x.id === 'a');
const one = S.addPick([], p1);
ok('addPick appends a cut-model piece: key · video · url · poster · in 0 · out its length',
  one.length === 1 && one[0].key === 'a' && one[0].kind === 'video' && one[0].url === 'https://x/a.mp4' && one[0].poster === 'https://x/a.jpg' && one[0].in === 0 && one[0].out === 12 && one[0].seconds === 12);
ok('a second tap on the same pickable adds nothing', S.addPick(one, p1).length === 1);
ok('cleanClips is cut-model\'s cleaner: a piece with no https url or no length is dropped, in is always 0',
  (() => { const c = S.cleanClips([{ key: 'a', url: 'https://x/a.mp4', out: 12, in: 3 }, { key: 'z', url: 'http://x/z.mp4', out: 4 }, { key: 'y', url: 'https://x/y.mp4' }]); return c.length === 1 && c[0].in === 0 && c[0].out === 12; })());
ok('totalSeconds sums the pieces', S.totalSeconds(S.cleanClips([{ key: 'a', url: 'https://x/a.mp4', out: 12 }, { key: 'b', url: 'https://x/b.mp4', out: 4.5 }])) === 16.5);
ok('the module exports what the page mirrors', ['moveBy', 'moveTo', 'dropAt', 'addPick', 'clipOf'].every((k) => typeof S[k] === 'function'));

// server.js wiring and the clip harvest's skip list
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
ok('server.js mounts /api/stitch and serves /stitch with the pill', /app\.use\('\/api\/stitch', require\('\.\/stitch'\)\.router\)/.test(SERVER) && /app\.get\('\/stitch', serveGated\('stitch\.html', \{ pill: true \}\)\)/.test(SERVER));
ok('stitch/ renders are never harvested back onto the Chunking shelf', require('../clips').SKIP_PREFIXES.includes('stitch/'));
const PAGE_SRC = fs.readFileSync(path.join(PUB, 'stitch.html'), 'utf8');
ok('the page links the shared view switch and keeps no copy of it', /<script src="\/viewswitch\.js">/.test(PAGE_SRC) && /viewswitch\.css/.test(PAGE_SRC) && !/localStorage\.getItem\('stitch_view'\)/.test(PAGE_SRC) && !/\.viewtog\{/.test(PAGE_SRC));
ok('the page\'s script is one IIFE and declares no pill global', /<script>\s*\(function \(\) \{/.test(PAGE_SRC) && !/^\s*(let|const|var) (raf|I|playing)\b/m.test(PAGE_SRC));
ok('text boxes ship empty — no placeholder anywhere', !/placeholder=/.test(PAGE_SRC));
ok('[hidden] wins', /\[hidden\]\{display:none !important\}/.test(PAGE_SRC));

// ── the page half ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('stitch: playwright not installed — page half skipped'); report(); return; }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// the stub: an in-memory stitch store and the pickables above, RECORDING
const store = {};
const posts = [];
let jobTicks = 0;
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const b = body ? JSON.parse(body) : {};
    if (u.pathname === '/stitch') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE_SRC.replace('__STUDIO_TOKEN__', '') + PILL); }
    if (/\.(jpg|png)$/.test(u.pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'witch', name: 'Secretly a Witch' }, { slug: 'ward', name: 'The ward' }] });
    if (u.pathname === '/api/stitch/clips') {
      const cs = cards.map((c) => ({ ...c, poster: c.poster ? c.poster.replace('https://x', '') : '', trims: (c.trims || []).map((t) => ({ ...t, poster: t.poster ? t.poster.replace('https://x', '') : '' })) }));
      const proj = u.searchParams.get('project') || '';
      return json({ ok: true, clips: S.pickables(cs).filter((p) => !proj || p.project === proj) });
    }
    if (u.pathname === '/api/stitch/' || u.pathname === '/api/stitch') {
      if (req.method === 'POST') { const id = 's' + (Object.keys(store).length + 1); store[id] = { id, title: 'Stitch · test', project: b.project || '', clips: [], renders: [], job: null, updatedAt: Date.now() }; posts.push({ path: '/', body: b }); return json({ id, title: store[id].title }); }
      return json({ stitches: Object.values(store).map(S.trimmed) });
    }
    const m = /^\/api\/stitch\/([^/]+)(?:\/(\w+))?$/.exec(u.pathname);
    if (m) {
      const d = store[m[1]]; if (!d) return json({ error: 'no such stitch' }, 404);
      if (!m[2]) return json(d);
      if (m[2] === 'clips') { d.clips = S.cleanClips(b.clips); posts.push({ path: 'clips', id: m[1], body: b }); return json({ ok: true, clips: d.clips.length }); }
      if (m[2] === 'title') { d.title = b.title; posts.push({ path: 'title', body: b }); return json({ ok: true }); }
      if (m[2] === 'render') { posts.push({ path: 'render', id: m[1] }); d.job = { kind: 'render', status: 'running', label: 'starting' }; jobTicks = 0; return json({ ok: true }); }
      if (m[2] === 'job') {
        if (d.job && d.job.status === 'running' && ++jobTicks >= 2) { d.job = { kind: 'render', status: 'done' }; d.renders.unshift({ url: '/film-1.mp4', at: Date.now(), seconds: 16, clips: d.clips.length }); }
        return json({ job: d.job, renders: d.renders });
      }
    }
    json({ error: 'stub: ' + req.method + ' ' + u.pathname }, 404);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  try {
    await page.goto(base + '/stitch', { waitUntil: 'networkidle' });
    ok('the shelf opens, empty', await page.evaluate(() => !document.getElementById('shelf').hidden && !document.getElementById('shelfempty').hidden));
    ok('the title is on screen once', (await page.locator('h1').count()) === 1);

    // the page's mirror of the order rules against the module over one fixture
    const mirror = await page.evaluate((L) => {
      const R = window.__stitchRules; const k = (l) => l.map((c) => c.key).join('');
      return [k(R.moveBy(L, 2, -1)), k(R.moveTo(L, 3, 1)), k(R.dropAt(L, 1)), R.addPick([{ key: 'a' }], { id: 'a', url: 'https://x/a.mp4', seconds: 3 }).length];
    }, L);
    ok('the page\'s order rules answer exactly what stitch.js answers', mirror.join('|') === [keys(S.moveBy(L, 2, -1)), keys(S.moveTo(L, 3, 1)), keys(S.dropAt(L, 1)), S.addPick([{ key: 'a' }], { id: 'a', url: 'https://x/a.mp4', seconds: 3 }).length].join('|'));

    await page.click('#newstitch');
    await page.waitForSelector('#open:not([hidden])');
    ok('a new stitch opens on its own page, the url carrying it', /[?&]s=s1/.test(await page.evaluate(() => location.search)));
    ok('the picker shows every pickable as a tile — the whole clip and both parts', (await page.locator('#tiles .cell').count()) === 4);
    ok('and opens on TILES, three across — MEASURED off the real cells', await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#tiles .cell')];
      const top = cells[0].getBoundingClientRect().top;
      return !document.getElementById('tiles').hidden && cells.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2).length === 3;
    }));
    ok('the shared switch is the one box with the three segments', await page.evaluate(() => !!document.querySelector('#feedbar .viewtog #v-list') && document.getElementById('v-cols').textContent === '3' && getComputedStyle(document.getElementById('v-tiles')).backgroundColor !== 'rgba(0, 0, 0, 0)'));
    await page.click('#v-cols');
    ok('the number segment goes to four, and the wall follows', await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#tiles .cell')];
      const top = cells[0].getBoundingClientRect().top;
      return document.getElementById('v-cols').textContent === '4' && cells.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2).length === 4;
    }));
    await page.click('#v-list');
    ok('LIST is a box per clip, the wall away', await page.evaluate(() => document.getElementById('tiles').hidden && !document.getElementById('feed').hidden && document.querySelectorAll('#feed .crow').length === 4));
    ok('and the view is remembered under the page\'s own key', await page.evaluate(() => localStorage.getItem('stitch_view') === 'list' && localStorage.getItem('stitch_cols') === '4'));
    await page.click('#v-tiles');

    // picking: a tap adds, the tile wears its number, a second tap takes it out
    const tile = (id) => page.locator('#tiles .cell[data-id="' + id + '"]');
    await tile('b:p1').click();
    await tile('a').click();
    await page.waitForTimeout(700);
    ok('two taps are two rows in the order, in tap order', await page.evaluate(() => [...document.querySelectorAll('#order .orow .num')].map((n) => n.value).join(',') === '1,2' && [...document.querySelectorAll('#order .orow .tt span')].map((n) => n.textContent).join('|').indexOf('part 1') >= 0));
    ok('the picked tiles wear their numbers', await page.evaluate(() => document.querySelector('#tiles .cell[data-id="b:p1"] .pn').textContent === '1' && document.querySelector('#tiles .cell[data-id="a"] .pn').textContent === '2' && getComputedStyle(document.querySelector('#tiles .cell[data-id="a"] .pn')).display === 'block'));
    ok('the list row wears the same number', await page.evaluate(() => document.querySelector('#feed .crow[data-id="a"] .pn').textContent === '2'));
    const saved = posts.filter((p) => p.path === 'clips');
    ok('the order reached the server — the whole list, as cut-model pieces', saved.length >= 1 && saved[saved.length - 1].body.clips.map((c) => c.key).join(',') === 'b:p1,a' && saved[saved.length - 1].body.clips[0].out === 4);
    ok('the total reads the two lengths', (await page.locator('#total').textContent()) === '2 clips · 0:16');

    // the arrows and the number
    await page.locator('#order .orow').nth(1).locator('button[aria-label="Earlier"]').click();
    await page.waitForTimeout(600);
    ok('the arrow moves a clip earlier, and the tiles renumber', await page.evaluate(() => [...document.querySelectorAll('#order .orow .tt span')][0].textContent.indexOf('part 1') < 0 && document.querySelector('#tiles .cell[data-id="a"] .pn').textContent === '1'));
    ok('the first row\'s Earlier is disabled, the last row\'s Later is disabled', await page.evaluate(() => document.querySelectorAll('#order .orow')[0].querySelector('button[aria-label="Earlier"]').disabled && document.querySelectorAll('#order .orow')[1].querySelector('button[aria-label="Later"]').disabled));
    await tile('b:p2').click();
    await page.waitForTimeout(100);
    await page.locator('#order .orow').nth(2).locator('.num').fill('1');
    await page.locator('#order .orow').nth(2).locator('.num').press('Enter');
    await page.waitForTimeout(600);
    ok('a typed number moves the clip to that place', await page.evaluate(() => [...document.querySelectorAll('#order .orow .tt span')][0].textContent.indexOf('part 2') >= 0));
    await page.locator('#order .orow').nth(0).locator('button[aria-label="Take it out"]').click();
    await page.waitForTimeout(600);
    ok('✕ takes it out of the order and off the tile', await page.evaluate(() => document.querySelectorAll('#order .orow').length === 2 && document.querySelector('#tiles .cell[data-id="b:p2"] .pn').textContent === '+' && !document.querySelector('#tiles .cell[data-id="b:p2"]').classList.contains('picked')));
    await tile('a').click();
    await page.waitForTimeout(600);
    ok('a second tap on a picked tile takes it out too', await page.evaluate(() => document.querySelectorAll('#order .orow').length === 1 && document.querySelector('#tiles .cell[data-id="a"] .pn').textContent === '+'));
    await tile('a').click();
    await page.waitForTimeout(600);

    // THE PILL'S BAND: the first order row's ✕ sits inside it at 390pt —
    // the row has to shorten so the tap reaches the button
    ok('a control in the pill\'s band still takes its own tap (elementFromPoint)', await page.evaluate(() => {
      const x = document.querySelector('#order .orow button[aria-label="Take it out"]');
      const r = x.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const pill = document.querySelector('body > .float');
      const pr = pill && pill.getClientRects().length ? pill.getBoundingClientRect() : null;
      // the row is in the band, and the hit is the button itself
      return (!pr || r.top < pr.bottom) && hit && (hit === x || x.contains(hit));
    }));

    // stitch: POST /render, then the poll lands the render row
    await page.click('#stitch');
    await page.waitForTimeout(200);
    ok('Stitch POSTs the render and says so', posts.some((p) => p.path === 'render' && p.id === 's1') && /stitching/.test(await page.locator('#status').textContent()));
    ok('and the button is off while it stitches', await page.evaluate(() => document.getElementById('stitch').disabled));
    await page.waitForSelector('#renders .rrow', { timeout: 8000 });
    ok('the render lands as a LINE with a play button, never a video', await page.evaluate(() => document.querySelectorAll('#renders .rrow').length === 1 && !!document.querySelector('#renders .rrow .ib.play') && !document.querySelector('#renders video') && /0:16/.test(document.querySelector('#renders .rrow .lab').textContent)));
    ok('the button comes back', await page.evaluate(() => !document.getElementById('stitch').disabled));
    await page.locator('#renders .rrow .ib.play').click();
    ok('play opens the player over the page with the film in it', await page.evaluate(() => !document.getElementById('player').hidden && !!document.querySelector('#player video') && document.body.style.overflow === 'hidden'));
    await page.locator('#player .pclose').click();
    ok('and the way out is the ✕', await page.evaluate(() => document.getElementById('player').hidden && !document.querySelector('#player video') && document.body.style.overflow === ''));

    // the project picker narrows the pickables server-side
    await page.selectOption('#project', 'ward');
    await page.waitForTimeout(400);
    ok('a project narrows the picker and lights the picker box', await page.evaluate(() => document.querySelectorAll('#tiles .cell').length === 0 && document.getElementById('projwrap').classList.contains('on') && !document.getElementById('feedempty').hidden));
    await page.selectOption('#project', '');
    await page.waitForTimeout(400);
    ok('All brings them back', (await page.locator('#tiles .cell').count()) === 4);

    // two levels: the chevron's __navBack goes shelf-ward before it leaves
    ok('__navBack from an open stitch goes to the shelf and answers true', await page.evaluate(() => window.__navBack() === true && !document.getElementById('shelf').hidden && document.getElementById('open').hidden));
    await page.waitForTimeout(300);
    ok('the shelf lists the stitch with its count, its length and its render', await page.evaluate(() => { const r = document.querySelector('#slist .srow'); return r && /2 clips · 0:16 · stitched 1 time/.test(r.textContent); }));
    ok('__navBack from the shelf answers false — the app leaves the tool', await page.evaluate(() => window.__navBack() === false));
    ok('no page errors', errors.length === 0);
    if (errors.length) console.log(errors);
  } finally {
    await browser.close();
    server.close();
  }
  report();
})().catch((e) => { console.error(e); process.exit(1); });
