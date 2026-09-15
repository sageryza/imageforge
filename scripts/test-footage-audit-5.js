#!/usr/bin/env node
/* THE FOURTH ROUND OF AUDITS (2026-09-14, Sophie: "audit footage for bugs and
 * missing features") — three read-only sweeps over footage.js, the page's
 * prompt panel and its feed/player, and the shared files; these pin what was
 * fixed in the same pass. Pure where the rule is pure, a SOURCE PIN where the
 * broken and the fixed version differ only in one expression, and a headless
 * block for the two that cost money: a put-back that doubled the head blocks
 * into every re-roll, and a lone block left shut with no way to open it.
 *
 * Run: node scripts/test-footage-audit-5.js */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { let v; try { v = typeof cond === 'function' ? cond() : cond; } catch (e) { v = false; } if (v) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE AUDIT 5 — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE AUDIT 5 — ' + pass + ' passed');
}
const F = require('../footage');
const CD = require('../clip-diff');
const PT = require('../page-templates');
const src = fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8');
const page = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');

// ── SERVER, pure ──────────────────────────────────────────────────────────
{
  // `… older` never skips a twin sharing a sentAt to the millisecond
  const T = '2026-09-14T10:00:00.000Z';
  const all = [{ id: 'c', d: { sentAt: T } }, { id: 'a', d: { sentAt: T } }, { id: 'b', d: { sentAt: T } }, { id: 'z', d: { sentAt: '2026-09-13T00:00:00.000Z' } }];
  const p1 = F.pageJobs(all, { limit: 2 });
  ok('a tie on sentAt sorts by id, so the order is stable', p1.docs.map((x) => x.id).join() === 'c,b' && p1.more);
  const p2 = F.pageJobs(all, { limit: 2, before: T, beforeId: 'b' });
  ok('the cursor carries the id it stands on and the twin is NOT skipped', p2.docs.map((x) => x.id).join() === 'a,z');
  const p3 = F.pageJobs(all, { limit: 2, before: T });
  ok('a page cached from before sends no id and walks as it did', p3.docs.map((x) => x.id).join() === 'z');

  // a clip with no ratio is counted once in the draw-time buckets
  ok('drawKeyOf keeps an empty ratio as empty', F.drawKeyOf({ model: 'bytedance/seedance-2.0-mini', params: { duration: 4, resolution: '480p' }, door: 'openrouter', drewMs: 1000 }).ratio === '');
  ok('drawStats adds no exact key for a clip with no ratio', /if \(k\.ratio\) add\(`\$\{k\.door\}\|\$\{k\.model\}\|\$\{k\.res\}\|\$\{k\.ratio\}\|\$\{k\.seconds\}`, ms\);/.test(src));

  // doorFor normalises a resolution the model lacks, like estimate and buildJob
  const d = F.doorFor({ model: 'mini', door: 'auto', resolution: '1080p', ratio: '16:9', seconds: 4 }, { openrouter: true, apiframe: true, atlascloud: true });
  ok('doorFor on a rung the model lacks still finds a door — ' + (d.door || d.error), !!d.door);

  // a failed discount read keeps the last good figure
  ok('endpointDiscount answers null when it cannot read', () => { F.init({ openrouter: { configured: () => true, api: async () => { throw new Error('down'); } } }); return F.endpointDiscount('x/y').then((v) => v === null); });
  ok('discounts() merges onto the last good map', /discCache = \{ at: Date\.now\(\), val: \{ \.\.\.discCache\.val, \.\.\.out \} \};/.test(src));

  // the shelf's 60-character slug and the page's 40 are compared through one rule
  ok('the tucked slugs go through projectSlug before the compare', /const tuckedSlugs = tucked\.map\(projectSlug\);/.test(src));
  // a refused poster url is dropped, not stored
  const j = F.buildJob({ prompt: 'p', model: 'mini', refs: [{ url: 'https://x/a.png', kind: 'image', poster: 'javascript:alert(1)' }, { url: 'https://x/b.png', kind: 'image', poster: 'https://x/b.jpg' }] });
  ok('a bad poster url is dropped and a good one kept', j.refs[0].poster === '' && j.refs[1].poster === 'https://x/b.jpg');
}
// ── SERVER, by source ─────────────────────────────────────────────────────
{
  ok('/status hands out the balances only with the token', /balances: authed \? bal : null/.test(src));
  ok('a replace onto a span another part already holds still writes the shortened list', /if \(already && !replacing\) \{/.test(src) && /const shrank = replacing && live\.length !== kept2\.length;/.test(src));
  ok('a poster that missed its bake is tried again, once per process', /posterTried\.has\(x\.id\)\) return;/.test(src) && /const posterTried = new Set\(\)/.test(src));
  ok('the poster bake and the floor encode ride the one-decode queue', /return gateTrim\(\(\) => bakePosterInner\(id, videoUrl\)\)/.test(src) && /await gateTrim\(\(\) => runBin\(bin, \['-y', '-i', src,/.test(src));
  ok('vote, project and hide UPDATE and answer 404 on a missing clip', (src.match(/\.update\(\{ (vote|project, folder|hidden) \}\)/g) || []).length === 3 && (src.match(/e\.code === 5\) return res\.status\(404\)/g) || []).length === 3);
  ok('a pair of long reference videos on AUTO walks off Atlas rather than dying', /avoid: \['atlascloud'\] \}, cfg\(\)\);/.test(src) && /walked = `Sent through/.test(src));
  ok('every refusal this module raises itself is logged', (src.match(/await refuse\(/g) || []).length >= 3 && /const refuse = async \(message, refusal, door, status\)/.test(src));
  ok('the pause is checked inside startJobInner', /if \(pausedNow\(\)\) await refuse\(PAUSED_WORDS, 'paused', '', 503\);/.test(src));
  ok('a door that could not file the job says so on the answer', /logged: r\.logged !== false/.test(src) && /could not be filed on the log/.test(src));
  for (const f of ['openrouter.js', 'atlascloud.js', 'apiframe.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(f + ' retries its log write once and answers `logged`', /let logged = true;/.test(s) && /logged = false;/.test(s) && /, logged \};/.test(s));
  }
  ok('kin reads ONE project, never the whole log as cards', /const snap = j\.project \? await coll\(\)\.where\('project', '==', own\.data\(\)\.project\)\.get\(\)/.test(src));
  ok('the shelf cache is emptied by every write that changes a tile', (src.match(/shelfBust\(\);/g) || []).length >= 4);
  ok('a door that did not answer keeps its last balance', /const keep = \(k, f\) => \(last\[k\] && last\[k\]\[f\] != null \? last\[k\]\[f\] : null\);/.test(src));
  ok('the server search puts the project NAME in the hay', /const names = await cast\.filmNames\(\)/.test(src));
  ok('a part carries when it was cut', /at: t\.at \|\| '',/.test(src));
  const atlas = fs.readFileSync(path.join(ROOT, 'atlascloud.js'), 'utf8');
  ok("the spend cache key leaves `fresh` out", /const key = JSON\.stringify\(\{ \.\.\.opts, fresh: undefined \}\);/.test(atlas));
}
// ── SHARED FILES, pure ────────────────────────────────────────────────────
{
  const jobs = [
    { id: 'b', project: 'ward', sentAt: '2026-09-14T03:00:00Z', prompt: 'sophie walks in and sits', status: 'done' },
    { id: 'h', project: 'ward', sentAt: '2026-09-14T02:00:00Z', prompt: 'sophie walks in and sits', status: 'done', hidden: true },
    { id: 'f', project: 'ward', sentAt: '2026-09-14T01:30:00Z', prompt: 'sophie walks in and sits', status: 'failed' },
    { id: 'a', project: 'ward', sentAt: '2026-09-14T01:00:00Z', prompt: 'sophie walks in and sits down', status: 'done' },
  ];
  const k = CD.kinOf(jobs[0], jobs);
  ok('the compare panel never diffs against a hidden or a failed clip — ' + (k && k.job.id), k && k.job.id === 'a');
  ok('tail() keeps a readable name however long — ' + CD.tail('https://x/y/sophie-blue-pajamas-front-view.png'), CD.tail('https://x/y/sophie-blue-pajamas-front-view.png') === 'sophie-blue-pajamas-front-view');
  ok('and still blanks a hash', CD.tail('https://x/y/3SL74kD3vCOePxCzjgh4aY9LbIGMe9T5.png') === '' && CD.tail('https://x/y/27fcbe6e73354f0599715eb38dee352f.mp4') === '');
  const cdsrc = fs.readFileSync(path.join(ROOT, 'clip-diff.js'), 'utf8');
  ok('tail() blanks an unbroken alnum run and hex, never a hyphenated name', /\/\^\[A-Za-z0-9\]\{20,\}\$\/\.test\(f\)/.test(cdsrc) && !/\[A-Za-z0-9_-\]\{20,\}/.test(cdsrc));

  const clean = PT.cleanFootage || null;
  if (clean) {
    const h = clean({ prompt: 'p', refs: [{ url: 'https://x/a.png' }, { url: 'https://x/b.png' }], firstFrame: 'https://x/a.png', lastFrame: 'https://x/nope.png', blocks: ['one', '', 'two'], project: 'ward', folder: 'kitchen' });
    ok('cleanFootage passes a keyframe that is among the refs and drops one that is not', h.firstFrame === 'https://x/a.png' && !h.lastFrame);
    ok('and the blocks, the project and the folder', h.blocks.join('|') === 'one|two' && h.project === 'ward' && h.folder === 'kitchen');
  } else {
    const pts = fs.readFileSync(path.join(ROOT, 'page-templates.js'), 'utf8');
    ok('cleanFootage passes firstFrame/lastFrame/blocks/project/folder (by source)', /out\.firstFrame = first/.test(pts) && /out\.blocks = blocks/.test(pts) && /out\.folder = folder/.test(pts));
  }
  const vs = fs.readFileSync(path.join(PUB, 'viewswitch.js'), 'utf8');
  ok('the view switch keeps its value in memory, storage only remembers it', /var curView = null, curCols = null;/.test(vs) && /curView = v === 'tiles' \? 'tiles' : 'list'; keep\(/.test(vs));
}
// ── THE PAGE, by source ───────────────────────────────────────────────────
{
  ok('a lone block can never be shut', /if \(ws\.length === 1 && ws\[0\]\.classList\.contains\('shut'\)\) \{ ws\[0\]\.classList\.remove\('shut'\)/.test(page));
  // THE SECOND STAR STAYS GONE (2026-09-14, Sophie: "button is stipid get it
  // out") — and THAT is the pin, not "only the active block sends". She asked
  // on 2026-09-15 for the thing it could never do ("select multiple non
  // adjacent text blocks … send appended as one prompt"), so an appended send
  // is back and it is read BY the one star. What must never grow back is a
  // second button beside it.
  ok('there is no second send button', !/goall|goalllab/.test(page));
  ok('the one star is the only send', (page.match(/\$\('go'\)\.addEventListener\('click'/g) || []).length === 1
    && /\$\('go'\)\.addEventListener\('click', sendStar\)/.test(page));
  // and "no figure, no send" is back with the ask it guards — the removed
  // star's own audit finding, pinned rather than trusted
  ok('a marked send refuses to send with no figure, and arms over $3', /if \(total == null\) \{/.test(page)
    && /armed = Date\.now\(\); paintGo\(\);/.test(page) && /ASK_CENTS = 300/.test(page));
  ok('a door word re-sends the exact body that was refused', /sendJob\(r\.door, box, job, body\)/.test(page) && /var body = resend \? Object\.assign\(\{\}, resend, \{ door: pin \|\| doorNow\(\) \}\)/.test(page));
  ok('offerDoors prices off the body that left, with the counts', /encodeURIComponent\(sent\.model \|\| S\.model\)/.test(page) && /'&auds=' \+ c\.audio;\n  Promise\.all\(others/.test(page));
  ok('reslotPlan forgets EVERY vanished slot name', /gones\.push\(a\.slots\[r\.url\]\)/.test(page) && /function reslotApply\(p, t\)/.test(page));
  // (2026-09-14: the cast is per BLOCK now, so the prefix is matched against
  // every cast on the page plus the one setting, and what comes off goes onto
  // the block the put-back makes.)
  ok('a put-back strips the heads it carries, and re-homes the cast',
    /var known = blocks\(\)\.map\(function \(b\) \{ return charsOf\(b\); \}\);/.test(page)
    && /known\.concat\(\[settingVal\(\)\]\)\.forEach/.test(page)
    && /back = back\.slice\(t\.length \+ 2\);/.test(page)
    && /addBlock\(back, tail, job, tookChars\)/.test(page));
  ok('a new folder is made in the project the sheet was on', /function newFolder\(project\)/.test(page) && /newFolder\(at\)/.test(page));
  ok('folding the buttons row closes the drawer through its own closer', /if \(recentOpen\) recClose\(\);/.test(page));
  ok("the Recent label says what the drawer holds", /aria-label="Recent — references you have used"/.test(page));
  ok('a pick opens the newer clip as "this clip"', /var nw = String\(b\.sentAt \|\| ''\) >= String\(j\.sentAt \|\| ''\) \? b : j;/.test(page));
  ok("the server's hits are a floor, not a ceiling", /if \(qHits && qHits\[j\.id\]\) return true;\n/.test(page) && !/if \(qHits\) return !!qHits\[j\.id\];/.test(page));
  ok('a baking part ages out', /var BAKE_STALE_MS = 15 \* 60 \* 1000;/.test(page) && /t\.status === 'baking' && !bakeStale\(t\)/.test(page));
  ok('the compare panel holds the self-heal', /if \(!\$\('cmp'\)\.hidden\) return 'the compare panel';/.test(page));
  ok('a refused move or mark goes back', /live\.project = wasP; live\.folder = wasF;/.test(page) && /live\.vote = wasVote;/.test(page));
  ok('the emptied line counts the view', /var n = Object\.keys\(jobsById\)\.filter\(function \(k\) \{\n    var j = jobsById\[k\];\n    return j && !j\.hidden/.test(page));
  ok("the grab row's reference lamp follows the tap", /useShot\(false, 'frame at ' \+ grabbed\.at\.toFixed\(1\) \+ 's', true\);   \/\/ her marks stay\n  paintGrabRef\(\);/.test(page));
  ok('the save bank holds one clip and lets its object urls go', /Object\.keys\(saveBlobs\)\.forEach\(function \(u\) \{ if \(!keep\[u\]\) delete saveBlobs\[u\]; \}\);/.test(page) && (page.match(/URL\.revokeObjectURL/g) || []).length >= 2);
  ok('a mark pauses the clip', /TR\.all = false;               \/\/ moving a mark is the end of a whole-clip run\n  try \{ TR\.v\.pause\(\); \}/.test(page));
  ok('a reference video opens with no note door', /openPlayer\(r\.url, null, \{ note: false \}\)/.test(page) && /if \(opts && opts\.note === false\) return;/.test(page));
  ok('the player says when a clip will not play', /v\.addEventListener\('error', function \(\) \{ toast\('That clip would not play/.test(page));
  ok('taking a part off keeps her marks', /if \(body\.remove\) \{ if \(TR\.editing === body\.remove\) TR\.editing = ''; \}/.test(page));
  ok('the older walk carries the id it stands on', /'&beforeId=' \+ encodeURIComponent\(bid\)/.test(page));
  ok('a project switch cancels an armed pick and the refusal line', /if \(typeof cmpCancelPick === 'function'\) cmpCancelPick\(\);/.test(page) && /function setProject[\s\S]{0,600}?clearErr\(\)/.test(page));
  ok('her notes are in the client-side hay', /var mine = threadFor\(j\)\.filter\(function \(m\) \{ return m && m\.from !== 'chat' && m\.text; \}\)/.test(page));
  ok('the heads are per project', /var HEADS_KEY = 'footage_heads';/.test(page) && /headsStash\(S\.project, hw\);/.test(page) && /headsApply\(p\); \}/.test(page));
}

// ── THE PAGE, headless: the two that cost money ───────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { try { ({ chromium } = require('playwright-core')); } catch (__) { chromium = null; } }
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) { const p = path.join(root, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; }
  return null;
}
(async () => {
  if (!chromium) { console.log('audit 5: playwright not installed — headless half skipped'); return report(); }
  const servePublic = require('./lib/public-asset');
  const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
  const posted = [];
  const card = { id: 'j1', prompt: 'nurse edna, tired\n\nthe ward office at night\n\nshe pours a coffee', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, refs: [], status: 'done', video: 'http://x/clip.mp4', poster: '', vote: '', project: '', folder: '',
    sentAt: '2026-09-14T01:00:00.000Z', seed: 7 };
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (u.pathname === '/footage') { const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL; res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
      if (u.pathname === '/api/footage/status') return json({ ok: true, doors: { atlascloud: true }, chat: 'footage', balances: { atlascloud: { configured: true } }, models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
      if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
      if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs: [card], folders: {} });
      if (u.pathname === '/api/footage/jobs' && req.method === 'POST') { posted.push(JSON.parse(body)); return json({ ok: true, jobId: 'n' + posted.length, door: 'atlascloud', estimate: 4.4 }, 202); }
      if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
      if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
      if (u.pathname === '/api/cast/films') return json({ ok: true, films: [] });
      res.writeHead(404); res.end('nope');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(`http://127.0.0.1:${port}/footage`);
  await pg.waitForSelector('#job-j1', { timeout: 15000 });
  // the cast and the room written, as they would be for this film (ONE folded
  // block with two boxes since 2026-09-14 — the cast is this block's own)
  await pg.evaluate(() => {
    const set = (id, v) => {
      const el = document.querySelector('.panel > .headwrap .hpart[data-head="' + id + '"] .hblock');
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('characters', 'nurse edna, tired');
    set('setting', 'the ward office at night');
  });
  // put the finished clip back
  await pg.evaluate(() => { document.querySelector('#job-j1 .copy').click(); });
  await pg.waitForTimeout(300);
  const boxed = await pg.evaluate(() => document.getElementById('prompt').value);
  ok('a put-back lands the SCENE in the box, not the heads too — ' + JSON.stringify(boxed), boxed === 'she pours a coffee');
  await pg.click('#go');
  await pg.waitForTimeout(500);
  ok('and the re-roll goes out with the heads ONCE — ' + JSON.stringify((posted[0] || {}).prompt), posted.length === 1 && posted[0].prompt === 'nurse edna, tired\n\nthe ward office at night\n\nshe pours a coffee');

  // a lone block can never be shut: two blocks, fold block 2, take block 1 off
  await pg.evaluate(() => {
    const box = document.getElementById('prompt');
    box.value = 'first shot|second shot'; box.setSelectionRange(10, 10); box.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.promptwrap.active .divide').click();
  });
  await pg.waitForTimeout(200);
  const two = await pg.evaluate(() => document.querySelectorAll('.promptwrap').length);
  ok('divided into two blocks', two === 2);
  await pg.evaluate(() => { const ws = document.querySelectorAll('.promptwrap'); ws[1].querySelector('.bfold').click(); });
  await pg.waitForTimeout(150);
  await pg.evaluate(() => { const ws = document.querySelectorAll('.promptwrap'); ws[0].querySelector('.wipeb').click(); });
  await pg.waitForTimeout(250);
  const lone = await pg.evaluate(() => {
    const ws = document.querySelectorAll('.promptwrap'); const b = ws[0].querySelector('.pblock'); const r = b.getBoundingClientRect();
    return { n: ws.length, shut: ws[0].classList.contains('shut'), visible: r.height > 20 && getComputedStyle(b).display !== 'none', value: b.value };
  });
  ok('the block left is open and its box is on screen — ' + JSON.stringify(lone), lone.n === 1 && !lone.shut && lone.visible);
  ok('no page errors', errs.length === 0);
  await browser.close(); server.close();
  report();
})().catch((e) => { console.log('audit 5 crashed: ' + (e && e.stack || e)); process.exit(1); });
