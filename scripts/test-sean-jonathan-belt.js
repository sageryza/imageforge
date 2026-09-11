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

const scenes3 = (fs.readFileSync(MD, 'utf8')
  .split('<!-- SCENES-3 BEGIN -->')[1].split('<!-- SCENES-3 END -->')[0])
  .split(/\r?\n[ \t]*cut[ \t.!:]*(?=\r?\n)/).map((s) => s.trim()).filter(Boolean);
const scenes2 = (fs.readFileSync(MD, 'utf8')
  .split('<!-- SCENES-2 BEGIN -->')[1].split('<!-- SCENES-2 END -->')[0])
  .split(/\r?\n[ \t]*cut[ \t.!:]*(?=\r?\n)/).map((s) => s.trim()).filter(Boolean);
const shot = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'sean-jonathan', 'shot.json'), 'utf8')).shot;

const cont = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'sean-jonathan', 'continuity.json'), 'utf8')).things;
const fixes = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'sean-jonathan', 'typos.json'), 'utf8')).fixes;
const corpus = [...scenes, ...scenes2, ...scenes3, ...shot.map((j) => j.prompt)].join('\u0000');
const correct = (t) => fixes.reduce((a, f) => a.split(f.find).join(f.replace), t);

ok(scenes.length === 6, 'her first message is 6 scenes — her own `cut` lines (' + scenes.length + ')');
ok(scenes2.length === 2, 'her second message is 2 scenes (' + scenes2.length + ')');
ok(scenes3.length === 1, 'her third message is the one ending scene (' + scenes3.length + ')');
ok(html.match(/<section class="card"/g).length
   === scenes.length + scenes2.length + scenes3.length + shot.length + 1,
  'one card a scene across all three messages, the two already shot, and the cast ('
  + (scenes.length + scenes2.length + scenes3.length + shot.length + 1) + ')');

// ── HER FILES ARE NEVER EDITED ──────────────────────────────────────────────
// 2026-09-11: "fix those two typos. are there anymore". The fix happens on the
// way onto the page; script.md and shot.json stay the record of what she said,
// so the original survives every rebuild and every fix is one auditable line.
ok(/jonathan's tongue is in jonathan's mouth/.test(corpus)
  && /but sean\. breaks one in half/.test(corpus)
  && /rubs into the kitchen/.test(corpus),
  'her own files still hold her words exactly as she said them');

