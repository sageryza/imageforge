#!/usr/bin/env node
/* A DROPPED ANSWER IS NOT A REFUSAL (2026-09-15, Sophie, looking at the clip's
 * own row sitting directly under the line that said nothing was sent: "it did
 * answer tho").
 *
 * The send's `.catch` fires when the page cannot READ the answer — a gateway
 * page, a dropped connection, a tunnel going away — and every one of those can
 * happen after the door has taken the job and charged for it. It said "nothing
 * was sent or charged", which was never knowledge; the fix is that the page
 * asks the log, which the server writes the moment a job goes.
 *
 * Every assertion is a MEASUREMENT of what is really on the error line, in the
 * toast and in the feed: a page that guessed right and a page that asked look
 * identical in the source, and the wrong guess is the one that costs money.
 *
 * Run: node scripts/test-footage-dropped-answer.js
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
    console.log('FOOTAGE DROPPED ANSWER — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE DROPPED ANSWER — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage dropped answer: playwright not installed — skipped'); report(); return;
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
const jobs = [];
const posted = [];
// 'drop-after' = the door really took it and the answer never arrived (hers);
// 'drop-before' = nothing reached the door at all.
let mode = '';

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
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 16.5, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      return json({ ok: true, jobs: jobs, more: false, folders: {} });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      if (mode === 'drop-after') {
        // the door took it and logged it — and then the answer never made it
        // back to the page
        jobs.unshift({ id: 'j' + posted.length, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini',
          door: 'atlascloud', seconds: b.seconds, resolution: b.resolution, ratio: b.ratio, sound: true,
          refs: b.refs || [], status: 'drawing', seed: 121668985, project: b.project || '', folder: b.folder || '',
          sentAt: new Date().toISOString(), estimate: 16.5, vote: '' });
      }
      // THE ANSWER THE PAGE CANNOT READ: a gateway page where the JSON should
      // be, which is what a proxy in front of the box really sends. (A raw
      // socket reset is the same thing to `api`, but Chromium re-sends the POST
      // itself on one — which would make this test measure the browser rather
      // than the page.)
      res.writeHead(502, { 'content-type': 'text/html' });
      return res.end('<html><body>502 Bad Gateway</body></html>');
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [] });
    res.writeHead(404); res.end('nope');
  });
});

const type = (t) => { const b = document.getElementById('prompt'); b.value = t; b.dispatchEvent(new Event('input', { bubbles: true })); };
const errText = () => (document.getElementById('err').hidden ? '' : document.getElementById('err').textContent);
const shownIds = () => [...document.querySelectorAll('#feed .job')].filter((e) => !e.hidden).map((e) => e.dataset.id);
// EVERY WORD THE ERROR LINE SAID, not whatever it happens to say when the test
// looks: the check can land in a few hundred milliseconds, so reading the line
// once would race the very words this is about.
const watchErr = () => {
  window.__errSaid = [];
  const el = document.getElementById('err');
  new MutationObserver(() => { const t = el.textContent; if (t && window.__errSaid[window.__errSaid.length - 1] !== t) window.__errSaid.push(t); })
    .observe(el, { childList: true, subtree: true, characterData: true });
};
const errSaid = () => (window.__errSaid || []).join(' ¶ ');

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(700);

  // ── HER CASE: it did answer, the page just could not hear it ────────────
  mode = 'drop-after';
  await page.evaluate(watchErr);
  await page.evaluate(type, 'exterior view of a cottage w snow on the roof');
  await page.click('#go');
  await page.waitForTimeout(400);
  await page.waitForFunction(() => document.getElementById('err').hidden, null, { timeout: 25000 });
  const said = await page.evaluate(errSaid);
  ok('while it asks, the line says it is checking (' + said + ')', /checking whether the clip went/.test(said));
  ok('and it never once claimed nothing was sent or charged', !/nothing was sent or charged/.test(said));
  ok('the clip it found is in the feed', (await page.evaluate(shownIds)).join() === 'j1');
  ok('and the toast says it went through',
    /did go through/.test(await page.$eval('#toast', (e) => e.textContent)));
  ok('the error line is gone', (await page.evaluate(errText)) === '');
  ok('and it was sent exactly once — the page never re-sends on its own', posted.length === 1);
  ok('the block reads as sent', await page.evaluate(() =>
    document.querySelector('.promptwrap .bfold .bsent').textContent.trim() === 'sent'));

  // ── AND WHEN NOTHING REACHED THE DOOR, IT SAYS SO WITHOUT GUESSING ──────
  mode = 'drop-before';
  await page.evaluate(watchErr);
  await page.evaluate(type, 'a shot that never left');
  await page.click('#go');
  await page.waitForFunction(() => /has appeared in the feed|no clip carrying/.test(document.getElementById('err').textContent),
    null, { timeout: 30000 });
  const out = await page.evaluate(errText);
  ok('it checked here too', /checking whether the clip went/.test(await page.evaluate(errSaid)));
  ok('it names what it looked for and points her at the feed (' + out + ')',
    /no clip carrying these words/.test(out) && /feed/.test(out));
  ok('and it still does not claim nothing was charged', !/nothing was sent or charged/.test(out));
  ok('the feed still holds only the clip that really went', (await page.evaluate(shownIds)).join() === 'j1');

  ok('no page errors (' + errors.slice(0, 2).join(' · ') + ')', errors.length === 0);

  await browser.close();
  server.close();
  report();
})();
