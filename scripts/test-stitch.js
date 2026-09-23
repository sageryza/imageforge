#!/usr/bin/env node
/* STITCH — pick clips, put them in order, ffmpeg joins them (2026-09-12,
   Sophie: "something very simple. We're just select clips and then move them
   around and ffmpeg stitches them together … it could be called stitch").

   THE FIXTURES CARRY REAL-SHAPED IDS, AND THAT IS THE POINT. The first
   version of this file used `id:'b'` and `key:'p1'`, so a pickable id was
   `b:p1` — four characters — and the bug that made EVERY trimmed part on her
   log unpickable (its id is `<job id>:<40-char sha1 trim key>`, 61-77
   characters, against cut-model's 40-char key cap) could not be seen from
   here: 57 assertions passed with it live. So every job id below is a real
   Atlas 32-hex or Firestore 20-char id and every trim key is a real sha1.

   The pure half is stitch.js: the pickables off the Footage log (a trimmed
   clip's PARTS beside the whole), the key derivation, the order arithmetic
   (arrows, a typed number, ✕, the duplicate, a pick that never doubles), the
   length fill that keeps a clip the log has no duration for from being
   dropped silently, and the stale-job reading. The page keeps a MIRROR of the
   order rules (`window.__stitchRules`) so a tap answers on the spot; the
   browser half drives that mirror over the same fixtures as the module, so
   the two cannot drift.

   The page half drives the REAL public/stitch.html in headless Chromium
   against a stub that RECORDS what the page really POSTs — a lit tile says
   nothing about what left the phone — and MEASURES the rest: three across off
   the real cells, the play chip clear of the pick target, a control in the
   pill's band really taking its own tap (elementFromPoint), the render row
   off the poll, the chevron unwinding instead of pushing.

   Run: node scripts/test-stitch.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond, got) => { if (cond) pass += 1; else fails.push(what + (got !== undefined ? '  [got: ' + got + ']' : '')); };
function report() {
  if (fails.length) { console.log('STITCH — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('STITCH — ' + pass + ' passed');
}

const S = require('../stitch');
const CutModel = require('../cut-model');

// ── the fixtures: REAL-SHAPED IDS ────────────────────────────────────────
const JOB_A = '27fcbe6e73354f0599715eb38dee352f';          // an Atlas job id, 32 hex
const JOB_B = 'aY9LbIGMe9T5lEcA984a';                       // a Firestore id, 20 chars
const JOB_C = 'ee0f9a48-57c5-4e91-b222-90fe5fd489ab';       // a uuid, 36 chars
const K1 = crypto.createHash('sha1').update('b|1|5').digest('hex');   // trimPlan's own key shape
const K2 = crypto.createHash('sha1').update('b|8|14').digest('hex');
const K3 = crypto.createHash('sha1').update('b|0|1').digest('hex');
const PART1 = JOB_B + ':' + K1;

const cards = [
  { id: JOB_A, status: 'done', video: 'https://x/a.mp4', source: 'https://x/a.mp4', poster: 'https://x/a.jpg', prompt: 'same ppl in [Video1] in a doctors office examination room she: "i\'ve been stressed"', seconds: 12, sentAt: '2026-09-12T06:08', project: 'witch', folder: '', trims: [], vote: 'like', chat: 'footage', ratio: '16:9', model: '2.5', modelLabel: '2.5' },
  { id: JOB_B, status: 'done', video: 'https://x/b-part1.mp4', source: 'https://x/b.mp4', poster: 'https://x/b.jpg', prompt: 'sophie hums as she skips around her suburban neighborhood', seconds: 15, sentAt: '2026-09-12T04:31', project: 'witch', folder: 'chamomile', chat: 'footage', ratio: '9:16', model: 'mini', modelLabel: 'Mini', vote: 'dislike',
    trims: [{ key: K1, status: 'ready', url: 'https://x/b-part1.mp4', poster: 'https://x/b1.jpg', start: 1, end: 5, seconds: 4 }, { key: K2, status: 'ready', url: 'https://x/b-part2.mp4', poster: '', start: 8, end: 14, seconds: 6 }, { key: K3, status: 'baking', url: '', start: 0, end: 1 }] },
  { id: 'Ic7ZjPH7fOoDPnxyfW5w', status: 'done', video: 'https://x/n.mp4', source: 'https://x/n.mp4', poster: '', prompt: 'Nurse Edna: the nurse in [Image1] at the desk', seconds: null, sentAt: '2026-09-12T03:00', project: 'ward', chat: 'ward-film', ratio: '3:4', model: 'mini', modelLabel: 'Mini' },
  { id: JOB_C, status: 'drawing', video: '', source: '', prompt: 'still drawing', seconds: 4, sentAt: '2026-09-12T07:00', trims: [] },
  { id: 'd0d0d0d0d0d0d0d0d0d0', status: 'failed', video: '', source: '', prompt: 'refused', seconds: 4, sentAt: '2026-09-12T07:01', trims: [] },
  { id: 'e0e0e0e0e0e0e0e0e0e0', status: 'done', video: 'https://x/e.mp4', source: 'https://x/e.mp4', poster: '', prompt: 'hidden one', seconds: 4, sentAt: '2026-09-12T07:02', hidden: true, trims: [] },
];

// ── the pure half ────────────────────────────────────────────────────────
const picks = S.pickables(cards);
const byId = Object.fromEntries(picks.map((p) => [p.id, p]));
ok('a finished clip is a pickable, a drawing / failed / hidden one is not',
  picks.length === 5 && !picks.some((p) => /^(ee0f|d0d0|e0e0)/.test(p.id)));
ok('every baked part rides beside the whole, and one still baking does not',
  Boolean(byId[PART1]) && Boolean(byId[JOB_B + ':' + K2]) && !byId[JOB_B + ':' + K3] && Boolean(byId[JOB_B]));
ok('newest first', picks[0].id === JOB_A);
ok('a part carries its own length, the whole carries the clip\'s',
  byId[PART1].seconds === 4 && byId[JOB_B].seconds === 15);
ok('a clip the log has no duration for is still offered, with no length',
  Boolean(byId['Ic7ZjPH7fOoDPnxyfW5w']) && !(byId['Ic7ZjPH7fOoDPnxyfW5w'].seconds > 0));
ok('the title is the prompt\'s first words, never the url', /^same ppl in \[Video1\] in a doctors…$/.test(byId[JOB_A].title) && !/https/.test(byId[JOB_A].title));
ok('and a mark line says WHICH take — seconds, the model, the day',
  /^12s · 2\.5 · Sep \d+/.test(byId[JOB_A].mark) && /part 1$/.test(byId[PART1].mark));
ok('every pickable carries the haystack the server searches, so the page filters on the same words',
  /doctors office/.test(byId[JOB_A].hay) && /trimmed part 1/.test(byId[PART1].hay) && /Mini/.test(byId[JOB_B].hay));
ok('the vote rides along, so the picker can honour her ♥ and ✕',
  byId[JOB_A].vote === 'like' && byId[JOB_B].vote === 'dislike');

// THE REGRESSION: a trimmed part's id is 61-77 characters.
ok('a trimmed part\'s pickable id really is longer than cut-model\'s old 40-char cap',
  PART1.length === 61 && byId[JOB_B + ':' + K2].id.length === 61);
ok('the key is the WHOLE pickable id — not a stump', S.keyOf(PART1, 1) === PART1 && S.clipOf(byId[PART1], 1).key === PART1);
ok('and cut-model keeps it through a save', CutModel.cleanPiece({ key: PART1, url: 'https://x/b.mp4', out: 4 }).key === PART1);
ok('pickIdOf reads the pickable back off a key, instance and all',
  S.pickIdOf(PART1) === PART1 && S.pickIdOf(PART1 + '#3') === PART1 && S.pickIdOf(JOB_A) === JOB_A);
ok('a job id that happens to contain a # is not read as an instance', S.pickIdOf('#4') === '#4');
(() => {
  let list = [];
  for (let i = 0; i < 3; i++) list = S.addPick(list, byId[PART1]);
  ok('THREE TAPS ON A TRIMMED PART ARE ONE ROW, not three (the 2026-09-13 bug)', list.length === 1);
  let whole = [];
  for (let i = 0; i < 3; i++) whole = S.addPick(whole, byId[JOB_A]);
  ok('and a whole clip is the same', whole.length === 1);
})();

const L = [{ key: '1' }, { key: '2' }, { key: '3' }, { key: '4' }];
const keys = (l) => l.map((c) => c.key).join('');
ok('the arrow steps one, and clamps at the ends', keys(S.moveBy(L, 2, -1)) === '1324' && keys(S.moveBy(L, 0, -1)) === '1234' && keys(S.moveBy(L, 3, 1)) === '1234');
ok('a typed number is 1-based and clamps', keys(S.moveTo(L, 3, 1)) === '4123' && keys(S.moveTo(L, 0, 99)) === '2341' && keys(S.moveTo(L, 0, 0)) === '1234');
ok('✕ takes exactly one out', keys(S.dropAt(L, 1)) === '134' && keys(S.dropAt(L, 9)) === '1234');
ok('nothing ever changes the length but ✕ and a pick', S.moveBy(L, 1, 2).length === 4 && S.moveTo(L, 0, 3).length === 4);

// A SHOT RIDES TWICE
(() => {
  let list = S.addPick([], byId[JOB_A]);
  list = S.dupAt(list, 0);
  ok('the duplicate lands RIGHT AFTER itself with its own instance key',
    list.length === 2 && list[0].key === JOB_A && list[1].key === JOB_A + '#2' && list[1].url === list[0].url);
  ok('and both places are reported against the one pickable', (S.placesOf(list)[JOB_A] || []).join(',') === '1,2');
  list = S.dupAt(list, 0);
  ok('a third instance takes the next free number', list.map((c) => c.key).join('|') === JOB_A + '|' + JOB_A + '#3|' + JOB_A + '#2');
  ok('the tile\'s second tap takes EVERY instance out', S.dropPick(list, JOB_A).length === 0);
  ok('a save keeps all three, because the key is what tells them apart', S.cleanClips(list.map((c) => ({ ...c, seconds: 4, out: 4 }))).length === 3);
})();
ok('addPick refuses past the cap', S.addPick(new Array(S.MAX_CLIPS).fill({ key: 'x' }), byId[JOB_A]).length === S.MAX_CLIPS);
ok('and so does the duplicate', S.dupAt(new Array(S.MAX_CLIPS).fill({ key: 'x', url: 'https://x/a.mp4' }), 0).length === S.MAX_CLIPS);

ok('a piece is the WHOLE clip: in 0, out its length, kind video',
  (() => { const c = S.clipOf(byId[JOB_A], 1); return c.in === 0 && c.out === 12 && c.kind === 'video' && c.seconds === 12; })());
ok('cleanClips is cut-model\'s own cleaner: https only, in forced to 0',
  (() => { const c = S.cleanClips([{ key: 'a', url: 'https://x/a.mp4', out: 12, in: 3 }, { key: 'z', url: 'http://x/z.mp4', out: 4 }, { key: 'y', url: 'https://x/y.mp4' }]); return c.length === 1 && c[0].in === 0 && c[0].out === 12; })());
ok('totalSeconds sums the pieces', S.totalSeconds(S.cleanClips([{ key: 'a', url: 'https://x/a.mp4', out: 12 }, { key: 'b', url: 'https://x/b.mp4', out: 4.5 }])) === 16.5);

// ── FROM FOOTAGE'S STITCH MODE (2026-09-23: "select the clips and add
// numbers to them · and then they go to the stitch area in that order") ──
(() => {
  const r = S.fromPicks(picks, [JOB_B + ':' + K2, JOB_A, PART1]);
  ok('the numbers she put on the tiles ARE the order — the parts and the whole clip exactly as sent',
    r.list.map((c) => c.key).join('|') === JOB_B + ':' + K2 + '|' + JOB_A + '|' + PART1 && r.missing.length === 0);
  ok('each row is the clip a tap on Stitch would have made (url, length, title)',
    r.list[0].url === 'https://x/b-part2.mp4' && r.list[2].seconds === 4 && r.list[1].title === byId[JOB_A].title);
  const m = S.fromPicks(picks, [JOB_A, JOB_C, 'e0e0e0e0e0e0e0e0e0e0', JOB_B + ':' + K3]);
  ok('a clip still drawing, a hidden one and a part still baking are NAMED as missing, never dropped quietly',
    m.list.length === 1 && m.missing.join('|') === JOB_C + '|e0e0e0e0e0e0e0e0e0e0|' + JOB_B + ':' + K3);
  const twice = S.fromPicks(picks, [JOB_A, JOB_A]);
  ok('an id sent twice rides twice, with its own instance key', twice.list.length === 2 && twice.list[1].key === JOB_A + '#2');
  ok('the job a part belongs to is read off its id', S.jobOfPick(PART1) === JOB_B && S.jobOfPick(JOB_A) === JOB_A);
  ok('nothing at all is an empty order, not a throw', S.fromPicks(picks, null).list.length === 0);
  const src = fs.readFileSync(path.join(ROOT, 'stitch.js'), 'utf8');
  ok('the route reads ONLY the jobs the ids name, never the whole log',
    /jobIds\.map\(\(j\) => d\.collection\(videoLog\.COLL\)\.doc\(j\)\.get\(\)\)/.test(src));
  ok('and it sits above GET /:id', src.indexOf("router.post('/from-footage'") < src.indexOf("router.get('/:id'"));
})();

// ── THE FILE IS THE TRUTH ABOUT ITS OWN LENGTH ──────────────────────────
(async () => {
  const fe = require('../filmeditor');
  const asked = [];
  const realProbe = fe.probeUrl;
  fe.probeUrl = async (u) => { asked.push(u); return u === 'https://x/dead.mp4' ? null : { seconds: 4.042 }; };
  // a clip the log has no duration for would be DROPPED by cleanPieces
  ok('cut-model really does drop a piece with no length — that is the silent loss',
    S.cleanClips([{ key: 'k', url: 'https://x/n.mp4', seconds: null, in: 0, out: 0 }]).length === 0);
  const filled = await S.fillLengths([{ key: 'k', url: 'https://x/n.mp4', seconds: null, in: 0, out: 0 }], { only: 'unknown' });
  ok('so the length is probed off the file before anything is saved',
    filled[0].seconds === 4.042 && filled[0].out === 4.042 && S.cleanClips(filled).length === 1);
  asked.length = 0;
  await S.fillLengths([{ key: 'k', url: 'https://x/n.mp4', seconds: 9, in: 0, out: 9 }], { only: 'unknown' });
  ok('a clip whose length is already known is not probed again on a save', asked.length === 0);
  asked.length = 0;
  const all = await S.fillLengths([{ key: 'k', url: 'https://x/four.mp4', seconds: 4, in: 0, out: 4 }]);
  ok('but the RENDER measures every one — a "4s" clip is 24·s+1 frames, so `out: 4` cut its last frame',
    all[0].out === 4.042 && asked.length === 1);
  asked.length = 0;
  await S.fillLengths([{ key: 'k', url: 'https://x/four.mp4', seconds: 4, in: 0, out: 4 }]);
  ok('and a url is read once per boot — the cache means a re-render probes nothing', asked.length === 0);
  const dead = await S.fillLengths([{ key: 'k', url: 'https://x/dead.mp4', seconds: null, in: 0, out: 0 }], { only: 'unknown' });
  ok('a source that cannot be read is left as it is, to be named back rather than guessed at', !(dead[0].out > 0));
  fe.probeUrl = realProbe;

  // ── a dead job says so ──
  const fresh = { kind: 'render', status: 'running', startedAt: new Date().toISOString() };
  const dead2 = { kind: 'render', status: 'running', startedAt: new Date(Date.now() - S.STALE_MS - 60000).toISOString() };
  ok('a running job is running', S.jobView(fresh).status === 'running');
  ok('a running job older than the takeover window reads as a dead one, so the button comes back',
    S.jobView(dead2).status === 'error' && S.jobView(dead2).stale === true);
  ok('and a finished job is untouched', S.jobView({ status: 'done' }).status === 'done' && S.jobView(null) === null);
  ok('the shelf row hides a stale job rather than saying "stitching…" for good',
    S.trimmed({ id: 's', clips: [], renders: [], job: dead2 }).job === null && S.trimmed({ id: 's', clips: [], renders: [], job: fresh }).job !== null);

  ok('stitch/ renders are never harvested back onto the Chunking shelf', require('../clips').SKIP_PREFIXES.includes('stitch/'));
  ok('the module reuses Footage\'s own readers rather than keeping a second copy',
    /require\('\.\/footage'\)/.test(fs.readFileSync(path.join(ROOT, 'stitch.js'), 'utf8'))
    && /footage\.foldersOf|footage\.hayOf|footage\.cardOf/.test(fs.readFileSync(path.join(ROOT, 'stitch.js'), 'utf8')));
  ok('and the render is filmeditor\'s renderCut, not a fourth copy of the recipe',
    /filmeditor\.renderCut/.test(fs.readFileSync(path.join(ROOT, 'stitch.js'), 'utf8')));

  await pageHalf();
})().catch((e) => { console.error(e); process.exit(1); });

// ── the page half ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { chromium = null; }
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

async function pageHalf() {
  if (!chromium) { console.log('stitch: playwright not installed — page half skipped'); return report(); }
  const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const PAGE_SRC = fs.readFileSync(path.join(PUB, 'stitch.html'), 'utf8');

  const store = {};
  const posts = [];
  let jobTicks = 0, BUILD = 'build-one', STALE = false;
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const b = body ? JSON.parse(body) : {};
      if (u.pathname === '/stitch') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(PAGE_SRC.replace('__STUDIO_TOKEN__', '') + PILL + '<script>window.__forgeBuild="build-one"</script>');
      }
      if (/\.(jpg|png|mp4)$/.test(u.pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
      if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'witch', name: 'Secretly a Witch' }, { slug: 'ward', name: 'The ward' }] });
      if (u.pathname === '/api/stitch/status') return json({ ok: true, chat: 'stitch' });
      if (u.pathname === '/api/stitch/build') return json({ build: BUILD });
      if (u.pathname === '/api/stitch/clips') {
        const cs = cards.map((c) => ({ ...c, poster: c.poster ? c.poster.replace('https://x', '') : '', trims: (c.trims || []).map((t) => ({ ...t, poster: t.poster ? t.poster.replace('https://x', '') : '' })) }));
        const proj = u.searchParams.get('project') || '';
        const q = (u.searchParams.get('q') || '').trim().toLowerCase();
        let all = S.pickables(cs).filter((p) => !proj || p.project === proj);
        if (q) all = all.filter((p) => String(p.hay || '').toLowerCase().indexOf(q) >= 0);
        const off = Number(u.searchParams.get('offset') || 0);
        const lim = Number(u.searchParams.get('limit') || 60);
        posts.push({ path: 'clips?', q, proj, off });
        return json({ ok: true, clips: all.slice(off, off + lim), offset: off, more: all.length > off + lim, total: all.length, folders: { witch: ['chamomile'] } });
      }
      if (u.pathname === '/api/stitch/' || u.pathname === '/api/stitch') {
        if (req.method === 'POST') { const id = 's' + (Object.keys(store).length + 1); store[id] = { id, title: 'Stitch · test', project: b.project || '', clips: [], renders: [], job: null, updatedAt: Date.now() }; posts.push({ path: '/', body: b }); return json({ id, title: store[id].title }); }
        return json({ stitches: Object.values(store).filter((s) => !s.hidden).map(S.trimmed) });
      }
      const m = /^\/api\/stitch\/([^/]+)(?:\/(\w+))?$/.exec(u.pathname);
      if (m) {
        const d = store[m[1]]; if (!d) return json({ error: 'no such stitch' }, 404);
        if (!m[2]) return json({ ...d, job: S.jobView(d.job) });
        if (m[2] === 'clips') {
          // the stub stands in for the probe: a clip with no length cannot be
          // read, so cleanPieces drops it and the route names it back
          const asked = b.clips || [];
          const saved = S.cleanClips(asked);
          const kept = new Set(saved.map((c) => c.key));
          const dropped = asked.filter((c) => !kept.has(c.key)).map((c) => c.title || 'a clip');
          d.clips = saved;
          posts.push({ path: 'clips', id: m[1], body: b });
          return json({ ok: true, clips: saved.length, dropped, saved });
        }
        if (m[2] === 'title') { d.title = b.title; posts.push({ path: 'title', body: b }); return json({ ok: true }); }
        if (m[2] === 'hide') { d.hidden = b.hidden !== false; posts.push({ path: 'hide', id: m[1] }); return json({ ok: true, hidden: d.hidden }); }
        if (m[2] === 'render') {
          posts.push({ path: 'render', id: m[1], clips: (d.clips || []).map((c) => c.key).join(',') });
          d.job = STALE
            ? { kind: 'render', status: 'running', startedAt: new Date(Date.now() - S.STALE_MS - 60000).toISOString(), label: 'piece 1 of 2' }
            : { kind: 'render', status: 'running', label: 'starting', startedAt: new Date().toISOString() };
          jobTicks = 0; return json({ ok: true });
        }
        if (m[2] === 'job') {
          if (d.job && d.job.status === 'running' && !STALE && ++jobTicks >= 2) { d.job = { kind: 'render', status: 'done' }; d.renders.unshift({ url: '/film-1.mp4', at: Date.now(), seconds: 16, clips: d.clips.length }); }
          return json({ job: S.jobView(d.job), renders: d.renders });
        }
      }
      json({ error: 'stub: ' + req.method + ' ' + u.pathname }, 404);
    });
  });

  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  const tile = (id) => page.locator('#tiles .cell[data-id="' + id + '"] .face');
  const cell = (id) => page.locator('#tiles .cell[data-id="' + id + '"]');
  try {
    await page.goto(base + '/stitch', { waitUntil: 'networkidle' });
    ok('the shelf opens, empty', await page.evaluate(() => !document.getElementById('shelf').hidden && !document.getElementById('shelfempty').hidden));
    ok('the title is on screen once', (await page.locator('h1').count()) === 1);

    // the page's mirror of the order rules against the module over one fixture
    const mirror = await page.evaluate((args) => {
      const R = window.__stitchRules; const k = (l) => l.map((c) => c.key).join('|');
      const L = args.L, p = args.p;
      return [k(R.moveBy(L, 2, -1)), k(R.moveTo(L, 3, 1)), k(R.dropAt(L, 1)),
        String(R.addPick(R.addPick([], p), p).length),
        k(R.dupAt(R.addPick([], p), 0)),
        R.pickIdOf(p.id + '#2'),
        String(R.dropPick(R.dupAt(R.addPick([], p), 0), p.id).length)];
    }, { L, p: byId[PART1] });
    const mine = [keys(S.moveBy(L, 2, -1)).split('').join('|'), keys(S.moveTo(L, 3, 1)).split('').join('|'), keys(S.dropAt(L, 1)).split('').join('|'),
      String(S.addPick(S.addPick([], byId[PART1]), byId[PART1]).length),
      S.dupAt(S.addPick([], byId[PART1]), 0).map((c) => c.key).join('|'),
      S.pickIdOf(PART1 + '#2'),
      String(S.dropPick(S.dupAt(S.addPick([], byId[PART1]), 0), PART1).length)];
    ok('the page\'s order rules answer exactly what stitch.js answers — on a REAL trimmed-part id', mirror.join('§') === mine.join('§'));

    await page.click('#newstitch');
    await page.waitForSelector('#open:not([hidden])');
    ok('a new stitch opens on its own page, the url carrying it', /[?&]s=s1/.test(await page.evaluate(() => location.search)));
    await page.waitForSelector('#tiles .cell');
    // DEFAULT ON (2026-09-14, Sophie: "default to hide x") — measured on the
    // untouched picker, then put DOWN for the rest of this pass: JOB_B is ✕'d
    // and everything below is about picking and ordering its parts. The
    // filter's own section turns it back on.
    {
      const start = await page.evaluate((id) => ({
        lit: document.getElementById('v-hidex').classList.contains('on'),
        xed: [...document.querySelectorAll('#tiles .cell')].some((c) => c.dataset.id.indexOf(id) === 0) }), JOB_B);
      ok('the picker opens with the ✕\'d clip and its parts already gone, and the box lit', start.lit && !start.xed);
      await page.click('#v-hidex');
      await page.waitForTimeout(250);
    }
    ok('the picker shows every pickable as a tile — both parts and both wholes', (await page.locator('#tiles .cell').count()) === 5);
    ok('and opens on TILES, three across — MEASURED off the real cells', await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#tiles .cell')];
      const top = cells[0].getBoundingClientRect().top;
      return !document.getElementById('tiles').hidden && cells.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2).length === 3;
    }));
    ok('every poster is lazy — 300 pickables must not fetch 300 posters on open', await page.evaluate(() => {
      const im = [...document.querySelectorAll('#tiles img, #feed img')];
      return im.length > 0 && im.every((i) => i.getAttribute('loading') === 'lazy');
    }));
    ok('the shared switch is the one box with the three segments', await page.evaluate(() => !!document.querySelector('#feedbar .viewtog #v-list') && document.getElementById('v-cols').textContent === '3'));
    await page.click('#v-cols');
    ok('the number segment goes to four, and the wall follows', await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#tiles .cell')];
      const top = cells[0].getBoundingClientRect().top;
      return document.getElementById('v-cols').textContent === '4' && cells.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2).length === 4;
    }));
    await page.click('#v-list');
    ok('LIST is a box per clip, the wall away', await page.evaluate(() => document.getElementById('tiles').hidden && !document.getElementById('feed').hidden && document.querySelectorAll('#feed .crow').length === 5));
    ok('and the view is remembered under the page\'s own key', await page.evaluate(() => localStorage.getItem('stitch_view') === 'list' && localStorage.getItem('stitch_cols') === '4'));
    await page.click('#v-tiles');

    // ── HER FIRST ASK: PLAY IT BEFORE YOU PICK IT ──
    ok('the play chip is clear of the pick target — MEASURED, not asserted in markup', await page.evaluate((id) => {
      const c = document.querySelector('#tiles .cell[data-id="' + id + '"]');
      const face = c.querySelector('.face'), play = c.querySelector('.tdoor');
      if (!play) return false;
      const cr = c.getBoundingClientRect(), pr = play.getBoundingClientRect();
      // the tile's own centre must still reach the FACE, not the play chip
      const mid = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      const onPlay = document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2);
      return (mid === face || face.contains(mid)) && (onPlay === play || play.contains(onPlay));
    }, JOB_A));
    await cell(JOB_A).locator('.tdoor').click();
    await page.waitForTimeout(200);
    ok('it plays the clip WITHOUT picking it', await page.evaluate(() => !document.getElementById('player').hidden && !!document.querySelector('#player video') && document.querySelectorAll('#order .orow').length === 0 && document.body.style.overflow === 'hidden'));
    ok('the film wears OUR transport, never iOS\'s tinting controls overlay', await page.evaluate(() => {
      const v = document.querySelector('#player video');
      return !v.controls && !!document.querySelector('#player .pstage.filmbar-host');
    }));
    ok('and tap-to-note is hosted on the STAGE, so nothing it draws lands on the page\'s own row', await page.evaluate(() => !!document.querySelector('#player .pstage.filmnote-host')));
    // MEASURED: the transport anchors to its wrap's BOTTOM, so a centred
    // stage leaves the bar at the foot of the screen with the film floating
    // above it — PHOTOgraphed, and invisible to any markup assertion.
    ok('the transport sits directly under the picture, not at the foot of the screen', await page.evaluate(() => {
      const v = document.querySelector('#player video'), bar = document.querySelector('#player .filmbar');
      if (!bar) return false;
      const vr = v.getBoundingClientRect(), br = bar.getBoundingClientRect();
      return Math.abs(br.top - vr.bottom) <= 6;
    }));
    // THE WAY OUT, on a portrait clip: the .pbar row is backdrop
    ok('the ✕ really takes its own tap', await page.evaluate(() => {
      const x = document.querySelector('#player .pclose'), r = x.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit === x || x.contains(hit);
    }));
    await page.locator('#player .pclose').click();
    await page.waitForTimeout(150);
    ok('and the page is put back exactly where it was', await page.evaluate(() => document.getElementById('player').hidden && !document.querySelector('#player video') && document.body.style.overflow === ''));

    // ── picking ──
    await tile(PART1).click();
    await tile(JOB_A).click();
    await page.waitForTimeout(800);
    ok('THREE TAPS ON A TRIMMED PART DO NOT MAKE THREE ROWS — the tile lights and carries its place',
      await (async () => {
        await tile(PART1).click(); await page.waitForTimeout(250);   // takes it out
        await tile(PART1).click(); await page.waitForTimeout(250);   // back in, at the end
        await tile(PART1).click(); await page.waitForTimeout(250);   // out again
        await tile(PART1).click(); await page.waitForTimeout(400);   // in
        return page.evaluate((id) => {
          const c = document.querySelector('#tiles .cell[data-id="' + id + '"]');
          return document.querySelectorAll('#order .orow').length === 2 && c.classList.contains('picked') && c.querySelector('.pn').textContent === '2';
        }, PART1);
      })());
    ok('the list row wears the same place', await page.evaluate((id) => document.querySelector('#feed .crow[data-id="' + id + '"] .pn').textContent === '2', PART1));
    ok('and the order row says WHICH take it is, not just the prompt', await page.evaluate(() => /\ds · /.test(document.querySelectorAll('#order .orow .tt i')[0].textContent)));
    // MEASURED, because a row whose title is crushed to "sop…" over "6s …"
    // renders perfectly and says nothing — PHOTOgraphed at 390pt with the
    // four controls on one line, the title column got about 40px.
    ok('and that line has room to be READ — the controls wrap rather than crushing it', await page.evaluate(() => {
      const tts = [...document.querySelectorAll('#order .orow .tt')];
      return tts.length > 0 && tts.every((t) => t.getBoundingClientRect().width >= 130);
    }));
    await page.waitForTimeout(800);           // past the save debounce
    {
      const saved = posts.filter((p) => p.path === 'clips');
      const got = saved[saved.length - 1].body.clips.map((c) => c.key).join(',');
      ok('the order reached the server — the WHOLE untruncated key, as cut-model pieces',
        saved.length >= 1 && got === JOB_A + ',' + PART1, got);
    }

    // ── the arrows, the number, the duplicate ──
    await page.locator('#order .orow').nth(1).locator('button[aria-label="Earlier"]').click();
    await page.waitForTimeout(600);
    ok('the arrow moves a clip earlier, and the tiles renumber', await page.evaluate((id) => document.querySelector('#tiles .cell[data-id="' + id + '"] .pn').textContent === '1', PART1));
    ok('the first row\'s Earlier is disabled, the last row\'s Later is disabled', await page.evaluate(() => document.querySelectorAll('#order .orow')[0].querySelector('button[aria-label="Earlier"]').disabled && document.querySelectorAll('#order .orow')[1].querySelector('button[aria-label="Later"]').disabled));
    await page.locator('#order .orow').nth(1).locator('.num').fill('1');
    await page.locator('#order .orow').nth(1).locator('.num').press('Enter');
    await page.waitForTimeout(600);
    ok('a typed number moves the clip to that place', await page.evaluate((id) => document.querySelector('#tiles .cell[data-id="' + id + '"] .pn').textContent === '1', JOB_A));
    await page.locator('#order .orow').nth(0).locator('button[aria-label="Use this shot again"]').click();
    await page.waitForTimeout(600);
    ok('A SHOT CAN RIDE TWICE — the copy lands right after itself and the tile says both places',
      await page.evaluate((id) => document.querySelectorAll('#order .orow').length === 3 && document.querySelector('#tiles .cell[data-id="' + id + '"] .pn').textContent === '1, 2', JOB_A));
    ok('and the row says where else it is', await page.evaluate(() => /also at 2/.test(document.querySelectorAll('#order .orow .tt i')[0].textContent)));
    {
      const saved = posts.filter((p) => p.path === 'clips');
      ok('both instances reached the server under their own keys', saved[saved.length - 1].body.clips.map((c) => c.key).join(',') === JOB_A + ',' + JOB_A + '#2,' + PART1);
    }
    await page.locator('#order .orow').nth(1).locator('button[aria-label="Take it out"]').click();
    await page.waitForTimeout(600);
    ok('✕ takes out ONE instance, not both', await page.evaluate((id) => document.querySelectorAll('#order .orow').length === 2 && document.querySelector('#tiles .cell[data-id="' + id + '"] .pn').textContent === '1', JOB_A));
    await tile(JOB_A).click();
    await page.waitForTimeout(600);
    ok('a second tap on a picked tile takes every instance out', await page.evaluate((id) => document.querySelectorAll('#order .orow').length === 1 && document.querySelector('#tiles .cell[data-id="' + id + '"] .pn').textContent === '+', JOB_A));

    // ── a clip the log has no length for is NAMED, never silently lost ──
    await tile('Ic7ZjPH7fOoDPnxyfW5w').click();
    await page.waitForTimeout(900);
    ok('a clip nothing could measure is named back and taken off the order, not left sitting there',
      await page.evaluate(() => /could not be read/.test(document.getElementById('toast').textContent) && document.querySelectorAll('#order .orow').length === 1));

    // ── WHAT SHAPE THE FILM WILL BE ──
    await tile(JOB_A).click();          // 16:9 beside the 9:16 part
    await page.waitForTimeout(700);
    ok('a mixed order says what it will be letterboxed onto', await page.evaluate(() => {
      const n = document.getElementById('shapenote');
      return !n.hidden && /9:16/.test(n.textContent) && /16:9/.test(n.textContent) && /first clip/.test(n.textContent);
    }));

    // ── the pill's band ──
    ok('a control in the pill\'s band still takes its own tap (elementFromPoint)', await page.evaluate(() => {
      const x = document.querySelector('#order .orow button[aria-label="Take it out"]');
      const r = x.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const pill = document.querySelector('body > .float');
      const pr = pill && pill.getClientRects().length ? pill.getBoundingClientRect() : null;
      return (!pr || r.top < pr.bottom) && hit && (hit === x || x.contains(hit));
    }));

    // ── CLEAR, AND THE UNDO BESIDE IT ──
    ok('clear shows while something is picked, undo does not', await page.evaluate(() => !document.getElementById('clear').hidden && document.getElementById('undo').hidden));
    await page.click('#clear');
    await page.waitForTimeout(600);
    ok('clear empties the order and offers the undo', await page.evaluate(() => document.querySelectorAll('#order .orow').length === 0 && !document.getElementById('undo').hidden && document.getElementById('clear').hidden));
    await page.click('#undo');
    await page.waitForTimeout(700);
    ok('and the undo brings the whole order back, keys and all', await page.evaluate(() => document.querySelectorAll('#order .orow').length === 2));
    {
      const saved = posts.filter((p) => p.path === 'clips');
      ok('the restored order reached the server too', saved[saved.length - 1].body.clips.length === 2);
    }

    // ── HER ♥ AND ✕, WHICH THE PICKER USED TO IGNORE ──
    await page.click('#v-hidex');
    await page.waitForTimeout(250);
    ok('hide-the-crossed-out really drops them off the wall', await page.evaluate(() => ![...document.querySelectorAll('#tiles .cell')].some((c) => c.dataset.id.indexOf('aY9LbIGMe9T5lEcA984a') === 0)));
    await page.click('#v-hidex');
    await page.click('#v-liked');
    await page.waitForTimeout(250);
    ok('hearted-only keeps only what she hearted', await page.evaluate((id) => {
      const ids = [...document.querySelectorAll('#tiles .cell')].map((c) => c.dataset.id);
      return ids.length === 1 && ids[0] === id;
    }, JOB_A));
    ok('and the two lit colours differ — one keeps, one drops', await page.evaluate(() => {
      const a = getComputedStyle(document.getElementById('v-liked')).backgroundColor;
      document.getElementById('v-hidex').classList.add('on');
      const b = getComputedStyle(document.getElementById('v-hidex')).backgroundColor;
      document.getElementById('v-hidex').classList.remove('on');
      return a !== b && a !== 'rgba(0, 0, 0, 0)';
    }));
    await page.click('#v-liked');
    await page.waitForTimeout(250);
    ok('the marks are remembered under the page\'s own keys', await page.evaluate(() => localStorage.getItem('stitch_liked') === '' && localStorage.getItem('stitch_hidex') === ''));

    // ── THE SEARCH ──
    ok('the search field is behind the glass, not on the bar', await page.evaluate(() => document.getElementById('feedsearch').hidden && document.getElementById('feedfilters').hidden));
    await page.click('#v-search');
    await page.waitForTimeout(150);
    ok('the glass opens the field and the funnel, and lights', await page.evaluate(() => !document.getElementById('feedsearch').hidden && !document.getElementById('feedfilters').hidden && document.getElementById('v-search').classList.contains('on') && !!document.querySelector('#feedfilters .filtchip')));
    await page.locator('#q').fill('skips');
    await page.waitForTimeout(700);
    ok('typing narrows the wall at once AND reaches the server over the whole log', await page.evaluate(() => {
      const ids = [...document.querySelectorAll('#tiles .cell')].map((c) => c.dataset.id);
      return ids.length > 0 && ids.every((i) => i.indexOf('aY9LbIGMe9T5lEcA984a') === 0);
    }) && posts.some((p) => p.path === 'clips?' && p.q === 'skips'));
    ok('a word nothing matches says so rather than looking empty', await (async () => {
      await page.locator('#q').fill('zzzznothing'); await page.waitForTimeout(700);
      return page.evaluate(() => !document.getElementById('feedempty').hidden && /matches/.test(document.getElementById('feedempty').textContent));
    })());
    await page.locator('#qclear').click();
    await page.waitForTimeout(600);
    ok('the ✕ wipes the words and brings them back', await page.evaluate(() => !document.getElementById('q').value && document.querySelectorAll('#tiles .cell').length === 5));
    await page.click('#v-search');
    await page.waitForTimeout(200);
    ok('closing the glass clears the query and leaves the filters alone', await page.evaluate(() => document.getElementById('feedsearch').hidden && !document.getElementById('q').value));

    // ── THE FUNNEL ──
    await page.click('#v-search');
    await page.waitForTimeout(150);
    await page.click('#feedfilters .filtchip');
    await page.waitForTimeout(150);
    ok('the funnel is the one shell, with Model and When', await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#feedfilters .filtrow .filtlab')].map((l) => l.textContent);
      return rows.indexOf('Model') >= 0 && rows.indexOf('When') >= 0;
    }));
    await page.locator('#feedfilters .filtrow').first().locator('.filtcbtn[data-v="2.5"]').click();
    await page.waitForTimeout(300);
    ok('a model chip really narrows the wall, and the glass wears the count', await page.evaluate((id) => {
      const ids = [...document.querySelectorAll('#tiles .cell')].map((c) => c.dataset.id);
      return ids.length === 1 && ids[0] === id && document.querySelector('#v-search .qcount').textContent === '1';
    }, JOB_A));
    await page.locator('#feedfilters .filtrow').first().locator('.filtcbtn[data-v="2.5"]').click();
    await page.waitForTimeout(300);
    await page.click('#v-search');

    // ── the project picker, its folders and the fold ──
    ok('the picker is a folder icon with the project\'s folders under it', await page.evaluate(() => {
      const opts = [...document.querySelectorAll('#project option')].map((o) => o.textContent);
      return document.getElementById('projwrap').classList.contains('iconsel')
        && !!document.querySelector('#projwrap .ico svg')
        && opts[0] === 'All projects' && opts.some((o) => /folder/.test(o));
    }));
    await page.selectOption('#project', 'witch');
    await page.waitForTimeout(500);
    ok('a project narrows the picker and lights the box', await page.evaluate(() => document.getElementById('projwrap').classList.contains('on') && document.querySelectorAll('#tiles .cell').length === 4));
    ok('and the project she is in opens its folders', await page.evaluate(() => [...document.querySelectorAll('#project option')].some((o) => /chamomile/.test(o.textContent))));
    await page.selectOption('#project', '');
    await page.waitForTimeout(500);
    ok('All brings them back', (await page.locator('#tiles .cell').count()) === 5);

    // ── stitch: the save is AWAITED, then the render ──
    await tile(JOB_A).click();
    await page.waitForTimeout(150);
    const before = posts.length;
    await page.click('#stitch');
    await page.waitForTimeout(500);
    {
      const after = posts.slice(before).filter((p) => p.path === 'clips' || p.path === 'render');
      ok('the order is SAVED BEFORE the render is asked for — never fired and forgotten',
        after.length >= 2 && after[0].path === 'clips' && after[after.length - 1].path === 'render');
      const r = after[after.length - 1];
      ok('so the render bakes the order she is looking at', r.clips.split(',').length === (await page.locator('#order .orow').count()));
    }
    ok('and the button is off while it stitches', await page.evaluate(() => document.getElementById('stitch').disabled));
    await page.waitForSelector('#renders .rrow', { timeout: 8000 });
    ok('the render lands as a LINE with a play button, never a video', await page.evaluate(() => document.querySelectorAll('#renders .rrow').length === 1 && !!document.querySelector('#renders .rrow .ib.play') && !document.querySelector('#renders video') && /0:16/.test(document.querySelector('#renders .rrow .lab').textContent)));
    ok('the button comes back', await page.evaluate(() => !document.getElementById('stitch').disabled));

    // ── A RENDER ORPHANED BY A DEPLOY DOES NOT LOCK THE BUTTON ──
    STALE = true;
    await page.click('#stitch');
    await page.waitForTimeout(900);
    ok('a job the server calls stale reads as interrupted, and the button comes back', await page.evaluate(() => {
      const st = document.getElementById('status');
      return /interrupted/.test(st.textContent) && !document.getElementById('stitch').disabled;
    }));
    STALE = false;

    // ── the chevron unwinds instead of pushing ──
    ok('__navBack from an open stitch goes to the shelf and answers true', await page.evaluate(() => window.__navBack() === true));
    await page.waitForTimeout(500);
    ok('the shelf lists the stitch with its count and its render', await page.evaluate(() => { const r = document.querySelector('#slist .srow'); return r && /clip/.test(r.textContent) && /stitched/.test(r.textContent); }));
    ok('__navBack from the shelf answers false — the app leaves the tool', await page.evaluate(() => window.__navBack() === false));
    // Pre-fix, leaving pushed a THIRD entry, so history read [shelf, open,
    // shelf] and a device back landed on `?s=s1` — the chevron bounced her
    // between the shelf and the last stitch with no way out of the tool.
    // Asked of the URL, because unwinding correctly can also leave the page.
    ok('AND A DEVICE BACK FROM THE SHELF DOES NOT WALK INTO THE STITCH SHE JUST LEFT', await (async () => {
      await page.goBack().catch(() => {}); await page.waitForTimeout(400);
      return !/[?&]s=/.test(page.url());
    })());

    // ── PUT A STITCH AWAY ──
    await page.goto(base + '/stitch', { waitUntil: 'networkidle' });
    await page.waitForSelector('#slist .srow');
    await page.locator('#slist .srow .shide').first().click();
    await page.waitForTimeout(500);
    ok('the trash on a shelf row puts the stitch away — hidden, never deleted',
      posts.some((p) => p.path === 'hide') && await page.evaluate(() => !document.getElementById('shelfempty').hidden));

    // ── THE PAGE HEALS ITS OWN STALENESS ──
    ok('the same build is a no-op', (await page.evaluate(() => window.__stHeal.check())) === false);
    BUILD = 'build-two';
    await page.evaluate(() => { window.__stHeal.reset(); document.getElementById('q').value = 'held'; });
    ok('a new build is HELD while something would be lost', (await page.evaluate(() => window.__stHeal.check())) === false && /search/.test(await page.evaluate(() => window.__stHeal.holding())));
    const wasOrigin = await page.evaluate(() => performance.timeOrigin);
    await page.evaluate(() => { document.getElementById('q').value = ''; window.__stHeal.reset(); window.__stHeal.check(); });
    await page.waitForTimeout(1200);
    ok('and once nothing is held it really reloads — asked of the DOCUMENT, never a load-state promise',
      (await page.evaluate(() => performance.timeOrigin)) !== wasOrigin);

    ok('no page errors', errors.length === 0);
    if (errors.length) console.log(errors);
  } finally {
    await browser.close();
    server.close();
  }
  report();
}
