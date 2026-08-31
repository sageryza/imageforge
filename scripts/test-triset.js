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
const tailUp = triset.cardPrompt('x', { invent: false }).fullPrompt;
ok('the border clause was found to swap (anchor still matches)', triset.STYLE.swapped === true);
ok('the tail asks for an EQUILATERAL triangle card (2026-08-30, "the shapes are off")',
  tailUp.includes('EQUILATERAL TRIANGLE-SHAPED CARD') && tailUp.includes('all three sides exactly the same length'));
ok('a pool card is point up', tailUp.includes('point up'));
ok('the border clause is gone', !tailUp.includes('Draw it inside a hand-drawn border'));
ok('cards carry no text (her own two words swapped in)',
  tailUp.includes('no text.') && !tailUp.includes('minimal text.'));
ok('the anti-content bookend survives', /do not draw its content/.test(tailUp));

// A MADE card — the venn center — is upside down (her rule: "the middle card
// has to be upside down").
const tailDown = triset.cardPrompt('x', { invent: true, invert: true }).fullPrompt;
ok('a made card is drawn point down', tailDown.includes('point down, upside down'));

/* ── editions (2026-08-31, "triset color edition") ───────────────────────── */
// a made card stays in its edition only when ALL THREE sources share one
ok('editionOf: three the same', triset.editionOf(['color', 'color', 'color']) === 'color');
ok('editionOf: a disagreement files plain', triset.editionOf(['color', 'color', null]) === null
  && triset.editionOf(['color', 'color', 'x']) === null);
ok('editionOf: no editions files plain', triset.editionOf([null, null, null]) === null
  && triset.editionOf([]) === null);
