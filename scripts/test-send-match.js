#!/usr/bin/env node
/*
 * test-send-match.js — the match step on the Playground → Story Room send
 * trip (2026-08-26, Sophie: "if I'm in the playground and I want to send a
 * drawing to the story room then it does some sort of a check to match it to
 * the right beat and then asks me to confirm or choose a different one").
 *
 * The PURE half pins send-match.js's rules: the ≥3-shared-roots gate (two is
 * a coincidence), the containment case for a tiny caption, the stem folding
 * lands/landing/landed on one root, exact-copy-of-the-beat's-prompt winning
 * outright, the ranking, and the cap. The ROUTE half pins that the server
 * endpoint goes through that one module and makes no model call. The
 * HEADLESS half drives the real scratchpad.html against a stub server whose
 * /send-match runs the REAL matcher: the card appears with the candidates,
 * a row's tap is the confirm (POST /image with the candidate's own pad —
 * and NO style, the chat-seeding rule), the room then opens that story on
 * that beat, and Pick by hand / no-match leaves the ordinary flow untouched.
 *
 *   node scripts/test-send-match.js
 *   (headless half needs: npm install playwright --no-save)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');
const { matchBeats, rootsOf, MAX_CANDIDATES } = require('../send-match');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. the matcher, pure ─────────────────────────────────────────────────
console.log('the stem: one root per word family');
const roots = [...rootsOf('lands landing landed smile smiling runs running crows crow stories')];
ok(roots.filter((r) => r === 'land').length === 1 && roots.includes('land'),
  'lands / landing / landed are one root');
ok(roots.includes('smil') && roots.filter((r) => r === 'smil').length === 1,
  'smile / smiling are one root');
ok(roots.includes('run') && roots.filter((r) => r === 'run').length === 1,
  'runs / running are one root (doubled tail folded)');
ok(roots.includes('crow'), 'crow / crows are one root');
ok(roots.includes('story'), 'stories keeps its y');
ok([...rootsOf('the ring at dusk')].includes('ring') && [...rootsOf('the ring at dusk')].includes('dusk'),
  'short words survive whole — ring is not r');
ok(![...rootsOf('a watercolor drawing of an owl')].includes('draw'),
  'the drawing words are stopped — they sit in half the prompts');

const PADS = [
  { id: 'p1', title: 'The Meteorite', updatedAt: 2, beats: [
    { id: 'b1', text: 'An owl lands on the mailbox at dusk' },
    { id: 'b2', text: 'She holds the bucket up to the smiling moon',
      prompt: 'the smiling moon leans down over her bucket' },
    { id: 'b3', text: 'A crow steals the ring' },
    { id: 'bc', kind: 'clip', text: '' },
  ] },
  { id: 'p2', title: 'Moon Milk', updatedAt: 5, beats: [
    { id: 'b4', text: 'The moon pours milk into her bucket' },
    { id: 'b5', text: 'the blue kleenex' },
  ] },
];

console.log('the gate');
let m = matchBeats('an owl landing on a mailbox', PADS);
ok(m.length === 1 && m[0].beat.id === 'b1', 'shared roots across word forms find the beat');
ok(matchBeats('a red balloon', PADS).length === 0, 'nothing clears the gate → no card, ordinary flow');
ok(matchBeats('', PADS).length === 0, 'an empty prompt matches nothing');
ok(matchBeats('the moon is red', PADS).length === 0, 'one shared root is a coincidence, not a match');
m = matchBeats('penny holding the blue kleenex up high', PADS);
ok(m.length === 1 && m[0].beat.id === 'b5', 'a tiny caption wholly contained still qualifies');

console.log('the ranking');
m = matchBeats('the moon pours milk into her bucket at night', PADS);
ok(m[0] && m[0].beat.id === 'b4', 'the beat matching every typed word leads');
m = matchBeats('the smiling moon leans down over her bucket', PADS);
ok(m[0] && m[0].beat.id === 'b2' && m[0].exact === true,
  'an exact copy of a beat\'s own drawing prompt wins outright');
ok(m[0].jaccard === 1 || m[0].inter > 0, 'and carries a real score');
// A shelf full of qualifying beats still answers at most MAX_CANDIDATES.
const many = [{ id: 'px', title: 'X', updatedAt: 1,
  beats: Array.from({ length: 9 }, (_, i) => ({ id: 'q' + i, text: 'the owl lands on the mailbox ' + i })) }];
ok(matchBeats('the owl lands on the mailbox', many).length === MAX_CANDIDATES,
  'capped at ' + MAX_CANDIDATES + ' candidates');
// Recency breaks a tie: two identical captions in two pads → newer pad first.
const tie = [
  { id: 'old', title: 'Old', updatedAt: 1, beats: [{ id: 'to', text: 'a fox in the rain' }] },
  { id: 'new', title: 'New', updatedAt: 9, beats: [{ id: 'tn', text: 'a fox in the rain' }] },
];
m = matchBeats('a fox in the rain at dawn', tie);
ok(m[0] && m[0].pad.id === 'new', 'a tie goes to the story she touched last');

// ── 2. the route ─────────────────────────────────────────────────────────
console.log('the route');
const padSrc = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
const route = padSrc.slice(padSrc.indexOf("router.get('/send-match'"), padSrc.indexOf("// ── The clip shelf"));
ok(route.length > 0, 'GET /send-match exists in scratchpad.js');
ok(/require\('\.\/send-match'\)/.test(route), 'and goes through the one tested matcher');
ok(!/anthropic|openai|replicate/i.test(route), 'no model call — this fires on a page open');
ok(/slotFace\(artSlot\(/.test(route), 'a row\'s face is derived the shelf tiles\' way');

// ── 3. the page, headless ────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log(fails ? '\n' + fails + ' FAILED' : '\npure half all pass');
  console.log('SKIP headless: playwright not installed (npm install playwright --no-save)');
  process.exit(fails ? 1 : 0);
}

const T0 = 1786000000000;
const RUN = {
  id: 'runA', prompt: 'an owl landing on the mailbox', status: 'done',
  engine: 'gptimage', model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: ['/px.png?r=runA&i=0'], votes: {}, createdAt: T0,
};
const RUN_MISS = { ...RUN, id: 'runB', prompt: 'a red balloon', images: ['/px.png?r=runB&i=0'] };
// The stub's shelf — /send-match below runs the REAL matcher over these.
const STUB_PADS = [
  { id: 'padX', title: 'The Meteorite', updatedAt: 5, beats: [
    { id: 'b1', text: 'An owl lands on the mailbox at dusk' },
    { id: 'b2', text: 'A crow steals the ring', url: '/px.png?b=2' },
  ] },
  { id: 'padY', title: 'Moon Milk', updatedAt: 2, beats: [
    { id: 'b4', text: 'The moon pours milk into her bucket' },
  ] },
];
const posts = [];
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    return req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      posts.push({ path: url.pathname, body });
      if (url.pathname === '/api/scratchpad/image') {
        const pad = STUB_PADS.find((p) => p.id === body.pad);
        const b = pad && pad.beats.find((x) => x.id === body.id);
        if (b) { b.url = body.url; b.src = body.src || null; }
        return json({ ok: true, beats: (pad || STUB_PADS[0]).beats });
      }
      json({ ok: true });
    });
  }
  if (url.pathname === '/api/scratchpad/send-match') {
    // The REAL matcher over the stub shelf — the wire the page sees is the
    // wire the route builds, shape for shape.
    const cands = matchBeats(String(url.searchParams.get('q') || ''), STUB_PADS).map((c) => ({
      pad: c.pad.id, padTitle: c.pad.title, beat: c.beat.id,
      words: String(c.beat.prompt || c.beat.text || '').slice(0, 240),
      art: c.beat.url || null, exact: c.exact === true,
    }));
    return json({ candidates: cands });
  }
  if (url.pathname === '/api/scratchpad/pads') {
    return json({ count: STUB_PADS.length, pads: STUB_PADS.map((p) => ({
      id: p.id, title: p.title, beats: p.beats.length, cover: null,
      category: null, folder: null, pinned: false, updatedAt: p.updatedAt })) });
  }
  if (url.pathname === '/api/scratchpad' || url.pathname === '/api/scratchpad/') {
    const pad = STUB_PADS.find((p) => p.id === url.searchParams.get('pad')) || STUB_PADS[0];
    return json({ beats: pad.beats, title: pad.title, style: 'watercolor', film: null });
  }
  if (url.pathname === '/api/promptlab/runA') return json(RUN);
  if (url.pathname === '/api/promptlab/runB') return json(RUN_MISS);
  if (url.pathname === '/api/story/thumb') {
    res.writeHead(302, { Location: url.searchParams.get('url') || '/px.png' });
    return res.end();
  }
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname === '/storyroom') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404).end();
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = process.env.PLAYWRIGHT_BROWSERS_PATH
    && fs.existsSync(path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'))
    ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : null;
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});

  console.log('the card proposes, best first');
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/storyroom?send=runA&i=0');
  await page.waitForSelector('#matchcard:not([hidden])');
  ok(true, 'the card appears once the run and the match land');
  const rows = await page.locator('#matchrows .mrow').count();
  ok(rows === 1, 'only the beat that clears the gate is proposed (' + rows + ' row)');
  const story = await page.locator('#matchrows .mrow .mstory').first().textContent();
  ok(/The Meteorite/.test(story) && /best match/.test(story), 'the row names its story and marks the best');
  const words = await page.locator('#matchrows .mrow .mwords').first().textContent();
  ok(/owl lands on the mailbox/i.test(words), 'and shows the beat\'s own words');
  ok(!(await page.locator('#sendband').isHidden()), 'the band still rides underneath');
  // The row must actually be reachable — a covered control passes visibility.
  const hit = await page.evaluate(() => {
    const r = document.querySelector('#matchrows .mrow').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el && el.closest('.mrow') ? 'row' : (el ? el.id || el.className : 'nothing');
  });
  ok(hit === 'row', 'the row is under her thumb (' + hit + ')');

  console.log('a tap is the confirm');
  await page.locator('#matchrows .mrow').first().click();
  await page.waitForSelector('#beatpop:not([hidden])');
  const img = posts.find((p) => p.path === '/api/scratchpad/image');
  ok(Boolean(img), 'the tap POSTs /image — the one write every placement takes');
  ok(img && img.body.pad === 'padX' && img.body.id === 'b1', 'aimed at the matched pad and beat');
  ok(img && img.body.src && img.body.src.runId === 'runA', 'the provenance rides along');
  ok(img && img.body.style === undefined, 'and NO style — the side comes from the run\'s own record');
  ok(await page.locator('#matchcard').isHidden(), 'the card is done');
  const popSrc = await page.locator('#popimg').getAttribute('src');
  ok(/r=runA/.test(popSrc || ''), 'the beat popup opens showing the landed picture');
  await page.evaluate(() => document.getElementById('beatpop').querySelector('#popclose,#beatclose,.bclose') === null);
  await page.close();

  console.log('pick by hand is the old flow, untouched');
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p2.goto(base + '/storyroom?send=runA&i=0');
  await p2.waitForSelector('#matchcard:not([hidden])');
  await p2.locator('#matchhand').click();
  ok(await p2.locator('#matchcard').isHidden(), 'Pick by hand puts the card away');
  ok(!(await p2.locator('#sendband').isHidden()), 'she is still holding the picture');
  const word = await p2.locator('#sendword').textContent();
  ok(/Pick a story/.test(word), 'over the shelf the band still says to pick a story');
  await p2.close();

  console.log('no match, no card');
  const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p3.goto(base + '/storyroom?send=runB&i=0');
  await p3.waitForSelector('#sendband:not([hidden])');
  await p3.waitForTimeout(300);
  ok(await p3.locator('#matchcard').isHidden(), 'a prompt matching nothing shows no card at all');
  await p3.close();

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
