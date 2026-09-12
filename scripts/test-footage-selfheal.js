#!/usr/bin/env node
/* THE FOOTAGE PAGE HEALS ITS OWN STALENESS (2026-09-12, Sophie, still seeing
 * the prompt box flip narrow/full a day after that fix went live: "can you
 * search for more bugs so i don't have to find them · switch between
 * narrow/full screen for example").
 *
 * The app keeps a tool's web view alive for the whole app process, so
 * /footage loads ONCE and no deploy can reach it — a fix she is told is live
 * shows her the OLD bug until a force-quit. The Playground's and the Chats
 * app's self-heal, on the page she types in most: the served build is a hash
 * of the page plus the pill (page-build.js), stamped on the page by
 * serveGated and answered by GET /api/footage/build; the page compares them
 * on every return to the tool and every five minutes, and reloads ONLY when
 * nothing would be lost.
 *
 * Every guard is driven here against the REAL page — a reload that throws
 * away her seed, a Fast she picked, or a send in flight is a worse bug than
 * the stale page. "Did it reload?" is asked of the DOCUMENT (a new
 * performance.timeOrigin), never of a load-state promise that resolves at
 * once on an already-loaded page.
 *
 * Run: node scripts/test-footage-selfheal.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');
const pageBuild = require('../page-build');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) {
    console.log('FOOTAGE SELF-HEAL — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE SELF-HEAL — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage self-heal: playwright not installed — skipped'); report(); return;
  }
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

// ── the route, by source: served with the pill, no-store ──────────────────
{
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const m = src.match(/app\.get\('\/api\/footage\/build'[\s\S]{0,400}?\}\);/);
  ok('server.js answers GET /api/footage/build', !!m);
  ok("…with pageBuildId('footage.html', true) — the pill is in the hash", !!m && /pageBuildId\('footage\.html',\s*true\)/.test(m[0]));
  ok('…and no-store, or the cache this route defeats answers it', !!m && /no-store/.test(m[0]));
  ok('/footage is served with the pill (the hash has to match the served page)', /app\.get\('\/footage',\s*serveGated\('footage\.html',\s*\{\s*pill:\s*true/.test(src));
}

const F = require('../footage');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const SERVED = pageBuild.pageBuildId('footage.html', true);
let currentBuild = SERVED;
let buildCalls = 0;
let jobsPostDelay = 0;

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL
      + '<script>window.__forgeBuild=' + JSON.stringify(SERVED) + '</script>';
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/build') { buildCalls++; return json({ build: currentBuild }); }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => setTimeout(() => json({ ok: true, jobId: 'jnew', door: 'atlascloud', params: {} }), jobsPostDelay));
    return;
  }
  if (u.pathname === '/api/footage/jobs') {
    // a few clips, so the feed bar (and its search) is on screen
    return json({ ok: true, jobs: Array.from({ length: 3 }, (_, i) => ({ id: 'j' + i, status: 'done', prompt: 'clip ' + i, model: 'seedance-2-mini', seconds: 4, res: '480p', ratio: '16:9', sentAt: 1786000000000 - i * 60000, doneAt: 1786000000000, video: 'http://x/v' + i + '.mp4', poster: '', door: 'atlascloud', references: [] })) });
  }
  if (u.pathname === '/api/drop/upload-file') {
    req.on('data', () => {}); req.on('end', () => setTimeout(() => json({ ok: true, item: { url: 'http://x/ref.png' } }), 1500));
    return;
  }
  if (u.pathname.startsWith('/api/gallery/assets/notes')) return json({ ok: true, notes: [] });
  res.writeHead(404); res.end('nope');
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const docId = () => page.evaluate(() => performance.timeOrigin).catch(() => docId());
  const waitNewDoc = async (was) => {
    for (let i = 0; i < 100; i++) { const now = await docId(); if (now !== was) return now; await page.waitForTimeout(50); }
    return was;
  };
  const open = async () => {
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.waitForTimeout(500);
  };
  // the page stamps the tap guard from capture-phase pointerdown/keydown, so
  // anything playwright touches arms it — rewind before every ask
  const check = () => page.evaluate(() => { window.__ftHeal.reset(); return window.__ftHeal.check(); });
  const holding = () => page.evaluate(() => { window.__ftHeal.reset(); return window.__ftHeal.holding(); });
  const settle = () => page.evaluate(() => { document.activeElement && document.activeElement.blur(); });

  await open();
  ok('serveGated\'s stamp reaches the page', await page.evaluate(() => window.__forgeBuild) === SERVED);
  ok('the page exposes its check', await page.evaluate(() => typeof window.__ftHeal.check) === 'function');

  // ── same build: never reloads, but really asked ──
  let doc = await docId();
  const asked = buildCalls;
  ok('a matching build is a no-op', await check() === false);
  ok('…and it really asked the server (not vacuously off)', buildCalls > asked);
  ok('…and the document did not reload', await docId() === doc);

  // ── the guards, one at a time, each proved to HOLD and then to RELEASE ──
  currentBuild = 'deadbeefcafe';
  const guard = async (name, arm, disarm) => {
    await arm();
    await page.waitForTimeout(150);
    const held = await holding();
    ok('HOLDS: ' + name + (held ? ' (' + held + ')' : ''), !!held);
    ok('  and the check refuses the reload while ' + name, !!held && await check() === false && await docId() === doc);
    await disarm();
    await page.waitForTimeout(150);
    const still = await holding();
    ok('RELEASES: ' + name + ' put down' + (still ? ' (still held by: ' + still + ')' : ''), still === false);
  };
  await guard('a field under her caret',
    () => page.focus('#prompt'), settle);
  await guard('the seed box holding a number',
    () => page.evaluate(() => { const s = document.getElementById('seedbox'); s.value = '12345'; s.dispatchEvent(new Event('input', { bubbles: true })); }),
    () => page.evaluate(() => { const s = document.getElementById('seedbox'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); }));
  await guard('the model moved off Mini',
    () => page.evaluate(() => { const m = document.getElementById('model'); m.value = m.options[1].value; m.dispatchEvent(new Event('change', { bubbles: true })); }),
    () => page.evaluate(() => { const m = document.getElementById('model'); m.value = m.options[0].value; m.dispatchEvent(new Event('change', { bubbles: true })); }));
  await guard('the seconds moved off the minimum',
    () => page.evaluate(() => { document.getElementById('secup').click(); }),
    () => page.evaluate(() => { document.getElementById('secdn').click(); }));
  await guard('the resolution moved off 480p',
    () => page.evaluate(() => { const r = document.getElementById('res'); r.value = r.options[1].value; r.dispatchEvent(new Event('change', { bubbles: true })); }),
    () => page.evaluate(() => { const r = document.getElementById('res'); r.value = r.options[0].value; r.dispatchEvent(new Event('change', { bubbles: true })); }));
  await guard('a refusal on screen',
    () => page.evaluate(() => { const e = document.getElementById('err'); e.textContent = 'refused'; e.hidden = false; }),
    () => page.evaluate(() => { document.getElementById('err').hidden = true; }));
  await guard('the search open',
    () => page.click('#v-search'), () => page.click('#v-search'));
  await guard('a send in flight',
    async () => {
      jobsPostDelay = 1500;
      await page.evaluate(() => { const el = document.getElementById('prompt'); el.value = 'the ward at night'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await settle();
      await page.evaluate(() => document.getElementById('go').click());
    },
    async () => { await page.waitForTimeout(1800); jobsPostDelay = 0; await page.evaluate(() => { document.getElementById('err').hidden = true; }); });
  await guard('an upload in flight',
    async () => {
      // the real upload path, against a Dump that takes 1.5s to answer
      await page.setInputFiles('#file', { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
    },
    async () => { await page.waitForTimeout(2200); });

  // ── a new build, nothing held: it heals ──
  await settle();
  await page.waitForTimeout(200);
  const held0 = await holding();
  ok('nothing held now' + (held0 ? ' (held by: ' + held0 + ')' : ''), held0 === false);
  ok('the check takes the reload', await check() === true);
  const healed = await waitNewDoc(doc);
  ok('the page really reloaded', healed !== doc);
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  ok('and her words came back with it (footage_draft)', (await page.evaluate(() => document.getElementById('prompt').value)) === 'the ward at night');

  // ── coming back to the tool is the check that matters ──
  doc = healed;
  currentBuild = 'feedfacebeef';
  await settle();
  await page.evaluate(() => { window.__ftHeal.reset(); });
  const before = buildCalls;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(600);
  ok('visibilitychange → visible asks the server', buildCalls > before);
  ok('and heals on the spot', (await waitNewDoc(doc)) !== doc);

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
