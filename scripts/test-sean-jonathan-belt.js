#!/usr/bin/env node
/* SEAN & JONATHAN — THE DRAFT BELT (2026-09-11, Sophie: "take the beginning of
   my original sean jonathan scene that has the videos that says who's who ·
   make a belt · with a footage button per scene" · "through atlas").

   Two halves, and the first is the one that matters most:

   PURE — her script is on the page VERBATIM and split only at HER `cut` lines.
   Nothing here may add, drop, merge, reorder or tidy a scene (the Story
   Timeline's rule, applied to a script), and the who's-who block plus both
   reference videos must be her own job's, slot for slot.

   HEADLESS — every other assertion is a MEASUREMENT, because a Footage button
   that writes nothing, one that writes the wrong refs, one that sends 16:9
   instead of her 3:4, and one whose words never reach the box all look
   identical in the source. The real page runs in headless Chromium with the
   real /compare.js and the real injected pill.

   node scripts/test-sean-jonathan-belt.js */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { execFileSync } = require('child_process');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'scripts', 'sean-jonathan', 'belt.html');
const MD = path.join(ROOT, 'docs', 'sean-jonathan', 'script.md');
const REFS = path.join(ROOT, 'docs', 'sean-jonathan', 'refs.json');

// PHOTOGRAPH EVERY ROUND — the house rule. The shots are harness output and
// belong nowhere near the repo; `--shots <dir>` puts them somewhere else.
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : os.tmpdir(); })();

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

// ── rebuild, so the page under test is the builder's current output ──────────
execFileSync('python3', [path.join(ROOT, 'scripts', 'sean-jonathan', 'belt.py')], { cwd: ROOT });
const html = fs.readFileSync(PAGE, 'utf8');
const refs = JSON.parse(fs.readFileSync(REFS, 'utf8'));

// ── HER WORDS, VERBATIM, HER SPLITS ─────────────────────────────────────────
const body = fs.readFileSync(MD, 'utf8')
  .split('<!-- SCENES BEGIN -->')[1].split('<!-- SCENES END -->')[0];
const scenes = body.split(/\r?\n[ \t]*cut[ \t.!:]*(?=\r?\n)/).map((s) => s.trim()).filter(Boolean);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

ok(scenes.length === 6, 'her script has 6 scenes — her own `cut` lines (' + scenes.length + ')');
ok(html.match(/<section class="card"/g).length === scenes.length,
  'one card a scene, no more and no fewer');
scenes.forEach((s, i) => ok(html.includes(esc(s)),
  'scene ' + (i + 1) + ' is on the page VERBATIM (' + s.length + ' chars)'));
// nothing tidied: a couple of her own oddities must survive
ok(html.includes(esc('sean beams from ear to ear,smiles widely')), 'her missing space survives');
ok(html.includes(esc("jonathan's tongue is in jonathan's mouth")),
  'her line is NOT corrected on her behalf');
ok(html.includes(esc('the cookies are burnt, badly, but sean. breaks one in half')),
  'her stray full stop survives');

// ── THE WHO'S-WHO BLOCK AND THE SLOTS ARE HERS ──────────────────────────────
ok(html.includes(esc(refs.whosWho)), "the who's-who block is her own job's, word for word");
ok(refs.refs[0]._slot === '[Video1]' && refs.refs[0]._who === 'jonathan',
  '[Video1] is jonathan, as she assigned it');
ok(refs.refs[1]._slot === '[Video2]' && refs.refs[1]._who === 'sean',
  '[Video2] is sean, as she assigned it');
const line = (who) => refs.whosWho.split(/\r?\n/).find((l) => l.trim().startsWith(who)) || '';
ok(/\[Video2\]/.test(line('sean (')) && /\[Video1\]/.test(line('jonathan (')),
  'each name is on the line with its own slot — the header never swaps them');

// ── the page's own text never shares the note key (2026-09-07) ──────────────
ok(/data-item="sj-1"/.test(html) && /item:k\+'\.'\+f/.test(html),
  "the page's own boxes ride `<key>.<field>`, never the note slot");

// ── HEADLESS ────────────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { console.log('\n(playwright missing — pure half only)'); process.exit(fails ? 1 : 0); }

const PILL = fs.existsSync(path.join(ROOT, 'public', 'pill-inject.html'))
  ? fs.readFileSync(path.join(ROOT, 'public', 'pill-inject.html'), 'utf8') : '';

const sent = [];
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && !/\/api\/chatfeed\/verdict$/.test(req.url)) sent.push(req.url);
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/chatfeed/verdict') {
    if (req.method === 'POST') { req.resume(); res.end(JSON.stringify({ ok: true })); return; }
    res.end(JSON.stringify({ texts: {} })); return;
  }
  if (u.pathname === '/footage') { res.end('<!doctype html><title>footage</title>ok'); return; }
  if (u.pathname === '/' || u.pathname === '/belt') {
    res.setHeader('content-type', 'text/html');
    res.end(html + PILL); return;
  }
  res.statusCode = 404; res.end('');
});

