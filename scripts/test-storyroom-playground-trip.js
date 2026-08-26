#!/usr/bin/env node
/*
 * test-storyroom-playground-trip.js — the round trip between a story BEAT and
 * the Playground (2026-08-26, Sophie: "if I go to the playground from the
 * story room by clicking the playground button, it should copy the drawing
 * prompt into the playground text box and if I click back to scratch pad
 * button, it should take me exactly back to the beat where I was and whatever
 * I just made, there should also be for that beat").
 *
 * Three legs, and each one is a thing that used to be lost on the way:
 *   OUT   the beat's drawing prompt, its pad and beat ids and the story's
 *         current style ride the link.
 *   MAKE  the run carries that target to the server, which lands the finished
 *         pictures on the beat — the PAGE must not do it, or a picture she
 *         taps back before finishing is gone.
 *   BACK  ?pad=&beat= reopens that story on that beat's popup.
 *
 * The pure half pins the server contract and the placement ORDER (oldest
 * first, so the newest is the beat's art and the rest are its past pictures)
 * against the REAL pad-art.js. The headless half drives the real
 * scratchpad.html and promptlab.html.
 *
 *   node scripts/test-storyroom-playground-trip.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');
const { swapArt } = require('../pad-art');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const padSrc = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
const playSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const roomSrc = fs.readFileSync(path.join(ROOT, 'public', 'scratchpad.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. the server contract ───────────────────────────────────────────────
console.log('the server lands it, not the page');
ok(/function padTargetOf\(body\)/.test(serverSrc), 'the run body may name a pad + beat');
ok(/async function landOnBeat\(target, images, runId, meta\)/.test(serverSrc),
  'and a finished run lands on it');
const gpt = serverSrc.slice(serverSrc.indexOf('async function runPromptLabGptJob'),
  serverSrc.indexOf('async function runPromptLabJob'));
const rep = serverSrc.slice(serverSrc.indexOf('async function runPromptLabJob'),
  serverSrc.indexOf("app.post('/api/promptlab'"));
ok(/landOnBeat\(cfg\.padTarget/.test(gpt), 'the gpt-image-2 job lands its pictures');
ok(/landOnBeat\(cfg\.padTarget/.test(rep), 'the LoRA job lands its pictures too');
ok(gpt.indexOf('landOnBeat') > gpt.indexOf("status: 'done'"),
  'after the run is done, so the feed shows it either way');
// A beat she deleted meanwhile must never fail a paid render.
ok(/catch \(err\) \{ console\.warn\('promptlab → beat failed:/.test(serverSrc),
  'a failed placement costs the placement, never the picture');
// Absent unless she came from a beat: an ordinary run is the request it was.
ok(/\.\.\.\(padTarget \? \{ padTarget \} : \{\}\)/.test(serverSrc),
  'the run doc records the beat only when there is one');
ok(!/padTarget: \{ pad: '', beat: ''/.test(serverSrc), 'and never an empty one');
ok(/padTargetOf\(req\.body\)/.test(serverSrc), 'the route reads it off the body');

console.log('one write puts a picture on a beat');
// `opts` since 2026-08-26 — {derived:true} lets a chat's style-less
// placement flip the toggle onto a story with no visible art (pad-side.js).
ok(/async function placeOnBeat\(padId, beatId, url, style, src, opts\)/.test(padSrc),
  'scratchpad.js owns it');
ok(/module\.exports = \{ router, attachVoiceUrl, placeOnBeat,/.test(padSrc),
  'and exports it, so server.js uses the same one');
const route = padSrc.slice(padSrc.indexOf("router.post('/image'"),
  padSrc.indexOf('async function placeOnBeat'));
ok(/placeOnBeat\(padIdOf\(req\)/.test(route), 'POST /image goes through it');
ok(!/swapArt\(/.test(route), 'and holds no second copy of the bookkeeping');

console.log('the order: oldest first');
// The real rule over the real pad-art.js — placing a run's images in order
// must leave the NEWEST as the beat's art and the rest in its past pictures,
// with whatever was there before them kept too.
const beat = { id: 'b1', url: 'OLD', text: 'the beat' };
['A', 'B', 'C'].forEach((u, i) => swapArt(beat, u, { runId: 'r', i }));
ok(beat.url === 'C', 'the last picture placed is the beat\'s art');
const hist = (beat.imageHistory || []).map((h) => h.url);
ok(hist.join(',') === 'OLD,A,B', 'the rest are its past pictures, in order (' + hist.join(',') + ')');
ok(hist.indexOf('C') < 0, 'and the current one is not also in the row');

// ── 2. the pages ─────────────────────────────────────────────────────────
console.log('the pages');
ok(/padstyle=/.test(roomSrc), 'the Story Room sends which side the picture lands on');
ok(/padTarget: padBack \|\| undefined/.test(playSrc),
  'the Playground carries the target on a run, and omits it otherwise');
ok(/id="beattag"/.test(playSrc), 'and says on screen that pictures are landing on a beat');

// ── 3. the real pages ────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the headless half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const BEATS = [
  { id: 'b1', text: 'she opens the door', prompt: 'a red door in the rain', color: null },
  { id: 'b2', text: 'and the dog runs out', color: null },
];

(async () => {
  let posted = null;
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        if (url.pathname === '/api/promptlab') { posted = JSON.parse(body || '{}'); return json({ id: 't1', poll: '/api/promptlab/t1' }); }
        json({ ok: true, beats: BEATS });
      });
    }
    if (url.pathname === '/api/promptlab/styles') {
      return json({ photoLine: ' PHOTO LINE', styles: {
        evan: { label: 'Sandy mirror', prefix: 'P', suffix: 'S', characterLine: ' C', refs: [] },
        dreamy: { label: 'Dreamy', prefix: 'P', suffix: 'S', characterLine: '', refs: [] },
        pastel: { label: 'Pastel', prefix: 'P', suffix: 'S', characterLine: '', refs: [] },
      } });
    }
    if (url.pathname === '/api/promptlab') return json({ runs: [], more: false });
    if (url.pathname === '/api/scratchpad') return json({ beats: BEATS, title: 'the trip', style: 'pastel', film: null, audios: [] });
    if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
    if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
    if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    if (url.pathname === '/scratchpad' || url.pathname === '/scratchpad.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(roomSrc);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(playSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: preinstalled }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  // ── OUT: the beat hands its prompt over ────────────────────────────────
  console.log('out of the Story Room');
  await page.goto(base + '/scratchpad.html');
  await page.evaluate(() => window.openPad('p1'));
  await page.waitForSelector('#pad .beat');
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.click('#arplay');
  await page.waitForFunction(() => /\/playground/.test(location.pathname));
  const q = new URL(page.url()).searchParams;
  ok(q.get('prompt') === 'a red door in the rain', 'the beat\'s drawing prompt rides the link');
  ok(q.get('pad') === 'p1' && q.get('beat') === 'b1', 'so do the pad and the beat');
  ok(q.get('padstyle') === 'pastel', 'and the side of the beat the story is showing');
  ok(q.get('from') === 'scratchpad', 'and the way-back flag it always sent');

  // ── the Playground, arrived from that beat ─────────────────────────────
  console.log('in the Playground');
  await page.waitForTimeout(400);
  ok(await page.$eval('#prompt', (el) => el.value) === 'a red door in the rain',
    'the words are in the box, ready to run');
  const chip = await page.$eval('#backchip', (el) => ({
    on: el.classList.contains('on'), href: el.getAttribute('href'),
  }));
  ok(chip.on, 'the way back is showing');
  ok(/pad=p1/.test(chip.href) && /beat=b1/.test(chip.href),
    'and it goes back to THAT beat, not the shelf (' + chip.href + ')');
  ok(await page.$eval('#beattag', (el) => el.classList.contains('on') && el.textContent.length > 20),
    'the page says pictures made here land on the beat');

  await page.click('#go');
  await page.waitForFunction(() => true);
  await page.waitForTimeout(300);
  ok(posted && posted.padTarget && posted.padTarget.pad === 'p1'
    && posted.padTarget.beat === 'b1' && posted.padTarget.style === 'pastel',
    'a run carries the beat to the server');

  // A Playground opened its own way carries NO target — an ordinary run is
  // byte-for-byte the request it has always been.
  posted = null;
  await page.goto(base + '/playground');
  await page.waitForTimeout(300);
  await page.fill('#prompt', 'something else entirely');
  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posted && posted.padTarget === undefined, 'an ordinary run carries none');
  ok(await page.$eval('#backchip', (el) => !el.classList.contains('on')),
    'and shows no way back');

  // ── BACK: the exact beat ───────────────────────────────────────────────
  console.log('back into the Story Room');
  await page.goto(base + '/scratchpad.html?pad=p1&beat=b2');
  await page.waitForSelector('#beatpop:not([hidden])', { timeout: 5000 });
  ok(await page.$eval('#pnote', (el) => el.value) === 'and the dog runs out',
    'it opens on the beat the link names');
  // The shelf is the room's floor — a plain open must still land there.
  await page.goto(base + '/scratchpad.html');
  await page.waitForTimeout(400);
  ok(await page.$eval('#stories', (el) => !el.hidden), 'and a plain open still opens on the shelf');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
