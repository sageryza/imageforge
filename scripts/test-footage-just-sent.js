#!/usr/bin/env node
/* A CLIP SHE JUST SENT IS NEVER FILTERED AWAY (2026-09-13, found auditing the
 * page after her "check for more bugs").
 *
 * The search's `qHits` is a set of ids the SERVER answered with, so a clip
 * that did not exist when it answered can never be in it: with a search
 * standing, a send was posted, charged and drawn while the feed went on
 * showing only the old hits — nothing on screen said a job had started, which
 * is how a clip gets paid for twice. The ♥/✕ marks and the funnel do it too (a
 * brand-new clip has no vote, and its model may not be the one she filtered
 * on).
 *
 * Every assertion is a MEASUREMENT of what really renders or a reading of what
 * the stub server received: a card in `jobsById` that no view draws, one drawn
 * but hidden, and one on screen all look identical in the source.
 *
 * Run: node scripts/test-footage-just-sent.js
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
    console.log('FOOTAGE JUST SENT — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE JUST SENT — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage just sent: playwright not installed — skipped'); report(); return;
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
const notes = [];
let cents = 4.4;
let refuse = false;
let slow = 0;                        // ms to hold a send open, so the page can be looked at mid-flight                  // the next send comes back a content refusal
const jobs = [];

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
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: cents, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      // the SERVER answers a search over the whole log — the words, not the
      // ids the page happens to hold — which is the half that cannot know
      // about a clip sent after it answered
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const out = q ? jobs.filter((j) => String(j.prompt || '').toLowerCase().includes(q)) : jobs;
      return json({ ok: true, jobs: out, more: false, folders: { ward: ['commercials'] } });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      if (refuse) {
        refuse = false;
        return json({ ok: false, error: 'refused', refusal: 'content', door: 'atlascloud' }, 400);
      }
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: b.refs || [], status: 'drawing', seed: 7,
        project: b.project || '', folder: b.folder || '',
        sentAt: new Date().toISOString(), estimate: cents, vote: '' });
      const send = () => json({ ok: true, jobId: id, door: 'atlascloud', estimate: cents, seed: 7 }, 202);
      if (slow) return setTimeout(send, slow);
      return send();
    }
    if (u.pathname === '/api/gallery/assets/note' && req.method === 'POST') {
      const b = JSON.parse(body);
      notes.push(b);
      return json({ ok: true, thread: [{ from: 'sophie', text: b.text, at: new Date().toISOString() }] });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'ward', name: 'The ward' }] });
    // a mark the server refuses is put back on the card (2026-09-14), so the stub has to TAKE one
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) return json({ ok: true, vote: JSON.parse(body || '{}').vote || '' });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
    res.writeHead(404); res.end('nope');
  });
});

const shownIds = () => [...document.querySelectorAll('#feed .job')].filter((e) => !e.hidden).map((e) => e.dataset.id);
const tileIds = () => [...document.querySelectorAll('#tiles .cell')].filter((e) => !e.hidden).map((e) => e.dataset.id);
const type = (t) => { const b = document.getElementById('prompt'); b.value = t; b.dispatchEvent(new Event('input', { bubbles: true })); };
const search = (t) => { const q = document.getElementById('q'); q.value = t; q.dispatchEvent(new Event('input', { bubbles: true })); };

// the picker is a POSTER SHEET since 2026-09-13 — a real walk through it
async function pickProject(pg, v) {
  v = String(v);
  const shut = await pg.evaluate(() => document.getElementById('shelf').hidden);
  if (shut) await pg.click('#projwrap');
  await pg.waitForSelector('#shgrid .shtile');
  // the sheet opens on the project she is standing in — go up first, so a
  // pick is always a walk down from the films
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

  // one clip in the feed, so there is something for a search to answer with
  await page.evaluate(type, 'the corridor at night');
  await page.click('#go');
  await page.waitForTimeout(600);
  ok('the first clip is in the feed', (await page.evaluate(shownIds)).join() === 'j1');

  // ── a SEARCH standing, and a clip sent that does not match it ───────────
  await page.click('#v-search');
  await page.waitForTimeout(150);
  await page.evaluate(search, 'corridor');
  await page.waitForTimeout(900);                  // the server's own answer lands
  ok('the search answers with the one hit', (await page.evaluate(shownIds)).join() === 'j1');
  await page.evaluate(type, 'a brand new office shot');
  await page.click('#go');
  await page.waitForTimeout(600);
  const after = await page.evaluate(shownIds);
  ok('the clip she just sent is on screen, newest first (' + after.join() + ')', after[0] === 'j2');
  ok('and it really went to the server', posted.length === 2 && posted[1].prompt === 'a brand new office shot');
  // AND IT SAYS SO — a card sitting in a feed her own search says nothing
  // matches would otherwise read as the filter broken
  ok('the toast says it is outside the search',
    /outside your search/.test(await page.$eval('#toast', (e) => e.textContent)));
  ok('the tile wall agrees — one predicate, both views', await page.evaluate(async () => {
    document.getElementById('v-tiles').click();
    return true;
  }) && (await page.waitForTimeout(200), (await page.evaluate(tileIds))[0] === 'j2'));
  await page.click('#v-list');
  await page.waitForTimeout(200);

  // ── MOVING THE VIEW is her re-deciding, and from then on it obeys ───────
  await page.evaluate(search, 'corridor at');
  await page.waitForTimeout(900);
  ok('editing the search puts it back under the filter (' + (await page.evaluate(shownIds)).join() + ')',
    (await page.evaluate(shownIds)).indexOf('j2') < 0);
  await page.evaluate(search, '');
  await page.waitForTimeout(600);
  ok('and with the search cleared both clips are back', (await page.evaluate(shownIds)).length === 2);

  // ── the ♥ filter is the same story ──────────────────────────────────────
  await page.click('#v-search');                   // shut it (it clears the words)
  await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('feedfilters').querySelector('.filtchip').click());
  await page.waitForTimeout(150);
  await page.click('#v-liked');
  await page.waitForTimeout(250);
  ok('hearts-only empties a feed with nothing hearted', (await page.evaluate(shownIds)).length === 0);
  await page.evaluate(type, 'one more shot, unhearted');
  await page.click('#go');
  await page.waitForTimeout(600);
  ok('a clip sent under hearts-only still shows while she waits',
    (await page.evaluate(shownIds)).join() === 'j3');
  await page.click('#v-liked');
  await page.waitForTimeout(250);
  ok('and turning the filter off shows every clip', (await page.evaluate(shownIds)).length === 3);

  // ── HER MARK ON A CLIP ENDS ITS SHIELD (2026-09-13, Sophie: "exed clips in
  // list view don't disappear when no x is selected") ─────────────────────
  // The shield is for while she WAITS; a ✕ is her deciding, and it used to
  // ride out the whole session on both views. MEASURED off what really
  // renders — a clip still in `jobsById` and one on screen look the same in
  // the source — and on BOTH views, since one predicate draws them.
  await page.click('#v-hidex');
  await page.waitForTimeout(250);
  await page.evaluate(type, 'the one she crosses out');
  await page.click('#go');
  await page.waitForTimeout(600);
  const sent = (await page.evaluate(shownIds))[0];
  ok('a clip sent under hide-the-✕\'d shows while she waits', sent === 'j4');
  await page.evaluate((id) => { document.getElementById('job-' + id).querySelector('[data-vote="dislike"]').click(); }, sent);
  await page.waitForTimeout(300);
  ok('crossing it out takes it off the list (' + (await page.evaluate(shownIds)).join() + ')',
    (await page.evaluate(shownIds)).indexOf(sent) < 0);
  await page.click('#v-tiles');
  await page.waitForTimeout(250);
  ok('and off the wall too', (await page.evaluate(tileIds)).indexOf(sent) < 0);
  await page.click('#v-list');
  await page.waitForTimeout(200);
  // the OTHER clips she just sent still ride — the shield is per clip
  await page.evaluate(type, 'another one, unmarked');
  await page.click('#go');
  await page.waitForTimeout(600);
  ok('another just-sent clip still rides the filter', (await page.evaluate(shownIds))[0] === 'j5');
  await page.click('#v-hidex');
  await page.waitForTimeout(250);

  // ── BOTH STARS GO DOWN TOGETHER WHILE A SEND IS IN FLIGHT ──────────────
  // A live-looking button that answers nothing is the shape of every "it
  // didn't work" report, so this is MEASURED against the send's own gate
  // rather than read out of the source.
  await page.evaluate(type, 'shot one');
  await page.evaluate(() => { const b = document.getElementById('prompt'); b.focus(); b.setSelectionRange(4, 4); });
  await page.click('#divide');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const ws = [...document.querySelectorAll('.pblock')];
    ws[1].value = 'shot two'; ws[1].dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  slow = 400;                                      // hold the send open long enough to look
  const during = await page.evaluate(async () => {
    document.getElementById('go').click();
    await new Promise((r) => setTimeout(r, 120));
    const go = document.getElementById('go'), all = document.getElementById('goall');
    return { go: go.disabled, all: all.disabled, dim: parseFloat(getComputedStyle(all).opacity) };
  });
  ok('while a send is in flight the All star is down too ' + JSON.stringify(during),
    during.go && during.all && during.dim < 0.6);
  await page.waitForTimeout(700);
  const afterSend = await page.evaluate(() => ({ go: document.getElementById('go').disabled, all: document.getElementById('goall').disabled }));
  ok('and both come back up when it lands ' + JSON.stringify(afterSend), !afterSend.go && !afterSend.all);
  slow = 0;

  // ── AN ARMED "SEND ALL · $x?" GOES DOWN WHEN THE PROJECT MOVES ─────────
  // The arm is a promise that the second tap sends the job she was looking
  // at, and the project rides the body — so an arm left standing across a
  // switch files the clip somewhere she was not when she armed it. MEASURED
  // off the button's own state and off what the server really received.
  cents = 420;                                     // over the $3 ask line
  await page.selectOption('#secs', '8');           // any control change re-asks /estimate
  await page.waitForFunction(() => /\$4\.20/.test(document.getElementById('goalllab').textContent), null, { timeout: 4000 });
  const nPosted = posted.length;
  await page.click('#goall');
  await page.waitForTimeout(200);
  ok('the first tap arms rather than sending',
    (await page.evaluate(() => document.getElementById('goall').classList.contains('armed'))) && posted.length === nPosted);
  // the FOLDER is the one that needed a line of its own — `setProject`
  // repaints the controls and `paintWipe` disarms, where `setFolder` does not
  await pickProject(page, 'ward');
  await page.waitForTimeout(500);
  await page.click('#goall');                      // arm again inside the project
  await page.waitForTimeout(200);
  ok('armed inside the project', await page.evaluate(() => document.getElementById('goall').classList.contains('armed')));
  await pickProject(page, 'ward/commercials');
  await page.waitForTimeout(400);
  ok('switching folder disarms it — nothing is one tap from sending',
    !(await page.evaluate(() => document.getElementById('goall').classList.contains('armed'))));
  ok('and still nothing went', posted.length === nPosted);
  cents = 4.4;

  ok('no page errors', errors.length === 0);
  await browser.close(); server.close();
  report();
})();
