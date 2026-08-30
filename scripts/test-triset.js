#!/usr/bin/env node
/* TRISET — triangular SET solitaire (2026-08-30, Sophie: "i want to make a
   triangular version of set - solitaire … the middle triangle is a text box …
   this version generates a new card — a venn diagram with each side, so the
   three qualities generate the new image").

   PURE half: the prompt seam (her words verbatim, the connective line in the
   wrapper, the triangle/no-text swaps applied to the REAL dreamy tail read out
   of server.js), the found-set validator, the stuck rule, and the source pins
   (mount, init, page route, no placeholder in her boxes, IIFE, pill tokens).

   HEADLESS half (playwright optional — skips cleanly): the real page against
   a stub API. Three cards dealt, the middle box EMPTY, tap-to-swap, the kind
   toggle showing the three side boxes, found POSTing exactly what the module
   validates, the poll landing the reveal, and the mid slot never eating a tap
   aimed at a lower card's inner corner.

   Run: node scripts/test-triset.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

const triset = require('../triset');
const { dreamyStyle } = require('./lib/dreamy-style');

const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const PAGE = fs.readFileSync(path.join(ROOT, 'public', 'triset.html'), 'utf8');
const MOD = fs.readFileSync(path.join(ROOT, 'triset.js'), 'utf8');

/* ── the style, exactly as server.js hands it in ─────────────────────────── */
const dreamy = dreamyStyle(SERVER);
ok('dreamy prefix read out of server.js', !!dreamy.prefix && /STYLE reference/.test(dreamy.prefix));
ok('dreamy tail read out of server.js', !!dreamy.suffix && /green tank top/.test(dreamy.suffix));
triset.init({ gptStyles: { dreamy } });

ok('server.js mounts /api/triset', /app\.use\('\/api\/triset', require\('\.\/triset'\)\.router\)/.test(SERVER));
ok('server.js hands the style table in',
  /require\('\.\/triset'\)\.init\(\{ gptStyles: PL_GPT_STYLES, fileCreation: fileCreationDoc \}\)/.test(SERVER));
ok('server.js serves the page', /app\.get\('\/triset', serveGated\('triset\.html'\)\)/.test(SERVER));
ok('triset.js keeps no copy of the dreamy wording', !MOD.includes('green tank top'));

/* ── the swaps against the REAL tail ─────────────────────────────────────── */
ok('the border clause was found to swap (anchor still matches)', triset.STYLE.swapped === true);
ok('the tail asks for a triangle card', triset.STYLE.suffix.includes('TRIANGLE-SHAPED CARD'));
ok('the border clause is gone', !triset.STYLE.suffix.includes('Draw it inside a hand-drawn border'));
ok('cards carry no text (her own two words swapped in)',
  triset.STYLE.suffix.includes('no text.') && !triset.STYLE.suffix.includes('minimal text.'));
ok('the anti-content bookend survives', /do not draw its content/.test(triset.STYLE.suffix));

// A reworded tail (anchor gone) APPENDS the triangle clause, never loses it.
const t2 = { ...triset };
const alt = { ...dreamy, suffix: 'A reworded tail with no anchor.', sheet: { from: 'nope', to: '' } };
triset.init({ gptStyles: { dreamy: alt } });
ok('a reworded tail still gets the triangle clause (appended)',
  triset.STYLE.suffix.includes('TRIANGLE-SHAPED CARD') && triset.STYLE.suffix.includes('A reworded tail'));
ok('an appended tail says so', triset.STYLE.swapped === false);
triset.init({ gptStyles: { dreamy } }); // restore

/* ── her words are the content half, verbatim ────────────────────────────── */
ok("'same': the middle alone", triset.foundContent({ kind: 'same', middle: 'they all have horns' }) === 'they all have horns');
ok("'each': the 4th thing then the three connections",
  triset.foundContent({ kind: 'each', middle: 'the moon', sides: ['round', 'out at night', 'glows'] })
  === 'the moon — round; out at night; glows');
const rec = triset.cardPrompt('they all have horns');
ok('her words land verbatim in the full prompt', rec.fullPrompt.includes('they all have horns'));
ok('the connective line is in the WRAPPER, disclosed',
  rec.promptStyle.includes(triset.INVENT_LINE) && rec.promptStyle.includes('[content]'));
