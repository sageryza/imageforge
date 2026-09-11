#!/usr/bin/env node
/* FOOTAGE — TRIMMING A CLIP AS IT COMES OUT (2026-09-10, Sophie: "how hard
   would it be to make it possible to trim clips right as they come out of the
   footage module?").

   Three parts, in the order they can lie to you:

   1. THE RULES, PURE — trimPlan's decision table. No Firestore, no bucket,
      no ffmpeg.
   2. A REAL CUT, MEASURED WITH ffprobe. A recipe that reads perfectly and a
      file that is the wrong length look identical to any source assertion,
      so the span is encoded for real and the OUTPUT is probed: its duration,
      and whether it still carries sound.
   3. THE REAL PAGE, HEADLESS, and every assertion a MEASUREMENT — the keep
      bar read off its own rect against the strip's, the loop read off
      `currentTime` while it really plays, and every write read off what the
      stub server ACTUALLY received. A mark that paints and never reaches the
      request, a Trim that posts the wrong span, and a player that closes on
      its own control are all invisible to a source assertion.

   The fixture the browser plays is WebM/VP8 with RANGE support: playwright's
   Chromium has no H.264, and a plain 200 leaves `seekable` at [0,0] so every
   currentTime write silently clamps to 0 (the Film Editor's own lesson).

   Run: node scripts/test-footage-trim.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const F = require('../footage');

const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
const near = (a, b, tol) => Math.abs(Number(a) - Number(b)) <= (tol == null ? 0.06 : tol);
function report() {
  if (fails.length) {
    console.log('FOOTAGE TRIM — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE TRIM — ' + pass + ' passed');
}

// ─── 1. THE RULES, PURE ──────────────────────────────────────────────────
const done = { status: 'completed', video: 'https://s/clip.mp4' };
{
  const good = F.trimPlan(done, { start: 1.2, end: 3.6 });
  ok('a good span plans', !good.error && good.span === 2.4 && good.start === 1.2 && good.end === 3.6);
  ok('the span is content-addressed under footage/trims', /^footage\/trims\/[0-9a-f]{40}\.mp4$/.test(good.path));
  ok('BAKED ONCE — the same span is the same object', F.trimPlan(done, { start: 1.2, end: 3.6 }).key === good.key);
  ok('a different span is a different object', F.trimPlan(done, { start: 1.2, end: 3.7 }).key !== good.key);
  ok('a different SOURCE is a different object',
    F.trimPlan({ status: 'completed', video: 'https://s/other.mp4' }, { start: 1.2, end: 3.6 }).key !== good.key);
  ok('milliseconds, never floating dust', F.trimPlan(done, { start: 0.10000001, end: 2.0000004 }).start === 0.1);

  ok('the end comes after the start', /after the start/.test(F.trimPlan(done, { start: 2, end: 2 }).error || ''));
  ok('and after it, not before', /after the start/.test(F.trimPlan(done, { start: 3, end: 2 }).error || ''));
  ok('a trim starts at 0 or later', /0 or later/.test(F.trimPlan(done, { start: -1, end: 2 }).error || ''));
  ok('under the floor is a tap, not a shot', /floor/.test(F.trimPlan(done, { start: 0, end: 0.2 }).error || ''));
  ok('exactly the floor is allowed', !F.trimPlan(done, { start: 0, end: F.TRIM_MIN_SECONDS }).error);
  ok('numbers, or the reason', /start and an end/.test(F.trimPlan(done, { start: 'x', end: 2 }).error || ''));
  ok('nothing longer than a clip this page makes', /longer than any clip/.test(F.trimPlan(done, { start: 0, end: 700 }).error || ''));

  ok('a clip still drawing is not trimmed', /once it has drawn/.test(F.trimPlan({ status: 'sent', video: '' }, { start: 0, end: 2 }).error || ''));
  ok('a FAILED clip is not trimmed', /once it has drawn/.test(F.trimPlan({ status: 'failed', video: '' }, { start: 0, end: 2 }).error || ''));
  ok('a clip with no file is not trimmed', /once it has drawn/.test(F.trimPlan({ status: 'completed', video: '' }, { start: 0, end: 2 }).error || ''));

  // the card: the parts ride BESIDE the clip, never over it
  const raw = { status: 'completed', video: 'https://s/clip.mp4', poster: 'https://s/p.jpg', params: { duration: 4 } };
  const plain = F.cardOf('a', raw);
  ok('with no trim the card is what it always was', plain.video === raw.video && plain.source === raw.video && plain.trim === null);
  ok('and it carries an empty parts list, never undefined', Array.isArray(plain.trims) && plain.trims.length === 0);
  const baking = F.cardOf('a', { ...raw, trim: { key: 'k1', status: 'baking', start: 1, end: 3, seconds: 2 } });
  ok('a BAKING trim still plays the original', baking.video === raw.video && baking.trim.status === 'baking');
  const ready = F.cardOf('a', { ...raw, trim: { key: 'k1', status: 'ready', url: 'https://s/t.mp4', poster: 'https://s/t.jpg', start: 1, end: 3, seconds: 2 } });
  ok('a READY trim is what she plays and saves', ready.video === 'https://s/t.mp4');
  ok('and the ORIGINAL is still on the card', ready.source === raw.video);
  ok('the trim brings its own poster', ready.poster === 'https://s/t.jpg');
  const failed = F.cardOf('a', { ...raw, trim: { key: 'k1', status: 'failed', error: 'nope', start: 1, end: 3 } });
  ok('a FAILED trim leaves the clip exactly as it was', failed.video === raw.video && failed.trim.error === 'nope');

  // ── SEVERAL PARTS OUT OF ONE CLIP ──────────────────────────────────────
  // The singular `trim` is the one-part record this shipped with; it reads as
  // a list of one, so nothing already on file needs migrating — and a doc
  // carrying `trims` ignores it, so the two spellings can never disagree.
  ok('the legacy single trim reads as a list of one',
    F.trimsOf({ trim: { key: 'k1', status: 'ready' } }).length === 1);
  ok('a doc carrying parts IGNORES the legacy field',
    F.trimsOf({ trims: [{ key: 'a' }, { key: 'b' }], trim: { key: 'old' } }).map((t) => t.key).join() === 'a,b');
  ok('a part with no key is not a part — nothing could ever match it',
    F.trimsOf({ trims: [{ key: 'a' }, { status: 'ready' }, null] }).length === 1);
  const two = F.cardOf('a', { ...raw, trims: [
    { key: 'p1', status: 'ready', url: 'https://s/1.mp4', poster: 'https://s/1.jpg', start: 0.5, end: 2, seconds: 1.5 },
    { key: 'p2', status: 'baking', start: 3, end: 3.9, seconds: 0.9 },
  ] });
  ok('every part reaches the card, in the order she cut them', two.trims.map((t) => t.key).join() === 'p1,p2');
  ok('the FIRST baked part is what she plays and saves', two.video === 'https://s/1.mp4' && two.poster === 'https://s/1.jpg');
  ok('and the clip the door drew is still the source', two.source === raw.video);
  ok('an older cached page still reads one trim off the first part', two.trim.key === 'p1');
  const laterReady = F.cardOf('a', { ...raw, trims: [
    { key: 'p1', status: 'baking', start: 0.5, end: 2, seconds: 1.5 },
    { key: 'p2', status: 'ready', url: 'https://s/2.mp4', start: 3, end: 3.9, seconds: 0.9 },
  ] });
  ok('while the first part bakes, a part that IS baked is what plays', laterReady.video === 'https://s/2.mp4');
}

// ─── 1b. A LATE BAKE MUST NOT SPEAK FOR A TRIM SHE MOVED ON FROM ─────────
// Trims queue, so a second tap can land while the first is still encoding.
// The write that matters is the UNDO: without the guard a bake finishing
// after `clear` puts the trim back on the doc by itself, with nothing on
// screen saying why. Driven through the REAL bakeTrim with `admin` stubbed
// and the object already existing (the baked-once path), so no ffmpeg and no
// network are involved — only the decision.
async function bakeAgainst(docTrim) {
  const admin = require('firebase-admin');
  // `apps`, `storage` and `firestore` are GETTER-ONLY on the firebase-admin
  // namespace, so a plain `admin.storage = …` fails SILENTLY outside strict
  // mode and the real one throws behind the stub's back — every write then
  // vanishes into bakeTrim's own catch and the test passes vacuously. Define
  // them, and put the originals back.
  const was = {};
  const stub = (name, value) => {
    was[name] = Object.getOwnPropertyDescriptor(admin, name);
    Object.defineProperty(admin, name, { value, configurable: true, writable: true });
  };
  const doc = { status: 'completed', video: 'https://s/clip.mp4', trims: docTrim ? [].concat(docTrim) : [] };
  const writes = [];
  const fsNs = () => ({ collection: () => ({ doc: () => ({
    get: async () => ({ exists: true, data: () => doc }),
    set: async (patch) => { writes.push(patch); },
  }) }) });
  Object.keys(admin.firestore).forEach((k) => { fsNs[k] = admin.firestore[k]; });
  stub('apps', [{}]);
  stub('storage', () => ({ bucket: () => ({ name: 'b', file: () => ({ exists: async () => [true] }) }) }));
  stub('firestore', fsNs);
  try {
    await F.bakeTrim('job1', F.trimPlan(doc, { start: 1, end: 3 }));
  } finally {
    Object.keys(was).forEach((k) => { if (was[k]) Object.defineProperty(admin, k, was[k]); });
  }
  return writes;
}

// ─── 2. A REAL CUT, MEASURED ─────────────────────────────────────────────
let FF = null;
try { FF = require('ffmpeg-static'); } catch (_) { /* none here */ }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ftrim-'));
const mp4 = path.join(tmp, 'src.mp4');
if (FF) {
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', mp4]);
}

