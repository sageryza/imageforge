#!/usr/bin/env node
/* FOOTAGE — Seedance clips by her own hand (2026-09-09, Sophie: "build a
   point so I can just make things on my own time by describing them or
   uploading references"), reworked the same day off her own list.

   The pure half is footage.js, which did NOT move: the door decision (a
   person-safe job goes OpenRouter first and falls to APIFRAME; 1.5 Pro is
   APIFRAME only; a pinned door is obeyed), the estimate, the slot names in
   attach order, and the body both doors take. APIFRAME is still a door there
   — a chat sends a job with a person in a reference through it — it is only
   the PAGE that stopped offering it.

   The page half drives the REAL public/footage.html in headless Chromium
   against a stub that RECORDS what the page really POSTs — a lit control says
   nothing about what left the phone — and MEASURES the rest: a `--cols` that
   never reached the grid, a select still drawing native chrome, and a control
   under the autoscroll pill all look perfectly fine in markup.

   Her list, 2026-09-09: no section labels · the controls on as few rows as
   they fit on · the Add word is a picture icon · model and resolution are
   drop-downs with 1.5 Pro off them · the seconds are typed · OpenRouter only ·
   sound always on · no Plan step, the star sends on its tap with the price
   beside it · the balance behind the "?" · the Playground's List/Tiles/3-4
   switch on the feed.

   Run: node scripts/test-footage.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE — ' + pass + ' passed');
}

// ── the pure half — footage.js, unchanged by the page's rework ──────────────
{
  const F = require('../footage');
  const both = { openrouter: true, apiframe: true };
  ok('auto with no Atlas: a 2.x model goes OpenRouter first with APIFRAME as the fallback',
    JSON.stringify(F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, both)) === '{"door":"openrouter","fallback":"apiframe"}');
  ok('1.5 Pro is APIFRAME only, whatever auto says', F.doorFor({ model: '1.5', door: 'auto', resolution: '480p' }, both).door === 'apiframe');
  ok('pinning OpenRouter on 1.5 Pro is refused with a reason', /only on APIFRAME/.test(F.doorFor({ model: '1.5', door: 'openrouter', resolution: '480p' }, both).error || ''));
  // THE APIFRAME DOOR STAYS IN THE MODULE — the page stopped offering it, a
  // chat did not stop using it (a person in a reference has nowhere else to go)
  ok('a pinned APIFRAME door is still obeyed with no fallback',
    JSON.stringify(F.doorFor({ model: '2.5', door: 'apiframe', resolution: '480p' }, both)) === '{"door":"apiframe","fallback":null}');
  ok('with OpenRouter unconfigured auto lands on APIFRAME', F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, { openrouter: false, apiframe: true }).door === 'apiframe');
  ok('1080p on APIFRAME is unpriced and refused as a pinned door', Boolean(F.doorFor({ model: '2.0', door: 'apiframe', resolution: '1080p' }, both).error));
  ok('1080p auto goes OpenRouter with NO fallback (APIFRAME cannot price it)',
    JSON.stringify(F.doorFor({ model: '2.0', door: 'auto', resolution: '1080p' }, both)) === '{"door":"openrouter","fallback":null}');
  // ATLAS IS THE DEFAULT (2026-09-09, Sophie: "make atlas the default and
  // only route through footage") — every 2.x row carries an Atlas id, auto
  // goes there first with APIFRAME behind it for a famous face, and a pinned
  // Atlas door never falls back
  const three = { openrouter: true, apiframe: true, atlascloud: true };
  ok('auto with Atlas configured: a 2.x model goes Atlas first with APIFRAME as the fallback',
    JSON.stringify(F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, three)) === '{"door":"atlascloud","fallback":"apiframe"}');
  ok('every 2.x row is on Atlas; 1.5 Pro is not', ['mini', 'fast', '2.0', '2.5'].every((id) => F.doorFor({ model: id, door: 'atlascloud', resolution: '480p' }, three).door === 'atlascloud')
    && /not on Atlas Cloud/.test(F.doorFor({ model: '1.5', door: 'atlascloud', resolution: '480p' }, three).error || ''));
  ok('a pinned Atlas door has no fallback',
    JSON.stringify(F.doorFor({ model: 'mini', door: 'atlascloud', resolution: '480p' }, three)) === '{"door":"atlascloud","fallback":null}');
  ok('with no ATLASCLOUD_API_KEY a pinned Atlas door is refused with a reason, never sent elsewhere',
    /ATLASCLOUD_API_KEY/.test(F.doorFor({ model: 'mini', door: 'atlascloud', resolution: '480p' }, both).error || ''));
  ok('2.0 at 1080p is unpriced on Atlas, so auto goes OpenRouter there',
    F.doorFor({ model: '2.0', door: 'auto', resolution: '1080p' }, three).door === 'openrouter');
  ok('there is no mini-atlas row any more — the door rides the rows', !F.publicModels().some((m) => m.id === 'mini-atlas'));
  const at = F.estimate({ model: 'mini', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three);
  ok('an Atlas price with no live read is per second off its LIST rate and "about"', at.door === 'atlascloud' && at.about === true && at.cents === 22.4);
  ok('the Atlas list rates per row: Fast 9¢/s · 2.0 11.2¢/s · 2.5 16.7¢/s',
    F.estimate({ model: 'fast', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three).cents === 36
    && F.estimate({ model: '2.0', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three).cents === 44.8
    && F.estimate({ model: '2.5', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three).cents === 66.8);
  ok('publicModels flags every 2.x row for Atlas', F.publicModels().filter((m) => m.atlascloud).map((m) => m.id).join(',') === 'mini,fast,2.0,2.5');
  ok('cardOf reads an Atlas job back onto its row', (() => { const c = F.cardOf('x', { prompt: 'p', model: 'bytedance/seedance-2.0-mini/reference-to-video', provider: 'atlascloud', params: { duration: 4 }, status: 'completed' }); return c.model === 'mini' && c.door === 'atlascloud'; })());
  ok('a pinned OpenRouter door is still obeyed (a chat\'s door, not the page\'s any more)',
    JSON.stringify(F.doorFor({ model: 'mini', door: 'openrouter', resolution: '480p' }, both)) === '{"door":"openrouter","fallback":null}');

  // ── THE PRICE, PINNED TO THE HUNDREDTH OF A CENT AGAINST REAL CHARGES ──
  // 113 completed OpenRouter jobs (their `usage.cost`), 44 APIFRAME jobs
  // (their `creditCost`), and ffprobe on the output clips (2026-09-09).
  // Three findings hold this up and each one is worth a figure of its own:
  // Mini renders on the 2.5 CANVASES, a clip is 24·s + 1 FRAMES, and the
  // price is LIST credit — the 5% top-up fee is not in it. The discount is
  // INJECTED here so the 60%-off era can be pinned without a live read.
  const orC = (o) => F.estimate(Object.assign({ door: 'openrouter', ratio: '3:4', seconds: 4, model: 'mini', resolution: '480p' }, o), both);
  ok('Mini 480p 3:4 4s at list is 13.96¢ — the exact charge on today\'s two Footage jobs', orC({}).cents === 13.96);
  ok('the same job under the 60% sale is 5.58¢', orC({ discount: 0.6 }).cents === 5.58);
  ok('Mini 480p 1:1 4s under the sale is 5.43¢ (640×640, the 2.5 canvas)', orC({ ratio: '1:1', discount: 0.6 }).cents === 5.43);
  ok('Mini 720p 3:4 4s under the sale is 12.30¢ (834×1112)', orC({ resolution: '720p', discount: 0.6 }).cents === 12.3);
  ok('Mini 480p 3:4 15s under the sale is 20.78¢', orC({ seconds: 15, discount: 0.6 }).cents === 20.78);
  ok('a clip is 24·s + 1 frames, and that +1 is what lands it on the cent', F.framesOf(4) === 97 && F.framesOf(15) === 361);
  ok('MINI RENDERS ON THE 2.5 CANVASES — measured with ffprobe, not read off the 2.0 table',
    JSON.stringify(F.canvasOf(F.modelOf('mini'), '480p', '3:4')) === '[560,752]'
    && JSON.stringify(F.canvasOf(F.modelOf('mini'), '480p', '1:1')) === '[640,640]'
    && JSON.stringify(F.canvasOf(F.modelOf('mini'), '720p', '3:4')) === '[834,1112]');
  ok('the models never measured on OpenRouter keep the published 2.0 canvases',
    JSON.stringify(F.canvasOf(F.modelOf('2.0'), '480p', '3:4')) === '[480,640]' && JSON.stringify(F.canvasOf(F.modelOf('2.5'), '480p', '3:4')) === '[560,752]');
  // THE SALE IS READ LIVE, NEVER HARDCODED — ByteDance's campaign is still
  // running (mini at 40% of list to 2026-10-07) but OpenRouter stopped passing
  // it on today, so the factor is `pricing.discount` off OpenRouter's own
  // endpoints record and nothing about it lives in the table.
  ok('no sale factor is written into the model table', !/\bsale\s*:/.test(fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8')));
  ok('the discount is applied as list × (1 − discount): 0.6 off is 5.58¢, none is 13.96¢',
    orC({ discount: 0.6 }).cents === 5.58 && orC({ discount: 0 }).cents === 13.96);
  ok('an unread discount is 0 — full list, the safe direction, never a stale sale', F.discountOf('mini') === 0 && orC({}).cents === 13.96);
  ok('the live discount rides /status per model', F.publicModels().every((m) => typeof m.discount === 'number'));
  ok('the 5% top-up fee is NOT in the shown price, and is still exported for anything that reads it',
    F.OR_FEE === 1.05 && orC({}).cents === Math.round((560 * 752 * 97 / 1024) * 3.5e-6 * 10000) / 100);
  // A NO-VIDEO JOB IS EXACT; A REFERENCE VIDEO IS NOT PINNED — one job only
  // (6.48¢ against 5.43¢ under the sale, i.e. ~19% MORE, not the discount the
  // published SKU advertises), so it is estimated at the same rate and said to
  // be "about" until it is measured.
  ok('a no-video OpenRouter estimate answers exact, never about', orC({}).exact === true && !orC({}).about);
  const ev = orC({ hasVideo: true });
  ok('a reference video is estimated at the same rate and marked about', ev.cents === orC({}).cents && ev.about === true && !ev.exact);
  // APIFRAME: 44 jobs, every one exact — 2.5 at 480p is 15¢/s with a
  // reference video and 13 without.
  const afC = (o) => F.estimate(Object.assign({ door: 'apiframe', model: '2.5', resolution: '480p', ratio: '3:4', seconds: 4 }, o), both);
  ok('APIFRAME 2.5 480p 4s with a reference video is 60¢', afC({ hasVideo: true }).cents === 60 && afC({ hasVideo: true }).exact === true);
  ok('and 52¢ without one', afC({}).cents === 52 && afC({}).exact === true);
  ok('the same rate holds at 15s and 30s (225¢ and 450¢)', afC({ hasVideo: true, seconds: 15 }).cents === 225 && afC({ hasVideo: true, seconds: 30 }).cents === 450);
  ok('an unmeasured APIFRAME rung says about rather than pretending', afC({ resolution: '720p' }).about === true && !afC({ resolution: '720p' }).exact);

  // slots in attach order: images, then videos, then audio
  const s = F.slotsOf([{ url: 'a.mp4' }, { url: 'b.png', kind: 'image' }, { url: 'c.m4a' }, { url: 'd.jpg' }]).map((r) => r.slot);
  ok('slots are numbered per kind, in list order', JSON.stringify(s) === '["[Video1]","[Image1]","[Audio1]","[Image2]"]');

  // the body both doors take
  const b = F.buildJob({ prompt: 'a cat', model: 'mini', seconds: 4, resolution: '480p', ratio: '3:4', sound: true,
    refs: [{ url: 'https://x/a.png', kind: 'image' }, { url: 'https://x/v.mp4', kind: 'video' }, { url: 'not a url' }] });
  ok('buildJob maps refs into the three reference lists and drops a bad url',
    !b.error && JSON.stringify(b.body.referenceImageUrls) === '["https://x/a.png"]' && JSON.stringify(b.body.referenceVideoUrls) === '["https://x/v.mp4"]'
    && b.body.referenceAudioUrls.length === 0 && b.refs.length === 2);
  ok('the body carries chat=footage, the seconds, the shape and the sound the page always sends',
    b.body.chat === 'footage' && b.body.duration === 4 && b.body.aspectRatio === '3:4' && b.body.generateAudio === true && b.body.resolution === '480p');
  ok('a blank prompt is refused before anything is sent', Boolean(F.buildJob({ prompt: '  ' }).error));
  ok('seconds outside the model are refused (3s on Mini)', /seconds/.test(F.buildJob({ prompt: 'x', model: 'mini', seconds: 3 }).error || ''));
  ok('the minimum is the default when no seconds are sent', F.buildJob({ prompt: 'x', model: '2.5' }).seconds === 4);
  ok('the title is the prompt cut at a word', F.titleOf('a '.repeat(60)).length <= 70 && F.titleOf('short') === 'short');

  // the card off a log doc
  const c = F.cardOf('j1', { prompt: 'p', model: 'bytedance/seedance-2.0-mini', provider: 'openrouter', status: 'completed', video: 'https://v', cost: 0.054,
    params: { duration: 4, resolution: '480p', aspect_ratio: '3:4' }, references: { images: ['https://i'], videos: [], audio: [] } });
  ok('cardOf reads the model, the door, the status and the cost off the log doc',
    c.model === 'mini' && c.door === 'openrouter' && c.status === 'done' && c.cost === 5.4 && c.seconds === 4 && c.refs[0].slot === '[Image1]');

  // the page's own model list is DERIVED — every model it can offer is one
  // Atlas Cloud carries, and 1.5 Pro is the one that is not
  const atModels = F.publicModels().filter((m) => m.atlascloud).map((m) => m.id);
  ok('the Atlas table is what the page can offer, and 1.5 Pro is not in it',
    atModels.length === 4 && atModels.indexOf('1.5') < 0 && atModels.indexOf('mini') === 0);

  // source pins
  const sv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  ok('server.js mounts /api/footage', /app\.use\('\/api\/footage', require\('\.\/footage'\)\.router\)/.test(sv));
  ok('/footage is served gated with the pill', /app\.get\('\/footage', serveGated\('footage\.html', \{ pill: true \}\)\)/.test(sv));
  const al = fs.readFileSync(path.join(ROOT, 'applinks.js'), 'utf8');
  const fl = fs.readFileSync(path.join(ROOT, 'ios/ImageForge/ForgeLinks.swift'), 'utf8');
  const rv = fs.readFileSync(path.join(ROOT, 'ios/ImageForge/RootView.swift'), 'utf8');
  ok('/footage is a universal link on both sides', /\['\/footage', 'footage'\]/.test(al) && /"\/footage": "footage"/.test(fl));
  ok('the app has a .footage Tool with the page path and the pill mirror', /case \.footage:\s+return "\/footage"/.test(rv) && /"\/footage"/.test(rv.slice(rv.indexOf('forgePillPages')))
    && /GatedWebTool\(path: "\/footage"/.test(rv));
  ok('Footage sits in the pipeline\'s pictures stage', /tools: \[\.character, \.movie, \.dreams, \.footage\]/.test(rv));
  const or = fs.readFileSync(path.join(ROOT, 'openrouter.js'), 'utf8');
  const af = fs.readFileSync(path.join(ROOT, 'apiframe.js'), 'utf8');
  ok('both doors export startVideo and pollVideo for the in-process send', /startVideo, pollVideo/.test(or) && /startVideo, pollVideo/.test(af));
  const page = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
  ok('the page holds no price figure of its own (it asks /estimate)', !/\d+\.\d+e-6|afCents\s*:\s*\{/.test(page) && /\/estimate/.test(page));
  ok('the page wears the house star on GO, the one button that spends', /id="go"[^>]*><span id="gostar">/.test(page) && /M 55\.8 31\.9/.test(page));
  ok('text boxes ship empty — no placeholder anywhere', !/placeholder=/.test(page) && /<textarea id="prompt"><\/textarea>/.test(page));
  ok('the page script is one IIFE (the injected pill\'s globals are safe)', /<script>\n\(function \(\) \{/.test(page));
  ok('[hidden] still beats an author display rule', /\[hidden\]\{display:none !important\}/.test(page));
  // THE PLAN STEP IS GONE, and so is every door and sound control
  ok('no plan card is left in the page', !/id="plan"|planGo|planBody|showPlan/.test(page));
  ok('the page offers no door and no sound switch', !/data-door=|id="doors"|id="sound"/.test(page));
  ok('there is no .lab section label left in the markup', !/class="lab"/.test(page));
  ok('the icons are inline Lucide, never emoji, and the picture one is there', /image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1\.8"/.test(page));
}

// ── the page half ────────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage: playwright not installed — page half skipped'); report(); return; }
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
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const posted = [];
const estQ = [];          // every /estimate the page asked for, so the ONE-DOOR
                          // claim is measured rather than asserted as true
let statusCalls = 0;
let discount = 0;        // what OpenRouter is passing on today, as /status says AND /estimate prices
let atlasPays = 100;     // the percent of list Atlas charges today — 100 is no sale, 20 is the 80%-off Mini
// cents per second on Atlas for a model, off its list rate × what it charges today
const ATLAS_LIST = { mini: 5.6, fast: 9, '2.0': 11.2, '2.5': 16.7 };
const atlasRate = (id) => (ATLAS_LIST[id] || 0) * atlasPays / 100;
let refuse = false;      // the next POST comes back as a ByteDance content refusal
let slow = 0;            // ms the next POST is held, so the one-tap guard is measurable

// EIGHT CLIPS, ALL 3:4 — eight divides by neither 3 nor 4 raggedly enough to
// hide a miscount in the first row, and one shape means every cell on a row is
// the same height. `old1` carries FOUR references, which is what makes a
// card's own picture row measurable at 3 and at 4 across.
const REFS4 = [1, 2, 3, 4].map((n) => ({ url: 'http://127.0.0.1:PORT/ref.png', kind: 'image', slot: '[Image' + n + ']' }));
let jobs = [
  { id: 'old1', prompt: 'a dog on a beach, camera at eye level', model: 'mini', modelLabel: '2.0 Mini', door: 'openrouter', seconds: 4, resolution: '480p', ratio: '3:4',
    sound: true, refs: REFS4, status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    cost: 5.6, estimate: 6, sentAt: '2026-09-09T08:00:00.000Z', vote: '', hidden: false },
].concat(Array.from({ length: 7 }, (_, i) => ({
  id: 'f' + i, prompt: 'the socks on the line ' + i, model: 'mini', modelLabel: '2.0 Mini', door: 'openrouter', seconds: 4, resolution: '480p', ratio: '3:4',
  sound: true, refs: [], status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
  cost: 5.6, estimate: 6, sentAt: '2026-09-09T0' + i + ':00:00.000Z', vote: '', hidden: false,
})));

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/clip.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      statusCalls += 1;
      return json({ ok: true, doors: { openrouter: true, apiframe: true, atlascloud: true }, balances: { openrouter: { configured: true, left: 35.72 }, apiframe: { configured: true, credits: 817 }, atlascloud: { configured: true } },
        models: F.publicModels().map((m) => ({ ...m, ...(m.openrouter ? { discount } : {}), ...(m.atlascloud ? { atlasPerSec: atlasRate(m.id) / 100, atlasPays } : {}) })), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') {
      const q = Object.fromEntries(u.searchParams);
      estQ.push(q);
      // the Atlas door is priced by the stub the way footage.js prices it —
      // the live per-second rate (the sale applied) × seconds, exact with no
      // reference video
      if (q.door === 'atlascloud') {
        const c = Math.round(atlasRate(q.model) * Number(q.seconds) * 100) / 100;
        return json({ ok: true, cents: c, door: 'atlascloud', ...(q.video === '1' ? { about: true } : { exact: true }) });
      }
      return json({ ok: true, ...F.estimate({ model: q.model, resolution: q.res, ratio: q.ratio, seconds: q.seconds, hasVideo: q.video === '1', door: q.door, discount }, { openrouter: true, apiframe: true }) });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const answer = () => {
        if (refuse) { refuse = false; return json({ error: 'ByteDance refused a reference', refusal: 'content', hint: 'that job goes through /api/apiframe/video' }, 400); }
        jobs.unshift({ id: 'new1', prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds, resolution: b.resolution, ratio: b.ratio,
          sound: true, refs: [], status: 'drawing', sentAt: new Date().toISOString(), estimate: 7, vote: '' });
        json({ ok: true, jobId: 'new1', door: 'atlascloud', fellBack: false, estimate: 7 }, 202);
      };
      if (slow) { const ms = slow; slow = 0; return setTimeout(answer, ms); }
      return answer();
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) { posted.push({ vote: u.pathname, body: JSON.parse(body) }); return json({ ok: true }); }
    if (u.pathname === '/api/drop/upload-file') {
      posted.push({ upload: Object.fromEntries(u.searchParams), ct: req.headers['content-type'], bytes: body.length });
      return json({ ok: true, item: { id: 'd1', url: 'http://127.0.0.1:' + server.address().port + '/ref.png', posterUrl: null, media: 'image' } });
    }
    res.writeHead(404); res.end('nope');
  });
});

// Her phone's own safe-area inset. It is 0 in headless Chromium and 47 on an
// iPhone 13, and the pill's top rides it — so every collision this page has
// ever had was invisible without it (Freeform's lesson, same shape).
const INSET = (n) => (function (px) {
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '.float{top:' + px + 'px !important}';
    document.head.appendChild(st);
  });
});

// Anything a finger aims at, plus the boxes that draw a border under the pill.
const SWEEP = 'button,select,input,textarea,a,.ref,.panel,.selwrap,.step,.chips';
async function pillSweep(pg, where) {
  const pill = await pg.evaluate(() => {
    const f = document.querySelector('body > .float');
    if (!f || getComputedStyle(f).display === 'none') return null;
    const r = f.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left) };
  });
  ok(where + ': the pill is on screen (this page scrolls)', Boolean(pill));
  if (!pill) return;
  const bad = await pg.evaluate((sel) => {
    const f = document.querySelector('body > .float').getBoundingClientRect();
    const out = [];
    document.querySelectorAll(sel).forEach((e) => {
      if (e.closest('.float') || e.closest('.helpcard')) return;
      const q = e.getBoundingClientRect();
      if (!q.width || !q.height || q.bottom < 0 || q.top > innerHeight) return;
      if (q.right > f.left && q.left < f.right && q.bottom > f.top && q.top < f.bottom) {
        // elementFromPoint is the only honest question: a covered control
        // passes every width assertion ever written about it
        const hit = document.elementFromPoint(Math.min(q.x + q.width / 2, innerWidth - 1), q.y + q.height / 2);
        out.push({ el: e.id || e.className || e.tagName, rect: [q.x, q.y, q.width, q.height].map(Math.round), covered: !!(hit && hit.closest('.float')) });
      }
    });
    return out;
  }, SWEEP);
  ok(where + ': nothing at rest sits in the pill\'s column — ' + JSON.stringify(bad), bad.length === 0);
}

(async () => {
  {
    // Atlas's price, read live off its own model list (a stub door here)
    const F = require('../footage');
    const three = { openrouter: true, apiframe: true, atlascloud: true };
    F.init({ atlascloud: { configured: () => true, api: async (p) => (p === '/models' ? { data: [{ model: 'bytedance/seedance-2.0-mini/reference-to-video', price: { discount: '20', actual: { base_price: '0.011' }, origin: { base_price: '0.056' } } }] } : null) } });
    await F.atlasPrices();
    const atLive = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, door: 'auto' }, three);
    ok('with the live read the Atlas price is the SALE rate per second (1.1¢/s × 4s), EXACT — Atlas bills per second', atLive.door === 'atlascloud' && atLive.exact === true && atLive.cents === 4.4);
    const atVid = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, hasVideo: true, door: 'auto' }, three);
    ok('a reference video is still "about" on Atlas (one job measured ~19% more)', atVid.door === 'atlascloud' && atVid.about === true && atVid.cents === 4.4);
    ok('publicModels carries the live per-second rate for the "?" card', F.publicModels().some((m) => m.id === 'mini' && m.atlasPerSec === 0.011 && m.atlasPays === 20));
    ok('a row Atlas did not price keeps its list fallback', F.estimate({ model: 'fast', resolution: '480p', ratio: '16:9', seconds: 4, door: 'auto' }, three).about === true);
  }
  // `await` is not legal in the pure block above, so the one asynchronous
  // pure check rides here: a read that cannot happen answers 0 — full list —
  // rather than throwing or leaving a sale in place.
  ok('a failed endpoints read answers 0 rather than throwing', (await F.endpointDiscount('bytedance/nope')) === 0);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  jobs = JSON.parse(JSON.stringify(jobs).replace(/PORT/g, String(port)));
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(INSET(47), 47);
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#ratios button');
  await page.waitForFunction(() => /¢$/.test(document.getElementById('cost').textContent));
  await page.waitForSelector('#job-old1');
  await page.waitForTimeout(1800);                 // let the pill's settling passes run

  // ── the page rules ──────────────────────────────────────────────────────
  ok('no page errors', errors.length === 0);
  ok('the name appears once (one h1, nothing above it)', await page.$$eval('h1', (h) => h.length) === 1);
  ok('the prompt box is empty', (await page.$eval('#prompt', (t) => t.value)) === '');
  // NO SECTION LABELS (2026-09-09, Sophie: "no button word labels above (eg
  // seconds)") — measured on the rendered page, not only in the source.
  ok('no .lab section label renders anywhere', await page.$$eval('.lab', (l) => l.length) === 0);
  const helpHidden = await page.$eval('#helpcard', (e) => e.hidden);
  ok('the explanation is behind the ? and shut', helpHidden);

  // ── the balance moved behind the "?" and is read live ────────────────────
  const balInBody = await page.evaluate(() => {
    const t = document.querySelector('.panel').textContent + document.querySelector('#feedbar').textContent;
    return /left|OpenRouter \$|APIFRAME \$/.test(t);
  });
  ok('the balance is NOT in the page body any more', !balInBody);
  const before = statusCalls;
  await page.click('#help');
  await page.waitForTimeout(300);
  ok('tapping ? opens the card', !(await page.$eval('#helpcard', (e) => e.hidden)));
  ok('opening it reads the status LIVE', statusCalls > before);
  // ATLAS HAS NO BALANCE TO READ — the card must not quote OpenRouter's or
  // APIFRAME's as if it were the page's door's
  ok('the card quotes no balance at all (Atlas has none to read), and names Atlas as the door',
    (await page.$eval('#balline', (e) => e.hidden)) && /Through Atlas Cloud/.test(await page.$eval('#helpcard', (e) => e.textContent))
    && !/Through OpenRouter|5% more/.test(await page.$eval('#helpcard', (e) => e.textContent)));
  await page.click('body', { position: { x: 5, y: 820 } });
  ok('any tap closes it', await page.$eval('#helpcard', (e) => e.hidden));

  // ── model and resolution are drop-downs, 1.5 Pro is off the page ─────────
  const sel = await page.evaluate(() => {
    const m = document.getElementById('model'), r = document.getElementById('res');
    const cs = getComputedStyle(m);
    return { mTag: m.tagName, rTag: r.tagName,
      models: [...m.options].map((o) => o.value), reses: [...r.options].map((o) => o.value),
      appearance: cs.appearance || cs.webkitAppearance, radius: cs.borderRadius,
      chevs: document.querySelectorAll('.selwrap .chev svg').length,
      value: m.value, rvalue: r.value };
  });
  ok('the model is a <select> and the resolution is a <select>', sel.mTag === 'SELECT' && sel.rTag === 'SELECT');
  ok('1.5 Pro is off the list — APIFRAME is not one of this page\'s doors — and the four 2.x rows are the list',
    sel.models.indexOf('1.5') < 0 && sel.models.join(',') === 'mini,fast,2.0,2.5');
  ok('the native chrome is off and the box is the house 6px', sel.appearance === 'none' && sel.radius === '6px');
  ok('each drop-down draws our own inline chevron', sel.chevs === 2);
  ok('the resolution opens at the model\'s minimum', sel.rvalue === '480p' && sel.reses.join(',') === '480p,720p');

  // ── the seconds are typed, and clamped to the model\'s own range ─────────
  const secBox = await page.evaluate(() => {
    const b = document.getElementById('secs');
    return { type: b.type, value: b.value, min: b.min, max: b.max };
  });
  ok('seconds open at the model minimum, in a real number field',
    secBox.type === 'number' && secBox.value === '4' && secBox.min === '4' && secBox.max === '15');
  await page.fill('#secs', '9');
  await page.evaluate(() => document.getElementById('secs').blur());
  await page.waitForTimeout(120);
  ok('a number she types is kept when the model allows it', (await page.$eval('#secs', (e) => e.value)) === '9');
  // Mini runs 4–15, so 99 clamps DOWN and 1 clamps UP — the range comes off
  // the served model table, never a number typed into the page.
  await page.fill('#secs', '99');
  await page.evaluate(() => document.getElementById('secs').blur());
  await page.waitForTimeout(120);
  ok('a number past the model\'s max clamps to it (99 → 15)', (await page.$eval('#secs', (e) => e.value)) === '15');
  await page.fill('#secs', '1');
  await page.evaluate(() => document.getElementById('secs').blur());
  await page.waitForTimeout(120);
  ok('a number under the minimum clamps up (1 → 4)', (await page.$eval('#secs', (e) => e.value)) === '4');
  await page.selectOption('#model', '2.5');
  await page.waitForTimeout(150);
  ok('switching the model brings its own range with it (2.5 runs to 30)',
    (await page.$eval('#secs', (e) => e.max)) === '30');
  await page.fill('#secs', '20');
  await page.evaluate(() => document.getElementById('secs').blur());
  await page.waitForTimeout(120);
  ok('20 stands on 2.5', (await page.$eval('#secs', (e) => e.value)) === '20');
  await page.selectOption('#model', 'mini');
  await page.waitForTimeout(200);
  ok('going back to a shorter model re-clamps what she typed (20 → 15)', (await page.$eval('#secs', (e) => e.value)) === '15');
  await page.fill('#secs', '4');
  await page.evaluate(() => document.getElementById('secs').blur());
  await page.waitForFunction(() => document.getElementById('secs').value === '4');

  // ── one door, so the price line no longer names one; and it says "about"
  //    ONLY where the number is not pinned ──────────────────────────────────
  await page.waitForFunction(() => /¢$/.test(document.getElementById('cost').textContent));
  const cost0 = await page.$eval('#cost', (e) => e.textContent);
  ok('the price line is a price and nothing about a door: ' + cost0, /^\d+(\.\d{1,2})?¢$/.test(cost0));
  ok('a pinned price does not hedge — no "about" on a job with no reference video (Atlas bills per second)', !/about/.test(cost0));
  const beside = await page.evaluate(() => {
    const g = document.getElementById('go').getBoundingClientRect(), c = document.getElementById('cost').getBoundingClientRect();
    return { sameRow: Math.abs((g.top + g.height / 2) - (c.top + c.height / 2)) < 14, gap: Math.round(c.left - g.right) };
  });
  ok('the price sits right beside the star (gap ' + beside.gap + 'px)', beside.sameRow && beside.gap >= 0 && beside.gap < 30);
  await page.click('#secup');
  await page.waitForFunction((c) => document.getElementById('cost').textContent !== c, cost0);
  ok('one more second is a higher price', parseFloat((await page.$eval('#cost', (e) => e.textContent)).replace('about ', '')) > parseFloat(cost0.replace('about ', '')));
  await page.click('#secdn');
  await page.waitForFunction((c) => document.getElementById('cost').textContent === c, cost0);
  // A REFERENCE VIDEO IS THE ONE SHAPE STILL UNMEASURED, so the line hedges
  // for it and only for it.
  await page.setInputFiles('#file', { name: 'sock.mp4', mimeType: 'video/mp4', buffer: Buffer.from('x') });
  await page.waitForSelector('#refs .ref');
  await page.waitForFunction(() => /^about /.test(document.getElementById('cost').textContent));
  ok('a reference VIDEO makes the price say "about"', /^about \d+(\.\d{1,2})?¢$/.test(await page.$eval('#cost', (e) => e.textContent)));
  await page.click('#refs .x');
  await page.waitForFunction((c) => document.getElementById('cost').textContent === c, cost0);
  ok('taking it off makes the price exact again', !/about/.test(await page.$eval('#cost', (e) => e.textContent)));

  // ── the controls sit on as few rows as they fit on ───────────────────────
  const rows = await page.evaluate(() => {
    // A row is `align-items:center`, so two controls of different heights
    // share a LINE without sharing a top — count centres, in bands.
    return [...document.querySelectorAll('.panel .row, .panel .chips')].map((el) => {
      const kids = [...el.children].filter((k) => k.getBoundingClientRect().width);
      const mid = kids.map((k) => { const b = k.getBoundingClientRect(); return b.top + b.height / 2; }).sort((a, b) => a - b);
      let lines = mid.length ? 1 : 0;
      for (let i = 1; i < mid.length; i += 1) if (mid[i] - mid[i - 1] > 8) lines += 1;
      return { cls: el.className, lines, kids: kids.length };
    });
  });
  ok('the six shapes are ONE row (measured, not assumed)', rows.some((r) => r.cls === 'chips' && r.kids === 6 && r.lines === 1));
  ok('the star and its price share a line', rows.some((r) => r.kids === 2 && r.lines === 1));

  // ── the feed: a card, its references, and a repaint that changes nothing ─
  ok('the earlier clip is a card with its real cost', await page.$eval('#job-old1 .tags', (e) => /5\.6¢/.test(e.textContent) && /2\.0 Mini/.test(e.textContent)));
  ok('the card names its references by slot', await page.$eval('#job-old1 .usedrefs', (e) => /Image1/.test(e.textContent) && /Image4/.test(e.textContent)));
  const imgBefore = await page.evaluateHandle(() => document.querySelector('#job-old1 .thumb img'));
  await page.evaluate(() => fetch('/api/footage/jobs?limit=40').then((r) => r.json()));
  await page.waitForTimeout(200);
  ok('a repaint never rebuilds a card that did not change', await page.evaluate((h) => h === document.querySelector('#job-old1 .thumb img'), imgBefore));

  // ── LIST · TILES · 3/4, and the number MEASURED off the real cells ───────
  const across = (s2) => page.evaluate((sel2) => {
    const cells = [...document.querySelectorAll(sel2)].filter((c) => !c.hidden && c.getBoundingClientRect().width);
    if (!cells.length) return 0;
    const top = Math.round(cells[0].getBoundingClientRect().top);
    return cells.filter((c) => Math.round(c.getBoundingClientRect().top) === top).length;
  }, s2);
  const says = () => page.$eval('#v-cols', (e) => e.textContent.trim());
  ok('the switch opens on LIST', await page.$eval('#v-list', (b) => b.classList.contains('on')) && !(await page.$eval('#v-tiles', (b) => b.classList.contains('on'))));
  ok('the number segment says 3, never bars', (await says()) === '3');
  ok('a card\'s own reference row is three across', (await across('#job-old1 .usedrefs .ur')) === 3);
  await page.click('#v-cols');
  ok('one tap: four', (await says()) === '4' && (await across('#job-old1 .usedrefs .ur')) === 4);
  await page.click('#v-cols');
  ok('the next tap comes back to three — there is nowhere else to go', (await says()) === '3');
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell').length > 0);
  ok('TILES shows the clips as posters, and the list is put away',
    (await page.$eval('#feed', (e) => e.hidden)) && !(await page.$eval('#tiles', (e) => e.hidden))
    && (await page.$$eval('#tiles .cell img', (i) => i.length)) === 8);
  ok('the wall is three across', (await across('#tiles .cell')) === 3);
  await page.click('#v-cols');
  ok('and follows the same tap to four', (await across('#tiles .cell')) === 4);
  await page.reload();
  await page.waitForSelector('#tiles .cell');
  await page.waitForTimeout(400);
  ok('a reload comes back on the view she left it on', !(await page.$eval('#tiles', (e) => e.hidden)) && (await says()) === '4');
  ok('and on the count she left it on', (await across('#tiles .cell')) === 4);
  await page.click('#v-list');
  await page.click('#v-cols');
  await page.waitForSelector('#job-old1');
  ok('back in the list, and the count went with her', (await says()) === '3' && (await across('#job-old1 .usedrefs .ur')) === 3);

  // ── nothing sits under the pill, at her inset ────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await pillSweep(page, 'inset 47');
  const gap = await page.$eval('.panel', (p) => p.style.getPropertyValue('--pillgap') || p.style.getPropertyValue('--pilltop'));
  ok('the top panel reserves the pill\'s corner (' + gap + ')', Boolean(gap) && gap !== '0px');

  // ── a reference through the Dump door, and its slot into the prompt ──────
  await page.setInputFiles('#file', { name: 'mayra.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForSelector('#refs .ref');
  const up = posted.filter((p) => p.upload).find((p) => p.upload.filename === 'mayra.png');
  ok('the upload went to the Dump with the bundle, the filename and the file\'s own type',
    up && up.upload.bundle === 'Footage' && up.upload.filename === 'mayra.png' && up.ct === 'image/png' && up.bytes > 0);
  ok('the attached reference shows its slot name', (await page.$eval('#refs .slot', (e) => e.textContent)) === '[Image1]');
  await page.fill('#prompt', 'her mother is the woman in');
  await page.click('#refs .slot');
  ok('tapping the slot drops it into the prompt', (await page.$eval('#prompt', (t) => t.value)) === 'her mother is the woman in [Image1]');
  ok('the picture icon is what attaches one — a Lucide glyph, not the word "Add"',
    await page.$eval('#add', (b) => !!b.querySelector('svg') && !/add/i.test(b.textContent)));
  const addBox = await page.evaluate(() => {
    const a = document.getElementById('add').getBoundingClientRect();
    const n = document.querySelector('.selwrap select').getBoundingClientRect();
    return { w: Math.round(a.width), h: Math.round(a.height), nh: Math.round(n.height), radius: getComputedStyle(document.getElementById('add')).borderRadius };
  });
  ok('it is a rounded SQUARE at the house 6px, the height of its neighbours',
    addBox.w === addBox.h && addBox.h === addBox.nh && addBox.radius === '6px');

  // ── the star: ONE tap, ONE job, and exactly what left the phone ──────────
  await page.click('#ratios button[data-ratio="9:16"]');
  await page.waitForFunction(() => /¢$/.test(document.getElementById('cost').textContent));
  const sentBefore = posted.filter((p) => p.prompt).length;
  slow = 400;                                  // hold the answer so a second tap has something to be swallowed by
  await page.evaluate(() => { document.getElementById('go').click(); document.getElementById('go').click(); });
  await page.waitForSelector('#job-new1');
  const sentAll = posted.filter((p) => p.prompt);
  ok('one tap on the star is one job, and a second tap while it is in flight is swallowed', sentAll.length === sentBefore + 1);
  const sent = sentAll[sentAll.length - 1];
  ok('GO POSTs the prompt, the reference with its kind, the model, the seconds, the size and the shape',
    sent && sent.prompt === 'her mother is the woman in [Image1]' && sent.refs.length === 1 && sent.refs[0].kind === 'image' && /ref\.png$/.test(sent.refs[0].url)
    && sent.model === 'mini' && sent.seconds === 4 && sent.resolution === '480p' && sent.ratio === '9:16');
  ok('sound is always on and always sent, never left to the model\'s default', sent.sound === true);
  ok('the door is always atlascloud — this page offers no other', sent.door === 'atlascloud');
  // ONE DOOR, MEASURED — every price this page ever quoted was quoted for the
  // door it actually sends through. A page that priced APIFRAME and sent
  // Atlas would show her the wrong number all day and look perfect.
  ok('every estimate this page asked for was Atlas\'s (' + estQ.length + ' asked)',
    estQ.length > 0 && estQ.every((q) => q.door === 'atlascloud'));
  ok('the new card is on top, drawing', await page.$eval('#feed', (f) => f.firstElementChild.id === 'job-new1' && /drawing/.test(f.firstElementChild.textContent)));
  ok('the draft is cleared once sent', await page.evaluate(() => localStorage.getItem('footage_draft') == null));

  // ── a content refusal is free, and the page says who can send it ─────────
  refuse = true;
  await page.click('#go');
  await page.waitForSelector('#err:not([hidden])');
  const err = await page.$eval('#err', (e) => e.textContent);
  ok('an Atlas refusal shows on the page with the page\'s own hint (a famous face; a chat can try APIFRAME): ' + err,
    /refused/.test(err) && /famous face/.test(err) && /APIFRAME/.test(err) && /chat/.test(err));

  // ── ♥ / ✕ — what the server really received ──────────────────────────────
  await page.click('#job-old1 .heart');
  const v = posted.find((p) => p.vote);
  ok('a heart POSTs like to the clip\'s own vote route', v && /old1\/vote$/.test(v.vote) && v.body.vote === 'like');
  ok('the heart lights', await page.$eval('#job-old1 .heart', (b) => b.classList.contains('on')));

  // ── the player: the lightbox contract ────────────────────────────────────
  await page.click('#job-old1 .thumb');
  ok('tapping the thumb opens the player over the page, page locked', !(await page.$eval('#player', (e) => e.hidden)) && (await page.evaluate(() => document.body.style.overflow)) === 'hidden');
  ok('__navBack closes the player first', await page.evaluate(() => window.__navBack()) === true && (await page.$eval('#player', (e) => e.hidden)));
  ok('the page unlocks on close', (await page.evaluate(() => document.body.style.overflow)) === '');
  ok('still no page errors after the whole walk', errors.length === 0);

  // ── the sale is READ, and the card and the price line tell one story ─────
  ok('with no sale running the card says nothing about one', await page.$eval('#discline', (e) => e.hidden));
  atlasPays = 20;                              // Atlas's 80%-off Mini sale, read off its own model list
  await page.click('#help');
  await page.waitForFunction(() => !document.getElementById('discline').hidden);
  ok('opening the card picks the sale up live: ' + (await page.$eval('#discline', (e) => e.textContent)),
    /2\.0 Mini is 80% off right now/.test(await page.$eval('#discline', (e) => e.textContent)));
  await page.waitForFunction(() => /¢$/.test(document.getElementById('cost').textContent));
  ok('and the price under the star drops with it', parseFloat(await page.$eval('#cost', (e) => e.textContent)) < parseFloat(cost0));
  await page.click('body', { position: { x: 5, y: 820 } });

  // ── A BATCH OF CARDS PAINTS THE WALL ONCE ───────────────────────────────
  // `loadJobs` hands every clip to jobCard in turn and the wall's signature
  // changes on each one, so a paint per card rebuilt the whole wall N times to
  // end with N cells. COUNTED off the real DOM on a first load in tiles view —
  // a wall that renders correctly and a wall that rendered itself eight times
  // on the way there are the same markup to any source assertion.
  // its OWN context — localStorage is per origin, so setting the view here
  // inside `ctx` would put every page after it into tiles and hide the list
  const ctxT = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pgT = await ctxT.newPage();
  await pgT.addInitScript(() => {
    localStorage.setItem('footage_view', 'tiles');
    window.__wipes = 0; window.__cells = 0;
    const start = () => {
      const t = document.getElementById('tiles');
      if (!t) { setTimeout(start, 5); return; }
      new MutationObserver((ms) => ms.forEach((m) => {
        if (m.removedNodes.length) window.__wipes += 1;
        window.__cells += m.addedNodes.length;
      })).observe(t, { childList: true });
    };
    document.addEventListener('DOMContentLoaded', start);
  });
  await pgT.goto(`http://127.0.0.1:${port}/footage`);
  await pgT.waitForSelector('#tiles .cell');
  await pgT.waitForTimeout(900);
  const churn = await pgT.evaluate(() => ({ wipes: window.__wipes, made: window.__cells, cells: document.querySelectorAll('#tiles .cell').length }));
  // the INVARIANT, not a count: every cell made is a cell that stayed, and
  // nothing was wiped on the way — so the number of clips can change freely
  ok('the wall is built ONCE for a whole page of clips — ' + JSON.stringify(churn),
    churn.cells >= 8 && churn.made === churn.cells && churn.wipes === 0);
  await ctxT.close();

  // ── the same sweep at the other inset ────────────────────────────────────
  const pg2 = await ctx.newPage();
  await pg2.addInitScript(INSET(14), 14);
  await pg2.goto(`http://127.0.0.1:${port}/footage`);
  await pg2.waitForSelector('#job-old1');
  await pg2.waitForTimeout(1800);
  await pillSweep(pg2, 'inset 14');
  await pg2.close();

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