ok('her words are the content half alone', rec.promptContent === 'they all have horns');
const seedRec = triset.cardPrompt('a garden snake', { invent: false });
ok('a seed card gets no connective line', !seedRec.promptStyle.includes(triset.INVENT_LINE));
ok('a seed card still gets the triangle tail', seedRec.fullPrompt.includes('TRIANGLE-SHAPED CARD'));

/* ── the validator ───────────────────────────────────────────────────────── */
const V = triset.validFound;
ok('three ids required', V({ cards: ['a', 'b'], kind: 'same', middle: 'x' }) !== null);
ok('three DIFFERENT ids', V({ cards: ['a', 'a', 'b'], kind: 'same', middle: 'x' }) !== null);
ok('kind gated', V({ cards: ['a', 'b', 'c'], kind: 'weird', middle: 'x' }) !== null);
ok('middle required', V({ cards: ['a', 'b', 'c'], kind: 'same', middle: '  ' }) !== null);
ok('a good same-set passes', V({ cards: ['a', 'b', 'c'], kind: 'same', middle: 'horns' }) === null);
ok("'each' needs three sides", V({ cards: ['a', 'b', 'c'], kind: 'each', middle: 'moon', sides: ['x', 'y'] }) !== null);
ok("a good each-set passes", V({ cards: ['a', 'b', 'c'], kind: 'each', middle: 'moon', sides: ['x', 'y', 'z'] }) === null);

/* ── the stuck rule ──────────────────────────────────────────────────────── */
const now = Date.now();
ok('a fresh draw is left alone', triset.stuckPatch({ status: 'drawing', createdAt: now - 60e3 }, now) === null);
ok('a ready card is left alone', triset.stuckPatch({ status: 'ready', createdAt: 0 }, now) === null);
const sp = triset.stuckPatch({ status: 'drawing', createdAt: now - triset.STUCK_MS - 1 }, now);
ok('an orphaned draw fails honestly', sp && sp.status === 'failed');

/* ── page source pins ────────────────────────────────────────────────────── */
ok('the middle box ships EMPTY — no placeholder, no content',
  /<textarea id="middle" rows="3"><\/textarea>/.test(PAGE) && !/id="middle"[^>]*placeholder/.test(PAGE));
