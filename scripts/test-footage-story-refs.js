#!/usr/bin/env node
/* A STORY SENT AGAIN GIVES ITS NEW PARTS NO PICTURES (2026-09-23, Sophie:
 * "the references keep attaching to the wrong one in footage").
 *
 * The Story Timeline's hand-off carries no `refs`, and the page used to hand
 * every NEW part whatever strip `setBlocks` had just loaded — part 1's. The
 * REAL page headless: part 1 gets a picture, the story is re-sent with a third
 * part, and each block's own count is read off its heading.
 *
 * Verified failing against the pre-fix page (part 3 came in with "1").
 *
 * Run: node scripts/test-footage-story-refs.js
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
    console.log('FOOTAGE STORY REFS — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE STORY REFS — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage story refs: playwright not installed — skipped'); report(); return;
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
const posted = [];
const estimates = [];
const jobs = [];
let slowUpload = 0;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, chat: 'footage',
        balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') {
      estimates.push(u.search);
      // a reference video is dearer, so the two shapes answer different money —
      // which is why a price is read off the shape that really rides
      const vid = u.searchParams.get('video') === '1';
      return json({ ok: true, cents: vid ? 9.9 : 4.4, door: 'atlascloud', exact: true });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: b.refs || [], status: 'drawing', seed: 7,
        sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/drop/upload-file') {
      const name = u.searchParams.get('filename') || 'f';
      const pic = /\.png$/i.test(name);
      const item = { url: 'http://127.0.0.1:' + server.address().port + (pic ? '/ref.png?' : '/clip.mp4?') + encodeURIComponent(name), posterUrl: '' };
      // a real upload is a ROUND TRIP, and that is the whole point of §11
      return slowUpload ? setTimeout(() => json({ ok: true, item }), slowUpload) : json({ ok: true, item });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
    res.writeHead(404); res.end('nope');
  });
});

// what is really on screen: each block's words, its heading's reference count,
// and the ONE strip under the panel
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    active: wraps.findIndex((w) => w.classList.contains('active')),
    counts: wraps.map((w) => {
      const c = w.querySelector('.bref');
      return c && c.classList.contains('on') ? c.querySelector('.n').textContent : '';
    }),
    strip: Array.from(document.querySelectorAll('#refs .ref')).map((r) => ({
      slot: (r.querySelector('.slot') || {}).textContent || '',
      src: r.querySelector('img') ? r.querySelector('img').getAttribute('src') : '',
      lit: !!r.querySelector('.kf.on'),
    })),
    reflab: document.getElementById('reffoldlab').textContent,
    refsShown: (() => { const r = document.getElementById('refs').getBoundingClientRect(); return !!(r.width && r.height); })(),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
    toast: document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '',
  };
};
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  const send = async (units) => {
    await page.evaluate((u) => localStorage.setItem('footage_handoff', JSON.stringify({
      prompt: u[0].text, blocks: u.map((x) => x.text), from: 'timeline', title: 'S',
      story: { id: 's1', title: 'S' }, units: u, at: Date.now() })), units);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await page.waitForTimeout(500);
  };
  const P1 = { key: 'a', text: 'part one' }, P2 = { key: 'b', text: 'part two' }, P3 = { key: 'c', text: 'part three' };
  await send([P1, P2]);
  let s = await page.evaluate(read);
  ok('the story lands as two parts carrying nothing — ' + JSON.stringify(s.counts), s.n === 2 && s.counts.join('') === '');
  await page.setInputFiles('#file', { name: 'x.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  ok('a picture attached to part 1 only — ' + JSON.stringify(s.counts), s.counts[0] === '1' && s.counts[1] === '');
  await send([P1, P2, P3]);
  s = await page.evaluate(read);
  ok('re-sent with a third part: part 1 keeps its picture, parts 2 and 3 carry none — ' + JSON.stringify(s.counts),
    s.n === 3 && s.counts[0] === '1' && s.counts[1] === '' && s.counts[2] === '');
  ok('and the draft agrees — ' + JSON.stringify((s.draft.jobs || []).map((j) => j.refs.length)),
    JSON.stringify((s.draft.jobs || []).map((j) => j.refs.length)) === '[1,0,0]');
  ok('no page errors — ' + JSON.stringify(errors), errors.length === 0);
  await browser.close(); server.close();
  report();
})();
