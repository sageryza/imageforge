#!/usr/bin/env node
/* THE RAIL FOLLOWS THE VISUAL VIEWPORT (2026-09-13, Sophie, on /footage:
 * "auto scroll bug").
 *
 * iOS shrinks the VISUAL viewport for the keyboard and offsets it inside the
 * LAYOUT one to reveal the caret; `position:fixed` pins to the layout
 * viewport, so the rail slid up out of the visible band by
 * `visualViewport.offsetTop`, top-first. Measured off her screenshot (iPhone
 * 13, the app's full-screen web view, a block textarea focused): the fixed
 * layer sat ~115pt above what she could see, which left #vtop 0 of 52pt on
 * screen, #vmid 3 of 52 and only #vbot whole — and #vbot while playing means
 * FASTER, which is why her speed label read Fastest.
 *
 * EVERY ASSERTION IS A MEASUREMENT. A pill that reads the offset and never
 * moves, one that moves the wrong way, and one that moves `.float` itself and
 * so drags six pages' column reserve with it all look identical in the source.
 * The second half is the one that would be easy to ship wrong: the offset is a
 * custom property the CHILDREN translate by, so `body > .float`'s own rect
 * must NOT move and the prompt box must keep one width.
 *
 * Run: node scripts/test-pill-visual-viewport.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) {
    console.log('PILL / VISUAL VIEWPORT — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('PILL / VISUAL VIEWPORT — ' + pass + ' passed');
}

// ── 1. the source pins: every copy carries it, or a page is left behind ────
const CSS_RULE = '.float > *{transform:translateY(var(--vvtop, 0px));}';
const copies = ['pill-inject.html', 'chats.html', 'gallery.html', 'storyroom.html', 'wall.html', 'writing.html'];
copies.forEach((f) => {
  const s = fs.readFileSync(path.join(PUB, f), 'utf8');
  ok(f + ' carries the child-transform rule', s.includes(CSS_RULE));
  ok(f + ' writes --vvtop from the visual viewport', /setProperty\('--vvtop'/.test(s) && /visualViewport/.test(s));
});
{
  const s = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  // mkPagePill is the parent-page copy the app's page viewer taps
  const at = s.indexOf('function mkPagePill(');
  const mk = s.slice(at, s.indexOf('\nfunction ', s.indexOf('return pill;', at)));
  ok('mkPagePill writes --vvtop too', /setProperty\('--vvtop'/.test(mk));
  ok('mkPagePill takes its listener off once the pill is detached', /isConnected/.test(mk) && /removeEventListener/.test(mk));
  ok('and it does NOT move .float itself', !/pill\.style\.transform\s*=/.test(mk));
}
{
  const s = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
  ok('the injected pill never sets a transform on .float itself', !/_pill\.style\.transform\s*=/.test(s));
  ok('and it publishes the offset', /__pillOffset/.test(s));
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('pill/visual viewport: playwright not installed — source pins only'); report(); return;
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

const F = require('../footage');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [] });
  res.writeHead(404); res.end('nope');
});

// the test's hands on a keyboard a headless browser has not got: shadow the
// prototype's accessor on the instance and fire the event the pill listens for
const keyboard = (off) => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, 'offsetTop', { configurable: true, get() { return off; } });
  vv.dispatchEvent(new Event('resize'));
};

const read = () => {
  const g = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), h: Math.round(r.height) }; };
  const f = document.querySelector('body > .float');
  const box = document.getElementById('prompt');
  return {
    float: g(f), vseg: g(document.querySelector('.float .vseg')),
    vtop: g(document.getElementById('vtop')), vmid: g(document.getElementById('vmid')), vbot: g(document.getElementById('vbot')),
    boxW: Math.round(box.getBoundingClientRect().width),
    offset: window.__pillOffset ? window.__pillOffset() : null,
    hitTop: (() => { const el = document.getElementById('vtop'); const r = el.getBoundingClientRect();
      const got = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const btn = got && got.closest ? got.closest('button') : null; return btn ? btn.id : (got ? (got.id || got.tagName) : null); })(),
  };
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  // a long enough page that the pill is drawn at all
  await page.evaluate(() => { document.documentElement.style.paddingBottom = '1600px';
    if (window.__pillSync) window.__pillSync(); if (window.__fitPillGap) window.__fitPillGap(); });
  await page.waitForTimeout(500);

  const a = await page.evaluate(read);
  ok('no keyboard: the offset is 0', a.offset === 0);
  ok('the capsule is whole and on screen (top ' + a.vseg.top + ')', a.vseg.top >= 0 && a.vseg.h > 120);
  ok('and #vtop takes its own tap', a.hitTop === 'vtop');

  // ── the keyboard: the visible band starts 117 down ─────────────────────
  const OFF = 117;
  await page.evaluate(keyboard, OFF);
  await page.waitForTimeout(200);
  const b = await page.evaluate(read);

  ok('the pill reads the offset (' + b.offset + ')', b.offset === OFF);
  ok('the capsule moved down with the band (' + a.vseg.top + ' → ' + b.vseg.top + ')', b.vseg.top === a.vseg.top + OFF);
  ['vtop', 'vmid', 'vbot'].forEach((k) => {
    const r = b[k];
    const vis = Math.max(0, Math.min(r.bottom, 844) - Math.max(r.top, OFF));
    ok('#' + k + ' is whole inside the visible band (' + vis + ' of ' + r.h + 'pt)', vis === r.h);
  });
  ok('#vtop still takes its own tap after the move', b.hitTop === 'vtop');

  // ── and the reserve did NOT move with it ──────────────────────────────
  ok('`body > .float`\'s own rect never moved (' + a.float.top + ' → ' + b.float.top + ')', b.float.top === a.float.top);
  ok('so the prompt box keeps one width (' + a.boxW + ' → ' + b.boxW + ')', b.boxW === a.boxW);

  // ── the keyboard goes: everything back exactly as it was ──────────────
  await page.evaluate(keyboard, 0);
  await page.waitForTimeout(200);
  const c = await page.evaluate(read);
  ok('keyboard gone: the offset is 0 again', c.offset === 0);
  ok('the capsule is back where it started (' + c.vseg.top + ')', c.vseg.top === a.vseg.top);
  ok('and the box never moved at all (' + c.boxW + ')', c.boxW === a.boxW);

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));

  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
