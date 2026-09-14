#!/usr/bin/env node
/* WHAT CHANGED BETWEEN TWO CLIPS (2026-09-11, Sophie: "is there an easy way I
   can diff video clips like I can't remember what I changed for example
   sometimes it's a single line or a reference for the model the timing etc …
   It's always been Sophie clips since they're pretty similar").

   The pure half is clip-diff.js: the word diff (an added word lands as `add`,
   nothing else of the sentence moves), the settings rows (only what changed),
   the references slot by slot (a different picture in [Image2] is ONE swapped
   row, not a removal and an addition), the cast-library names, and "the clip
   before this one" by project.

   The page half drives the REAL public/footage.html in headless Chromium
   against a stub feed: the compare mark on a card opens the panel on the clip
   BEFORE it, the added word is MEASURED as a lit span, the swapped reference
   wears its cast-library name, the arrows walk the other side, a clip older
   than the page holds is asked of the server, and a pick lands on the card
   she taps. Every assertion a measurement — a panel that opens on the wrong
   clip, or lights nothing, is the same markup to any source check.

   Run: node scripts/test-clip-diff.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('CLIP DIFF — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('CLIP DIFF — ' + pass + ' passed');
}

const D = require('../clip-diff');

// ── the pure half ──────────────────────────────────────────────────────────
{
  const a = { id: 'a', prompt: 'sophie is the woman in [Video1].\nshe walks down the hall, camera at eye level', seconds: 8, seed: 11, model: 'mini', modelLabel: '2.0 Mini', resolution: '480p', ratio: '3:4', door: 'atlascloud', project: 'ward',
    refs: [{ url: 'https://x/jazz.mp4', kind: 'video' }, { url: 'https://x/pj-a.png', kind: 'image' }, { url: 'https://x/pj-b.png', kind: 'image' }], sentAt: '2026-09-10T01:00:00Z' };
  const b = { id: 'b', prompt: 'sophie is the woman in [Video1].\nshe walks slowly down the hall, camera at eye level', seconds: 12, seed: 11, model: 'mini', modelLabel: '2.0 Mini', resolution: '480p', ratio: '3:4', door: 'atlascloud', project: 'ward',
    refs: [{ url: 'https://x/jazz.mp4', kind: 'video' }, { url: 'https://x/pj-c.png', kind: 'image' }, { url: 'https://x/pj-b.png', kind: 'image' }], sentAt: '2026-09-10T02:00:00Z' };
  const d = D.diff(a, b);
  ok('one added word, nothing removed', d.words === 1 && d.prompt.filter((t) => t.op === 'add').length === 1 && !d.prompt.some((t) => t.op === 'del'));
  ok('the added word is the word she put in', d.prompt.find((t) => t.op === 'add').t.trim() === 'slowly');
  ok('the diff re-joins to the newer prompt byte for byte', d.prompt.filter((t) => t.op !== 'del').map((t) => t.t).join('') === b.prompt);
  ok('and to the older one', d.prompt.filter((t) => t.op !== 'add').map((t) => t.t).join('') === a.prompt);
  ok('the newline she typed survives as a newline', d.prompt.some((t) => t.op === 'same' && t.t.indexOf('\n') >= 0));
  ok('one settings row — seconds 8s → 12s — and the seed, which did not move, is not a row',
    d.settings.length === 1 && d.settings[0].label === 'seconds' && d.settings[0].from === '8s' && d.settings[0].to === '12s');
  const swapped = d.refs.filter((r) => r.op === 'swapped');
  ok('[Image1] is ONE swapped row, not a removal and an addition', swapped.length === 1 && swapped[0].slot === '[Image1]' && !d.refs.some((r) => r.op === 'added' || r.op === 'removed'));
  ok('the other two slots are same', d.refs.filter((r) => r.op === 'same').length === 2);
  ok('the filename names a reference when no cast name does', swapped[0].fromName === 'pj-a' && swapped[0].toName === 'pj-c');
  ok('the summary is one line in her words', D.summary(d) === '1 word · seconds 8s → 12s · [Image1] swapped');
  ok('identical clips say so', D.summary(D.diff(a, a)) === 'identical' && D.diff(a, a).changed === false);
  // a Storage id says nothing — the slot alone
  ok('a random Storage filename is not offered as a name', D.tail('https://s/footage/3fb2e6d1a9c04f3d8e7b6a5c4d3e2f1a.png') === '' && D.tail('https://s/x/jazz-best4s.mp4') === 'jazz-best4s');
  // cast names win over the filename
  const names = D.castNames([
    { slug: 'sophie', name: 'Sophie', looks: [{ name: 'the blue pajamas', refs: [{ url: 'https://x/jazz.mp4' }, { url: 'https://x/pj-c.png' }] }, { name: 'street clothes', refs: [{ url: 'https://x/street.png' }] }] },
    { slug: 'blue-pajamas', name: 'Blue pajamas', looks: [{ name: 'head off', refs: [{ url: 'https://x/pj-a.png' }, { url: 'https://x/pj-b.png' }] }] },
  ]);
  const dn = D.diff(a, b, { resolve: names });
  const sw = dn.refs.find((r) => r.op === 'swapped');
  ok('a reference wears its cast-library name, character · look', sw.fromName === 'Blue pajamas' && sw.toName === 'Sophie · the blue pajamas');
  ok('a one-look entry is named by the character alone', names('https://x/pj-a.png') === 'Blue pajamas');
  // added and removed
  const c = { ...b, refs: b.refs.concat([{ url: 'https://x/extra.png', kind: 'image' }]) };
  ok('a slot only the newer clip has is added', D.refsDiff(b, c).some((r) => r.op === 'added' && r.slot === '[Image3]'));
  ok('a slot only the older clip has is removed', D.refsDiff(c, b).some((r) => r.op === 'removed' && r.slot === '[Image3]'));
  // the keyframes are their own lane and take no slot
  const k1 = { refs: [{ url: 'https://x/f1.png', kind: 'image', role: 'first' }, { url: 'https://x/p.png', kind: 'image' }] };
  const k2 = { refs: [{ url: 'https://x/f2.png', kind: 'image', role: 'first' }, { url: 'https://x/p.png', kind: 'image' }] };
  const kr = D.refsDiff(k1, k2);
  ok('a swapped first frame is its own row and the picture after it keeps [Image1]',
    kr.some((r) => r.slot === 'first frame' && r.op === 'swapped') && kr.some((r) => r.slot === '[Image1]' && r.op === 'same'));
  // a prompt with a removed line
  const dd = D.diff({ prompt: 'one\ntwo\nthree' }, { prompt: 'one\nthree' });
  ok('a removed line is struck whole', dd.prompt.some((t) => t.op === 'del' && t.t.trim() === 'two') && dd.words === 1);
  // previousOf — same project, next older
  const jobs = [
    { id: 'n', project: 'ward', sentAt: '2026-09-10T03:00:00Z' },
    { id: 'other', project: 'ticky', sentAt: '2026-09-10T02:30:00Z' },
    b, a,
    { id: 'z', project: '', sentAt: '2026-09-10T00:30:00Z' },
  ];
  ok('the clip before is the next older one in the SAME project', D.previousOf(jobs[0], jobs).id === 'b' && D.previousOf(b, jobs).id === 'a');
  ok('an unfiled clip is compared against the unfiled ones, not another project', D.previousOf({ id: 'q', project: '', sentAt: '2026-09-10T04:00:00Z' }, jobs).id === 'z');
  ok('the oldest has nothing before it', D.previousOf(jobs[4], jobs) === null);
  // KIN — the clip before is the nearest older NEAR-TWIN, not the one before
  // it in time (her screenshot: a 15s 9:16 clip against the 4s failed 3:4
  // clip that merely came before it)
  const stray = { id: 'stray', project: 'ward', prompt: 'a commercial for a witchcraft kit on a kitchen table, camera pushes in', sentAt: '2026-09-10T02:30:00Z' };
  const withStray = [jobs[0], stray, b, a];
  const kn = D.kinOf({ ...jobs[0], prompt: b.prompt + ' and waits' }, withStray);
  ok('an unrelated clip immediately before is skipped for the twin behind it', kn && kn.job.id === 'b' && kn.kin === true && kn.back === 2);
  const ks = D.kinOf(stray, withStray);
  ok('with no twin at all the plain previous clip answers, marked kin:false', ks && ks.job.id === 'b' && ks.kin === false && ks.back === 1);
  ok('previousOf follows kin', D.previousOf({ ...jobs[0], prompt: b.prompt }, withStray).id === 'b');
  ok('two twins measure alike, two strangers do not', D.similarity(a.prompt, b.prompt) >= D.KIN && D.similarity(a.prompt, stray.prompt) < D.KIN);
  // LINES FIRST — two unrelated prompts are a line out and a line in, never a
  // hash of matched "the"s; a reworded twin line lights only its words
  const un = D.wordDiff(stray.prompt, a.prompt);
  ok('unrelated prompts diff as whole lines: ' + JSON.stringify(un.map((t) => t.op)), un.every((t) => t.op !== 'same') && un.filter((t) => t.op === 'del').length === 1 && un.filter((t) => t.op === 'add').length === 1);
  const dstr = D.diff(stray, a);
  ok('and the summary calls it a different prompt', dstr.kin === false && /^a different prompt/.test(D.summary(dstr)));
  const tw = D.wordDiff('one line here\nsophie walks down the hall\nend', 'one line here\nsophie runs down the hall\nend');
  ok('a reworded twin line lights only the word: ' + JSON.stringify(tw), tw.filter((t) => t.op === 'del').map((t) => t.t.trim()).join() === 'walks' && tw.filter((t) => t.op === 'add').map((t) => t.t.trim()).join() === 'runs');
  const join = (d, side) => d.filter((t) => t.op === 'same' || t.op === side).map((t) => t.t).join('');
  [['a\nb', 'a\nb\nc\nd'], ['a\nb\nc', 'a'], ['', 'x\ny'], ['x\ny', ''], ['p\n\nq', 'p\n\nq\n\nr'], [stray.prompt, a.prompt], ['s\nt', 'u\nt']].forEach(([x, y], i) => {
    const d = D.wordDiff(x, y);
    ok('the line diff re-joins byte for byte to both prompts (case ' + i + ')', join(d, 'del') === x && join(d, 'add') === y);
  });
  // a pasted scene past the cap still answers, as one block
  const big = Array.from({ length: 1600 }, (_, i) => 'w' + i).join(' ');
  ok('a prompt past the size cap diffs as one block rather than hanging', D.wordDiff(big, big + ' x').length === 2);
}

// ── the page half ──────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('clip diff: playwright not installed — page half skipped'); report(); return; }
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
const base = { model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', resolution: '480p', ratio: '3:4', sound: true, status: 'done', vote: '', hidden: false, project: 'ward', poster: 'http://127.0.0.1:PORT/ref.png' };
let jobs = [
  { ...base, id: 'c3', prompt: 'sophie is the woman in [Video1]. she walks slowly down the hall, camera at eye level', seconds: 12, seed: 7,
    video: 'http://127.0.0.1:PORT/c3.mp4', refs: [{ url: 'http://127.0.0.1:PORT/jazz.mp4', kind: 'video', poster: 'http://127.0.0.1:PORT/ref.png' }, { url: 'http://127.0.0.1:PORT/pj-c.png', kind: 'image' }], sentAt: '2026-09-10T03:00:00.000Z' },
  // an UNRELATED ward clip right before c3 — the shape of her screenshot —
  // never the "clip before" for a twin further back
  { ...base, id: 'ux', prompt: 'a commercial for a witchcraft kit on a kitchen table, camera pushes in', seconds: 4, seed: 2, status: 'failed', ratio: '9:16',
    video: '', refs: [], sentAt: '2026-09-10T02:30:00.000Z' },
  { ...base, id: 'c2', prompt: 'sophie is the woman in [Video1]. she walks down the hall, camera at eye level', seconds: 8, seed: 7,
    video: 'http://127.0.0.1:PORT/c2.mp4', refs: [{ url: 'http://127.0.0.1:PORT/jazz.mp4', kind: 'video', poster: 'http://127.0.0.1:PORT/ref.png' }, { url: 'http://127.0.0.1:PORT/pj-a.png', kind: 'image' }], sentAt: '2026-09-10T02:00:00.000Z' },
  // another project between them — never the "clip before" for a ward clip
  { ...base, id: 'tt', project: 'ticky-tack', prompt: 'a red door', seconds: 4, seed: 1, video: 'http://127.0.0.1:PORT/tt.mp4', refs: [], sentAt: '2026-09-10T01:30:00.000Z' },
  { ...base, id: 'c1', prompt: 'sophie is the woman in [Video1]. she stands in the hall', seconds: 8, seed: 7,
    video: 'http://127.0.0.1:PORT/c1.mp4', refs: [{ url: 'http://127.0.0.1:PORT/jazz.mp4', kind: 'video', poster: 'http://127.0.0.1:PORT/ref.png' }, { url: 'http://127.0.0.1:PORT/pj-a.png', kind: 'image' }], sentAt: '2026-09-10T01:00:00.000Z' },
];
// off the page — the one the server answers when asked for what is under c1
let older = { ...base, id: 'c0', prompt: 'sophie sits in the hall', seconds: 4, seed: 3, video: 'http://127.0.0.1:PORT/c0.mp4', refs: [], sentAt: '2026-09-09T20:00:00.000Z' };
const asked = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname.endsWith('.png')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname.endsWith('.mp4')) { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      if (u.searchParams.get('before')) { asked.push(u.search); return json({ ok: true, jobs: [older], more: false }); }
      return json({ ok: true, jobs, more: true });
    }
    // the server's kin route — the REAL rule over the whole project, the
    // off-page clip included
    const km = u.pathname.match(/^\/api\/footage\/jobs\/([^/]+)\/kin$/);
    if (km) {
      asked.push(u.pathname);
      const all = jobs.concat([older]);
      const j = all.find((x) => x.id === km[1]);
      const k = j ? D.kinOf(j, all) : null;
      return json({ ok: true, job: k ? k.job : null, kin: k ? k.kin : false, back: k ? k.back : 0 });
    }
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'ward', name: 'The ward' }] });
    if (u.pathname === '/api/cast/' || u.pathname === '/api/cast') {
      return json({ ok: true, film: 'ward', films: [{ slug: 'ward', name: 'The ward' }], entries: [
        { slug: 'sophie', name: 'Sophie', looks: [
          { key: 'pj', name: 'the blue pajamas', refs: [{ url: `http://127.0.0.1:${server.address().port}/jazz.mp4`, kind: 'video' }, { url: `http://127.0.0.1:${server.address().port}/pj-c.png`, kind: 'image' }] },
          { key: 'street', name: 'street clothes', refs: [{ url: `http://127.0.0.1:${server.address().port}/street.png`, kind: 'image' }] }] },
        { slug: 'blue-pajamas', name: 'Blue pajamas', looks: [{ key: 'off', name: 'head off', refs: [{ url: `http://127.0.0.1:${server.address().port}/pj-a.png`, kind: 'image' }] }] },
      ] });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, items: [] });
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) return json({ ok: true });
    res.writeHead(404); res.end('nope');
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  jobs = JSON.parse(JSON.stringify(jobs).replace(/PORT/g, String(port)));
  older = JSON.parse(JSON.stringify(older).replace(/PORT/g, String(port)));
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-c3');
  await page.waitForTimeout(400);
  ok('no page errors', errors.length === 0);
  ok('the panel is shut until she asks', await page.$eval('#cmp', (e) => e.hidden));
  ok('every card carries the compare mark', (await page.$$('#feed .job .cmpb')).length === 5);

  // ONE TAP: this clip against the one before it in its project
  await page.click('#job-c3 .cmpb');
  await page.waitForSelector('#cmp:not([hidden])');
  await page.waitForTimeout(500);   // the cast names land
  ok('the panel opened', !(await page.$eval('#cmp', (e) => e.hidden)));
  ok('the page behind it is locked', await page.evaluate(() => document.body.style.overflow === 'hidden'));
  const before = await page.$eval('#cmp .cpair .cclip:first-child', (e) => e.textContent);
  ok('the other side is c2 — the nearest ward TWIN, not the unrelated ward clip right before it nor the ticky-tack one', /8s/.test(before) && !/4s/.test(before));
  ok('the twin was found on the page, nothing asked of the server yet', asked.length === 0);
  const adds = await page.$$eval('#cmp .cprompt .dadd', (els) => els.map((e) => e.textContent.trim()));
  const dels = await page.$$eval('#cmp .cprompt .ddel', (els) => els.map((e) => e.textContent.trim()));
  ok('the one added word is lit and nothing is struck — got ' + JSON.stringify(adds) + ' / ' + JSON.stringify(dels), adds.length === 1 && adds[0] === 'slowly' && dels.length === 0);
  const litBg = await page.$eval('#cmp .cprompt .dadd', (e) => getComputedStyle(e).backgroundColor);
  ok('the lit word really paints (a class whose CSS never landed is invisible)', litBg !== 'rgba(0, 0, 0, 0)' && litBg !== 'transparent');
  const setRows = await page.$$eval('#cmp .cset .k', (els) => els.map((e) => e.textContent));
  ok('one settings row, seconds — the unchanged seed is not a row: ' + setRows.join(','), setRows.length === 1 && setRows[0] === 'seconds');
  ok('it reads 8s → 12s', await page.$eval('#cmp .cset .v', (e) => e.textContent) === '8s12s');
  const refRows = await page.$$eval('#cmp .cref', (els) => els.map((e) => e.className.replace('cref ', '') + ':' + e.querySelector('.rslot').textContent));
  ok('references slot by slot — [Image1] swapped, [Video1] same: ' + refRows.join(' '), refRows.indexOf('swapped:[Image1]') >= 0 && refRows.indexOf('same:[Video1]') >= 0 && refRows.length === 2);
  const names = await page.$eval('#cmp .cref.swapped', (e) => Array.from(e.querySelectorAll('.rname')).map((n) => n.textContent));
  ok('the swapped picture wears its cast-library name, not a filename: ' + names.join(' → '), names[0] === 'Blue pajamas' && names[1] === 'Sophie · the blue pajamas');
  ok('the summary says it in one line', /1 word · seconds 8s → 12s · \[Image1\] swapped/.test(await page.$eval('#cmp .csum', (e) => e.textContent)));
  ok('the walk says how far back the other side is (the stray counts)', await page.$eval('#cmp .cwhich', (e) => e.textContent) === '2 clips back');

  // WALK OLDER: the other side steps to c1 (skipping the other project)
  await page.click('#cmpolder');
  await page.waitForTimeout(100);
  ok('older walks the other side to c1, three clips back', await page.$eval('#cmp .cwhich', (e) => e.textContent) === '3 clips back');
  const dels2 = await page.$$eval('#cmp .cprompt .ddel', (els) => els.map((e) => e.textContent.trim()));
  ok('against c1 the words she took out are struck: ' + JSON.stringify(dels2), dels2.length >= 1 && dels2.join(' ').indexOf('stands') >= 0);
  // OLDER PAST THE PAGE: asked of the server, off the cursor
  await page.click('#cmpolder');
  await page.waitForTimeout(400);
  ok('a clip older than the page holds is asked of the server\'s kin route for c1: ' + asked.join(','), asked.length === 1 && asked[0] === '/api/footage/jobs/c1/kin');
  ok('and it becomes the other side', /4s/.test(await page.$eval('#cmp .cpair .cclip:first-child', (e) => e.textContent)));
  ok('the fetched clip did NOT land on the feed (the … older cursor is untouched)', (await page.$$('#feed .job')).length === 5);
  await page.click('#cmpnewer');
  await page.waitForTimeout(100);
  ok('newer walks back', await page.$eval('#cmp .cwhich', (e) => e.textContent) === '3 clips back');

  // PICK: close, the mark on c3 lights, tapping c1's mark compares c3 against c1
  await page.click('#cmppick');
  await page.waitForTimeout(100);
  ok('pick closes the panel and lights the mark on the clip it is for', await page.$eval('#cmp', (e) => e.hidden) && await page.$eval('#job-c3 .cmpb', (e) => e.classList.contains('on')));
  ok('and the page is unlocked while she picks', await page.evaluate(() => document.body.style.overflow === ''));
  await page.click('#job-c1 .cmpb');
  await page.waitForSelector('#cmp:not([hidden])');
  ok('the pick lands: c3 against c1', await page.$eval('#cmp .cwhich', (e) => e.textContent) === '3 clips back' && /12s/.test(await page.$eval('#cmp .cpair .cclip:last-child', (e) => e.textContent)));
  ok('the pick mark is off again', !(await page.$eval('#job-c3 .cmpb', (e) => e.classList.contains('on'))));

  // the ✕ and the app's chevron both close it, back where she was
  await page.click('#cmpclose');
  ok('✕ closes', await page.$eval('#cmp', (e) => e.hidden) && await page.evaluate(() => document.body.style.overflow === ''));
  await page.click('#job-c2 .cmpb');
  await page.waitForSelector('#cmp:not([hidden])');
  ok('__navBack closes it and answers true', await page.evaluate(() => window.__navBack()) && await page.$eval('#cmp', (e) => e.hidden));

  // A CLIP WITH NO TWIN: the panel says "a different prompt" and paints no hash
  await page.click('#job-ux .cmpb');
  await page.waitForSelector('#cmp:not([hidden])');
  await page.waitForTimeout(500);
  ok('a clip with no twin still opens, on the plain clip before it', /8s/.test(await page.$eval('#cmp .cpair .cclip:first-child', (e) => e.textContent)));
  ok('and says the prompt is different rather than lighting a hash of words', /a different prompt/.test(await page.$eval('#cmp .csum', (e) => e.textContent)) && (await page.$$('#cmp .cprompt .dadd, #cmp .cprompt .ddel')).length === 0);
  ok('this clip\'s own words are shown plain', /witchcraft kit/.test(await page.$eval('#cmp .cprompt', (e) => e.textContent)));
  await page.click('#cmpclose');

  // identical clips say so
  await page.evaluate(() => { window.__cmpTest = 1; });
  await page.click('#job-c2 .cmpb');
  await page.waitForSelector('#cmp:not([hidden])');
  await page.click('#cmppick');
  await page.click('#job-c2 .cmpb');   // same card twice = cancel
  ok('tapping the lit mark again cancels the pick', await page.$eval('#cmp', (e) => e.hidden) && !(await page.$eval('#job-c2 .cmpb', (e) => e.classList.contains('on'))));

  // PHOTO
  await page.click('#job-c3 .cmpb');
  await page.waitForSelector('#cmp:not([hidden])');
  await page.waitForTimeout(400);
  const shot = process.env.CLIP_DIFF_SHOT;
  if (shot) await page.screenshot({ path: shot, fullPage: false });

  ok('no page errors at the end', errors.length === 0);
  if (errors.length) console.log(errors);
  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