ok('/found stamps the shared edition on the made doc',
  /\.\.\.\(edition \? \{ edition \} : \{\}\)/.test(MOD) && /editionOf\(srcDocs\.map/.test(MOD));
ok('the seeder can file an edition', /EDITION \? \{ edition: EDITION \}/.test(
  fs.readFileSync(path.join(ROOT, 'scripts', 'seed-triset.js'), 'utf8')));

// three HEX cards mix in CODE — free, subtractive like paint, pastels stay
// pastel (geometric mean, not a straight multiply)
ok('mixHex: red + yellow makes orange', (() => {
  const m = triset.mixHex(['#e67774', '#efcb52', '#ee975d']);
  if (!/^#[0-9a-f]{6}$/.test(m)) return false;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(m.slice(i, i + 2), 16));
  return r > g && g > b && r > 180; // warm, orange-ordered, still pastel-bright
})());
ok('mixHex: blue + yellow lose their blue (subtractive, not additive-grey)', (() => {
  const m = triset.mixHex(['#8ca2c5', '#efcb52', '#cbc46a']);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(m.slice(i, i + 2), 16));
  // a straight RGB average would keep b within ~30 of g; subtractive drops it
  return b < g - 50 && b < r - 50 && g > 150;
})());
ok('mixHex refuses a short or malformed list',
  triset.mixHex(['#e67774', '#efcb52']) === null && triset.mixHex(['x', '#efcb52', '#ee975d']) === null);
ok('/found answers a hex set READY with no render (nothing drawn, nothing billed)',
  /const hex = mixHex\(srcDocs\.map\(c => c\.hex\)\)/.test(MOD)
  && /return res\.json\(\{ ok: true, id: ref\.id, status: 'ready', hex,/.test(MOD));
ok('a hex set refuses auto honestly (no picture for the model to read)',
  /color cards mix by themselves/.test(MOD));
ok('the page renders a hex card as a flat SVG triangle',
  /function hexSrc\(hex, down\)/.test(PAGE) && /data:image\/svg\+xml/.test(PAGE));
ok('the page deals by edition and the chips row is derived from the pool',
  /!c\.flip && \(!edition \|\| c\.edition === edition\)/.test(PAGE) && /function paintEds\(\)/.test(PAGE));
ok('a pool card needs a url OR a hex', /c\.status === 'ready' && \(c\.url \|\| c\.hex\)/.test(PAGE));
ok('the placeholder never leaks into a sent prompt',
  !tailUp.includes('{triangle}') && !tailDown.includes('{triangle}'));
ok('/found draws inverted and stamps flip on the doc',
  /invert: true/.test(MOD) && /flip: true/.test(MOD));

// A reworded tail (anchor gone) APPENDS the triangle clause, never loses it.
const alt = { ...dreamy, suffix: 'A reworded tail with no anchor.', sheet: { from: 'nope', to: '' } };
triset.init({ gptStyles: { dreamy: alt } });
const reworded = triset.cardPrompt('x', { invent: false }).fullPrompt;
ok('a reworded tail still gets the triangle clause (appended)',
  reworded.includes('EQUILATERAL TRIANGLE-SHAPED CARD') && reworded.includes('A reworded tail'));
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

/* ── the AUTO kind (2026-08-30, her idea: "a prompt explaining the rules of
   set and have the image model come up w something that shares each one") ── */
ok('an auto set needs no middle', V({ cards: ['a', 'b', 'c'], kind: 'auto' }) === null);
const autoRec = triset.cardPrompt('', { auto: true, invert: true });
ok('the rules ride the wrapper and cover BOTH kinds',
  autoRec.promptStyle.includes(triset.AUTO_RULES)
  && /ONE quality all three cards share/.test(triset.AUTO_RULES)
  && /DIFFERENT quality with each/.test(triset.AUTO_RULES));
ok('an auto card has an honestly empty content half', autoRec.promptContent === '');
ok('an auto card is still upside down', autoRec.fullPrompt.includes('point down, upside down'));
ok('auto content is empty by construction', triset.foundContent({ kind: 'auto' }) === '');
ok('the route resolves and attaches the three source cards',
  /srcCards/.test(MOD) && /card\.from && card\.from\.urls/.test(MOD));

/* ── the DIE-CUT (2026-08-30, Sophie: "they shud have a cream border ·
   equilateral · the whole image plus outline needs to fit in the triangle ·
   fix the cutting") — measured per image, never a fixed mapping ──────────── */
const cut = require('../triset-cut');
{
  // a synthetic drawn card: white paper, a colored triangle, an interior
  // white patch (a highlight INSIDE the frame — must survive the flood fill)
  const w = 60; const h = 60;
  const data = Buffer.alloc(w * h * 4, 255);
  const paint = (x, y, r, g, b) => { const i = (y * w + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; };
  for (let y = 10; y <= 50; y++) {
    const half = Math.round(((y - 10) / 40) * 20);
    for (let x = 30 - half; x <= 30 + half; x++) paint(x, y, 122, 74, 43);
  }
  for (let y = 40; y <= 44; y++) for (let x = 28; x <= 32; x++) paint(x, y, 255, 255, 255);
  const r = cut.dieCutAlpha(data, w, h);
  ok('the background is removed', r.removed > 0.5);
  ok('the bbox is the drawn card, not the canvas',
    r.bbox && r.bbox.x0 === 10 && r.bbox.x1 === 50 && r.bbox.y0 === 10 && r.bbox.y1 === 50);
  const a = (x, y) => data[(y * w + x) * 4 + 3];
  ok('outside went transparent', a(2, 2) === 0 && a(57, 57) === 0 && a(5, 55) === 0);
  ok('the art is opaque', a(30, 30) === 255);
  ok('an interior white highlight SURVIVES (flood fill, not a chroma key)', a(30, 42) === 255);
}
{
  // inscribePlan (c5): the largest WINDOW into the original that keeps every
  // drawn pixel MIN_BORDER inside the triangle — and the whole window inside
  // the source frame, because the cut is an extract of the original. The
  // synthetics are TRIANGLES like the real drawn cards: a rectangle can
  // never satisfy both constraints, and no card is one.
  const w = 200; const h = 200;
  const tri = (apexY, baseY, x0, x1) => {
    const buf = Buffer.alloc(w * h * 4, 0);
    const cx0 = (x0 + x1) / 2;
    for (let y = apexY; y <= baseY; y += 1) {
      const f = (y - apexY) / (baseY - apexY);
      const half = ((x1 - x0) / 2) * f;
      for (let x = Math.ceil(cx0 - half); x <= Math.floor(cx0 + half); x += 1) buf[(y * w + x) * 4 + 3] = 255;
    }
    return buf;
  };
  const card = tri(16, 180, 14, 186);
  const bbox = { x0: 14, y0: 16, x1: 186, y1: 180 };
  const plan = cut.inscribePlan(card, w, h, bbox);
  ok('a drawn card gets a real (non-fallback) window', !plan.cover);
  const k = plan.scale;
  // NO window-inside-frame assertion: her real cards fill ~950 of a 1024
  // frame, so the border-keeping window MUST overhang — bakeCut continues
  // the overhang in the frame's own measured paper colour.
  const [[ax, ay], [bx, by], [cx, cy]] = cut.insetTri(false);
  const edge = (px, py, xa, ya, xb, yb) => (xb - xa) * (py - ya) - (yb - ya) * (px - xa);
  const sgn = edge(cx, cy, ax, ay, bx, by) >= 0 ? 1 : -1;
  const inside = (px, py) => sgn * edge(px, py, ax, ay, bx, by) >= -2
    && sgn * edge(px, py, bx, by, cx, cy) >= -2 && sgn * edge(px, py, cx, cy, ax, ay) >= -2;
  const cardPts = [[100, 16], [14, 180], [186, 180], [100, 100]];
  ok('every drawn pixel lands inside the inset triangle',
    cardPts.every(([x, y]) => inside(plan.left + (x - bbox.x0) * k, plan.top + (y - bbox.y0) * k)));
  // a squat drawing anchors to the base — the extra room is at the TOP
  const squat = tri(120, 184, 12, 188);
  const qp = cut.inscribePlan(squat, w, h, { x0: 12, y0: 120, x1: 188, y1: 184 });
  ok('a squat card sits at the base, extra room above it',
    !qp.cover && qp.top + 64 * qp.scale > 866 - cut.MIN_BORDER - 80);
  // (a full-bleed frame never reaches inscribePlan — bakeCut routes it to
  // the cover path first, tested end-to-end below)
}
ok('render banks the paid bytes BEFORE the cut, and a failed bake still readies the card',
  /await ref\.set\(\{ url \}, \{ merge: true \}\)/.test(MOD)
  && /\.\.\.\(cut \? \{ cut \} : \{\}\), status: 'ready'/.test(MOD));
ok('a made card is cut with its flip', /bakeCut\(buf, \{ flip: !!card\.flip \}\)/.test(MOD));
ok('the recut sweep exists and /seed kicks it', /router\.post\('\/recut'/.test(MOD) && /bakeMissing\(false\)/.test(MOD));
ok('the page shows the cut when a card has one, the mapping only as fallback',
  /thumb\(card\.cut \|\| card\.url\)/.test(PAGE) && /classList\.toggle\('whole', !!card\.cut \|\| !!card\.hex\)/.test(PAGE));
ok('the reveal shows the cut too', /cardSrc\(card, true\)/.test(PAGE.slice(PAGE.indexOf('function showMade'))));

async function bakeChecks() {
  const sharp = require('sharp');
  const svg = Buffer.from('<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">'
    + '<rect width="200" height="200" fill="#fff"/>'
    + '<polygon points="100,20 180,170 20,170" fill="#7a4a2b"/>'
    + '<rect x="90" y="120" width="20" height="20" fill="#fff"/></svg>');
  const { buf, fullBleed } = await cut.bakeCut(await sharp(svg).png().toBuffer());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  ok('the cut canvas is the slot triangle, 1000x866', info.width === 1000 && info.height === 866);
  ok('a white-paper card is measured, not masked', fullBleed === false);
  // the canvas corners OUTSIDE the triangle — for a point-up cut that is the
  // two top corners; the bottom corners are inside the perfect cut now
  ok('the corners are transparent (the page paper shows through)',
    px(5, 5)[3] === 0 && px(994, 5)[3] === 0 && px(250, 5)[3] === 0);
  ok('the art lands opaque inside the triangle', px(500, 500)[3] === 255 && px(500, 500)[0] < 200);
  // the interior white highlight survives SOMEWHERE inside the triangle
  let highlight = false;
  for (let y = 200; y < 820 && !highlight; y += 4) {
    for (let x = 150; x < 850; x += 4) {
      const [r, , , al] = px(x, y);
      if (al === 255 && r > 230) { highlight = true; break; }
    }
  }
  ok('the interior white patch is opaque in the bake', highlight);
  // THE CUT IS A WINDOW INTO THE ORIGINAL (2026-08-31, Sophie: "just recut
  // the original") — the border around the drawn rim is the source's own
  // paper, so the triangle's corners hold LIGHT original pixels (the
  // synthetic's paper is white) and nothing dark sits near the cut edge.
  const lightAt = (x, y) => { const [r, g, b, al] = px(x, y); return al === 255 && r > 200 && g > 200 && b > 180; };
  ok('the triangle fills to its corners with the original\'s own paper',
    lightAt(500, 30) && lightAt(50, 850) && lightAt(950, 850));
  {
    // MIN_BORDER: walk just inside each edge of the triangle — every pixel
    // there is paper or rim, never art (a scissor line cannot touch the
    // drawing). Sampled 10px inside the exact edges.
    let dark = 0;
    for (let t = 0.06; t < 0.94; t += 0.02) {
      const spots = [
        [500 + (1000 - 500) * t, 0 + 866 * t],            // right edge apex→base-right
        [500 - 500 * t, 866 * t],                         // left edge
        [60 + 880 * t, 856],                              // base, 10px up
      ];
      for (const [x, y] of spots) {
        const px2 = Math.round(x + (x < 500 ? 10 : -10)); const py2 = Math.round(Math.min(856, y));
        const [r, , , al] = px(px2, py2);
        if (al === 255 && r < 150) dark += 1;
      }
    }
    ok('nothing dark within the border band along the cut edges', dark === 0);
  }
  // a full-bleed draw (no white paper) falls back to the ideal triangle mask
  const solid = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#7a4a2b' } }).png().toBuffer();
  const fb = await cut.bakeCut(solid);
  ok('a full-bleed draw says so', fb.fullBleed === true);
  const raw2 = await sharp(fb.buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const p2 = (x, y) => raw2.data[(y * raw2.info.width + x) * 4 + 3];
  ok('…and still comes out a triangle', p2(5, 5) === 0 && p2(500, 430) === 255);
}

/* ── the stuck rule ──────────────────────────────────────────────────────── */
const now = Date.now();
ok('a fresh draw is left alone', triset.stuckPatch({ status: 'drawing', createdAt: now - 60e3 }, now) === null);
ok('a ready card is left alone', triset.stuckPatch({ status: 'ready', createdAt: 0 }, now) === null);
const sp = triset.stuckPatch({ status: 'drawing', createdAt: now - triset.STUCK_MS - 1 }, now);
ok('an orphaned draw fails honestly', sp && sp.status === 'failed');

/* ── page source pins ────────────────────────────────────────────────────── */
ok('the middle box ships EMPTY — no placeholder, no content',
  /<textarea id="middle" rows="3"><\/textarea>/.test(PAGE) && !/id="middle"[^>]*placeholder/.test(PAGE));
ok('the venn side boxes ship EMPTY', !/id="v-[a-z]+"[^>]*placeholder/.test(PAGE) && !/id="v-[a-z]+"[^>]*value=/.test(PAGE));
ok('the venn boxes lie along the middle triangle\'s sides', /#v-left\{[^}]*rotate\(60deg\)/.test(PAGE) && /#v-right\{[^}]*rotate\(-60deg\)/.test(PAGE));
ok('the page script is an IIFE', /<script>\s*\(function\(\)\{/.test(PAGE));
ok('the five pill tokens are defined', ['--paper', '--ink', '--chg', '--rose', '--line'].every(t => PAGE.includes(t)));
ok('[hidden] beats author display rules', PAGE.includes('[hidden]{display:none !important}'));
ok('the paid button wears the star and the cost',
  /id="found"/.test(PAGE) && /~2¢/.test(PAGE) && /id="star"/.test(PAGE));
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
    url: 'https://storage.googleapis.com/x/triset/cards/c' + i + '.webp',
    cut: 'https://storage.googleapis.com/x/triset/cuts/c' + i + '.c1.webp', createdAt: i,
  }));
  // phase 2 swaps in a pool that ALSO holds three hex color cards
  let cardsResp = cards;
  let madeHex = null; // the hex /found answered with, phase 2
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/triset/cards') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, cards: cardsResp }));
    }
    if (u.pathname === '/api/triset/found') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const f = JSON.parse(body);
        founds.push(f);
        res.writeHead(200, { 'content-type': 'application/json' });
        // a set of three hex cards answers READY at once — the mix is code
        if ((f.cards || []).every(id => String(id).startsWith('h'))) {
          madeHex = '#e09a63';
          return res.end(JSON.stringify({ ok: true, id: 'made2', status: 'ready', hex: madeHex }));
        }
        res.end(JSON.stringify({ ok: true, id: 'made1', status: 'drawing' }));
      });
      return;
    }
    if (u.pathname.startsWith('/api/triset/card/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      if (u.pathname.endsWith('/made2')) {
        return res.end(JSON.stringify({ ok: true, status: 'ready', title: 'orange', flip: true, hex: madeHex, edition: 'color' }));
      }
      pollCount += 1;
      return res.end(JSON.stringify(pollCount < 2
        ? { ok: true, status: 'drawing' }
        : { ok: true, status: 'ready', title: 'the moon', flip: true, url: 'https://storage.googleapis.com/x/triset/cards/made1.webp' }));
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
  ok('a card with a die-cut shows the CUT, not the original', dealt.every(s => s.includes('cuts%2F')));
  // the cut copy fills the slot exactly — no legacy overscan mapping — so the
  // cream face shows through the copy's transparency as the border
  ok('the cut fills the slot, measured', await pg.evaluate(() => {
    return ['top', 'left', 'right'].every(s => {
      const el = document.getElementById('s-' + s);
      const r = el.querySelector('img').getBoundingClientRect();
      const b = el.getBoundingClientRect();
      return el.querySelector('img').classList.contains('whole')
        && Math.abs(r.width - b.width) <= 2 && Math.abs(r.top - b.top) <= 2
        && Math.abs(r.left - b.left) <= 2 && Math.abs(r.height - b.height) <= 2;
    });
  }));
  // the ONLY cream border is the paper rim drawn INTO each picture — a mat
  // behind a card is a second band of a different cream around the first
  // (2026-08-31, Sophie: "there shud be no cream border aside from the one
  // built into the images")
  ok('a card slot draws no cream mat behind the cut', await pg.evaluate(() =>
    ['top', 'left', 'right'].every(s =>
      getComputedStyle(document.querySelector('#s-' + s + ' .face')).backgroundColor === 'rgba(0, 0, 0, 0)')));
  // …while the EMPTY middle triangle keeps its cream: it is the writing
  // surface, not a border on anything
  ok('the empty middle triangle keeps its cream writing surface', await pg.evaluate(() =>
    getComputedStyle(document.querySelector('#s-mid .face')).backgroundColor === 'rgb(243, 231, 201)'));
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

  // the kind toggle shows the three venn boxes on the middle triangle's sides
  ok('venn boxes hidden in same mode', await pg.$eval('#v-top', el => el.hidden));
  await pg.click('#k-each');
  ok('each mode shows the three venn boxes', await pg.evaluate(() =>
    ['v-top', 'v-left', 'v-right'].every(id => !document.getElementById(id).hidden)));
  ok('the venn boxes are empty', await pg.evaluate(() =>
    ['v-top', 'v-left', 'v-right'].every(id => document.getElementById(id).value === '')));

  // found posts exactly what the module validates, and the new card lands IN
  // THE MIDDLE, upside down (her rule: "shud show, in the middle, when drawn")
  await pg.fill('#middle', 'the moon');
  await pg.fill('#v-top', 'round');
  await pg.fill('#v-left', 'out at night');
  await pg.fill('#v-right', 'glows');
  await pg.click('#found');
  await pg.waitForFunction(() => !document.getElementById('midcut').hidden, null, { timeout: 15000 });
  ok('found POSTed once', founds.length === 1);
  const f = founds[0] || {};
  ok('…with three different card ids', f.cards && new Set(f.cards).size === 3);
  ok('…the kind and her words', f.kind === 'each' && f.middle === 'the moon' && (f.sides || []).join('|') === 'round|out at night|glows');
  ok('…and the module would accept it', triset.validFound(f) === null);
  ok('the made card shows in the middle slot', await pg.evaluate(() =>
    (document.getElementById('midimg').getAttribute('src') || '').includes('made1')
    && document.getElementById('midwrap').hidden));
  // computed clip-path serializes 0 as 0px — normalize before asking which
  // way. The CUTTER is the scissors (the equilateral cut), not the image.
  ok('…the made card cuts point down', await pg.evaluate(() => {
    const c = getComputedStyle(document.getElementById('midcut')).clipPath
      .replace(/px/g, '').replace(/%/g, '').replace(/\s/g, '');
    return c.startsWith('polygon(00,1000,50100');
  }));
  // the stub's made card carries NO `cut` — this is the FALLBACK mapping
  // (a failed bake): the image scaled past the slot so the inset cut fills it
  ok('…and a cut-less card falls back to the fixed mapping', await pg.evaluate(() => {
    const img = document.getElementById('midimg');
    const s = document.getElementById('s-mid').getBoundingClientRect();
    const r = img.getBoundingClientRect();
    return r.width > s.width * 1.04 && r.width < s.width * 1.12 && r.top < s.top;
  }));
  // …and NOTHING cream behind it (2026-08-31, Sophie: "there shud be no
  // cream border aside from the one built into the images") — the mid face
  // is the writing surface and must step aside under a card
  ok('a made card gets no cream mat behind it', await pg.evaluate(() =>
    getComputedStyle(document.querySelector('#s-mid .face')).backgroundColor === 'rgba(0, 0, 0, 0)'));

  // tapping the made card deals the next hand: boxes clear, text box back
  await pg.click('#midimg', { position: { x: 90, y: 30 } });
  ok('the next hand deals and the boxes clear', await pg.evaluate(() =>
    document.getElementById('midcut').hidden && !document.getElementById('midwrap').hidden
    && document.getElementById('middle').value === '' && document.getElementById('v-top').value === ''));

  // an upside-down (made) card is NEVER dealt into a corner (2026-08-30,
  // Sophie: "the upside down cards are being dealt in the wrong spot") — 80
  // swaps of the top slot and made1 must never appear in any corner
  for (let i = 0; i < 80; i++) {
    await pg.click('#s-top', { position: { x: 90, y: 120 } });
  }
  const strayed = await pg.evaluate(() => ['top', 'left', 'right'].some(s =>
    (document.querySelector('#s-' + s + ' img').src || '').includes('made1')));
  ok('an upside-down card is never dealt into a corner', !strayed);

  /* ── phase 2: the COLOR EDITION — hex cards, chips, the free mix ───────
     (2026-08-31, "for now the digital version just hex colors") */
  ok('no editions in the pool → no chips row', await pg.$eval('#eds', el => el.hidden));
  cardsResp = cards.concat([
    { id: 'h0', title: 'pastel red', hex: '#e67774', edition: 'color', status: 'ready', createdAt: 10 },
    { id: 'h1', title: 'pastel yellow', hex: '#efcb52', edition: 'color', status: 'ready', createdAt: 11 },
    { id: 'h2', title: 'pastel blue', hex: '#8ca2c5', edition: 'color', status: 'ready', createdAt: 12 },
  ]);
  await pg.reload({ waitUntil: 'networkidle' });
  ok('the chips row derives from the pool (All cards · Colors)', await pg.evaluate(() => {
    const row = document.getElementById('eds');
    const words = Array.from(row.querySelectorAll('button')).map(b => b.textContent);
    return !row.hidden && words.join('|') === 'All cards|Colors'
      && row.querySelector('button').classList.contains('on');
  }));
  ok('the whole pool counts in the header', await pg.$eval('#pool', el => el.textContent) === '9 cards');
  await pg.click('#eds button:nth-child(2)');
  ok('a lit edition deals ONLY its cards, as flat SVG triangles', await pg.evaluate(() =>
    ['top', 'left', 'right'].every(s => {
      const img = document.querySelector('#s-' + s + ' img');
      return (img.getAttribute('src') || '').startsWith('data:image/svg')
        && img.classList.contains('whole');
    })));
  ok('…and the header says so', await pg.$eval('#pool', el => el.textContent) === '3 colors');
  ok('a hand of three colors mixes FREE — the button says so',
    await pg.$eval('#found .cost', el => el.textContent) === 'free');

  // find the mix: instant, no drawing wait, the blend lands in the middle
  await pg.fill('#middle', 'orange');
  await pg.click('#k-same');
  await pg.click('#found');
  await pg.waitForFunction(() => !document.getElementById('midcut').hidden, null, { timeout: 15000 });
  const fh = founds[founds.length - 1] || {};
  ok('the hex found posted the three hex ids', (fh.cards || []).join('|') === ['h0', 'h1', 'h2'].sort().join('|')
    || (fh.cards || []).every(id => String(id).startsWith('h')));
  ok('the made MIX shows in the middle as its color, point down', await pg.evaluate(() => {
    const src = document.getElementById('midimg').getAttribute('src') || '';
    return src.startsWith('data:image/svg') && decodeURIComponent(src).includes('#e09a63');
  }));
  // tap it → the next hand stays inside the lit edition
  await pg.click('#midimg', { position: { x: 90, y: 30 } });
  ok('the next hand stays in the edition', await pg.evaluate(() =>
    ['top', 'left', 'right'].every(s =>
      (document.querySelector('#s-' + s + ' img').getAttribute('src') || '').startsWith('data:image/svg'))));

  await browser.close();
  srv.close();
}

(async () => {
  await bakeChecks();
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