ok('the side boxes ship EMPTY', !/id="side-[a-z]+"[^>]*placeholder/.test(PAGE) && !/id="side-[a-z]+"[^>]*value=/.test(PAGE));
ok('the page script is an IIFE', /<script>\s*\(function\(\)\{/.test(PAGE));
ok('the five pill tokens are defined', ['--paper', '--ink', '--chg', '--rose', '--line'].every(t => PAGE.includes(t)));
ok('[hidden] beats author display rules', PAGE.includes('[hidden]{display:none !important}'));
ok('the paid button wears the star and the cost',
  /id="found"/.test(PAGE) && /~7¢/.test(PAGE) && /id="star"/.test(PAGE));
ok('the title is the tool-eyebrow, once',
  (PAGE.match(/tool-eyebrow/g) || []).length >= 1 && (PAGE.match(/<h1/g) || []).length === 1);
ok('the mid slot cannot eat card taps', /#s-mid\{pointer-events:none\}/.test(PAGE));

/* ── headless half ───────────────────────────────────────────────────────── */
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { /* skip */ }
}
function exe() {
  const root = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall through */ }
  return undefined;
}

// 1x1 webp so <img> really decodes.
const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');

async function headless() {
  const founds = [];
  let pollCount = 0;
  const cards = Array.from({ length: 6 }, (_, i) => ({
    id: 'c' + i, title: 'card ' + i, status: 'ready',
    url: 'https://storage.googleapis.com/x/triset/cards/c' + i + '.webp', createdAt: i,
  }));
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/triset/cards') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, cards }));
    }
    if (u.pathname === '/api/triset/found') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        founds.push(JSON.parse(body));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: 'made1', status: 'drawing' }));
      });
      return;
    }
    if (u.pathname.startsWith('/api/triset/card/')) {
      pollCount += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(pollCount < 2
        ? { ok: true, status: 'drawing' }
        : { ok: true, status: 'ready', title: 'the moon', url: 'https://storage.googleapis.com/x/triset/cards/made1.webp' }));
    }
    if (u.pathname === '/api/story/thumb') {
      res.writeHead(200, { 'content-type': 'image/webp' });
      return res.end(PIXEL);
    }
    if (u.pathname === '/triset') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(PAGE.replace('__STUDIO_TOKEN__', ''));
    }
    res.writeHead(404); res.end('no');
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: exe() });
  const pg = await browser.newContext({ viewport: { width: 390, height: 844 } }).then(c => c.newPage());
  await pg.goto(base + '/triset', { waitUntil: 'networkidle' });

  // dealt: three card images up, middle box empty
  const dealt = await pg.evaluate(() => ['top', 'left', 'right']
    .map(s => document.querySelector('#s-' + s + ' img').getAttribute('src') || ''));
  ok('three cards are dealt', dealt.every(s => s.includes('/api/story/thumb')));
  ok('the middle box is EMPTY on open', await pg.$eval('#middle', el => el.value) === '');

  // tap a card → it swaps (six cards, three dealt, a swap always changes the id)
  const before = await pg.$eval('#s-top img', el => el.src);
  let after = before;
  for (let i = 0; i < 4 && after === before; i++) {
    await pg.click('#s-top', { position: { x: 90, y: 120 } });
    after = await pg.$eval('#s-top img', el => el.src);
  }
  ok('tapping a card swaps it', after !== before);

  // the mid rectangle overlaps the lower cards — a tap on a lower card's inner
  // corner must reach the CARD (elementFromPoint is the only honest question)
  const hit = await pg.evaluate(() => {
    const b = document.getElementById('board').getBoundingClientRect();
    // 40% across, 80% down — inside s-left's triangle AND inside s-mid's rectangle
    const el = document.elementFromPoint(b.left + b.width * 0.40, b.top + b.height * 0.80);
    return el && (el.closest('#s-left') ? 'left' : el.id || el.tagName);
  });
  ok('a lower card\'s inner corner takes the tap (got ' + hit + ')', hit === 'left');

  // the kind toggle shows the three side boxes, empty
  ok('side boxes hidden in same mode', await pg.$eval('#sides', el => el.hidden));
  await pg.click('#k-each');
  ok('each mode shows the three side boxes', await pg.$eval('#sides', el => !el.hidden));
  ok('the side boxes are empty', await pg.evaluate(() =>
    ['side-top', 'side-left', 'side-right'].every(id => document.getElementById(id).value === '')));

  // found posts exactly what the module validates, and the reveal lands
  await pg.fill('#middle', 'the moon');
  await pg.fill('#side-top', 'round');
  await pg.fill('#side-left', 'out at night');
  await pg.fill('#side-right', 'glows');
  await pg.click('#found');
  await pg.waitForFunction(() => !document.getElementById('reveal').hidden, null, { timeout: 15000 });
  ok('found POSTed once', founds.length === 1);
  const f = founds[0] || {};
  ok('…with three different card ids', f.cards && new Set(f.cards).size === 3);
  ok('…the kind and her words', f.kind === 'each' && f.middle === 'the moon' && (f.sides || []).join('|') === 'round|out at night|glows');
  ok('…and the module would accept it', triset.validFound(f) === null);
  ok('the reveal shows the new card and her words', await pg.evaluate(() =>
    document.querySelector('#reveal .rt').textContent === 'the moon'
    && (document.querySelector('#reveal img').getAttribute('src') || '').includes('made1')));

  // tap to keep playing: boxes clear, a fresh hand deals
  await pg.click('#reveal', { position: { x: 20, y: 20 } });
  ok('the reveal closes and the boxes clear', await pg.evaluate(() =>
    document.getElementById('reveal').hidden && document.getElementById('middle').value === ''
    && document.getElementById('side-top').value === ''));

  await browser.close();
  srv.close();
}

(async () => {
  if (chromium) await headless();
  else console.log('triset: playwright not installed — headless half skipped');
  console.log('');
  if (fails.length) {
    console.log('FAIL ' + fails.length + ' (of ' + (pass + fails.length) + ')');
    for (const f of fails) console.log('  ✗ ' + f);
    process.exit(1);
  }
  console.log('ok — ' + pass + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