const exe = () => {
  const d = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const p of [path.join(d, 'chromium'), path.join(d, 'chrome')]) if (fs.existsSync(p)) return p;
  return undefined;
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));

  // the deck really is six snapping cards
  const cards = await page.$$eval('.deck .card', (n) => n.length);
  ok(cards === 6, 'six cards in the deck (' + cards + ')');

  // the scene box is filled with her words and the header box with hers
  const filled = await page.$eval('.p[data-key="sj-1"]:not([data-field])', (t) => t.value.length);
  ok(filled > 800, 'card 1 opens holding her scene (' + filled + ' chars)');
  const head = await page.$eval('.p[data-key="sj-1"][data-field="mine"]', (t) => t.value);
  ok(head.includes('[Video1]') && head.includes('[Video2]') && /^setting:/m.test(head),
    "the header box holds her who's-who plus one setting line");

  // THE BUTTON IS ON SCREEN WITHOUT SCROLLING, and that is the assertion —
  // it is the one control this page exists for. Measured with no scroll of any
  // kind at 390x844: a footer button under a fitted 894-character scene box
  // sat ~600px down and `elementFromPoint` answered `none`.
  const btn = await page.$('.tofoot[data-key="sj-1"]');
  const box = await btn.boundingBox();
  const vh = page.viewportSize().height;
  ok(box.y + box.height <= vh,
    'the Footage button is above the fold on a 390x844 phone (bottom at '
    + Math.round(box.y + box.height) + ' of ' + vh + ')');
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.className || el.tagName) + '' : 'none';
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  ok(/tofoot/.test(hit), 'and it really takes its own tap (' + hit + ')');

  // the price wears a tilde (Atlas has no billing API) — read BEFORE the tap,
  // which is a real link and navigates
  const cost = await page.$eval('.cost[data-key="sj-1"]', (n) => n.textContent);
  ok(/^~/.test(cost) && /Atlas/.test(cost), 'the price wears a ~ and names the door: ' + cost);

  // the pill's column is clear of the card's words, its heading and its button
  const clash = await page.evaluate(() => {
    const f = document.querySelector('.float');
    if (!f) return 'no pill';
    const p = f.getBoundingClientRect();
    const bad = [];
    // ONLY THE CARD ON SCREEN. The deck is a horizontal scroller, so every other
    // card's rect sits past the right edge of the viewport and would report a
    // collision with the pill's column that nobody can see.
    document.querySelectorAll('.card h2, .text summary, .tofoot, .row').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || r.left < 0 || r.left > innerWidth) return;
      if (r.right > p.left && r.top < p.bottom && r.bottom > p.top) bad.push((el.className || el.tagName) + '@' + Math.round(r.right));
    });
    return bad.join(',');
  });
  ok(clash === '' || clash === 'no pill', "nothing runs into the pill's column (" + clash + ')');

  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-card1.png') });
  await page.evaluate(() => document.getElementById('next').click());
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-card2.png') });
  await page.evaluate(() => document.getElementById('prev').click());
  await page.waitForTimeout(600);

  // WHAT THE TAP REALLY WRITES. It is an <a href="/footage">, so this navigates —
  // every layout assertion above had to come first, and the hand-off is read back
  // from the same origin on the other side.
  await btn.click();
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => {
    const raw = localStorage.getItem('footage_handoff');
    return raw ? JSON.parse(raw) : null;
  });
  ok(!!h, 'the tap wrote a hand-off');
  if (h) {
    ok(h.prompt.startsWith('sean (brown haired boy, [Video2])'),
      "the hand-off leads with her who's-who block");
    ok(h.prompt.includes('setting: '), 'and carries the setting line');
    ok(h.prompt.includes('sean takes fancy tea cups'), 'and then her scene, whole');
    ok(h.refs.length === 2 && h.refs[0].url === refs.refs[0].url && h.refs[1].url === refs.refs[1].url,
      'both videos ride, in HER slot order');
    ok(h.refs.every((r) => r.kind === 'video' && r.poster), 'each ref is a video with a poster');
    ok(h.model === 'mini' && h.res === '480p' && h.ratio === '3:4' && h.seconds === 15,
      'Mini · 480p · 3:4 · 15s — the shape of her own two clips'
      + ' (' + [h.model, h.res, h.ratio, h.seconds].join(' · ') + ')');
    ok(h.from === 'sean-jonathan-script' && /tea party/.test(h.title || ''),
      'it says which chat and which scene');
  }

  // NOTHING IS SENT BY THE BELT. The stub records every request; a POST to any
  // footage or video route would be the belt spending her money on its own.
  ok(!sent.some((u) => /footage|video/.test(u)),
    'the belt sends nothing — the star on the Footage page is still hers'
    + (sent.length ? ' (' + sent.join(', ') + ')' : ''));

  console.log('shots: ' + SHOTS + '/sj-belt-card{1,2}.png');
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