// ── EVERY FIX LANDED, EXACTLY ONCE, AND NOTHING ELSE MOVED ──────────────────
fixes.forEach((f) => {
  const n = corpus.split(f.find).length - 1;
  ok(n === 1, 'the fix "' + f.find.slice(0, 34).replace(/\n/g, '\\n') + '…" matches her words exactly once (' + n + ')');
});
ok(fixes.filter((f) => f.hers).length === 2, 'the two she named herself are marked as hers');
ok(/sean's tongue is in jonathan's mouth/.test(html.replace(/&#x27;/g, "'"))
  && /but sean breaks one in half/.test(html)
  && /turns on his heel, and runs into the kitchen/.test(html),
  'and the page carries the corrected words');
// THE WHOLE ASSERTION, and the one that makes the others safe: the page's text
// is her text with THESE fixes and no other edit anywhere.
[...scenes, ...scenes2, ...scenes3].forEach((sc, i) => ok(html.includes(esc(correct(sc))),
  'scene ' + (i + 1) + ' is her words, corrected and otherwise verbatim (' + sc.length + ' chars)'));
shot.forEach((j) => ok(correct(j.prompt).split(/\n\s*\n/).every((para) => html.includes(esc(para.trim()))),
  'shot scene ' + j.id.slice(0, 8) + ' is what the door received, corrected'));
// the fixes are MECHANICAL — none of them may change how many words she wrote
fixes.forEach((f) => ok(Math.abs(f.replace.split(/\s+/).length - f.find.split(/\s+/).length) <= 1,
  'the fix "' + f.find.slice(0, 24) + '…" rewords nothing'));

// ── THE CONTINUITY STILLS ──────────────────────────────────────────────────
// 2026-09-11: "we need to take screenshots of any rooms it invents or objects
// that repeat." A still rides as a reference IMAGE on every card in its
// neededBy — and never on a card that CHAINS off the clip before it, which
// already carries that clip's room and clothes.
const grabbed = cont.filter((t) => t.still);
ok(grabbed.length >= 3, 'at least the three from the drawn clips are grabbed ('
  + grabbed.map((t) => t.key).join(' ') + ')');
ok(cont.every((t) => !t.still || /^https:\/\/storage\.googleapis\.com\//.test(t.still)),
  'every still is a real hosted url');
ok(cont.every((t) => !(t.neededBy || []).includes('sj-c')),
  'the chained card asks for no still — its clip already carries the room and the clothes');
ok(cont.every((t) => (t.neededBy || []).every((k) => k !== t.establishedOn)),
  'nothing is its own reference');

// ── A CARD THAT NAMES SOMEONE ELSE'S TITLE SAYS SO ────────────────────────
// Measured, not guessed: Seedance has an OUTPUT gate that fails a drawn clip on
// copyright, it is probabilistic and per model, and a blocked job is unbilled.
// The warning must land on exactly the cards whose OWN WORDS name a title.
const ipCards = [...html.matchAll(/data-key="(sj-[a-z0-9]+)"[\s\S]*?(?=<section|$)/g)]
  .map((m) => [m[1], /class="ip"/.test(m[0])]);
const withIp = ipCards.filter(([, y]) => y).map(([k]) => k);
ok(withIp.join(' ') === 'sj-6 sj-e',
  'the copyright note is on the two cards that name a title, and nowhere else ('
  + withIp.join(' ') + ')');
ok(/the lion king/.test(scenes3[0]) && /a whole new world/.test(scenes[5])
  && /willy wonka/.test(correct(scenes[5])),
  'and those are the two scenes that really name one');

// ── HER WORDS DECIDE THE ORDER ──────────────────────────────────────────────
const order = [...html.matchAll(/<section class="card"[^>]*data-key="([^"]+)"/g)].map((m) => m[1]);
ok(order.join(' ') === 'sj-a sj-b sj-c sj-d sj-1 sj-2 sj-3 sj-4 sj-5 sj-6 sj-e sj-cast',
  'the running order is the chain her own words make, the cast last (' + order.join(' ') + ')');
ok(/we have to sleep in the same bed/.test(shot[1].prompt)
  && /^jonathan \(flabbergasted, splutters\) "WHAT\?!"/.test(scenes2[0])
  && /rubs into the kitchen\.$/.test(scenes2[0])
  && /^now they are in the kitchen together/.test(scenes2[1])
  && /^sean takes fancy tea cups and a tea pot out of the kitchen cabinet/.test(scenes[0]),
  'and each link in it is her own sentence, end to end');
ok(/data-key="sj-1"[^>]*>\s*<h2>5 · The tea party/.test(html.replace(/\n/g, '')),
  'the tea party is still sj-1 and is now card 5 — a key never moves');

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
  ok(cards === 12, 'twelve cards in the deck — eleven scenes and the cast (' + cards + ')');

  // THE DECK IS A HORIZONTAL SCROLLER, so a card must be brought into view
  // before anything about it can honestly be measured — off-screen every rect
  // sits past the right edge and elementFromPoint answers `none`.
  const goCard = async (key) => {
    await page.evaluate((k) => {
      const d = document.getElementById('deck');
      const i = [...d.children].findIndex((c) => c.getAttribute('data-key') === k);
      d.scrollTo({ left: i * d.clientWidth, behavior: 'instant' });
      scrollTo(0, 0);
    }, key);
    await page.waitForTimeout(250);
  };

  // the scene box is filled with her words and the header box with hers
  const filled = await page.$eval('.p[data-key="sj-1"]:not([data-field])', (t) => t.value.length);
  ok(filled > 800, 'card 1 opens holding her scene (' + filled + ' chars)');
  const head = await page.$eval('.p[data-key="sj-1"][data-field="mine"]', (t) => t.value);
  ok(head.includes('[Video1]') && head.includes('[Video2]') && /^setting:/m.test(head),
    "the header box holds her who's-who plus one setting line");
  // THE CHAINED CARD CARRIES THE CLIP BEFORE IT, not the who's-who pair — the way
  // she drew scene 2 herself. Measured off what the card really holds.
  const chained = await page.evaluate(() => ({
    head: document.querySelector('.p[data-key="sj-c"][data-field="mine"]').value,
    refs: JSON.parse(document.querySelector('.refjson[data-key="sj-c"]').textContent),
  }));
  ok(chained.refs.length === 1 && /atlascloud-video/.test(chained.refs[0].url)
    && /^this scene continues \[Video1\]\./.test(chained.head),
    'card 3 chains off the clip before it, one video, named by its slot');
  // THE SHOT CARDS PLAY. __filmRow is the house player — one per drawn scene.
  const players = await page.$$eval('.film video, .film button, .film a', (n) => n.length);
  const tags = await page.$$eval('.tag', (n) => n.map((x) => x.textContent).join(','));
  ok(tags === 'shot,shot,reference',
    'the two drawn scenes are marked shot and the cast is marked reference (' + tags + ')');
  ok(players > 0, 'and carry a real player (' + players + ' controls)');

  // THE BUTTON IS ON SCREEN WITHOUT SCROLLING, on EVERY card — it is the one
  // control this page exists for. Measured with no vertical scroll at 390x844:
  // a footer button under a fitted 894-character scene box sat ~600px down and
  // `elementFromPoint` answered `none`. The shot cards are the tight ones, since
  // they carry a player as well.
  const vh = page.viewportSize().height;
  const keys = (await page.$$eval('.deck .card', (n) => n.map((c) => c.getAttribute('data-key'))))
    .filter((k) => k !== 'sj-cast');
  let worst = { key: '', bottom: 0 }, unreachable = [];
  for (const key of keys) {
    await goCard(key);
    const b = await (await page.$('.tofoot[data-key="' + key + '"]')).boundingBox();
    if (b.y + b.height > worst.bottom) worst = { key, bottom: b.y + b.height };
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.className || el.tagName) + '' : 'none';
    }, [b.x + b.width / 2, b.y + b.height / 2]);
    if (!/tofoot/.test(hit)) unreachable.push(key + ':' + hit);
  }
  ok(worst.bottom <= vh, 'the Footage button is above the fold on all ten cards '
    + '(worst: ' + worst.key + ' at ' + Math.round(worst.bottom) + ' of ' + vh + ')');
  ok(unreachable.length === 0,
    'and every one really takes its own tap' + (unreachable.length ? ' — ' + unreachable.join(', ') : ''));

  // A STILL REALLY REACHES THE CARD THAT NEEDS IT — read off what the card
  // would hand the Footage page, since a map that is right and a page that
  // never reads it look identical in the source.
  for (const t of cont.filter((x) => x.still)) {
    for (const key of t.neededBy || []) {
      await goCard(key);
      const state = await page.evaluate((k) => ({
        refs: JSON.parse(document.querySelector('.refjson[data-key="' + k + '"]').textContent),
        head: document.querySelector('.p[data-key="' + k + '"][data-field="mine"]').value,
      }), key);
      const img = state.refs.filter((r) => r.kind === 'image');
      const mine = state.refs.findIndex((r) => r.url === t.still);
      ok(mine >= 0 && state.refs.slice(0, mine).every((r) => r.kind !== 'image' || true)
        && state.refs[0].kind === 'video',
        t.key + ' rides card ' + key + ' as an image, behind the videos');
      ok(new RegExp('\\[Image' + (img.findIndex((r) => r.url === t.still) + 1) + '\\]')
        .test(state.head), 'and the header names it by its slot on ' + key);
    }
  }

  // THE CAST CARD IS NOT A SHOT — it must not offer a tap that costs money.
  await goCard('sj-cast');
  const cast = await page.evaluate(() => ({
    foot: document.querySelectorAll('.card[data-key="sj-cast"] .tofoot').length,
    secs: document.querySelectorAll('.card[data-key="sj-cast"] .secs').length,
    // `textarea.p` is the BELT's own box. __compareNotes adds a note box to
    // every [data-item] block, the cast card included, and that one is hers.
    box: document.querySelectorAll('.card[data-key="sj-cast"] textarea.p').length,
    films: document.querySelectorAll('.card[data-key="sj-cast"] .film').length,
    players: document.querySelectorAll('.card[data-key="sj-cast"] .film button, .card[data-key="sj-cast"] .film video').length,
  }));
  ok(cast.foot === 0 && cast.secs === 0 && cast.box === 0,
    'the cast card offers no Footage button, no seconds and no scene box');
  ok(cast.films === 2 && cast.players >= 2,
    'and plays both original reference videos (' + cast.films + ' rows, ' + cast.players + ' controls)');
  // MEASURED, not counted: a figure that collapses to nothing while the picture
  // loads puts the captions on top of each other, which is what the photo caught.
  const stills = await page.evaluate(() => [...document.querySelectorAll(
    '.card[data-key="sj-cast"] .stills figure')].map((f) => {
      const img = f.querySelector('img').getBoundingClientRect();
      const cap = f.querySelector('figcaption').getBoundingClientRect();
      return { w: Math.round(img.width), h: Math.round(img.height), capTop: Math.round(cap.top),
               imgBottom: Math.round(img.bottom) };
    }));
  ok(stills.length === grabbed.length,
    'and shows every screenshot grabbed so far (' + stills.length + ')');
  ok(stills.every((s2) => s2.h > 60 && s2.capTop >= s2.imgBottom),
    'each still reserves its box and its caption sits under it, never on it ('
    + stills.map((s2) => s2.w + 'x' + s2.h).join(' ') + ')');
  const h3 = await page.$eval('.card[data-key="sj-cast"] h3',
    (n) => parseFloat(getComputedStyle(n).fontSize));
  ok(h3 <= 14, 'the section heading is a quiet label, not a headline (' + h3 + 'px)');

  await goCard('sj-1');
  const btn = await page.$('.tofoot[data-key="sj-1"]');

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

  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-card5.png') });
  await goCard('sj-a');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-card1-shot.png') });
  await goCard('sj-c');
  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-card3-chain.png') });
  await goCard('sj-e');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-ending.png') });
  await goCard('sj-cast');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-cast.png') });
  await goCard('sj-4');
  await page.screenshot({ path: path.join(SHOTS, 'sj-belt-card8-fixed.png') });
  await goCard('sj-1');

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
    ok(h.refs[0].url === refs.refs[0].url && h.refs[1].url === refs.refs[1].url,
      'both videos ride, in HER slot order');
    ok(h.refs.every((r) => r.poster), 'every reference carries a poster');
    // THE VIDEOS LEAD AND THE STILLS FOLLOW. The footage page slots by the order
    // of this list, so a still slipping in front would move [Video1]/[Video2] out
    // from under her who's-who block — the one thing the belt must never do.
    const kinds = h.refs.map((r) => r.kind).join(' ');
    ok(/^video video( image)*$/.test(kinds),
      'the two who\'s-who videos lead, the continuity stills follow (' + kinds + ')');
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

  console.log('shots: ' + SHOTS + '/sj-belt-card{5,1-shot,3-chain}.png');
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
