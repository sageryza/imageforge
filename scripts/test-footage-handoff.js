#!/usr/bin/env node
/* THE BELT'S HAND-OFF DOOR — public/footage.html reads `footage_handoff`
   (2026-09-10, Sophie: "add a button to each scene that automatically puts all
   the right references in the same text to footage so I can edit it or press
   go myself").

   Her belt pages are served from this same origin, so the hand-off is one
   localStorage key. This drives the REAL page in headless Chromium against a
   stub, because every one of these is a MEASUREMENT rather than a source
   assertion: a hand-off that parses correctly and never reaches the box, one
   that reaches the box and leaves the key behind (so it re-applies on the next
   load), one that lands but never lights the refs strip, and one that lands
   its seconds without the model's clamp all look identical in the source.

   The four read moments the page owes, and the three this file can drive:
     1. on LOAD, after loadCtl()        — scene 1
     2. on visibilitychange → visible   — not drivable headlessly (the page is
                                          always visible); it is the same one
                                          function as 3 and 4
     3. on pageshow                     — scene 6, a real back-forward hop
     4. on the `storage` event          — scene 2, written by a SECOND page in
                                          the same context, the only honest way
                                          to ask

   Run: node scripts/test-footage-handoff.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE HAND-OFF — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE HAND-OFF — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage hand-off: playwright not installed — skipped'); report(); return; }
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

const F = require('../footage');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const posted = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    // /belt stands in for one of her belt pages: same origin, so its
    // localStorage IS the page's, which is the whole mechanism under test.
    if (u.pathname === '/footage' || u.pathname === '/belt') {
      const html = u.pathname === '/belt'
        ? '<!doctype html><title>belt</title><body>a belt page on the same origin</body>'
        : fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/clip.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { openrouter: true, apiframe: true, atlascloud: true },
        balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs: [] });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') { posted.push(JSON.parse(body)); return json({ ok: true, jobId: 'n1', door: 'atlascloud', estimate: 4.4 }, 202); }
    res.writeHead(404); res.end('nope');
  });
});

// The shape the belt writes. The url appears TWICE on purpose (the page must
// dedupe by url) and one ref carries a kind nothing knows (it must land as a
// picture rather than name a slot "[AudioNaN]").
function handoff(port, extra) {
  const at = 'http://127.0.0.1:' + port;
  return Object.assign({
    prompt: 'the ward corridor at night, camera at eye level. O\'Hara is the woman in [Image1].',
    refs: [
      { url: at + '/ref.png', kind: 'image', name: 'ohara.png' },
      { url: at + '/ref.png', kind: 'image', name: 'a duplicate url' },
      { url: at + '/clip.mp4', kind: 'video', poster: at + '/ref.png' },
      { url: at + '/ref.png?second', kind: 'nonsense' },
    ],
    model: 'fast', seconds: 9, res: '720p', ratio: '16:9',
    from: 'belt', title: 'Scene 36a1', at: Date.now(),
  }, extra || {});
}

const arm = (h) => `localStorage.setItem('footage_handoff', ${JSON.stringify(JSON.stringify(h))})`;

// what the controls really say, read off the rendered page
const readState = () => ({
  prompt: document.getElementById('prompt').value,
  refs: document.querySelectorAll('#refs .ref').length,
  slots: [...document.querySelectorAll('#refs .slot')].map((b) => b.textContent),
  thumbs: [...document.querySelectorAll('#refs .im img')].map((i) => i.naturalWidth),
  model: (document.getElementById('model') || {}).value || 'mini',   // no control since 2026-09-10 — Mini is pinned
  secs: document.getElementById('secs').value,
  res: document.getElementById('res').value,
  ratio: (document.getElementById('ratio') || {}).value || '',
  key: localStorage.getItem('footage_handoff'),
  draft: localStorage.getItem('footage_draft'),
  toast: (document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : ''),
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const errors = [];

  // A FRESH CONTEXT PER SCENE, and the key is armed from the BELT page rather
  // than an init script: localStorage is per ORIGIN, so one context would
  // carry `footage_draft` into the next scene (and an init script re-arms the
  // hand-off on every navigation), and every assertion after the first would
  // be measuring the one before it.
  async function scene(name, h, pre) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(name + ': ' + e));
    await page.goto(base + '/belt');
    if (pre) await page.evaluate(pre);
    if (h !== null) await page.evaluate(arm(h));
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.waitForFunction(() => /¢$/.test(document.getElementById('cost').textContent));
    await page.waitForTimeout(500);
    return { ctx, page };
  }

  // ── 1. a hand-off written BEFORE the page loads ──────────────────────────
  const one = await scene('load', handoff(port),
    `localStorage.setItem('footage_draft', JSON.stringify({prompt:'an old draft nobody sent', refs:[]}))`);
  const s1 = await one.page.evaluate(readState);

  ok('no page errors', errors.length === 0);
  ok('the prompt lands in the box, replacing the draft — ' + JSON.stringify(s1.prompt.slice(0, 24)),
    /the ward corridor at night/.test(s1.prompt) && !/an old draft/.test(s1.prompt));
  ok('the refs strip draws one row per reference, deduped by url — ' + s1.refs, s1.refs === 3);
  ok('the slots are named per kind in attach order, an unknown kind riding as a picture — ' + JSON.stringify(s1.slots),
    JSON.stringify(s1.slots) === '["[Image1]","[Image2]","[Video1]"]');
  ok('every thumb really decoded (the poster stands in for the video) — ' + JSON.stringify(s1.thumbs),
    s1.thumbs.length === 3 && s1.thumbs.every((w) => w > 0));
  ok('the hand-off\'s model is IGNORED — the page is Mini only (2026-09-10) — ' + s1.model, s1.model === 'mini');
  ok('the seconds are the hand-off\'s, through Mini\'s own clamp — ' + s1.secs, s1.secs === '9');
  ok('the resolution is the hand-off\'s — ' + s1.res, s1.res === '720p');
  ok('the shape is the hand-off\'s and its chip is lit — ' + s1.ratio, s1.ratio === '16:9');
  ok('the key is GONE, so no later load can re-apply it', s1.key === null);
  ok('the draft was re-saved with the hand-off, so a reload keeps it',
    /the ward corridor/.test(String(s1.draft)) && (JSON.parse(s1.draft).refs || []).length === 3);
  ok('the toast names the belt and the scene — ' + JSON.stringify(s1.toast), /From the belt: Scene 36a1/.test(s1.toast));
  ok('nothing was SENT — the star is still her tap', posted.length === 0);

  // and it really does not come back on the next load
  await one.page.waitForTimeout(3000);              // let the toast time itself out
  await one.page.reload();
  await one.page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await one.page.waitForTimeout(600);
  const s1b = await one.page.evaluate(readState);
  ok('a reload keeps the words (from the draft) and raises NO second toast — ' + JSON.stringify(s1b.toast),
    /the ward corridor/.test(s1b.prompt) && !/From the belt/.test(s1b.toast));
  await one.ctx.close();

  // ── 2. a hand-off written AFTER load, by ANOTHER document ────────────────
  const two = await scene('storage', null);
  const belt = await two.ctx.newPage();
  await belt.goto(base + '/belt');
  await belt.evaluate(arm(handoff(port, { title: 'Scene 12b', model: 'mini', seconds: 99, res: '480p', ratio: '3:4' })));
  let landed = false;
  try {
    await two.page.waitForFunction(() => /the ward corridor/.test(document.getElementById('prompt').value), null, { timeout: 6000 });
    landed = true;
  } catch (_) { /* measured either way */ }
  await two.page.waitForTimeout(300);
  const s2 = landed ? await two.page.evaluate(readState) : null;
  ok('a hand-off written by another same-origin document lands with no reload', landed);
  if (s2) {
    ok('and it brings its refs — ' + s2.refs, s2.refs === 3);
    ok('and the page is still Mini — ' + s2.model, s2.model === 'mini');
    ok('and 99 seconds is CLAMPED to Mini\'s max, never sent as typed — ' + s2.secs, s2.secs === '15');
    ok('and its shape — ' + s2.ratio, s2.ratio === '3:4');
    ok('and the key is gone here too', s2.key === null);
    ok('and the toast names that scene — ' + JSON.stringify(s2.toast), /From the belt: Scene 12b/.test(s2.toast));
  }
  await two.ctx.close();

  // ── 3. a STALE hand-off is ignored ──────────────────────────────────────
  const three = await scene('stale', handoff(port, { prompt: 'two days ago', at: Date.now() - 2 * 24 * 60 * 60 * 1000 }));
  const s3 = await three.page.evaluate(readState);
  ok('a hand-off older than a day never reaches the box — ' + JSON.stringify(s3.prompt), s3.prompt === '' && s3.refs === 0);
  ok('and it is taken off the shelf rather than left to be re-read', s3.key === null);
  ok('and no toast claims one arrived — ' + JSON.stringify(s3.toast), !/From the belt/.test(s3.toast));
  await three.ctx.close();

  // ── 4. a malformed value throws nothing ─────────────────────────────────
  const four = await scene('garbage', null, `localStorage.setItem('footage_handoff', '{not json at all')`);
  const s4 = await four.page.evaluate(readState);
  ok('a malformed value throws nothing — the page renders as usual — ' + JSON.stringify(s4.prompt),
    errors.filter((e) => /garbage/.test(e)).length === 0 && s4.prompt === '');
  ok('and it is dropped rather than re-read at every moment', s4.key === null);
  await four.ctx.close();

  const five = await scene('noprompt', { refs: [], title: 'no prompt', at: Date.now() });
  const s5 = await five.page.evaluate(readState);
  ok('a hand-off with no prompt string is dropped, silently',
    s5.prompt === '' && s5.key === null && !/From the belt/.test(s5.toast));
  await five.ctx.close();

  // ── 5. pageshow — a back-forward hop with no load ────────────────────────
  const six = await scene('pageshow', null);
  await six.page.goto(base + '/belt');
  await six.page.evaluate(arm(handoff(port, { title: 'Scene 40', prompt: 'the sun room, camera at eye level' })));
  await six.page.goBack();
  await six.page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  let back = false;
  try { await six.page.waitForFunction(() => /the sun room/.test(document.getElementById('prompt').value), null, { timeout: 6000 }); back = true; } catch (_) {}
  const s6 = await six.page.evaluate(readState);
  ok('coming back to the page picks up a hand-off written while she was away — ' + JSON.stringify(s6.prompt.slice(0, 20)), back);
  ok('and spends the key', s6.key === null);
  await six.ctx.close();

  ok('no page errors anywhere — ' + JSON.stringify(errors), errors.length === 0);
  ok('nothing was ever sent', posted.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
