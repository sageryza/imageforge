#!/usr/bin/env node
/* FOOTAGE — A SEARCH INSIDE A PROJECT SAYS HOW MANY IT FOUND OUTSIDE IT
 * (2026-09-15, Sophie, standing in "Secretly a Witch" with `cider` typed and
 * "Nothing matches that." under it: "where r the rest of my clips???").
 *
 * The project narrows the feed AND the search — `projQ()` rides the search
 * read and `shown()` drops a card of another project — and from down at the
 * feed the project is a filter she cannot see. Measured on her live log that
 * morning: 90 of her 500 clips carry NO project at all, 53 of them sent the
 * day before (the Christmas commercial she was searching for), because the
 * project stamps at SEND time and she was in All when she sent them. So the
 * page reported an empty library over clips that were one tap away.
 *
 * Every assertion here is a MEASUREMENT of what really renders or a reading
 * of what the stub server received: a count computed but never drawn, one
 * drawn but hidden, a tap that goes nowhere and a line naming the wrong
 * filter all look identical in the source.
 *
 * Verified failing 12 pre-fix.
 *
 * Run: node scripts/test-footage-elsewhere.js */
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
    console.log('FOOTAGE ELSEWHERE — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE ELSEWHERE — ' + pass + ' passed');
}

const F = require('../footage');
// NEVER `F.outsideCount(...)` DIRECTLY: pre-fix the export does not exist and
// a TypeError at line 1 would take the page half of this test down with it,
// reporting a crash where the whole point is a count of what is wrong. -1 is
// an answer no rule below can accidentally agree with.
const outsideCount = typeof F.outsideCount === 'function' ? F.outsideCount : () => -1;

// ── THE COUNT ITSELF, PURE (footage.js's outsideCount) ────────────────────
{
  const row = (id, project, folder, prompt, hidden) => ({ id, d: { project, folder, prompt, hidden } });
  const rows = [
    row('a', '', '', 'cider in the kitchen'),            // her orphans: no project at all
    row('b', '', '', 'cider again'),
    row('c', 'secretly-a-witch', '', 'a cider bottle'),  // one really in the project
    row('d', 'secretly-a-witch', 'doctor', 'cider'),     // and one in a folder of it
    row('e', 'ward', '', 'cider'),                       // a TUCKED film still counts
    row('f', '', '', 'cider', true),                     // hidden: the feed would never draw it
    row('g', 'house', '', 'a corridor'),                 // matches nothing
  ];
  const hit = (x) => /cider/.test(x.d.prompt);
  ok('in ALL there is no "elsewhere" to name', outsideCount(rows, { project: '', folder: '', hit }) === 0);
  ok('inside a project it counts every match outside it, tucked included (a, b, e)',
    outsideCount(rows, { project: 'secretly-a-witch', folder: '', hit }) === 3);
  ok('a HIDDEN clip is not elsewhere — the feed would never draw it',
    outsideCount(rows, { project: 'secretly-a-witch', folder: '', hit }) === 3
    && rows.filter((x) => x.d.hidden).length === 1);
  ok('inside a FOLDER the rest of its own project counts too (a, b, c, e)',
    outsideCount(rows, { project: 'secretly-a-witch', folder: 'doctor', hit }) === 4);
  ok('a word nothing matches outside is 0, not the whole log',
    outsideCount(rows, { project: 'house', folder: '', hit: (x) => /corridor/.test(x.d.prompt) }) === 0);
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage elsewhere: playwright not installed — pure half only'); report(); return;
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

const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
// two clips in her project and two filed nowhere — the live shape, small
const LOG = [
  { id: 'w1', prompt: 'the witch packs her travel kit', project: 'secretly-a-witch', folder: '' },
  { id: 'w2', prompt: 'the witch at the school lecture', project: 'secretly-a-witch', folder: '' },
  { id: 'c1', prompt: 'mom nudging dad, whispering about the cider', project: '', folder: '' },
  { id: 'c2', prompt: 'a warm baritone over the cider on the stove', project: '', folder: '' },
].map((j, i) => Object.assign({
  model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4, resolution: '480p',
  ratio: '9:16', sound: true, refs: [], status: 'done', seed: 7, vote: '',
  sentAt: new Date(Date.now() - i * 60000).toISOString(),
}, j));
const asked = [];

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
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      // THE REAL RULES, so the page is driven by the server it really talks
      // to: the project narrows the read, and the count is the route's own
      const project = u.searchParams.get('project') || '';
      const folder = u.searchParams.get('folder') || '';
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      asked.push({ project, folder, q });
      const hit = (x) => !q || String(x.d.prompt || '').toLowerCase().includes(q);
      const rows = LOG.map((j) => ({ id: j.id, d: j }));
      const jobs = rows.filter((x) => (!project || x.d.project === project) && (!folder || x.d.folder === folder) && hit(x)).map((x) => x.d);
      return json({ ok: true, jobs, more: false, folders: { 'secretly-a-witch': [] },
        elsewhere: q ? outsideCount(rows, { project, folder, hit }) : 0 });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'secretly-a-witch', name: 'Secretly a Witch' }] });
    if (u.pathname === '/api/footage/shelf') return json({ ok: true, shelf: { 'secretly-a-witch': { n: 2, poster: '' } }, folders: { 'secretly-a-witch': [] } });
    res.writeHead(404); res.end('nope');
  });
});