// ─── 3. THE REAL PAGE ────────────────────────────────────────────────────
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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

(async () => {
  {
    const mine = F.trimPlan({ status: 'completed', video: 'https://s/clip.mp4' }, { start: 1, end: 3 });
    const w1 = await bakeAgainst({ key: mine.key, status: 'baking' });
    ok('a bake writes while the doc still asks for its own span',
      w1.length === 1 && Array.isArray(w1[0].trims) && w1[0].trims[0].status === 'ready');
    const w2 = await bakeAgainst(null);
    ok('a REMOVED part is never resurrected by a late bake', w2.length === 0);
    const w3 = await bakeAgainst({ key: 'someothertrim', status: 'baking' });
    ok('a part she replaced is not overwritten by the bake it replaced', w3.length === 0);
    // A LATE BAKE PATCHES ITS OWN ENTRY — a part she cut while this one was
    // encoding must survive the write, which is the whole reason the guard
    // re-reads the list rather than writing back the one it planned.
    const w4 = await bakeAgainst([{ key: 'cutwhileiwasbaking', status: 'baking', start: 4, end: 5 }, { key: mine.key, status: 'baking' }]);
    ok('and a part cut WHILE it baked is still there afterwards',
      w4.length === 1 && w4[0].trims.length === 2 && w4[0].trims[0].key === 'cutwhileiwasbaking' && w4[0].trims[1].status === 'ready');
    ok('the legacy single field is dropped the moment parts are written',
      w1[0].trim && typeof w1[0].trim === 'object');
  }

  if (FF) {
    const out = path.join(tmp, 'cut.mp4');
    const src = await F.probeMedia(mp4);
    ok('the fixture is what we asked for', near(src.total, 5, 0.1) && src.withAudio === true);
    await F.cutSpan(mp4, out, 1.2, 3.6, true);
    const cut = await F.probeMedia(out);
    // THE MEASUREMENT: 1.2 → 3.6 is 2.4 seconds of file, not a plan that says so
    ok('a real cut is exactly the span asked for', near(cut.total, 2.4, 0.12));
    ok('and it still carries its sound', cut.withAudio === true);
    const silent = path.join(tmp, 'silent.mp4');
    await F.cutSpan(mp4, silent, 0, 1.5, false);
    const s2 = await F.probeMedia(silent);
    ok('a source with no audio cuts to a file with none', s2.withAudio === false && near(s2.total, 1.5, 0.12));
  } else {
    console.log('  (ffmpeg-static missing — the real-cut half skipped)');
  }

  if (!chromium) { console.log('footage trim: playwright not installed — page half skipped'); report(); return; }
  if (!FF) { console.log('footage trim: no ffmpeg — page half skipped'); report(); return; }

  // A REAL, SEEKABLE 5s VP8 fixture. Chromium here has no H.264.
  const webm = path.join(tmp, 'clip.webm');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=5',
    '-c:v', 'libvpx', '-b:v', '200k', webm]);
  const WEBM = fs.readFileSync(webm);
  // and a PORTRAIT one — 3:4, the ward film's shape — for the way-out block
  const tallWebm = path.join(tmp, 'tall.webm');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=420x560:rate=24:duration=5',
    '-c:v', 'libvpx', '-b:v', '200k', tallWebm]);
  const TALL = fs.readFileSync(tallWebm);

  const got = [];                 // every trim the server really received
  let jobs = [{
    id: 'clip1', prompt: 'the ward corridor', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: '/clip.webm', source: '/clip.webm', poster: '/ref.png', refs: [],
    sentAt: '2026-09-10T08:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false, trims: [],
  }];
  let jobReads = 0;

  const serveMedia = (req, res, body, type) => {
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? Math.min(parseInt(m[2], 10), body.length - 1) : body.length - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes',
        'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
      return res.end(body.slice(start, end + 1));
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': body.length });
    res.end(body);
  };

  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    // NO-STORE, exactly as footage.js answers — without it Chromium
    // heuristic-caches the jobs read and a second loadJobs sees the same
    // list, which makes a real repaint look like a page that never
    // updated (it cost this test an hour).
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (u.pathname === '/footage') {
        const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
        res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
      }
      if (u.pathname === '/clip.webm' || u.pathname === '/trimmed.webm') return serveMedia(req, res, WEBM, 'video/webm');
      if (u.pathname === '/tall.webm') return serveMedia(req, res, TALL, 'video/webm');
      if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
      if (u.pathname === '/api/footage/status') {
        return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
          models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
      }
      if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
      if (u.pathname === '/api/footage/jobs' && req.method === 'GET') { jobReads += 1; return json({ ok: true, jobs }); }
      if (/^\/api\/footage\/jobs\/[^/]+\/trim$/.test(u.pathname)) {
        const b = JSON.parse(body || '{}');
        got.push(b);
        const parts = (jobs[0].trims || []).slice();
        if (b.clear) {
          jobs[0] = { ...jobs[0], trims: [], video: '/clip.webm', poster: '/ref.png' };
        } else if (b.remove) {
          const next = parts.filter((t) => t.key !== b.remove);
          jobs[0] = { ...jobs[0], trims: next, video: next.length ? jobs[0].video : '/clip.webm' };
        } else {
          const part = { key: 'k' + b.start + '-' + b.end, start: b.start, end: b.end,
            seconds: Math.round((b.end - b.start) * 1000) / 1000, status: 'baking', url: '', error: '' };
          jobs[0] = { ...jobs[0], trims: b.replace ? parts.map((t) => (t.key === b.replace ? part : t)) : parts.concat([part]) };
        }
        return json({ ok: true, job: jobs[0] }, 202);
      }
      if (/^\/api\/footage\/jobs\/[^/]+\/(vote|hide)$/.test(u.pathname)) return json({ ok: true });
      res.writeHead(404); res.end('nope');
    });
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-clip1');
  await page.waitForTimeout(300);

  const shown = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }).catch(() => false);
  const seek = async (t) => {
    await page.evaluate((tt) => { const v = document.querySelector('#player .pstage video'); v.pause(); v.currentTime = tt; }, t);
    await page.waitForFunction((tt) => {
      const v = document.querySelector('#player .pstage video');
      return v && !v.seeking && Math.abs(v.currentTime - tt) < 0.2;
    }, t, { timeout: 4000 }).catch(() => {});
  };
  // the keep bar as a FRACTION of the strip, read off the real boxes
  const keepBox = () => page.evaluate(() => {
    const s = document.querySelector('.trimbar .strip').getBoundingClientRect();
    const k = document.getElementById('tkeep').getBoundingClientRect();
    return { a: (k.left - s.left) / s.width, b: (k.right - s.left) / s.width, w: s.width };
  });

  ok('no page errors', errors.length === 0);
  ok('the trim bar is not on screen until a clip is open', !(await shown('#trimbar')));

  await page.click('#job-clip1 .thumb');
  await page.waitForSelector('#player .pstage video');
  await page.waitForFunction(() => {
    const v = document.querySelector('#player .pstage video');
    return v && isFinite(v.duration) && v.duration > 0;
  }, null, { timeout: 8000 });
  await page.waitForTimeout(200);

  ok('opening a clip arms the trimmer', await shown('#trimbar'));
  ok('the SOURCE is what plays, never a trim',
    /\/clip\.webm$/.test(await page.$eval('#player .pstage video', (v) => v.currentSrc)));
  ok('the clip is really seekable (Range, not a plain 200)',
    await page.$eval('#player .pstage video', (v) => v.seekable.length > 0 && v.seekable.end(0) > 1));
  ok('it opens on the whole clip', /the whole clip/.test(await page.textContent('#tspan')));
  ok('nothing to do → NO Trim button', !(await shown('#tgo')));
  ok('and nothing to reset either', !(await shown('#treset')));
  // WITH THE MARKS ON THE WHOLE CLIP THE KEEP BAR IS NOT DRAWN — a bright
  // band over the whole strip would cover the dim bands of the parts she has
  // already cut, and the whole clip is the state the trimmer opens on.
  ok('with nothing marked the keep bar is not drawn at all',
    (await page.$eval('#tkeep', (el) => getComputedStyle(el).display)) === 'none');

  // ── setting the marks ──────────────────────────────────────────────────
  await seek(1.2);
  await page.click('#tin');
  await page.waitForTimeout(120);
  ok('the start mark lands at the playhead', /^1\.2s – /.test(await page.textContent('#tspan')));
  {
    const k = await keepBox();
    ok('and the keep bar really moves with it', near(k.a, 1.2 / 5, 0.03) && near(k.b, 1, 0.02));
  }
  ok('a mark shows the way back to the whole clip', await shown('#treset'));
  ok('and now there is something to tap', await shown('#tgo'));
  ok('which says Trim', (await page.textContent('#tgo')).trim() === 'Trim');
  ok('a tap on a trim control does NOT close the player', !(await page.$eval('#player', (el) => el.hidden)));

  // an end mark on top of the start mark is refused, and refused OUT LOUD
  await seek(1.3);
  await page.click('#tout');
  await page.waitForTimeout(120);
  ok('an end mark too close to the start is refused', /^1\.2s – 5s/.test(await page.textContent('#tspan')));
  ok('and says so', /too close/.test(await page.textContent('#toast')));

  await seek(3.6);
  await page.click('#tout');
  await page.waitForTimeout(120);
  ok('the end mark lands at the playhead', /^1\.2s – 3\.6s · keeping 2\.4s$/.test((await page.textContent('#tspan')).trim()));
  {
    const k = await keepBox();
    ok('both edges of the keep bar are where the marks are', near(k.a, 1.2 / 5, 0.03) && near(k.b, 3.6 / 5, 0.03));
  }

  // ── filmnote and the trim bar share this screen ────────────────────────
  // /filmnote.js (the paused-film note, PR #2272) anchors everything it draws
  // to its WRAP's bottom edge, so hosted on `#player` its Note button landed
  // ON the trim controls — PHOTOgraphed, sitting over the `›` stepper. It is
  // hosted on `.pstage` instead. MEASURED, both ways round: no overlap, and
  // every control really takes its own tap (a button that is merely "visible"
  // under another one passes every width assertion ever written about it).
  const overlaps = await page.evaluate(() => {
    const n = document.querySelector('#player .notebtn');
    if (!n) return { none: true };
    const a = n.getBoundingClientRect();
    const hit = [];
    document.querySelectorAll('.trimbar button, .trimbar .strip').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) {
        hit.push(el.id || el.className);
      }
    });
    return { hit, hosted: !!document.querySelector('#player .pstage.filmnote-host') };
  });
  ok('filmnote is hosted on the stage, not the whole player', overlaps.none || overlaps.hosted);
  ok('and its Note button sits on NOTHING in the trim bar', overlaps.none || overlaps.hit.length === 0);
  const reachable = await page.evaluate(() => {
    const out = [];
    ['tstrip', 'tback', 'tin', 'tout', 'tfwd', 'treset', 'tgo'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.hidden) return;
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.push([id, at === el || el.contains(at)]);
    });
    return out;
  });
  ok('every trim control takes its own tap', reachable.length >= 5 && reachable.every(([, hitIt]) => hitIt));

  // the steppers walk the playhead a tenth at a time, so a mark can be placed
  // exactly with no handle to catch
  const before = await page.$eval('#player .pstage video', (v) => v.currentTime);
  await page.click('#tback');
  await page.waitForTimeout(150);
  const after = await page.$eval('#player .pstage video', (v) => v.currentTime);
  ok('the stepper walks the playhead back a tenth', near(before - after, 0.1, 0.05));
  await page.click('#tfwd');
  await page.waitForTimeout(150);
  ok('and forward again', near(await page.$eval('#player .pstage video', (v) => v.currentTime), before, 0.05));

  // ── TAP THE STRIP AND THE PLAYHEAD GOES THERE (2026-09-10, her ask) ────
  // A POSITION, never the element: playwright aims at an element's centre, so
  // clicking `#tstrip` would land at 50% and a strip that ignored the x
  // entirely would pass. And the BAND is measured against the BAR — the target
  // has to be bigger than the 10px mark without the mark getting heavier.
  {
    const box = await page.evaluate(() => {
      const b = document.getElementById('tstrip').getBoundingClientRect();
      const r = document.querySelector('.trimbar .strip').getBoundingClientRect();
      return { band: b.height, bar: r.height, left: r.left, width: r.width, top: r.top + r.height / 2 };
    });
    ok('the tap band is a real target', box.band >= 30);
    ok('and the bar itself is still the light 10px mark', near(box.bar, 10, 1.5));

    await page.evaluate(() => { const v = document.querySelector('#player .pstage video'); return v.play().catch(() => {}); });
    await page.waitForTimeout(200);
    await page.mouse.click(box.left + box.width * 0.6, box.top);
    await page.waitForTimeout(250);
    const at = await page.$eval('#player .pstage video', (v) => ({ t: v.currentTime, paused: v.paused }));
    ok('a tap at 60% of the strip puts the playhead at 60% of the clip', near(at.t, 5 * 0.6, 0.25));
    ok('and it pauses, so she can mark the frame she found', at.paused === true);
    ok('a tap on the strip does not close the player', !(await page.$eval('#player', (el) => el.hidden)));

    // the other end, so a strip that always answers the same place fails
    await page.mouse.click(box.left + box.width * 0.15, box.top);
    await page.waitForTimeout(250);
    ok('and a tap near the start lands near the start',
      near(await page.$eval('#player .pstage video', (v) => v.currentTime), 5 * 0.15, 0.25));
    ok('the marks are untouched by a tap on the strip', /^1\.2s – 3\.6s/.test((await page.textContent('#tspan')).trim()));
  }

  // ── the loop: playing plays the SPAN ───────────────────────────────────
  const walk = await page.evaluate(async () => {
    const v = document.querySelector('#player .pstage video');
    v.currentTime = 3.3;
    await v.play().catch(() => {});
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 2600) {
      seen.push(v.currentTime);
      await new Promise((r) => setTimeout(r, 60));
    }
    v.pause();
    return seen;
  });
  ok('playing never runs past the end mark', walk.every((t) => t < 3.6 + 0.25));
  ok('and it loops back to the start mark', walk.some((t) => t < 1.6) && walk.length > 5);

  // ── the write ──────────────────────────────────────────────────────────
  await page.click('#tgo');
  await page.waitForTimeout(400);
  ok('ONE trim was sent', got.length === 1);
  ok('and it carries exactly the marks she set', got[0] && near(got[0].start, 1.2, 0.02) && near(got[0].end, 3.6, 0.02));
  // THE PLAYER STAYS OPEN (2026-09-10, her second ask: "re-cut the same whole
  // clip after I've cut it to also get a second part") — closing on every cut
  // would mean finding the clip and re-opening it between every part.
  ok('the player STAYS OPEN, ready for the next part', !(await page.$eval('#player', (el) => el.hidden)));
  ok('and the marks go back to the whole clip', /the whole clip/.test(await page.textContent('#tspan')));
  ok('the part she just cut has a row of its own',
    (await page.$$eval('.trimbar .tpart', (n) => n.length)) === 1);
  ok('which says what it is baking', /1\.2–3\.6s/.test(await page.textContent('.trimbar .tpart')) && /trimming/.test(await page.textContent('.trimbar .tpart')));
  ok('and there is nothing to play past, so no whole-clip button', !(await shown('#tall')));
  ok('the card says it is trimming', /trimming to 1\.2–3\.6s/.test(await page.textContent('#job-clip1')));

  // the poll has to keep running or the card sits on "trimming…" forever
  const reads = jobReads;
  await page.waitForTimeout(5000);
  ok('a baking part keeps the poll alive', jobReads > reads);

  // ── it lands ───────────────────────────────────────────────────────────
  jobs[0] = { ...jobs[0], video: '/trimmed.webm', poster: '/ref.png',
    trims: [{ key: 'k1.2-3.6', start: 1.2, end: 3.6, seconds: 2.4, status: 'ready', url: '/trimmed.webm', error: '' }] };
  // the page's OWN re-read — `loadJobs` is inside the page's IIFE, so
  // `window.loadJobs` is undefined and calling it was a silent no-op that only
  // passed because a baking part's poll happened to fire.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => /trimmed 1\.2–3\.6s/.test(document.getElementById('job-clip1').textContent), null, { timeout: 8000 });
  ok('the card says what is kept', /trimmed 1\.2–3\.6s · keeping 2\.4s/.test(await page.textContent('#job-clip1')));
  // SAVE IS A BUTTON NOW (2026-09-10, "shud save directly to my photos"), so
  // the honest question is what it really hands over — the url the native
  // bridge receives, never an href the page no longer draws.
  await page.evaluate(() => {
    window.__saved = [];
    window.webkit = { messageHandlers: { forgeSave: { postMessage: (u) => window.__saved.push(u) } } };
  });
  // dispatched, not clicked: the trimmer is OPEN over the feed at this point
  await page.evaluate(() => document.querySelector('#job-clip1 .acts .save').click());
  ok('save hands her the TRIMMED clip',
    /\/trimmed\.webm$/.test((await page.evaluate(() => window.__saved))[0] || ''));
  // the OPEN trimmer is this clip too — a part that finishes baking while she
  // is standing in it must stop saying "trimming…" there as well as on the card
  ok('and the row in the open trimmer stops saying it is baking',
    !/trimming/.test(await page.textContent('.trimbar .tpart')));

  // ── A SECOND PART OUT OF THE SAME CLIP ─────────────────────────────────
  await seek(0.5);
  await page.click('#tin');
  await seek(1.2);
  await page.click('#tout');
  await page.waitForTimeout(150);
  ok('the button knows there is already a part', (await page.textContent('#tgo')).trim() === 'Add part');
  ok('and the whole-clip button appears once the span is narrower', await shown('#tall'));

  // ── PLAY THE WHOLE CLIP (2026-09-10, her first ask) ────────────────────
  // The MEASUREMENT is that the playhead really runs PAST the out mark — a
  // button that plays and still loops at 1.2s looks identical in the source.
  {
    await page.click('#tall');
    ok('and it says she is watching it all', /Back to the part/.test(await page.textContent('#tall')));
    const seen = await page.evaluate(async () => {
      const v = document.querySelector('#player .pstage video');
      const out = []; const t0 = Date.now();
      while (Date.now() - t0 < 2400) { out.push(v.currentTime); await new Promise((r) => setTimeout(r, 60)); }
      return out;
    });
    ok('a whole-clip run starts at the beginning', seen.length > 5 && seen[0] < 0.6);
    ok('and it runs PAST the out mark instead of looping', seen.some((t) => t > 1.6));
    await page.click('#tall');
    await page.waitForTimeout(300);
    ok('tapping again goes back to the part',
      near(await page.$eval('#player .pstage video', (v) => v.currentTime), 0.5, 0.45));
    ok('and the marks were never touched by any of it', /^0\.5s – 1\.2s/.test((await page.textContent('#tspan')).trim()));
  }

  await page.click('#tgo');
  await page.waitForTimeout(400);
  ok('the second part is SENT, not a replacement', got.length === 2 && !got[1].replace && near(got[1].start, 0.5, 0.02));
  ok('and the clip now carries two parts', (await page.$$eval('.trimbar .tpart', (n) => n.length)) === 2);
  ok('each one numbered, in the order she cut them',
    /part 1 · 1\.2–3\.6s/.test(await page.textContent('.trimbar .tparts')) && /part 2 · 0\.5–1\.2s/.test(await page.textContent('.trimbar .tparts')));
  ok('the strip shows a dim band for each of them',
    (await page.$$eval('.trimbar .bands .part', (n) => n.length)) === 2);
  {
    // the bands are WHERE the parts are, measured off the real boxes
    const b = await page.evaluate(() => {
      const s2 = document.querySelector('.trimbar .strip').getBoundingClientRect();
      return Array.prototype.map.call(document.querySelectorAll('.trimbar .bands .part'), (el) => {
        const r = el.getBoundingClientRect();
        return [(r.left - s2.left) / s2.width, (r.right - s2.left) / s2.width];
      });
    });
    ok('and each band really sits over its own span',
      near(b[0][0], 1.2 / 5, 0.03) && near(b[0][1], 3.6 / 5, 0.03) && near(b[1][0], 0.5 / 5, 0.03) && near(b[1][1], 1.2 / 5, 0.03));
  }
  ok('the card lists both', /part 1 · trimmed 1\.2–3\.6s/.test(await page.textContent('#job-clip1')) && /part 2 · trimming to 0\.5–1\.2s/.test(await page.textContent('#job-clip1')));

  // ── a part's own row puts its marks back, and REPLACES it in place ─────
  await page.click('.trimbar .tpart:first-child .tpspan');
  await page.waitForTimeout(150);
  ok('tapping a part puts its own marks back', /^1\.2s – 3\.6s/.test((await page.textContent('#tspan')).trim()));
  ok('and the button says it will replace that part', (await page.textContent('#tgo')).trim() === 'Replace');
  await seek(1.5);
  await page.click('#tin');
  await page.waitForTimeout(120);
  await page.click('#tgo');
  await page.waitForTimeout(400);
  ok('a replace names the part it is replacing', got.length === 3 && got[2].replace === 'k1.2-3.6' && near(got[2].start, 1.5, 0.02));
  ok('and it keeps its PLACE in the order rather than jumping to the end',
    (await page.$$eval('.trimbar .tpart', (n) => n.length)) === 2 && /part 1 · 1\.5–3\.6s/.test(await page.textContent('.trimbar .tparts')));

  // ── the ✕ on a row is the undo, and it can only mean that part ─────────
  await page.click('.trimbar .tpart:last-child .tpx');
  await page.waitForTimeout(400);
  ok('a ✕ takes off exactly the part it sits on', got.length === 4 && got[3].remove === 'k0.5-1.2');
  ok('and the one she kept is still there', (await page.$$eval('.trimbar .tpart', (n) => n.length)) === 1);
  ok('with no number on it any more, because there is only one',
    !/part 1/.test(await page.textContent('.trimbar .tparts')));

  // ── the backdrop still closes ──────────────────────────────────────────
  // (the player has been open through every part of this — that IS the point)
  await page.evaluate(() => document.querySelector('#player .pstage').click());
  await page.waitForTimeout(150);
  ok('a tap on the backdrop closes the player', await page.$eval('#player', (el) => el.hidden));

  // ── THE WAY OUT ON A PORTRAIT CLIP WITH PARTS (2026-09-11, Sophie: "all
  // the stuff at the bottom in trim view, esp after a trim is added, makes
  // it impossible to close the player") ──────────────────────────────────
  // The ✕ used to be absolute in the top-left corner, and on a 3:4 clip the
  // stage fills to the top and the VIDEO paints over it — a presence check
  // on `.pclose` passed the whole time. Every assertion here is a
  // MEASUREMENT at the app's own 390x700: the ✕ asked with elementFromPoint,
  // the video's rect proved to start UNDER it, and the tap really closing.
  {
    jobs.push({
      id: 'tall1', prompt: 'the ER, close', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
      seconds: 4, resolution: '480p', ratio: '3:4', sound: true, status: 'done',
      video: '/tall.webm', source: '/tall.webm', poster: '/ref.png', refs: [],
      sentAt: '2026-09-10T09:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false,
      trims: [{ key: 'k0-1', start: 0, end: 1, seconds: 1, status: 'ready', url: '/tall.webm', error: '' },
        { key: 'k1-2', start: 1, end: 2, seconds: 1, status: 'ready', url: '/tall.webm', error: '' }],
    });
    await page.setViewportSize({ width: 390, height: 700 });
    await page.reload();
    await page.waitForSelector('#job-tall1');
    await page.click('#job-tall1 .thumb');
    await page.waitForFunction(() => !document.getElementById('player').hidden && !document.getElementById('trimbar').hidden);
    await page.waitForFunction(() => { const v = document.querySelector('#player video'); return v && v.videoWidth > 0; });
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => {
      const c = document.querySelector('#player .pclose'); const q = c.getBoundingClientRect();
      const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
      const v = document.querySelector('#player video').getBoundingClientRect();
      const t = document.getElementById('trimbar').getBoundingClientRect();
      return { reach: !!(hit && hit.closest('.pclose')), x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height),
        videoTop: Math.round(v.y), closeBottom: Math.round(q.bottom), videoBottom: Math.round(v.bottom), trimTop: Math.round(t.y),
        parts: document.querySelectorAll('.trimbar .tpart').length };
    });
    ok('the ✕ takes its own tap on a portrait clip with parts listed (' + JSON.stringify(out) + ')', out.reach);
    ok('the picture starts UNDER the ✕ row, never over it', out.videoTop >= out.closeBottom);
    ok('and still ends above the trim bar (the stage yields, the row does not)', out.videoBottom <= out.trimTop && out.h === 34);
    ok('both parts are on the bar — this is the screen she could not leave', out.parts === 2);
    // a REAL tap at the ✕'s own centre — playwright's element click refuses a
    // covered target with a timeout, which is a crash rather than a finding
    await page.mouse.click(out.x + out.w / 2, out.y + out.h / 2);
    await page.waitForTimeout(150);
    ok('tapping the ✕ closes the player', await page.$eval('#player', (el) => el.hidden));
    ok('and unlocks the page', (await page.evaluate(() => document.body.style.overflow)) === '');
    // the row's dead space is backdrop too (leave by the app's chevron first if
    // the ✕ failed, so a pre-fix page reports the finding rather than crashing)
    await page.evaluate(() => window.__navBack());
    await page.click('#job-tall1 .thumb');
    await page.waitForFunction(() => !document.getElementById('player').hidden);
    await page.waitForTimeout(300);
    await page.evaluate(() => { const t = document.querySelector('#player .pbar'); if (t) t.click(); });
    await page.waitForTimeout(150);
    ok('a tap on the row beside the ✕ closes it too', await page.$eval('#player', (el) => el.hidden));
    jobs.pop();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForSelector('#job-clip1');
    await page.waitForTimeout(300);
  }

  // ── AND THE WALL SAYS SO TOO (2026-09-10, Sophie: "can you put a little
  // icon on clips that have been trimmed even in the tile view?") ────────
  // MEASURED off the real cells: a class whose CSS never landed, a badge
  // drawn on every tile, and one that never lights are the same markup.
  {
    jobs[0] = { ...jobs[0], trims: [{ key: 'k1.2-3.6', start: 1.2, end: 3.6, seconds: 2.4, status: 'ready', url: '/trimmed.webm', error: '' }] };
    jobs.push({
      id: 'clip2', prompt: 'the day room', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
      seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
      video: '/clip.webm', source: '/clip.webm', poster: '/ref.png', refs: [],
      sentAt: '2026-09-10T07:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false, trims: [],
    });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300);
    await page.click('#v-tiles');
    await page.waitForSelector('#tiles .cell[data-id="clip2"]');
    await page.waitForTimeout(200);
    const marks = await page.evaluate(() => {
      const read = (id) => {
        const cell = document.querySelector('#tiles .cell[data-id="' + id + '"]');
        const m = cell && cell.querySelector('.tcut');
        const r = m ? m.getBoundingClientRect() : null;
        const cr = cell ? cell.getBoundingClientRect() : null;
        return {
          drawn: !!(r && r.width > 0 && r.height > 0),
          n: m ? m.querySelector('.n').textContent : '',
          inside: !!(r && cr && r.top >= cr.top - 1 && r.left >= cr.left - 1 && r.bottom <= cr.bottom + 1),
          overHeart: !!(r && (() => {
            const h = cell.querySelector('.tmark.heart').getBoundingClientRect();
            return !(r.right <= h.left || r.left >= h.right || r.bottom <= h.top || r.top >= h.bottom);
          })()),
        };
      };
      return { cut: read('clip1'), plain: read('clip2') };
    });
    ok('a trimmed clip wears the mark on the wall', marks.cut.drawn);
    ok('and an untrimmed one does not', !marks.plain.drawn);
    ok('one part shows no number', marks.cut.n === '');
    ok('the mark sits inside its own tile', marks.cut.inside);
    ok('and never on the heart', !marks.cut.overHeart);
    // AND AT FOUR ACROSS, which is where it is tight: a 16:9 tile is 49px
    // high there and the heart's box starts 19px down, so a badge picked by
    // eye sits on it (measured: the first cut did).
    await page.click('#v-cols');
    await page.waitForTimeout(250);
    const tight = await page.evaluate(() => {
      const cell = document.querySelector('#tiles .cell[data-id="clip1"]');
      const m = cell.querySelector('.tcut').getBoundingClientRect();
      const h = cell.querySelector('.tmark.heart').getBoundingClientRect();
      const hit = (el) => { const q = el.getBoundingClientRect();
        const at = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return at === el || el.contains(at); };
      return { over: !(m.right <= h.left || m.left >= h.right || m.bottom <= h.top || m.top >= h.bottom),
        drawn: m.width > 0 && m.height > 0, heart: hit(cell.querySelector('.tmark.heart')) };
    });
    ok('four across: the mark is still drawn', tight.drawn);
    ok('four across: and still off the heart', !tight.over);
    ok('four across: the heart still takes its own tap', tight.heart);
    await page.click('#v-cols');
    await page.waitForTimeout(200);
    // the face still takes the tap — a badge over the play face would be a
    // clip she cannot open from the wall
    const facehit = await page.evaluate(() => {
      const f = document.querySelector('#tiles .cell[data-id="clip1"] .face');
      const r = f.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return at === f || f.contains(at);
    });
    ok('the play face still takes its own tap', facehit);
    // TWO parts → the count, so a clip cut twice is not read as cut once
    jobs[0] = { ...jobs[0], trims: jobs[0].trims.concat([{ key: 'k4-4.8', start: 4, end: 4.8, seconds: 0.8, status: 'ready', url: '/trimmed.webm', error: '' }]) };
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(400);
    ok('two parts put the number on the mark',
      (await page.$eval('#tiles .cell[data-id="clip1"] .tcut .n', (el) => el.textContent)) === '2');
    // and it is off the wall's signature: a vote must not rebuild the posters
    const same = await page.evaluate(async () => {
      const img = document.querySelector('#tiles .cell[data-id="clip1"] img');
      document.querySelector('#tiles .cell[data-id="clip1"] .tmark.heart').click();
      await new Promise((r) => setTimeout(r, 250));
      return img === document.querySelector('#tiles .cell[data-id="clip1"] img');
    });
    ok('a mark cast on the wall never rebuilds the poster', same);
    ok('and the trimmed mark survives it',
      await shown('#tiles .cell[data-id="clip1"] .tcut'));
    await page.click('#v-list');
  }

  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* temp */ }
  report();
})().catch((e) => { console.error(e); process.exit(1); });
