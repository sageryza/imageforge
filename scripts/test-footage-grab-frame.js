#!/usr/bin/env node
/* FOOTAGE — GRAB FRAME (2026-09-12, Sophie: "I need to cut one out. I said
   the last frame doesn't have the curtains" · "it shouldn't file to the dump.
   It should give me a way to use it immediately as a reference for my next
   film").

   Three parts, in the order they can lie to you:

   1. THE RULES, PURE — framePlan's decision table. No Firestore, no bucket,
      no ffmpeg.
   2. A REAL PULL, MEASURED WITH ffprobe. A recipe that reads perfectly and
      a png that is the wrong size (or the nearest keyframe rather than the
      second asked for) look identical to any source assertion, so a frame
      is pulled for real out of a clip whose picture CHANGES with time, and
      the OUTPUT is probed: its size, and which second it really shows.
   3. THE REAL PAGE, HEADLESS, every assertion a MEASUREMENT — the word
      really on the row at 390pt and taking its own tap, the second the stub
      server ACTUALLY received against the playhead, the reference really in
      the strip afterwards, the draft carrying it, and nothing posted to the
      Dump.

   Run: node scripts/test-footage-grab-frame.js */
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
    console.log('FOOTAGE GRAB FRAME — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE GRAB FRAME — ' + pass + ' passed');
}