const shownIds = () => [...document.querySelectorAll('#feed .job')].filter((e) => !e.hidden).map((e) => e.dataset.id);
const search = (t) => { const q = document.getElementById('q'); q.value = t; q.dispatchEvent(new Event('input', { bubbles: true })); };
// MEASURED, never read off the attribute: a button with the right words that
// no layout puts on screen is the bug this test exists for
const elseSeen = () => {
  const b = document.getElementById('qelse');
  if (!b || b.hidden) return null;
  const r = b.getBoundingClientRect();
  return (r.width > 0 && r.height > 0) ? b.textContent.trim() : null;
};

async function pickProject(pg, v) {
  v = String(v);
  const shut = await pg.evaluate(() => document.getElementById('shelf').hidden);
  if (shut) await pg.click('#projwrap');
  await pg.waitForSelector('#shgrid .shtile');
  const up = await pg.$('#shback:not([hidden])');
  if (up) { await up.click(); await pg.waitForSelector('#shgrid .shtile'); }
  const p = v.split('/')[0];
  if (p) {
    const into = await pg.$(`.shtile[data-into="${p}"]`);
    if (into) { await into.click(); await pg.waitForSelector(`#shgrid .shtile[data-go="${p}"]`); }
  }
  await pg.click(`.shtile[data-go="${v}"]`);
}

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

  // ── HER SCREEN: inside the project, searching a word only the orphans have
  await pickProject(page, 'secretly-a-witch');
  await page.waitForTimeout(700);
  ok('she is in the project and it says so in the header',
    /secretly a witch/i.test(await page.$eval('#title', (e) => e.textContent)));
  ok('the feed is the project\'s two clips', (await page.evaluate(shownIds)).sort().join() === 'w1,w2');

  await page.click('#v-search');
  await page.waitForTimeout(150);
  await page.evaluate(search, 'cider');
  await page.waitForTimeout(1100);

  ok('nothing in here matches — which is true', (await page.evaluate(shownIds)).length === 0);
  ok('and the empty line names the PROJECT as the filter that emptied it',
    /Nothing matches that in Secretly a Witch\./.test(await page.$eval('#feedempty', (e) => e.textContent)));
  const seen = await page.evaluate(elseSeen);
  ok('the way out is on screen and counts them: "' + seen + '"', /\b2\b/.test(seen || '') && /outside this project/.test(seen || ''));

  // ── AND THE TAP IS THE GESTURE THAT SHOWS THEM ──────────────────────────
  // asked with a real tap where the button really is, and only when it is
  // there at all — a missing one is a fail above, not a 30-second timeout
  const way = await page.$('#qelse:not([hidden])');
  ok('there is something to tap', !!way);
  if (way) await way.click();
  await page.waitForTimeout(1100);
  ok('the tap leaves the project', (await page.$eval('#title', (e) => e.textContent)).trim() === 'Footage');
  ok('her words are still in the box', (await page.$eval('#q', (e) => e.value)) === 'cider');
  ok('and the clips she was looking for are on screen',
    (await page.evaluate(shownIds)).sort().join() === 'c1,c2');
  ok('the search really re-asked the server with no project',
    asked.filter((a) => a.q === 'cider' && !a.project).length > 0);
  ok('with nothing narrowing it, the way out is gone', (await page.evaluate(elseSeen)) === null);

  // ── AND IT IS NOT DRAWN WHEN THERE IS NOTHING OUTSIDE ───────────────────
  await pickProject(page, 'secretly-a-witch');
  await page.waitForTimeout(700);
  await page.evaluate(search, 'travel kit');
  await page.waitForTimeout(1100);
  ok('a search that finds its clip in here shows it', (await page.evaluate(shownIds)).join() === 'w1');
  ok('and offers no way out it does not need', (await page.evaluate(elseSeen)) === null);

  // ── CLEARING THE WORDS TAKES IT WITH THEM ───────────────────────────────
  await page.evaluate(search, 'cider');
  await page.waitForTimeout(1100);
  ok('the way out is back', (await page.evaluate(elseSeen)) !== null);
  await page.evaluate(search, '');
  await page.waitForTimeout(700);
  ok('and clearing the search clears it', (await page.evaluate(elseSeen)) === null);

  ok('no page errors (' + errors.join(' | ') + ')', errors.length === 0);

  await browser.close();
  server.close();
  report();
})();
