#!/usr/bin/env node
// A HEART ON A PANEL SURVIVES THE NEXT SWEEP (2026-09-06, Sophie: "when i
// heart individual panels the heart gets removed 😡").
//
// The Panels tab re-reads its gallery through the server's 60s scan cache, and
// a vote wrote the run doc and never the cache — so the tap after her heart
// re-read a copy frozen before it, `mergeRuns` let the fresh copy win, and the
// ♥ came off. Two halves, both measured here:
//   1. pl-scan-patch.js — the server applies a vote's patch to the cached copy
//      (pure, and every run-vote write site in server.js calls it);
//   2. the page shields a mark she just cast from a stale read — the stub's
//      kind=panels answer here is DELIBERATELY the pre-heart copy, the way the
//      real cache was, and the badge on screen is what is measured.
//
//   npm install playwright --no-save && node scripts/test-playground-panel-heart.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');
const { applyPatch } = require('../pl-scan-patch');

let bad = 0;
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else { console.error('FAIL: ' + m); bad++; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('pl-scan-patch — the cached copy takes the vote’s own patch');
{
  const DEL = { __del: true };
  const isDel = (v) => v === DEL;
  const runs = [{ id: 'a', votes: { 1: 'like' }, voteFrom: { 1: 'sheet' } }, { id: 'b' }];
  ok(applyPatch(runs, 'a', { 'votes.0': 'like', 'voteFrom.0': DEL }, isDel), 'a run in the cache is patched');
  ok(same(runs[0].votes, { 0: 'like', 1: 'like' }), 'the new mark lands beside the old one');
  ok(applyPatch(runs, 'a', { 'votes.1': DEL, 'voteFrom.1': DEL }, isDel) && same(runs[0].votes, { 0: 'like' })
    && same(runs[0].voteFrom, {}), 'a delete sentinel removes the key');
  ok(applyPatch(runs, 'b', { 'votes.-1': 'dislike' }, isDel) && runs[1].votes['-1'] === 'dislike',
    'a run with no votes map yet grows one');
  ok(applyPatch(runs, 'zzz', { 'votes.0': 'like' }, isDel) === false, 'a run not in the cache is left alone');
  ok(applyPatch(null, 'a', { 'votes.0': 'like' }, isDel) === false, 'no cache, no crash');
}

console.log('\nserver.js — every run-vote write patches the cache');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const updates = src.match(/\n\s*await (ref|doc\.ref|docRef)\.update\(patch\);\n\s*plScanApply\((ref|doc|docRef)\.id, patch\);/g) || [];
  ok(updates.length === 4, 'four write sites (vote, votes, the Assets sync, the cut landing) — found ' + updates.length);
  ok(/require\('\.\/pl-scan-patch'\)/.test(src), 'server.js requires the rule');
}

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP headless half: playwright not installed'); process.exit(bad ? 1 : 0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1787000000000;
const RUN = {
  id: 'heartrun', prompt: 'four panels', status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3', sheet: '2336x3504',
  panels: ['one', 'two', 'three', 'four'],
  sheetUrl: '/px.png?p=sheet',
  images: ['/px.png?p=0', '/px.png?p=1', '/px.png?p=2', '/px.png?p=3'],
  votes: { 2: 'dislike' },
  createdAt: T0,
};
// THE STALE COPY — what the real 60s cache handed back: the run as it stood
// before her tap. Never updated by a vote, on purpose.
const STALE = JSON.parse(JSON.stringify(RUN));
const posts = [];
let sweeps = 0;
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const m = /^\/api\/promptlab\/([^/]+)\/vote$/.exec(url.pathname);
  if (m && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      const j = JSON.parse(body || '{}');
      posts.push(j);
      if (j.vote) RUN.votes[j.image] = j.vote; else delete RUN.votes[j.image];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }
  if (url.pathname === '/api/promptlab') {
    const panels = url.searchParams.get('kind') === 'panels';
    if (panels) sweeps++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: panels ? [STALE] : [], more: false }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { localStorage.setItem('promptlab_tab', 'panels'); });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 4);

  const badges = () => page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#runs .cell').forEach((c) => {
      const im = c.querySelector('img[data-run]');
      if (!im) return;
      const b = c.querySelector('.badge');
      out[im.getAttribute('data-i')] = b ? (b.classList.contains('like') ? 'like' : 'dislike') : '';
    });
    return out;
  });
  const badgeOf = (i) => page.evaluate((i) => {
    const im = document.querySelector('#runs .cell img[data-i="' + i + '"]');
    const b = im && im.parentElement.querySelector('.badge');
    return b ? (b.classList.contains('like') ? 'like' : 'dislike') : '';
  }, i);
  // The sweep the tap after her heart arms — asked past the throttle, the
  // way a visibility flip asks it.
  const resweep = async () => {
    const before = sweeps;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => true);
    await new Promise((r) => setTimeout(r, 400));
    return sweeps > before;
  };

  console.log('\nheart a panel');
  ok(same(await badges(), { 0: '', 1: '', 2: 'dislike', 3: '' }), 'the fixture as loaded');
  await page.click('#runs .cell img[data-i="0"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display !== 'none';
  });
  await page.click('#clightbox .vote.heart');
  await page.waitForFunction(() => {
    const im = document.querySelector('#runs .cell img[data-i="0"]');
    return !!(im && im.parentElement.querySelector('.badge.like'));
  });
  await page.evaluate(() => window.__assetLightboxClose && window.__assetLightboxClose());
  ok(posts.length === 1 && posts[0].image === 0 && posts[0].vote === 'like', 'the ♥ is posted');
  ok(RUN.votes[0] === 'like', 'and the server has it');

  console.log('\nthe sweep after it answers with the PRE-HEART copy');
  ok(await resweep(), 'a re-sweep really ran (' + sweeps + ' panels reads)');
  ok(await badgeOf(0) === 'like', 'THE ♥ IS STILL ON THE PANEL');
  ok(await badgeOf(2) === 'dislike', 'the ✕ she cast before is untouched');

  console.log('\nclear it, then the same stale sweep');
  await page.click('#runs .cell img[data-i="0"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display !== 'none';
  });
  await page.click('#clightbox .vote.heart');          // tap again — clear
  await page.waitForFunction(() => {
    const im = document.querySelector('#runs .cell img[data-i="0"]');
    return !(im && im.parentElement.querySelector('.badge'));
  });
  await page.evaluate(() => window.__assetLightboxClose && window.__assetLightboxClose());
  // The stale copy now says NOTHING for panel 0 either, so make it disagree
  // the other way: a cache that still held the heart from a moment ago.
  STALE.votes[0] = 'like';
  ok(await resweep(), 'a re-sweep really ran');
  ok(await badgeOf(0) === '', 'a CLEAR she just cast is shielded too — the stale ♥ does not come back');

  await browser.close();
  server.close();
  console.log(bad ? `\n${bad} FAILED` : '\nall good');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
