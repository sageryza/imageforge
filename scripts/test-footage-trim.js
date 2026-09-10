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

  // the card: the trim rides BESIDE the clip, never over it
  const raw = { status: 'completed', video: 'https://s/clip.mp4', poster: 'https://s/p.jpg', params: { duration: 4 } };
  const plain = F.cardOf('a', raw);
  ok('with no trim the card is what it always was', plain.video === raw.video && plain.source === raw.video && plain.trim === null);
  const baking = F.cardOf('a', { ...raw, trim: { status: 'baking', start: 1, end: 3, seconds: 2 } });
  ok('a BAKING trim still plays the original', baking.video === raw.video && baking.trim.status === 'baking');
  const ready = F.cardOf('a', { ...raw, trim: { status: 'ready', url: 'https://s/t.mp4', poster: 'https://s/t.jpg', start: 1, end: 3, seconds: 2 } });
  ok('a READY trim is what she plays and saves', ready.video === 'https://s/t.mp4');
  ok('and the ORIGINAL is still on the card', ready.source === raw.video);
  ok('the trim brings its own poster', ready.poster === 'https://s/t.jpg');
  const failed = F.cardOf('a', { ...raw, trim: { status: 'failed', error: 'nope', start: 1, end: 3 } });
  ok('a FAILED trim leaves the clip exactly as it was', failed.video === raw.video && failed.trim.error === 'nope');
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

  const got = [];                 // every trim the server really received
  let jobs = [{
    id: 'clip1', prompt: 'the ward corridor', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: '/clip.webm', source: '/clip.webm', poster: '/ref.png', refs: [],
    sentAt: '2026-09-10T08:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false, trim: null,
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
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (u.pathname === '/footage') {
        const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
        res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
      }
      if (u.pathname === '/clip.webm' || u.pathname === '/trimmed.webm') return serveMedia(req, res, WEBM, 'video/webm');
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
        if (b.clear) {
          jobs[0] = { ...jobs[0], trim: null, video: '/clip.webm', poster: '/ref.png' };
        } else {
          jobs[0] = { ...jobs[0], trim: { start: b.start, end: b.end, seconds: Math.round((b.end - b.start) * 1000) / 1000, status: 'baking', url: '', error: '' } };
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
  {
    const k = await keepBox();
    ok('the keep bar is the whole strip', near(k.a, 0, 0.02) && near(k.b, 1, 0.02));
  }

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
  ok('the player closes on a trim', await page.$eval('#player', (el) => el.hidden));
  ok('the card says it is trimming', /trimming to 1\.2–3\.6s/.test(await page.textContent('#job-clip1')));

  // the poll has to keep running or the card sits on "trimming…" forever
  const reads = jobReads;
  await page.waitForTimeout(5000);
  ok('a baking trim keeps the poll alive', jobReads > reads);

  // ── it lands ───────────────────────────────────────────────────────────
  jobs[0] = { ...jobs[0], video: '/trimmed.webm', poster: '/ref.png',
    trim: { start: 1.2, end: 3.6, seconds: 2.4, status: 'ready', url: '/trimmed.webm', error: '' } };
  await page.evaluate(() => window.loadJobs && window.loadJobs());
  await page.waitForFunction(() => /trimmed 1\.2–3\.6s/.test(document.getElementById('job-clip1').textContent), null, { timeout: 8000 });
  ok('the card says what is kept', /trimmed 1\.2–3\.6s · keeping 2\.4s/.test(await page.textContent('#job-clip1')));
  ok('save hands her the TRIMMED clip', /\/trimmed\.webm$/.test(await page.$eval('#job-clip1 .acts a', (a) => a.getAttribute('href'))));

  // ── re-opening: the marks come back, and the button knows it ───────────
  await page.click('#job-clip1 .thumb');
  await page.waitForSelector('#player .pstage video');
  await page.waitForFunction(() => {
    const v = document.querySelector('#player .pstage video');
    return v && isFinite(v.duration) && v.duration > 0;
  }, null, { timeout: 8000 });
  await page.waitForTimeout(250);
  ok('a trimmed clip still opens its ORIGINAL',
    /\/clip\.webm$/.test(await page.$eval('#player .pstage video', (v) => v.currentSrc)));
  ok('with her marks already on it', /^1\.2s – 3\.6s/.test((await page.textContent('#tspan')).trim()));
  ok('and the button says Re-trim', (await page.textContent('#tgo')).trim() === 'Re-trim');

  await page.click('#treset');
  await page.waitForTimeout(120);
  ok('back to the whole clip', /the whole clip/.test(await page.textContent('#tspan')));
  ok('and the button becomes the undo', (await page.textContent('#tgo')).trim() === 'Undo the trim');
  await page.click('#tgo');
  await page.waitForTimeout(400);
  ok('undoing sends clear, and no span', got.length === 2 && got[1].clear === true && got[1].start == null);
  await page.waitForFunction(() => !/trimmed 1\.2/.test(document.getElementById('job-clip1').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('and the card stops saying it is trimmed', !/trimmed 1\.2–3\.6s/.test(await page.textContent('#job-clip1')));

  // ── the backdrop still closes ──────────────────────────────────────────
  await page.click('#job-clip1 .thumb');
  await page.waitForSelector('#player .pstage video');
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('#player .pstage').click());
  await page.waitForTimeout(150);
  ok('a tap on the backdrop closes the player', await page.$eval('#player', (el) => el.hidden));

  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* temp */ }
  report();
})().catch((e) => { console.error(e); process.exit(1); });