// ─── 1. THE RULES, PURE ──────────────────────────────────────────────────
const done = { status: 'completed', video: 'https://s/clip.mp4' };
{
  const good = F.framePlan(done, { at: 2.5 });
  ok('a good second plans', !good.error && good.at === 2.5 && good.source === done.video);
  ok('the frame is content-addressed under footage/frames, as a png', /^footage\/frames\/[0-9a-f]{40}\.png$/.test(good.path));
  ok('BAKED ONCE — the same second is the same object', F.framePlan(done, { at: 2.5 }).key === good.key);
  ok('a different second is a different object', F.framePlan(done, { at: 2.6 }).key !== good.key);
  ok('a different SOURCE is a different object', F.framePlan({ status: 'completed', video: 'https://s/other.mp4' }, { at: 2.5 }).key !== good.key);
  ok('a frame and a trim at the same numbers are different objects',
    F.framePath(done.video, 2.5).key !== F.trimPlan(done, { start: 2.5, end: 3 }).key);
  ok('milliseconds, never floating dust', F.framePlan(done, { at: 0.10000001 }).at === 0.1);
  ok('the first frame is a normal ask', !F.framePlan(done, { at: 0 }).error);
  ok('a frame is at 0 or later', /0 or later/.test(F.framePlan(done, { at: -1 }).error || ''));
  ok('a number, or the reason', /needs a second/.test(F.framePlan(done, { at: 'x' }).error || ''));
  ok('nothing past a clip this page makes', /past any clip/.test(F.framePlan(done, { at: 700 }).error || ''));
  ok('a clip still drawing is not grabbed from', /once the clip has drawn/.test(F.framePlan({ status: 'sent', video: '' }, { at: 1 }).error || ''));
  ok('a FAILED clip is not grabbed from', /once the clip has drawn/.test(F.framePlan({ status: 'failed', video: '' }, { at: 1 }).error || ''));
  ok('a clip with no file is not grabbed from', /once the clip has drawn/.test(F.framePlan({ status: 'completed', video: '' }, { at: 1 }).error || ''));
  // the route is declared, and the page has no copy of the folder name
  const src = fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8');
  ok('the route exists', /router\.post\('\/jobs\/:id\/frame'/.test(src));
  ok('the pull stands in the trim queue (one decode at a time)', /async function grabFrame[\s\S]*?return gateTrim\(/.test(src));
  const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
  ok('the page never posts a grabbed frame to the Dump', !/tgrab[\s\S]{0,1500}drop\/upload-file/.test(html));
}

// ─── 2. A REAL PULL, MEASURED ────────────────────────────────────────────
let FF = null, FP = null;
try { FF = require('ffmpeg-static'); } catch (_) { /* none here */ }
try { FP = require('ffprobe-static').path; } catch (_) { /* none here */ }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fgrab-'));
const mp4 = path.join(tmp, 'src.mp4');
if (FF) {
  // a clip whose picture is a DIFFERENT flat colour every second — so the
  // pulled frame says, in its own pixels, which second it came from
  const cols = ['red', 'lime', 'blue', 'yellow', 'magenta'];
  const inputs = [];
  cols.forEach((c) => { inputs.push('-f', 'lavfi', '-i', `color=c=${c}:size=320x240:rate=24:duration=1`); });
  execFileSync(FF, ['-y', '-loglevel', 'error', ...inputs,
    '-filter_complex', cols.map((_, i) => `[${i}:v]`).join('') + `concat=n=${cols.length}:v=1:a=0[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-g', '48', '-pix_fmt', 'yuv420p', mp4]);
}

(async () => {
  if (FF && FP) {
    const png = path.join(tmp, 'f.png');
    await F.pullFrame(mp4, png, 2.5);
    const info = JSON.parse(execFileSync(FP, ['-v', 'error', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', png]).toString());
    const st = (info.streams || [])[0] || {};
    ok('a real pull is a png', st.codec_name === 'png');
    ok('at the clip\'s own size, never scaled', st.width === 320 && st.height === 240);
    // THE MEASUREMENT: 2.5s into red·lime·blue·yellow·magenta is the BLUE
    // second. The nearest keyframe is at 2.0s — also blue — so the seek is
    // asked at 1.02s too, inside the LIME second and 0.98s past the red
    // keyframe: a keyframe-only seek answers red there.
    const meanRGB = (file) => {
      const out = execFileSync(FF, ['-v', 'error', '-i', file, '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
      return [out[0], out[1], out[2]];
    };
    const b = meanRGB(png);
    ok('the frame really shows the second asked for (blue at 2.5s)', b[2] > 180 && b[0] < 80 && b[1] < 80);
    const png2 = path.join(tmp, 'f2.png');
    await F.pullFrame(mp4, png2, 1.02);
    const g = meanRGB(png2);
    ok('and not the nearest keyframe (lime at 1.02s, not red)', g[1] > 180 && g[0] < 80);
  } else {
    console.log('  (ffmpeg/ffprobe missing — the real-pull half skipped)');
  }

  // ─── 3. THE REAL PAGE ──────────────────────────────────────────────────
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
  if (!chromium) { console.log('footage grab frame: playwright not installed — page half skipped'); report(); return; }
  if (!FF) { console.log('footage grab frame: no ffmpeg — page half skipped'); report(); return; }

  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const webm = path.join(tmp, 'clip.webm');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=5',
    '-c:v', 'libvpx', '-b:v', '200k', webm]);
  const WEBM = fs.readFileSync(webm);

  const got = [];            // every frame ask the server really received
  let dumpPosts = 0;
  const jobs = [{
    id: 'clip1', prompt: 'the ward corridor', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: '/clip.webm', source: '/clip.webm', poster: '/ref.png', refs: [],
    sentAt: '2026-09-12T08:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false, trims: [],
  }];
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
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (u.pathname === '/footage') {
        const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
        res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
      }
      if (u.pathname === '/clip.webm') return serveMedia(req, res, WEBM, 'video/webm');
      if (u.pathname === '/ref.png' || u.pathname === '/frame.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
      if (u.pathname === '/api/footage/status') {
        return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
          models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
      }
      if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
      if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
      if (/^\/api\/footage\/jobs\/[^/]+\/frame$/.test(u.pathname)) {
        const b = JSON.parse(body || '{}');
        got.push(b);
        return json({ ok: true, url: '/frame.png', at: b.at, banked: false });
      }
      if (u.pathname.startsWith('/api/drop/')) { dumpPosts += 1; return json({ ok: true }); }
      if (/^\/api\/footage\/jobs\/[^/]+\/(vote|hide|trim)$/.test(u.pathname)) return json({ ok: true, job: jobs[0] });
      if (u.pathname.startsWith('/api/gallery/')) return json({ ok: true, notes: [] });
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

  ok('no page errors', errors.length === 0);
  const refsBefore = await page.$$eval('#refs .ref', (els) => els.length);

  await page.click('#job-clip1 .thumb');
  await page.waitForSelector('#player .pstage video');
  await page.waitForFunction(() => {
    const v = document.querySelector('#player .pstage video');
    return v && isFinite(v.duration) && v.duration > 0;
  }, null, { timeout: 8000 });
  await page.waitForTimeout(200);

  ok('the word is on the trimmer', await shown('#tgrab'));
  ok('and it says Grab frame', (await page.textContent('#tgrab')).trim() === 'Grab frame');
  // THE ROW FITS 390pt — every control on ONE line and every one taking its
  // own tap. A button pushed off the right of the row is "visible" to every
  // width assertion ever written.
  const row = await page.evaluate(() => {
    const ids = ['tback', 'tin', 'tout', 'tgrab', 'tfwd'];
    const tops = new Set(); const out = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      tops.add(Math.round(r.top));
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.push({ id, hit: at === el || el.contains(at), inside: r.left >= 0 && r.right <= window.innerWidth });
    });
    return { lines: tops.size, out };
  });
  ok('the row is ONE line at 390pt', row.lines === 1);
  ok('every control on it is inside the screen', row.out.every((o) => o.inside));
  ok('and takes its own tap', row.out.every((o) => o.hit));
  await page.screenshot({ path: path.join(process.env.SHOT_DIR || tmp, 'grab-frame.png') }).catch(() => {});

  // ── the grab ───────────────────────────────────────────────────────────
  await seek(2.5);
  await page.click('#tgrab');
  await page.waitForFunction(() => document.getElementById('player').hidden, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(250);
  ok('the server was asked ONCE', got.length === 1);
  ok('for the second under the playhead', got.length === 1 && near(got[0].at, 2.5, 0.2));
  ok('the player closes with the frame in hand', await page.$eval('#player', (el) => el.hidden));
  const strip = await page.$$eval('#refs .ref', (els) => els.map((el) => ({
    src: (el.querySelector('img') || {}).src || '', slot: (el.querySelector('.slot') || {}).textContent || '',
  })));
  ok('the frame is a reference in the strip now', strip.length === refsBefore + 1 && strip.some((r) => /\/frame\.png$/.test(r.src)));
  ok('as a plain slot, not a keyframe', strip.some((r) => /\/frame\.png$/.test(r.src) && /^\[Image\d\]$/.test(r.slot.trim())));
  ok('and it says so', /reference now/.test(await page.textContent('#toast')));
  ok('nothing went to the Dump', dumpPosts === 0);
  const draft = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('footage_draft') || '{}'); } catch (e) { return {}; } });
  ok('the draft carries it, so a reload keeps it', Array.isArray(draft.refs) && draft.refs.some((r) => /\/frame\.png$/.test(r.url)));

  // a second grab of the same second is the same reference, not a twin
  await page.click('#job-clip1 .thumb');
  await page.waitForSelector('#player .pstage video');
  await page.waitForFunction(() => { const v = document.querySelector('#player .pstage video'); return v && isFinite(v.duration) && v.duration > 0; }, null, { timeout: 8000 });
  await seek(2.5);
  await page.click('#tgrab');
  await page.waitForFunction(() => document.getElementById('player').hidden, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(250);
  ok('the same frame twice is ONE reference', (await page.$$eval('#refs .ref', (els) => els.length)) === refsBefore + 1);
  ok('no page errors at the end', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
