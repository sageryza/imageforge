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
const PAGE_SRC = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
// A price on this page may wear a leading "~" where the figure is not pinned,
// so a bare parseFloat reads NaN — read the number through this.
const priceNum = (t) => parseFloat(String(t).replace(/^~/, ''));
function report() {
  if (fails.length) { console.log('FOOTAGE — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE — ' + pass + ' passed');
}

// ── the pure half — footage.js, unchanged by the page's rework ──────────────
{
  const F = require('../footage');
  const both = { openrouter: true, apiframe: true };
  // A REFUSED JOB FAILS — NO FALLBACK, NO CHAIN, EVER (2026-09-11 evening,
  // Sophie: "if a job refuses references it should just fail"). The walk
  // shipped that morning and put six jobs on APIFRAME, three of which drew
  // without their references and reported success.
  ok('auto with no Atlas: a 2.x model goes OpenRouter and NOTHING is behind it',
    (() => { const d = F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, both); return d.door === 'openrouter' && d.fallback === null && d.chain.length === 0; })());
  ok('1.5 Pro is APIFRAME only, whatever auto says', F.doorFor({ model: '1.5', door: 'auto', resolution: '480p' }, both).door === 'apiframe');
  ok('pinning OpenRouter on 1.5 Pro is refused with a reason', /only on APIFRAME/.test(F.doorFor({ model: '1.5', door: 'openrouter', resolution: '480p' }, both).error || ''));
  // THE APIFRAME DOOR STAYS IN THE MODULE — the page stopped offering it, a
  // chat did not stop using it (a person in a reference has nowhere else to go)
  ok('a pinned APIFRAME door is still obeyed with no fallback',
    (() => { const d = F.doorFor({ model: '2.5', door: 'apiframe', resolution: '480p' }, both); return d.door === 'apiframe' && d.fallback === null && d.chain.length === 0; })());
  ok('with OpenRouter unconfigured auto lands on APIFRAME', F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, { openrouter: false, apiframe: true }).door === 'apiframe');
  ok('1080p on APIFRAME is unpriced and refused as a pinned door', Boolean(F.doorFor({ model: '2.0', door: 'apiframe', resolution: '1080p' }, both).error));
  ok('1080p auto goes OpenRouter with NO fallback (APIFRAME cannot price it)',
    (() => { const d = F.doorFor({ model: '2.0', door: 'auto', resolution: '1080p' }, both); return d.door === 'openrouter' && d.fallback === null && d.chain.length === 0; })());
  // AUTO IS CHEAPEST-FIRST (2026-09-11, Sophie: "are they cheapest through
  // router, atlas or frame? choose cheapest"). With no live Atlas read the
  // Atlas rate is its LIST rate, and by list OpenRouter really is the cheap
  // door on every row — the sale is what puts Mini and Fast back on Atlas,
  // and that is measured with a live read further down rather than written
  // down here.
  const three = { openrouter: true, apiframe: true, atlascloud: true };
  const autoMini = F.doorFor({ model: 'mini', door: 'auto', resolution: '480p', ratio: '16:9', seconds: 4 }, three);
  ok('auto ranks the doors by what THIS tap costs, cheapest first — ' + (autoMini.ranked || []).map((x) => x.door + ':' + x.cents).join(' '),
    autoMini.ranked.length === 3 && autoMini.ranked.every((x, i, a) => i === 0 || a[i - 1].cents <= x.cents));
  ok('at Atlas\'s LIST rate the cheapest door for Mini is OpenRouter (13.59¢ against 22.4¢)',
    autoMini.door === 'openrouter' && autoMini.ranked[0].cents === 13.59);
  // THE CHAIN IS EVERY OTHER DOOR, NONE SKIPPED (2026-09-11 afternoon). The
  // morning's rule skipped a door "no looser" than the last one, and on 2.5
  // — price order OpenRouter · APIFRAME · Atlas — that dropped Atlas from
  // the chain outright; APIFRAME then refused the real face too, and the one
  // door measured to take those pictures was never tried. Doors whose
  // refusal is free on the POST come first, each group cheapest first.
  ok('auto answers ONE door and an empty chain, on every model', ['mini', 'fast', '2.0', '2.5'].every((id) => {
    const d = F.doorFor({ model: id, door: 'auto', resolution: '480p', ratio: '9:16', seconds: 4 }, three); return d.door && d.fallback === null && d.chain.length === 0; }));
  ok('and there is no walk left in the module', typeof F.walkPlan === 'undefined' && typeof F.walkOn === 'undefined');
  ok('`avoid` takes the doors that already refused off the table',
    (() => { const d = F.doorFor({ model: '2.5', door: 'auto', resolution: '480p', avoid: ['openrouter', 'apiframe'] }, three); return d.door === 'atlascloud' && d.chain.length === 0; })());
  ok('and with every door refused it says so', /every door has refused/.test(F.doorFor({ model: '2.5', door: 'auto', resolution: '480p', avoid: ['openrouter', 'apiframe', 'atlascloud'] }, three).error || ''));
  ok('every 2.x row is on Atlas; 1.5 Pro is not', ['mini', 'fast', '2.0', '2.5'].every((id) => F.doorFor({ model: id, door: 'atlascloud', resolution: '480p' }, three).door === 'atlascloud')
    && /not on Atlas Cloud/.test(F.doorFor({ model: '1.5', door: 'atlascloud', resolution: '480p' }, three).error || ''));
  ok('a pinned door never falls back — a refusal on a door she named is hers to read',
    (() => { const d = F.doorFor({ model: 'mini', door: 'atlascloud', resolution: '480p' }, three); return d.door === 'atlascloud' && d.fallback === null && d.chain.length === 0; })());
  ok('with no ATLASCLOUD_API_KEY a pinned Atlas door is refused with a reason, never sent elsewhere',
    /ATLASCLOUD_API_KEY/.test(F.doorFor({ model: 'mini', door: 'atlascloud', resolution: '480p' }, both).error || ''));
  ok('2.0 at 1080p is unpriced on Atlas and on APIFRAME, so auto goes OpenRouter with nothing behind it',
    (() => { const d = F.doorFor({ model: '2.0', door: 'auto', resolution: '1080p' }, three); return d.door === 'openrouter' && d.chain.length === 0; })());
  ok('there is no mini-atlas row any more — the door rides the rows', !F.publicModels().some((m) => m.id === 'mini-atlas'));
  const at = F.estimate({ model: 'mini', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three);
  ok('an Atlas price with no live read is per second off its LIST rate and "about"', at.door === 'atlascloud' && at.about === true && at.cents === 22.4);
  ok('the Atlas list rates per row: Fast 9¢/s · 2.0 11.2¢/s · 2.5 16.7¢/s',
    F.estimate({ model: 'fast', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three).cents === 36
    && F.estimate({ model: '2.0', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three).cents === 44.8
    && F.estimate({ model: '2.5', resolution: '480p', ratio: '3:4', seconds: 4, door: 'atlascloud' }, three).cents === 66.8);
  ok('publicModels flags every 2.x row for Atlas', F.publicModels().filter((m) => m.atlascloud).map((m) => m.id).join(',') === 'mini,fast,2.0,2.5');
  ok('cardOf reads an Atlas job back onto its row', (() => { const c = F.cardOf('x', { prompt: 'p', model: 'bytedance/seedance-2.0-mini/reference-to-video', provider: 'atlascloud', params: { duration: 4 }, status: 'completed' }); return c.model === 'mini' && c.door === 'atlascloud'; })());
  // EXACT IS THE CANVAS, NOT ONLY THE FORMULA (2026-09-11). Mini's canvas is
  // MEASURED onto the 2.5 table with ffprobe on every clip; 2.0, Fast and 2.5
  // have never gone through OpenRouter, so theirs is the published table and
  // unverified — and that table has been wrong once already, which is how
  // Mini's was found. Their price answers "about".
  ok('an OpenRouter price is exact only where the canvas is measured — Mini yes',
    F.estimate({ model: 'mini', resolution: '480p', ratio: '3:4', seconds: 4, door: 'openrouter' }, both).exact === true);
  ok('and 2.0, Fast and 2.5 answer "about" — their canvas is the published table, unmeasured',
    ['fast', '2.0', '2.5'].every((id) => {
      const e = F.estimate({ model: id, resolution: '480p', ratio: '3:4', seconds: 4, door: 'openrouter' }, both);
      return e.about === true && !e.exact;
    }));
  ok('a pinned OpenRouter door is still obeyed (a chat\'s door, not the page\'s any more)',
    (() => { const d = F.doorFor({ model: 'mini', door: 'openrouter', resolution: '480p' }, both); return d.door === 'openrouter' && d.fallback === null && d.chain.length === 0; })());

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
  // ── THE PROJECT (2026-09-11) ──
  ok('the project rides the body as the cast\'s own slug shape', F.buildJob({ prompt: 'x', project: 'The Ward!' }).body.project === 'the-ward');
  ok('no project sends no field at all (what an older page sends)', !('project' in F.buildJob({ prompt: 'x' }).body) && !('project' in F.buildJob({ prompt: 'x', project: '' }).body));
  ok('cardOf reads the project back, blank for a clip drawn before projects', F.cardOf('x', { prompt: 'p', project: 'ward', params: {} }).project === 'ward' && F.cardOf('x', { prompt: 'p', params: {} }).project === '');
  ok('every ward belt chat maps to the ward, Ticky Tack to its own', ['soap-pill-scene', 'hospital-severance-rough-cut', 'hospital-night-film', 'climax-dissociation-accounts', 'severance-api-multiple-frames'].every((c) => F.HANDOFF_PROJECTS[c] === 'ward') && F.HANDOFF_PROJECTS['ticky-tack-film-page-dupe'] === 'ticky-tack');
  ok('the log record keeps the project a door is handed', require('../video-log').sentRecord({ jobId: 'j', prompt: 'p', model: 'm', params: {}, tag: { chat: 'footage', project: 'ward' } }).project === 'ward');
  ok('all three doors put the project on the log tag', ['openrouter.js', 'atlascloud.js', 'apiframe.js'].every((f) => /note: b\.note, project: b\.project \}/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  ok('the feed route filters by project and the move route exists', /projectSlug\(req\.query\.project\)/.test(fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8')) && /router\.post\('\/jobs\/:id\/project'/.test(fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8')));
  // EVERY CHAT'S CLIPS RIDE THE FEED (2026-09-11, her "if so, good"): the
  // route reads the whole log, never `where('chat', '==', CHAT)`, and the
  // card says which chat sent a clip that was not this page's
  {
    const src = fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8');
    const route = src.slice(src.indexOf("router.get('/jobs'"), src.indexOf("router.post('/jobs/:id/vote'"));
    ok('the feed reads every chat\'s clips, not only the page\'s own', /coll\(\)\.get\(\)/.test(route) && !/where\('chat'/.test(route));
    ok('cardOf carries the chat that sent the clip', F.cardOf('x', { prompt: 'p', chat: 'mom-character-clip', params: {} }).chat === 'mom-character-clip');
  }
  ok('seconds outside the model are refused (3s on Mini)', /seconds/.test(F.buildJob({ prompt: 'x', model: 'mini', seconds: 3 }).error || ''));
  ok('the minimum is the default when no seconds are sent', F.buildJob({ prompt: 'x', model: '2.5' }).seconds === 4);
  ok('the title is the prompt cut at a word', F.titleOf('a '.repeat(60)).length <= 70 && F.titleOf('short') === 'short');

  // the card off a log doc
  const c = F.cardOf('j1', { prompt: 'p', model: 'bytedance/seedance-2.0-mini', provider: 'openrouter', status: 'completed', video: 'https://v', cost: 0.054,
    params: { duration: 4, resolution: '480p', aspect_ratio: '3:4' }, references: { images: ['https://i'], videos: [], audio: [] } });
  ok('cardOf reads the model, the door, the status and the cost off the log doc',
    c.model === 'mini' && c.door === 'openrouter' && c.status === 'done' && c.cost === 5.4 && c.seconds === 4 && c.refs[0].slot === '[Image1]');

  // the page's own model list is DERIVED — a model it can offer is one Atlas
  // Cloud carries AND one named in PAGE_MODELS; 1.5 Pro fails the first test
  // and 2.0/2.5 the second, so neither can reach the drop-down
  const atModels = F.publicModels().filter((m) => m.atlascloud).map((m) => m.id);
  ok('the Atlas table is what the page can draw from, and 1.5 Pro is not in it',
    atModels.length === 4 && atModels.indexOf('1.5') < 0 && atModels.indexOf('mini') === 0);
  const pmSrc = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
  // a missing list is a NAMED failure, never a throw that takes the run with it
  const pmRaw = (pmSrc.match(/var PAGE_MODELS = (\[[^\]]*\])/) || [])[1];
  const pageModels = pmRaw ? JSON.parse(pmRaw.replace(/'/g, '"')) : null;
  ok('the page names its own model list (PAGE_MODELS)', Array.isArray(pageModels) && pageModels.length > 0);
  ok('every model the page offers is on the Atlas table (nothing it cannot send)',
    Boolean(pageModels) && pageModels.every((id) => atModels.indexOf(id) >= 0));

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
  // TEXT BOXES SHIP EMPTY, and a placeholder may NAME a field but never fill
  // it or instruct (the house rule). Her words go in the prompt box, which
  // carries nothing at all; the seed box sits on a row with no word labels on
  // it, so its one-word name is the only thing saying what it is.
  ok('the prompt box ships empty, with no placeholder of its own', /<textarea id="prompt" class="pblock"><\/textarea>/.test(page));
  ok('every placeholder is a NAME — one or two words, no example and no instruction',
    (page.match(/placeholder="([^"]*)"/g) || []).every((m) => {
      const v = m.slice(13, -1);
      return v.split(/\s+/).filter(Boolean).length <= 2 && !/[.…:?]/.test(v);
    }));
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
const threads = {};      // clip url → the note thread the server holds
const noteReads = [];    // which chat each /notes read asked for
let refuse = false;      // the next POST comes back as a ByteDance content refusal
let noApiframe = false;  // APIFRAME shut, so a keyframe+references job has NO door
let uploads = 0;         // so two uploads are two references, not one deduped
let slow = 0;            // ms the next POST is held, so the one-tap guard is measurable

// EIGHT CLIPS, ALL 3:4 — eight divides by neither 3 nor 4 raggedly enough to
// hide a miscount in the first row, and one shape means every cell on a row is
// the same height. `old1` carries FOUR references, which is what makes a
// card's own picture row measurable at 3 and at 4 across.
const REFS4 = [1, 2, 3, 4].map((n) => ({ url: 'http://127.0.0.1:PORT/ref.png', kind: 'image', slot: '[Image' + n + ']' }));
let jobs = [
  { id: 'old1', prompt: 'a dog on a beach, camera at eye level', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4, resolution: '480p', ratio: '3:4',
    sound: true, refs: REFS4, status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    // the seed the door minted for it — every clip drawn since 2026-09-09
    // carries one, and the `f*` clips below carry none (drawn before that)
    seed: 4242,
    // the DOOR's own draw time (Atlas's `latency_ms` for a real clip of hers);
    // the f* clips below carry none, which must draw no tag at all
    drewMs: 153626,
    // ITS OWN LAST FRAME — Atlas is the only door that bakes one, so this
    // clip is an Atlas one and the f* clips below are not: the tile has to be
    // absent on those, not merely different.
    lastFrame: 'http://127.0.0.1:PORT/frame.png',
    cost: 5.6, estimate: 6, sentAt: '2026-09-09T08:00:00.000Z', vote: '', hidden: false,
    // THE PROJECT (2026-09-11): old1 and f0-f2 are the ward's, f3-f6 belong
    // to none — so a project filter that leaks in either direction shows
    project: 'ward' },
].concat([{
  // A CHAT'S CLIP IN HER FEED (2026-09-11) — filed under the ward by the
  // sort, sent by a chat, so its card has to say `from <chat>`
  id: 'c1', chat: 'mom-character-clip', project: 'ward', prompt: 'her mother is the woman in [Image1]', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 8, resolution: '480p', ratio: '3:4',
  sound: true, refs: [], status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
  cost: 8.8, estimate: 8.8, sentAt: '2026-09-09T07:30:00.000Z', vote: '', hidden: false,
}]).concat(Array.from({ length: 7 }, (_, i) => ({
  project: i < 3 ? 'ward' : '',
  id: 'f' + i, prompt: 'the socks on the line ' + i, model: 'mini', modelLabel: '2.0 Mini', door: 'openrouter', seconds: 4, resolution: '480p', ratio: '3:4',
  sound: true, refs: [], status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
  // f6 is the LONG one: the box opens at the model's minimum, so a clip that
  // is 4 seconds proves nothing about the seconds coming back with the words
  seconds: i === 6 ? 15 : 4, resolution: i === 6 ? '720p' : '480p', ratio: i === 6 ? '9:16' : '3:4',
  cost: 5.6, estimate: 6, sentAt: '2026-09-09T0' + i + ':00:00.000Z', vote: '', hidden: false,
  // f1 is TRIMMED and carries a last frame: the frame is the end of what the
  // DOOR drew, never the end of the part she kept, and the tile has to say so
  ...(i === 1 ? { door: 'atlascloud', lastFrame: 'http://127.0.0.1:PORT/frame.png',
    trims: [{ key: 't1', status: 'ready', start: 8.93, end: 12.06, seconds: 3.13, url: 'http://127.0.0.1:PORT/clip.mp4' }] } : {}),
})));

// THE PAGE UNDER TODAY — three clips from the day before, handed out ONLY
// under a `before` cursor, two at a time, so the walk takes two taps and the
// second one is the one that says there is nothing left.
const older = [0, 1, 2].map((i) => ({
  id: 'y' + i, prompt: 'yesterday\'s clip ' + i, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: 4, resolution: '480p', ratio: '3:4',
  sound: true, refs: [], status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
  cost: 4.4, estimate: 4.4, sentAt: '2026-09-08T1' + i + ':00:00.000Z', vote: '', hidden: false,
}));
const jobReads = [];
const projReads = [];    // the `project` every feed read asked for
const projMoves = [];    // every clip the page moved to a project, in order
const castReads = [];    // the film every shelf read asked for
const filmsPosted = [];  // every new film the page named
const films = [{ slug: 'ward', name: 'The ward', order: 1, people: 15, wardrobe: 2, settings: 3 }];

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
    if (u.pathname === '/frame.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/clip.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      statusCalls += 1;
      return json({ ok: true, doors: { openrouter: true, apiframe: true, atlascloud: true }, balances: { openrouter: { configured: true, left: 35.72 }, apiframe: { configured: true, credits: 817 }, atlascloud: { configured: true } },
        models: F.publicModels().map((m) => ({ ...m, ...(m.openrouter ? { discount } : {}), ...(m.atlascloud ? { atlasPerSec: atlasRate(m.id) / 100, atlasPays } : {}) })), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, handoffProjects: F.HANDOFF_PROJECTS });
    }
    if (u.pathname === '/api/footage/estimate') {
      const q = Object.fromEntries(u.searchParams);
      estQ.push(q);
      // THE STUB PRICES ALL THREE DOORS AND ANSWERS THE CHEAPEST, the way
      // footage.js does — it has to hold Atlas's rate itself because the
      // sale here is a variable the test moves (`atlasPays`) rather than a
      // live read footage.js has cached. The RULE is pinned in the pure
      // block above against the real `doorFor`; what this half measures is
      // that the page asks for `auto`, prints the door it was given, and
      // sends through it.
      const priceOn = (door) => {
        if (door === 'atlascloud') return { cents: Math.round(atlasRate(q.model) * Number(q.seconds) * F.resFactor(F.modelOf(q.model), q.res, q.ratio) * 100) / 100, door: 'atlascloud', about: true };
        return F.priceOn(F.modelOf(q.model), door, { res: q.res, ratio: q.ratio, seconds: Number(q.seconds), hasVideo: q.video === '1', discount });
      };
      if (q.door && q.door !== 'auto') return json({ ok: true, ...priceOn(q.door) });
      // THE SHAPE NARROWS THE DOORS, exactly as footage.js's `doorTakes`
      // does: a keyframe WITH references rides APIFRAME alone, because
      // Atlas's image-to-video has no reference lists and OpenRouter's own
      // guide says frame_images beats input_references. The RULE is pinned
      // against the real `doorTakes` in the pure block above and in
      // test-video-keyframes.js; what this half measures is that the page
      // sends the shape and prints the door it is given.
      const kf = q.first === '1' || q.last === '1';
      let open = ['openrouter', 'atlascloud', 'apiframe'];
      if (kf && q.refs === '1') open = noApiframe ? [] : ['apiframe'];
      if (!open.length) return json({ error: 'A first frame and references cannot ride one job' }, 400);
      const ranked = open.map(priceOn).filter((x) => !x.error).sort((a, b) => a.cents - b.cents);
      return json({ ok: true, ...ranked[0] });
    }
    // THE CAST LIBRARY, as far as the picker and the sheet read it
    if (u.pathname === '/api/cast/films' && req.method === 'GET') return json({ ok: true, films });
    if (u.pathname === '/api/cast/films' && req.method === 'POST') {
      const b = JSON.parse(body); filmsPosted.push(b);
      if (!films.some((f) => f.slug === b.slug)) films.push({ slug: b.slug, name: b.name || b.slug, order: 0, people: 0, wardrobe: 0, settings: 0 });
      return json({ ok: true, films });
    }
    if (u.pathname === '/api/cast/' || u.pathname === '/api/cast') {
      castReads.push(u.searchParams.get('film') || '');
      const f = u.searchParams.get('film') || (films[0] && films[0].slug) || '';
      return json({ ok: true, film: f, films, entries: [] });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      // THE FEED PAGES BACK — the stub is the real route's shape: `before`
      // is a sentAt cursor, the answer is the page under it, and `more`
      // says whether anything is left under THAT. The newest read hands
      // out `jobs` and says there is more while the old pool is untouched.
      const before = u.searchParams.get('before');
      jobReads.push(before || '');
      // the real route filters by project over the WHOLE collection before
      // the page is cut; no `project` is every clip
      const proj = u.searchParams.get('project') || '';
      projReads.push(proj);
      const mine = proj ? jobs.filter((j) => (j.project || '') === proj) : jobs;
      if (!before) return json({ ok: true, jobs: mine, more: older.length > 0 });
      const under = older.filter((j) => j.sentAt < before).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
      return json({ ok: true, jobs: under.slice(0, 2), more: under.length > 2 });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const answer = () => {
        if (refuse) { refuse = false; return json({ error: 'ByteDance refused a reference', refusal: 'content', hint: 'that job goes through /api/apiframe/video' }, 400); }
        // the door answers with the seed it really used — hers when she typed
        // one, else the one it minted (video-seed.js)
        const seed = b.seed != null ? Number(b.seed) : 999111;
        jobs.unshift({ id: 'new1', prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds, resolution: b.resolution, ratio: b.ratio,
          sound: true, refs: [], status: 'drawing', seed, sentAt: new Date().toISOString(), estimate: 7, vote: '', project: b.project || '' });
        json({ ok: true, jobId: 'new1', door: 'atlascloud', fellBack: false, estimate: 7, seed }, 202);
      };
      if (slow) { const ms = slow; slow = 0; return setTimeout(answer, ms); }
      return answer();
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) { posted.push({ vote: u.pathname, body: JSON.parse(body) }); return json({ ok: true }); }
    if (/^\/api\/footage\/jobs\/[^/]+\/project$/.test(u.pathname)) {
      const id = u.pathname.split('/')[4], b = JSON.parse(body);
      projMoves.push({ id, project: b.project });
      const jj = jobs.find((x) => x.id === id); if (jj) jj.project = b.project || '';
      return json({ ok: true, project: b.project || '' });
    }
    // the HOUSE note thread, stubbed exactly as server.js answers it: the
    // whole thread comes back on a write, and the read is the one inbox
    // (`waiting:'chat'` on the ones nobody has answered)
    if (u.pathname === '/api/gallery/assets/notes') {
      noteReads.push(u.searchParams.get('chat'));
      return json({ ok: true, chat: u.searchParams.get('chat'),
        notes: Object.keys(threads).map((url) => ({ url, thread: threads[url], waiting: 'chat' })) });
    }
    if (u.pathname === '/api/gallery/assets/note') {
      const b = JSON.parse(body);
      if (String(b.text || '').length > 2000) return json({ ok: false, error: 'that note is 40 characters too long' }, 400);
      posted.push({ note: b });
      threads[b.url] = (threads[b.url] || []).concat([{ from: b.from || 'sophie', text: b.text, at: new Date().toISOString() }]);
      return json({ ok: true, thread: threads[b.url], waiting: 'chat' });
    }
    if (u.pathname === '/api/drop/upload-file') {
      posted.push({ upload: Object.fromEntries(u.searchParams), ct: req.headers['content-type'], bytes: body.length });
      // THE DUMP ANSWERS A URL PER FILE, not one url forever — the page
      // dedupes the strip by url, so a constant one made every upload after
      // the first a no-op and the strip could never hold two pictures.
      uploads += 1;
      const nm = (Object.fromEntries(u.searchParams).filename || '') + uploads;
      const isVid = /\.(mp4|mov|webm|m4v)$/i.test(nm);
      return json({ ok: true, item: { id: 'd' + uploads, url: 'http://127.0.0.1:' + server.address().port + (isVid ? '/clip.mp4?f=' : '/ref.png?f=') + encodeURIComponent(nm), posterUrl: null, media: isVid ? 'video' : 'image' } });
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
const SWEEP = 'button,select,input,textarea,a,.ref,.selwrap,.step,.seedwrap,.panel > *';
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
    // THE LAST FRAME IS ASKED FOR ON ATLAS, AND ONLY THERE (2026-09-10,
    // Sophie: "on"). It is free and it is the chaining still — but it has to
    // reach the DOOR to exist, and a flag that is set on the page and dropped
    // in the send is invisible from every card. So this reads what the door
    // was really handed. It is Atlas-only on purpose: OpenRouter accepts the
    // flag and answers one output (a measured no-op) and APIFRAME builds its
    // own body, so sending it there is a key nothing reads.
    const F = require('../footage');
    const seen = [];
    // the stub carries Atlas's own model list too — startJob reads the live
    // price on its way past, and a door with no `api` would poison the price
    // cache the block below measures
    const ATLAS_MODELS = { data: [{ model: 'bytedance/seedance-2.0-mini/reference-to-video', price: { discount: '20', actual: { base_price: '0.011' }, origin: { base_price: '0.056' } } }] };
    const door = (name) => ({
      configured: () => true,
      api: async (path2) => (path2 === '/models' ? ATLAS_MODELS : null),
      startVideo: async (req) => { seen.push({ name, req }); return { jobId: name + '-1', sent: req, params: { seed: 7 } }; },
      pollVideo: async () => null,
    });
    F.init({ atlascloud: door('atlas'), apiframe: door('apiframe'), openrouter: door('openrouter') });
    await F.startJob({ prompt: 'the ward corridor', model: 'mini', seconds: 4, resolution: '480p', ratio: '16:9', door: 'atlascloud' });
    ok('an Atlas job asks for the last frame', seen.length === 1 && seen[0].name === 'atlas' && seen[0].req.returnLastFrame === true);
    await F.startJob({ prompt: 'the ward corridor', model: 'mini', seconds: 4, resolution: '480p', ratio: '16:9', door: 'apiframe' });
    ok('an APIFRAME job does not — it answers no frame', seen.length === 2 && seen[1].name === 'apiframe' && !('returnLastFrame' in seen[1].req));
    await F.startJob({ prompt: 'the ward corridor', model: 'mini', seconds: 4, resolution: '1080p', door: 'openrouter' });
    ok('nor does an OpenRouter one — the flag is a measured no-op there',
      seen.length === 3 && seen[2].name === 'openrouter' && !('returnLastFrame' in seen[2].req));
    // and the card answers the baked frame, so the page can offer it
    ok('the card carries the clip\'s own last frame',
      F.cardOf('j1', { model: 'bytedance/seedance-2.0-mini', params: {}, video: 'v.mp4', lastFrame: 'f.png' }).lastFrame === 'f.png');
    ok('and a clip drawn before this carries none, honestly',
      F.cardOf('j2', { model: 'bytedance/seedance-2.0-mini', params: {}, video: 'v.mp4' }).lastFrame === '');
    // A REFUSAL ON THE POLL IS THE CARD'S ANSWER — NOTHING IS SENT AGAIN
    // (2026-09-11 evening). The morning's walk re-sent it through the next
    // door; that is what drew three clips without their references.
    {
      const REAL = "Generation failed: The request failed because the input image 'content[1]' may contain real person. Request id: x";
      const doc = { door: 'apiframe', prompt: 'the ward corridor', model: 'seedance-2.5', params: { seed: 4242, duration: 4 }, status: 'sent' };
      const refusing = (text) => ({ ...door('apiframe'), pollVideo: async () => ({ id: 'x', status: 'FAILED', patch: { status: 'failed', error: text, doneAt: 'now' } }) });
      const settle = () => new Promise((r) => setTimeout(r, 300));
      const before = seen.length;
      F.init({ apiframe: refusing(REAL) });
      const r = await F.pollOne('walk-1', doc); await settle();
      ok('a content refusal landing on the poll is answered as the failure it is', r && r.patch && r.patch.status === 'failed');
      ok('…and NOTHING is sent through another door', seen.length === before);
    }
    // ── A REFUSAL ON THE POST THROWS — never a second send (2026-09-11) ──
    {
      const before = seen.length;
      const refusingPost = { ...door('openrouter'), startVideo: async () => { const e = new Error('ByteDance refused a reference'); e.status = 400; e.refusal = 'content'; throw e; } };
      F.init({ openrouter: refusingPost, atlascloud: door('atlas'), apiframe: door('apiframe') });
      let threw = null;
      try { await F.startJob({ prompt: 'her at the window', model: '2.0', seconds: 4, resolution: '480p', ratio: '9:16', door: 'openrouter' }); } catch (e) { threw = e; }
      ok('a content refusal on the POST throws with the refusal on it', threw && threw.refusal === 'content' && threw.door === 'openrouter');
      ok('…and no other door was sent the job', seen.length === before);
    }
    F.init({ atlascloud: require('../atlascloud'), apiframe: require('../apiframe'), openrouter: require('../openrouter') });
  }
  {
    // Atlas's price, read live off its own model list (a stub door here)
    const F = require('../footage');
    const three = { openrouter: true, apiframe: true, atlascloud: true };
    F.init({ atlascloud: { configured: () => true, api: async (p) => (p === '/models' ? { data: [{ model: 'bytedance/seedance-2.0-mini/reference-to-video', price: { discount: '20', actual: { base_price: '0.011' }, origin: { base_price: '0.056' } } }] } : null) } });
    await F.atlasPrices();
    const atLive = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, door: 'auto' }, three);
    ok('with the live read the Atlas price is the SALE rate per second (1.1¢/s × 4s)', atLive.door === 'atlascloud' && atLive.cents === 4.4);
    // NOTHING ON ATLAS IS PINNED (2026-09-10, Sophie: "add ~ to both"). It
    // publishes no billing API — her console is the only read — and no Atlas
    // charge has ever been read against an estimate, at either resolution.
    ok('and it is "about", never exact — no Atlas charge has been read', atLive.about === true && !atLive.exact);
    const atVid = F.estimate({ model: 'mini', resolution: '480p', ratio: '16:9', seconds: 4, hasVideo: true, door: 'auto' }, three);
    ok('a reference video is the same rate and also "about" (one job measured ~19% more)', atVid.door === 'atlascloud' && atVid.about === true && atVid.cents === 4.4);
    // 720p IS THE PIXEL RATIO DEARER, PER SHAPE — Atlas bills by resolution
    // (its own model readme) while publishing one flat rate, so the rate is
    // read as a 480p rate and scaled by the canvas. 16:9 on the 2.5 table is
    // 854×480 → 1280×720 = 2.2482×; 3:4 is 560×752 → 834×1112 = 2.2021×.
    // Proven to the token on the log: the one 720p job (12s Mini 3:4, one
    // reference video) spent 435,628 tokens against 197,811 for the same job
    // at 480p, i.e. 2.202× — the 3:4 factor exactly.
    const at720 = F.estimate({ model: 'mini', resolution: '720p', ratio: '16:9', seconds: 4, door: 'auto' }, three);
    ok('720p 16:9 is 2.2482× the 480p price, not the same price — ' + at720.cents + '¢', at720.cents === Math.round(4.4 * (1280 * 720) / (854 * 480) * 100) / 100);
    const at720p34 = F.estimate({ model: 'mini', resolution: '720p', ratio: '3:4', seconds: 4, door: 'auto' }, three);
    ok('and 3:4 is its OWN factor, 2.2021× — the shape is what the tokens are made of', at720p34.cents !== at720.cents
      && at720p34.cents === Math.round(4.4 * (834 * 1112) / (560 * 752) * 100) / 100);
    ok('720p is "about" too', at720.about === true && !at720.exact);
    ok('resFactor is 1 at 480p, so a 480p price is untouched by the scaling', F.resFactor(F.modelOf('mini'), '480p', '16:9') === 1);
    // The factor lands on APIFRAME's own published 720p:480p ratios, which is
    // the corroboration that Atlas bills the same way: Mini 4→9¢/s, Fast
    // 7→16, 2.0 8→18, 2.5 13→29 are all the pixel ratio.
    ok('the factor matches APIFRAME\'s own published 720p:480p ratio to within 5%', ['mini', 'fast', '2.0', '2.5'].every((id) => {
      const m = F.modelOf(id);
      const af = m.afCents['720p'] / m.afCents['480p'];
      return Math.abs(F.resFactor(m, '720p', '16:9') / af - 1) < 0.05;
    }));
    ok('publicModels carries the live per-second rate for the "?" card', F.publicModels().some((m) => m.id === 'mini' && m.atlasPerSec === 0.011 && m.atlasPays === 20));
    ok('a row Atlas did not price keeps its list fallback', F.estimate({ model: 'fast', resolution: '480p', ratio: '16:9', seconds: 4, door: 'atlascloud' }, three).cents === 36);
    // THE PRODUCTION SHAPE, with the sale Atlas is really running on all four
    // rows (read off its own model list 2026-09-11): Atlas is far the cheapest
    // for the two small models and NOT the cheapest for the two big ones,
    // because the 80%/70% sale is on Mini and Fast and only 20% on 2.0 and
    // 2.5. So "choose cheapest" moves 2.0 and 2.5 off Atlas and leaves Mini
    // and Fast exactly where they were.
    const SALE = { mini: 0.011, fast: 0.027, '2.0': 0.09, '2.5': 0.134 };
    F.init({ atlascloud: { configured: () => true, api: async (p2) => (p2 === '/models' ? { data: Object.keys(SALE).map((id) => ({ model: F.modelOf(id).atlas, price: { discount: '20', actual: { base_price: String(SALE[id]) } } })) } : null) } });
    F.atlasCacheBust();
    await F.atlasPrices();
    const pick = (id, res) => F.doorFor({ model: id, door: 'auto', resolution: res, ratio: '16:9', seconds: 4 }, three);
    ok('with the real sale on, Mini and Fast stay on Atlas', pick('mini', '480p').door === 'atlascloud' && pick('fast', '480p').door === 'atlascloud');
    ok('and 2.0 and 2.5 go to OpenRouter, which is cheaper than both other doors — '
      + pick('2.0', '480p').ranked.map((x) => x.door + ':' + x.cents).join(' '),
      pick('2.0', '480p').door === 'openrouter' && pick('2.5', '480p').door === 'openrouter');
    ok('720p follows the same order, not a different one', pick('mini', '720p').door === 'atlascloud' && pick('2.0', '720p').door === 'openrouter');
    // 2.5 WITH A REFERENCE VIDEO IS THE ONE ROW WHERE ATLAS BEATS APIFRAME
    // (53.6¢ against 60¢ — APIFRAME charges its own dearer video rate), so
    // the ranking there is OpenRouter · Atlas · APIFRAME — and still ONE
    // door goes out, nothing behind it.
    ok('the ranking is priced too, not a fixed order — and the chain is still empty',
      (() => { const d = F.doorFor({ model: '2.5', door: 'auto', resolution: '480p', ratio: '16:9', seconds: 4, hasVideo: true }, three); return d.ranked.map((x) => x.door).join(',') === 'openrouter,atlascloud,apiframe' && d.chain.length === 0; })());
    // A FAILED ATLAS READ MUST NOT MOVE THE DOOR. Falling back to the LIST
    // rate would quietly send every Mini job to OpenRouter at 3x the real
    // price for the ten minutes the cache holds.
    F.init({ atlascloud: { configured: () => true, api: async () => { throw new Error('down'); } } });
    F.atlasCacheBust();
    await F.atlasPrices();
    ok('a failed Atlas price read keeps the last good prices, so the door does not move', pick('mini', '480p').door === 'atlascloud');
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
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
  await page.waitForSelector('#job-old1');
  await page.waitForTimeout(1800);                 // let the pill's settling passes run

  // ── THE FEED PAGES BACK — the walk, pure (2026-09-11, Sophie: "I can't go
  // back farther than today in footage") ──────────────────────────────────
  {
    const all = Array.from({ length: 7 }, (_, i) => ({ id: 'j' + i, d: { sentAt: '2026-09-0' + (i + 1) + 'T00:00:00.000Z' } }));
    const p1 = F.pageJobs(all, { limit: 3 });
    ok('the first page is the newest three, newest first', p1.docs.map((x) => x.id).join() === 'j6,j5,j4');
    ok('and it says there is more under it', p1.more === true);
    const p2 = F.pageJobs(all, { limit: 3, before: p1.docs[2].d.sentAt });
    ok('the page under a cursor is the three below it, none repeated', p2.docs.map((x) => x.id).join() === 'j3,j2,j1' && p2.more === true);
    const p3 = F.pageJobs(all, { limit: 3, before: p2.docs[2].d.sentAt });
    ok('the last page is short and says so', p3.docs.map((x) => x.id).join() === 'j0' && p3.more === false);
    ok('no cursor and a big limit is everything, and more is false', F.pageJobs(all, { limit: 40 }).more === false && F.pageJobs(all, { limit: 40 }).docs.length === 7);
    ok('the route answers `more` beside the jobs', /jobs: docs\.map\(\(x\) => cardOf\(x\.id, x\.d\)\), more \}/.test(fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8')));
  }

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
  // NO BALANCE LINE — Atlas has none to read, and quoting OpenRouter's or
  // APIFRAME's as if it were the one that matters would be worse than none.
  // The card explains the RULE (cheapest door, free refusal, the walk) rather
  // than naming one door as the page's.
  ok('the card quotes no balance at all, and explains the cheapest-door rule',
    (await page.$eval('#balline', (e) => e.hidden))
    && /Whichever door is cheapest/.test(await page.$eval('#helpcard', (e) => e.textContent))
    && /Four models/.test(await page.$eval('#helpcard', (e) => e.textContent)));
  ok('and it says where the last frame does and does not ride',
    /last frame[\s\S]{0,160}Atlas Cloud only/.test(await page.$eval('#helpcard', (e) => e.textContent)));
  await page.click('body', { position: { x: 5, y: 820 } });
  ok('any tap closes it', await page.$eval('#helpcard', (e) => e.hidden));

  // ── the model is a drop-down of TWO — Mini and 2.0 Fast ──────────────────
  // (2026-09-10, Sophie: "add 2.0 fast back as an option"; it had been pinned
  // to Mini alone that morning). Every assertion here is a MEASUREMENT of the
  // rendered control, because a select filled from the wrong list and one
  // filled from the right one are the same markup.
  const sel = await page.evaluate(() => {
    const r = document.getElementById('res');
    const m = document.getElementById('model');
    const cs = getComputedStyle(r);
    return { rTag: r.tagName, mTag: m && m.tagName,
      models: m ? [...m.options].map((o) => o.value) : [],
      labels: m ? [...m.options].map((o) => o.textContent) : [],
      mvalue: m && m.value,
      reses: [...r.options].map((o) => o.value),
      appearance: cs.appearance || cs.webkitAppearance, radius: cs.borderRadius,
      chevs: document.querySelectorAll('#controls .selwrap .chev svg, .foldrow .selwrap .chev svg').length,
      rvalue: r.value };
  });
  ok('the model is a <select> and it holds the whole 2.x family — ' + sel.models.join(','),
    sel.mTag === 'SELECT' && sel.models.join(',') === 'mini,fast,2.0,2.5' && sel.labels.join(',') === '2.0 Mini,2.0 Fast,2.0,2.5');
  ok('Mini leads and is what the page opens on', sel.mvalue === 'mini');
  ok('1.5 Pro is not on it — it is on APIFRAME only', sel.models.indexOf('1.5') < 0);
  ok('the list is the one line in source',
    /var PAGE_MODELS = \['mini', 'fast', '2\.0', '2\.5'\]/.test(PAGE_SRC));
  ok('the resolution is a <select>', sel.rTag === 'SELECT');
  ok('the native chrome is off and the box is the house 6px', sel.appearance === 'none' && sel.radius === '6px');
  ok('the four drop-downs (project, model, size, shape) each draw our own inline chevron', sel.chevs === 4);
  ok('the resolution opens at Mini\'s minimum', sel.rvalue === '480p' && sel.reses.join(',') === '480p,720p');
  // PICKING FAST REALLY REACHES THE PRICE AND THE JOB — a select whose change
  // handler never fires looks identical to one that works
  if (sel.mTag === 'SELECT') {
    const cost00 = await page.$eval('#cost', (e) => e.textContent);   // Mini, as the page rests
    await page.selectOption('#model', 'fast');
    await page.waitForTimeout(200);
    const fastCost = await page.$eval('#cost', (e) => e.textContent);
    // MINI IS NOT THE CHEAP ONE ON EVERY DOOR AT EVERY SHAPE, and that is
    // measured rather than assumed: Mini renders on the 2.5 canvases and Fast
    // on the 2.0 ones, so at 3:4 Mini is 560×752 against Fast's 480×640 — 37%
    // more pixels, which OpenRouter's lower per-token rate for Mini does not
    // make up (13.96¢ against 12.22¢ for the same 4s clip). Atlas's sale is
    // what makes Mini the cheap row in production, not the model itself.
    ok('picking Fast really re-asks the price for Fast — ' + fastCost,
      fastCost !== cost00 && estQ[estQ.length - 1].model === 'fast');
    // 2.0 AND 2.5 ARE REALLY REACHABLE AND REALLY DEARER — a <select> whose
    // new options never reach the price handler looks identical to one that
    // works, and the whole point of adding them is what they cost.
    await page.selectOption('#model', '2.0');
    await page.waitForTimeout(200);
    const bigCost = await page.$eval('#cost', (e) => e.textContent);
    ok('picking 2.0 re-asks it again and it is dearer still — ' + bigCost, priceNum(bigCost) > priceNum(fastCost));
    await page.selectOption('#model', '2.5');
    await page.waitForTimeout(200);
    ok('and 2.5 is the dearest of the four', priceNum(await page.$eval('#cost', (e) => e.textContent)) > priceNum(bigCost));
    await page.selectOption('#model', 'mini');
    await page.waitForTimeout(200);
    ok('and back to Mini re-asks it again', await page.$eval('#cost', (e) => e.textContent) === cost00);
  } else { ok('picking Fast re-asks the price', false); ok('picking 2.0 re-asks it again and it is dearer still', false); ok('and 2.5 is the dearest of the four', false); ok('and back to Mini re-asks it again', false); }
  // THE MODEL IS NOT STICKY: Fast is ~8x Mini a second, so it opens on Mini
  // every load the way the seconds and the size do
  ok('nothing writes the model into footage_ctl',
    !(await page.evaluate(() => (localStorage.getItem('footage_ctl') || '').indexOf('model') >= 0)));

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
  // the range is Mini's own — 4 to 15 — read off the served table, never a
  // number typed into the page (Fast happens to share it)
  ok('the clamp is Mini\'s (4–15) off the served table, not a number in the page',
    (await page.$eval('#secs', (e) => e.min + '-' + e.max)) === '4-15' && !/max="15"|min="4"/.test(PAGE_SRC));
  await page.fill('#secs', '4');
  await page.evaluate(() => document.getElementById('secs').blur());
  await page.waitForFunction(() => document.getElementById('secs').value === '4');

  // ── one door, so the price line no longer names one; and the hedge is one
  //    CHARACTER — "~" where the figure is not pinned (2026-09-10, Sophie:
  //    "add ~ to both"). The WORD "about" was cut the day before for firing
  //    on nearly every job and spending a line to say the same thing every
  //    time; a tilde costs nothing and still says the number is not a
  //    promise. On Atlas — the page's one door — nothing is pinned at either
  //    resolution, so it is there whether or not a reference video rides.
  //    `#cost` still carries the flag for anything that needs to know. ─────
  await page.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
  const cost0 = await page.$eval('#cost', (e) => e.textContent);
  // THE LINE NAMES THE DOOR AGAIN (2026-09-11, her "choose cheapest"). It
  // came off on 2026-09-09 only because one door was left to name; with four
  // models the cheapest door is no longer the same one every time, and which
  // door a tap goes to is a fact about the CLIP as well as the bill — the
  // last frame rides on Atlas alone, and OpenRouter refuses any person in a
  // reference. The hedge is still a "~" and never the word.
  ok('the price line is a price and the door it goes to: ' + cost0, /^~?\d+(\.\d{1,2})?¢ · (Atlas Cloud|OpenRouter|APIFRAME)$/.test(cost0));
  ok('the hedge is a "~" and never the word', !/about/i.test(cost0));
  ok('and the door it names is the cheapest one, not a fixed one',
    /OpenRouter/.test(cost0));
  const beside = await page.evaluate(() => {
    const g = document.getElementById('go').getBoundingClientRect(), c = document.getElementById('cost').getBoundingClientRect();
    return { sameRow: Math.abs((g.top + g.height / 2) - (c.top + c.height / 2)) < 14, gap: Math.round(c.left - g.right) };
  });
  ok('the price sits right beside the star (gap ' + beside.gap + 'px)', beside.sameRow && beside.gap >= 0 && beside.gap < 30);
  await page.click('#secup');
  await page.waitForFunction((c) => document.getElementById('cost').textContent !== c, cost0);
  ok('one more second is a higher price', priceNum(await page.$eval('#cost', (e) => e.textContent)) > priceNum(cost0));
  await page.click('#secdn');
  await page.waitForFunction((c) => document.getElementById('cost').textContent === c, cost0);
  // THE PRICE WEARS ITS "~" AND NEVER THE WORD, with a reference video and
  // without one — on Atlas neither is pinned, so taking the video off must
  // NOT quietly promote the figure to a promise.
  // AT ATLAS'S LIST RATE THE CHEAPEST DOOR IS OPENROUTER, whose 480p price
  // with no reference video IS pinned — so the resting line here carries no
  // "~" and the flag says so. The "~" is measured on the Atlas and the
  // reference-video cases below.
  ok('an OpenRouter price with no reference video is PINNED, so no ~: ' + cost0, !cost0.startsWith('~'));
  ok('and the page knows it', await page.$eval('#cost', (e) => e.dataset.about === ''));
  await page.setInputFiles('#file', { name: 'sock.mp4', mimeType: 'video/mp4', buffer: Buffer.from('x') });
  await page.waitForSelector('#refs .ref');
  await page.waitForFunction(() => document.getElementById('cost').dataset.about === '1');
  const withVid = await page.$eval('#cost', (e) => e.textContent);
  ok('a reference VIDEO says the price with a ~ and NOT the word: ' + withVid, /^~\d+(\.\d{1,2})?¢ · \w/.test(withVid) && !/about/i.test(withVid));
  await page.click('#refs .x');
  await page.waitForFunction((c) => document.getElementById('cost').textContent === c, cost0);
  ok('taking it off puts the price back to the pinned OpenRouter one', await page.$eval('#cost', (e) => e.dataset.about === ''));

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
  // THE SHAPE IS A DROP-DOWN AND THE CONTROLS ARE ONE BLOCK (2026-09-10,
  // Sophie: "buttons take up too much room" · "drop down for aspect ratio").
  // Six chips were a row of their own and TWO rows once the pill's column was
  // reserved; the box sits in the row the size is already on.
  ok('the shape is a drop-down in the SAME row as the size — never a row of its own',
    await page.evaluate(() => document.getElementById('ratio').closest('.row') === document.getElementById('res').closest('.row')));
  const ctl = rows.filter((r) => r.kids > 2)[0];
  ok('the controls are ' + (ctl && ctl.lines) + ' line(s), not the five-deep column the chips made', ctl && ctl.lines <= 2);
  // THE SEED SITS WITH THE STAR — up to ten digits (video-seed.js mints
  // 1..2147483647), so a box narrow enough to fit beside the sizes clipped its
  // own number. It is an ingredient of THIS tap, not a size.
  ok('the seed, the star and the price are one line',
    await page.evaluate(() => {
      const row = document.getElementById('go').closest('.row');
      const mid = [...row.children].map((k) => { const b = k.getBoundingClientRect(); return b.top + b.height / 2; });
      return document.getElementById('seedwrap').closest('.row') === row
        && Math.max(...mid) - Math.min(...mid) < 8;
    }));
  ok('the seed box shows a whole ten-digit seed',
    await page.evaluate(() => {
      const b = document.getElementById('seedbox');
      b.value = '2147483647'; b.dispatchEvent(new Event('input'));
      const fits = b.scrollWidth <= b.clientWidth + 1;
      b.value = ''; b.dispatchEvent(new Event('input'));
      return fits;
    }));

  // ── the feed: a card, its references, and a repaint that changes nothing ─
  ok('the earlier clip is a card with its real cost', await page.$eval('#job-old1 .tags', (e) => /5\.6¢/.test(e.textContent) && /2\.0 Mini/.test(e.textContent)));
  // SOUND IS NOT A TAG AND THE PRICE DOES NOT HEDGE (2026-09-10, Sophie:
  // "get rid of sound since they all have sound" · "just see the price not
  // 'about'"). MEASURED off the rendered line — the page sends sound:true on
  // every job, so a `sound` still in the array reads as a perfectly ordinary
  // card to any source check.
  ok('the card does not say "sound" — every clip has it',
    await page.$eval('#job-old1 .tags', (e) => !/\bsound\b/.test(e.textContent)));
  ok('and a silent clip would still say so',
    /j\.sound \? '' : 'silent'/.test(PAGE_SRC));
  ok('the card\'s price is the number alone',
    await page.$eval('#job-old1 .tags', (e) => !/about/.test(e.textContent) && /5\.6¢/.test(e.textContent)));
  // HOW LONG IT TOOK TO DRAW (2026-09-10, her ask). MEASURED off the rendered
  // tag: a card that computes the span and never paints it, and one that
  // paints sentAt→doneAt instead, are the same markup to any source check.
  ok('the card says how long the door took to draw it — 2m 34s',
    await page.$eval('#job-old1 .tags', (e) => /drew in 2m 34s/.test(e.textContent)));
  ok('a clip whose door did not say carries no tag at all',
    await page.$eval('#job-f0 .tags', (e) => !/drew/.test(e.textContent)));
  ok('the clip\'s own length is still there beside it, and they do not read as one',
    await page.$eval('#job-old1 .tags', (e) => /\b4s\b/.test(e.textContent) && /2m 34s/.test(e.textContent)));
  ok('the card names its references by slot', await page.$eval('#job-old1 .usedrefs', (e) => /Image1/.test(e.textContent) && /Image4/.test(e.textContent)));
  const imgBefore = await page.evaluateHandle(() => document.querySelector('#job-old1 .thumb img'));
  await page.evaluate(() => fetch('/api/footage/jobs?limit=40').then((r) => r.json()));
  await page.waitForTimeout(200);
  ok('a repaint never rebuilds a card that did not change', await page.evaluate((h) => h === document.querySelector('#job-old1 .thumb img'), imgBefore));

  // ── THE WAY BACK PAST TODAY (2026-09-11, Sophie: "I can't go back farther
  // than today in footage") — every assertion a MEASUREMENT: an opener that
  // is in the markup and never drawn, a walk that repeats a page, and a poll
  // that puts the opener back after the last page all read fine in source.
  ok('the "… older" opener is drawn under the feed while there is a page under it',
    await page.$eval('#older', (e) => !e.hidden && e.getBoundingClientRect().height > 0 && /older/.test(e.textContent)));
  ok('it is an underlined word, no box and no fill',
    await page.$eval('#older', (e) => { const c = getComputedStyle(e); return c.textDecorationLine.includes('underline') && c.borderTopWidth === '0px' && c.backgroundColor === 'rgba(0, 0, 0, 0)'; }));
  ok('no card from yesterday is on the page yet', await page.$$eval('#feed .job', (els) => !els.some((e) => /^job-y/.test(e.id))));
  await page.click('#older');
  await page.waitForSelector('#job-y2');
  await page.waitForTimeout(150);
  ok('the tap asked for the page under the OLDEST clip on screen, by its sentAt',
    jobReads[jobReads.length - 1] === '2026-09-09T00:00:00.000Z');
  ok('yesterday\'s two newest clips landed at the END of the feed, newest first — ' + await page.$$eval('#feed .job', (els) => els.map((e) => e.id).join(',')),
    await page.$$eval('#feed .job', (els) => els.map((e) => e.id).slice(-2).join() === 'job-y2,job-y1' && !els.some((e) => e.id === 'job-y0')));
  ok('the opener is still there — the server said there is one more page',
    await page.$eval('#older', (e) => !e.hidden && !e.disabled));
  await page.click('#older');
  await page.waitForSelector('#job-y0');
  await page.waitForTimeout(150);
  ok('the second tap walked under the page it had just loaded, not under today again',
    jobReads[jobReads.length - 1] === '2026-09-08T11:00:00.000Z');
  ok('the last clip is at the very end and the opener is gone',
    await page.$$eval('#feed .job', (els) => els[els.length - 1].id === 'job-y0') && await page.$eval('#older', (e) => e.hidden));
  ok('nothing was loaded twice — one card per clip', await page.$$eval('#feed .job', (els) => new Set(els.map((e) => e.id)).size === els.length && els.length === 12));
  // the newest-page poll again — it always says "more under the first 40",
  // which must not bring the opener back nor take the walked pages away
  await page.evaluate(() => fetch('/api/footage/jobs?limit=40').then((r) => r.json()));
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(400);
  ok('a later poll of the newest page neither drops the older cards nor re-lights the opener',
    await page.$$eval('#feed .job', (els) => els.length === 12) && await page.$eval('#older', (e) => e.hidden));
  ok('the older clips are on the wall too', await page.evaluate(() => { document.getElementById('v-tiles').click(); const n = document.querySelectorAll('#tiles .cell[data-id^="y"]').length; document.getElementById('v-list').click(); return n === 3; }));

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
    // 9 of today's plus the 3 the walk back brought in above
    && (await page.$$eval('#tiles .cell img', (i) => i.length)) === 12);
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
  // THE ROW THAT OVERLAPS THE PILL IS THE ROW THAT SHORTENS (2026-09-10,
  // Sophie: "shud be one row - not a column for pill scroll"). The panel used
  // to carry the reserve on its own margin, so 64px came off every row in it —
  // the controls included, which sit below the pill and never touch it.
  const gaps = await page.evaluate(() => {
    const p = document.querySelector('body > .float').getBoundingClientRect();
    return [...document.querySelectorAll('.panel > *')].map((el) => {
      const r = el.getBoundingClientRect();
      return { el: el.id || el.className, gap: el.style.getPropertyValue('--pillgap'),
        w: Math.round(r.width), kids: [...el.children].map((k) => k.id + ':' + Math.round(k.getBoundingClientRect().width)),
        // a row that ENDS before the column needs no reserve — the two fold
        // rows are fit-content headings and never reach it
        reaches: r.right > p.left,
        over: r.bottom > p.top && r.top < p.bottom && r.width > 0 && r.height > 0 };
    });
  });
  ok('the panel itself reserves nothing — it keeps its width and passes under the rail',
    !(await page.$eval('.panel', (p) => p.style.getPropertyValue('--pillgap'))));
  // The invariant, measured after the reserves have settled: no row of the
  // panel reaches into the pill's column, and the reserve is what put them
  // there (at least one row is really carrying one).
  ok('no row that overlaps the pill reaches into its column (' + JSON.stringify(gaps.filter((g) => g.over)) + ')',
    gaps.filter((g) => g.over).every((g) => !g.reaches));
  ok('and the reserve is what did it — a row that overlaps carries one',
    gaps.some((g) => g.over && g.gap && g.gap !== '0px'));
  ok('a row BELOW the pill keeps the panel\'s whole width — no reserve it does not need ' + JSON.stringify(gaps),
    gaps.filter((g) => !g.over).every((g) => !g.gap || g.gap === '0px'));
  // The controls row DOES graze the pill's band at rest (an empty prompt box
  // puts it high on the page), so it reserves the column — and with the shape
  // in a drop-down and Recent as an icon it still fits on two lines inside
  // what is left. That is the whole of the fix: the reserve is honest and the
  // row is no longer a column.
  ok('nothing in the controls row is left sitting under the pill',
    await page.evaluate(() => {
      const f = document.querySelector('body > .float').getBoundingClientRect();
      return [...document.getElementById('res').closest('.row').children]
        .every((k) => { const r = k.getBoundingClientRect(); return !r.width || r.right <= f.left + 1; });
    }));

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

  // ── THE SEED: her box, the clip's own number, the copy that reuses it ────
  // Every assertion here is a MEASUREMENT of what renders or of what the
  // server really received: a seed row that never drew, a copy button that
  // sets nothing, and a box whose value never reaches the request all look
  // identical in the source.
  ok('the box ships EMPTY — blank means a fresh seed, never a remembered one',
    (await page.$eval('#seedbox', (e) => e.value)) === '');
  ok('the seed box is not sticky and stores nothing of its own',
    await page.evaluate(() => Object.keys(localStorage).every((k) => !/seed/i.test(k))));
  ok('the card exposes the seed the clip really carried',
    await page.$eval('#job-old1 .seedrow', (e) => /seed 4242/.test(e.textContent)));
  ok('a clip with no seed on file shows no seed row at all — never a dead control',
    (await page.$('#job-f0 .seedrow')) === null);
  await page.click('#job-old1 .seedcopy');
  ok('the copy button puts THAT seed in the box', (await page.$eval('#seedbox', (e) => e.value)) === '4242');
  ok('the seed box is a real text box she can change',
    await page.$eval('#seedbox', (e) => e.tagName === 'INPUT' && !e.readOnly && !e.disabled));

  // ── the star: ONE tap, ONE job, and exactly what left the phone ──────────
  await page.selectOption('#ratio', '9:16');
  await page.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
  const sentBefore = posted.filter((p) => p.prompt).length;
  slow = 400;                                  // hold the answer so a second tap has something to be swallowed by
  await page.evaluate(() => { document.getElementById('go').click(); document.getElementById('go').click(); });
  await page.waitForSelector('#job-new1');
  const sentAll = posted.filter((p) => p.prompt);
  ok('one tap on the star is one job, and a second tap while it is in flight is swallowed', sentAll.length === sentBefore + 1);
  const sent = sentAll[sentAll.length - 1];
  ok('GO POSTs the prompt, the reference with its kind, the model, the seconds, the size and the shape',
    sent && sent.prompt === 'her mother is the woman in [Image1]' && sent.refs.length === 1 && sent.refs[0].kind === 'image' && /ref\.png(\?|$)/.test(sent.refs[0].url)
    && sent.model === 'mini' && sent.seconds === 4 && sent.resolution === '480p' && sent.ratio === '9:16');
  ok('sound is always on and always sent, never left to the model\'s default', sent.sound === true);
  ok('the seed in the box is the seed the job is sent with', sent.seed === 4242);
  ok('and the new card carries it back straight away, without waiting for a poll',
    await page.$eval('#job-new1 .seedrow', (e) => /seed 4242/.test(e.textContent)));
  ok('the door is always auto — the page names no door, the server picks the cheapest', sent.door === 'auto');
  // ONE RULE, MEASURED — every price this page ever quoted was asked the same
  // way the job is sent. A page that priced one door and sent another would
  // show her the wrong number all day and look perfect.
  ok('every estimate this page asked for was asked for auto too (' + estQ.length + ' asked)',
    estQ.length > 0 && estQ.every((q) => q.door === 'auto'));
  ok('the new card is on top, drawing', await page.$eval('#feed', (f) => f.firstElementChild.id === 'job-new1' && /drawing/.test(f.firstElementChild.textContent)));
  // 2026-09-10: the words STAY in the box after a send (she re-rolls the
  // same clip with one change), so the draft is kept beside them — a send
  // that wiped the draft while the box still showed the words lost them on
  // the next load.
  ok('the words stay in the box after a send, and the draft stays with them',
    await page.evaluate(() => document.getElementById('prompt').value.length > 0 && localStorage.getItem('footage_draft') != null));

  // ── a content refusal is free, and the page says who can send it ─────────
  refuse = true;
  await page.click('#go');
  await page.waitForSelector('#err:not([hidden])');
  const err = await page.$eval('#err', (e) => e.textContent);
  // A REFUSAL IS THE ANSWER (2026-09-11 evening): the page says it was
  // refused and that nothing was drawn or charged — it names no door to try
  // next and the server sent it nowhere else.
  ok('a content refusal shows on the page as refused, nothing drawn or charged: ' + err,
    /refused/.test(err) && /nothing drawn or charged/.test(err) && !/every door/.test(err));

  // ── putting a prompt back brings its seed, and clearing means clearing ───
  await page.click('#job-old1 .copy');
  ok('copying a clip back puts its seed in the box with its words',
    (await page.$eval('#seedbox', (e) => e.value)) === '4242');
  await page.click('#job-f0 .copy');
  ok('copying a clip that has NO seed CLEARS the box — another clip\'s seed never rides along',
    (await page.$eval('#seedbox', (e) => e.value)) === '');

  // ── THE SECONDS COME BACK WITH THE WORDS (2026-09-10, Sophie: "seconds copy
  // w clip text") — with the size and the shape, since a clip is all four.
  // The box opens at the model's minimum, so this is measured against a clip
  // that is deliberately NOT four seconds.
  await page.click('#job-f6 .copy');
  const back = await page.evaluate(() => ({ secs: document.getElementById('secs').value,
    res: document.getElementById('res').value, ratio: document.getElementById('ratio').value,
    prompt: document.getElementById('prompt').value }));
  ok('copying a 15-second clip brings its seconds, its size and its shape back with its words ' + JSON.stringify(back),
    back.secs === '15' && back.res === '720p' && back.ratio === '9:16' && /socks on the line 6/.test(back.prompt));
  // AND IT WINS EVEN WITH THE CARET STILL IN THE SECONDS BOX — on iOS that
  // box can hold focus while she taps a card, and the guard that keeps a "1"
  // on its way to "12" from becoming 4 under her used to swallow the copy.
  // driven WITHOUT a real pointer on purpose: a playwright click blurs the
  // box on its way in, which is the one thing an iPhone does not promise
  await page.evaluate(() => { document.getElementById('secs').focus(); document.querySelector('#job-f6 .copy').click(); });
  ok('a copy she asked for beats the caret sitting in the seconds box',
    (await page.$eval('#secs', (e) => e.value)) === '15');
  await page.click('#job-f0 .copy');            // back to 4s · 480p · 3:4 for what follows

  // ── THE SEED'S ✕ (2026-09-10, Sophie: "x for seed to clear") ─────────────
  ok('an empty box draws no clear — a control that would do nothing is not drawn',
    await page.$eval('#seedclear', (e) => e.hidden));
  await page.click('#job-old1 .seedcopy');
  ok('a seed in the box brings the clear with it', !(await page.$eval('#seedclear', (e) => e.hidden)));
  await page.click('#seedclear');
  ok('the clear empties the box and takes itself off again',
    (await page.$eval('#seedbox', (e) => e.value)) === '' && (await page.$eval('#seedclear', (e) => e.hidden)));

  // ── A ROW ONLY PAYS FOR A COLLISION IT REALLY HAS ───────────────────────
  // With four references attached the strip is two rows tall, which puts the
  // controls a hundred pixels BELOW the pill — they must not still be paying
  // 49px for it. (The old pass measured every row in the zero-reserve layout,
  // where the strip fitted on one row and the controls grazed the pill by 4px.)
  await page.click('#job-old1 .copy');
  await page.waitForSelector('#refs .ref');
  await page.evaluate(() => window.__fitPillGap());
  await page.waitForTimeout(200);
  const withRefs = await page.evaluate(() => {
    const f = document.querySelector('body > .float').getBoundingClientRect();
    const row = document.getElementById('res').closest('.row');
    const r = row.getBoundingClientRect();
    // page coords against the fixed pill's viewport rect — fitPillGap's own
    // convention, so the answer does not depend on where she has scrolled to
    return { top: Math.round(r.top + (window.scrollY || 0)), pillBottom: Math.round(f.bottom),
      w: Math.round(r.width), gap: row.style.getPropertyValue('--pillgap') };
  });
  ok('with the references attached the controls sit below the pill and reserve nothing ' + JSON.stringify(withRefs),
    withRefs.top >= withRefs.pillBottom && (!withRefs.gap || withRefs.gap === '0px') && withRefs.w > 330);

  // ── TWO FOLDS, SEPARATELY (2026-09-10, Sophie: "make references, ABD
  // buttons collapsible separately") ─────────────────────────────────────
  // Every assertion is a MEASUREMENT: a fold that renders and hides nothing,
  // one that loses the values it hides, and one that forgets across a reload
  // all look identical in the source.
  const shown = (sel) => page.evaluate((q) => {
    const e = document.querySelector(q); const r = e.getBoundingClientRect();
    return !!(r.width && r.height);
  }, sel);
  ok('both open until she says otherwise', (await shown('#refs')) && (await shown('#controls')));
  await page.click('#ctlfold');
  await page.waitForTimeout(120);
  const ctlShut = await page.evaluate(() => ({
    controls: (() => { const r = document.getElementById('controls').getBoundingClientRect(); return !!(r.width && r.height); })(),
    lab: document.getElementById('ctlfoldlab').textContent,
    refs: (() => { const r = document.getElementById('refs').getBoundingClientRect(); return !!(r.width && r.height); })(),
    go: (() => { const r = document.getElementById('go').getBoundingClientRect(); return !!(r.width && r.height); })(),
    secs: document.getElementById('secs').value, ratio: document.getElementById('ratio').value,
  }));
  ok('folding the buttons hides them and leaves the references and the star alone ' + JSON.stringify(ctlShut),
    !ctlShut.controls && ctlShut.refs && ctlShut.go);
  ok('and the shut row says what they were set to, the model included: ' + ctlShut.lab,
    /2\.0 Mini/.test(ctlShut.lab) && /480p/i.test(ctlShut.lab) && /3:4/.test(ctlShut.lab) && /4s/i.test(ctlShut.lab));
  ok('a folded row keeps its values — hidden, never emptied', ctlShut.secs === '4' && ctlShut.ratio === '3:4');
  await page.click('#reffold');
  await page.waitForTimeout(120);
  const bothShut = await page.evaluate(() => ({ refs: (() => { const r = document.getElementById('refs').getBoundingClientRect(); return !!(r.width && r.height); })(),
    lab: document.getElementById('reffoldlab').textContent, n: document.querySelectorAll('#refs .ref').length }));
  ok('the references fold separately, and the shut row counts them: ' + bothShut.lab,
    !bothShut.refs && bothShut.n === 4 && /References · 4/.test(bothShut.lab));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(500);
  ok('a fold is remembered across a reload — folding once has to stick',
    !(await shown('#controls')) && !(await shown('#refs')));

  // ── THE SEED AND THE TWO DRAWERS GO WITH THE BUTTONS (2026-09-11, Sophie:
  // "make the seed text box also disappear when it collapse buttons" · "the
  // recent references button it stays open, even if I close the collapsible
  // folder"). MEASURED, because a seed box still on screen, a drawer still
  // painted with no control left to close it, and a label that never names a
  // set seed all look identical in the source.
  await page.click('#ctlfold');                     // open them again
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const b = document.getElementById('seedbox');
    b.value = '777'; b.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('rectog').click();      // the Recent drawer
    document.getElementById('casttog').click();     // and the character sheet
  });
  await page.waitForTimeout(150);
  const opened = await page.evaluate(() => ({
    seed: (() => { const r = document.getElementById('seedwrap').getBoundingClientRect(); return !!(r.width && r.height); })(),
    rec: (() => { const r = document.getElementById('recent').getBoundingClientRect(); return !!(r.width && r.height); })(),
    cast: (() => { const r = document.getElementById('cast').getBoundingClientRect(); return !!(r.width && r.height); })(),
  }));
  ok('with the buttons open the seed box and both drawers are on screen ' + JSON.stringify(opened),
    opened.seed && opened.rec && opened.cast);
  await page.click('#ctlfold');
  await page.waitForTimeout(150);
  const withSeed = await page.evaluate(() => ({
    seed: (() => { const r = document.getElementById('seedwrap').getBoundingClientRect(); return !!(r.width && r.height); })(),
    rec: (() => { const r = document.getElementById('recent').getBoundingClientRect(); return !!(r.width && r.height); })(),
    cast: (() => { const r = document.getElementById('cast').getBoundingClientRect(); return !!(r.width && r.height); })(),
    go: (() => { const r = document.getElementById('go').getBoundingClientRect(); return !!(r.width && r.height); })(),
    lab: document.getElementById('ctlfoldlab').textContent,
    val: document.getElementById('seedbox').value,
    // the row ellipsizes to give way to the picker, so the seed has to be
    // inside the part that is actually ON SCREEN — measured, not asserted
    // against the text, which carries the whole label either way
    seedShown: (() => {
      const l = document.getElementById('ctlfoldlab');
      const i = l.textContent.indexOf('seed ');
      if (i < 0) return false;
      const t = l.firstChild, rg = document.createRange();
      rg.setStart(t, i); rg.setEnd(t, i + 8);
      const r = rg.getBoundingClientRect(), lr = l.getBoundingClientRect();
      return r.right <= lr.right + 0.5;
    })(),
  }));
  ok('folding the buttons takes the seed box and both drawers with them, and leaves the star ' + JSON.stringify(withSeed),
    !withSeed.seed && !withSeed.rec && !withSeed.cast && withSeed.go);
  ok('a hidden seed is NEVER emptied — a folded Go still sends it', withSeed.val === '777');
  ok('and the shut row NAMES a seed she set, where it can be READ: ' + withSeed.lab,
    /seed 777/.test(withSeed.lab) && withSeed.seedShown);
  await page.evaluate(() => {
    const b = document.getElementById('seedbox');
    b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // PUTTING A CLIP BACK IS "these are what you are about to send" — it opens
  // both, because a value she cannot see is the hidden ingredient the price
  // line beside the star exists to prevent.
  await page.click('#job-old1 .copy');
  await page.waitForTimeout(200);
  ok('putting a clip back opens both again', (await shown('#refs')) && (await shown('#controls')));
  // taking each one off re-renders the strip, so the buttons are re-asked for
  // THE ✕ WORKS AFTER A COPY-BACK — it used to remove by identity, and the
  // strip's signature is the urls, so putting back a clip whose references
  // are the same urls left the buttons on screen closed over objects that
  // were no longer in the list: the ✕ did nothing at all.
  for (let g = 0; g < 8 && (await page.$$eval('#refs .ref', (n) => n.length)); g += 1) {
    await page.evaluate(() => document.querySelector('#refs .x').click());
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(150);
  const noRefs = await page.evaluate(() => ({ hidden: document.getElementById('reffold').hidden,
    disp: getComputedStyle(document.getElementById('reffold')).display,
    left: document.querySelectorAll('#refs .ref').length,
    refsH: Math.round(document.getElementById('refs').getBoundingClientRect().height) }));
  ok('with nothing attached the references fold is not drawn at all — never a dead control ' + JSON.stringify(noRefs),
    noRefs.hidden && noRefs.disp === 'none' && noRefs.left === 0);
  await page.click('#job-f0 .copy');
  const beforeBlank = posted.filter((p) => p.prompt).length;
  await page.click('#go');
  await page.waitForFunction((n) => true, beforeBlank);
  await page.waitForTimeout(300);
  const blank = posted.filter((p) => p.prompt).pop();
  ok('a blank box sends NO seed at all — the door mints one instead', blank && blank.seed === undefined);

  // ── ♥ / ✕ — what the server really received ──────────────────────────────
  await page.click('#job-old1 .heart');
  const v = posted.find((p) => p.vote);
  ok('a heart POSTs like to the clip\'s own vote route', v && /old1\/vote$/.test(v.vote) && v.body.vote === 'like');
  ok('the heart lights', await page.$eval('#job-old1 .heart', (b) => b.classList.contains('on')));

  // ── ♥ / ✕ FROM THE WALL (2026-09-10, Sophie: "heart and x from tile view")
  // Every assertion is a MEASUREMENT of what the server received or of what
  // renders: a mark that draws and posts nothing, and a mark whose tap also
  // plays the clip, both look perfect in the source.
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell .tmark').length > 0);
  ok('every cell carries the same two marks the card does',
    await page.evaluate(() => [...document.querySelectorAll('#tiles .cell')]
      .every((c) => c.querySelector('.tmark.heart') && c.querySelector('.tmark.nope'))));
  ok('a mark is a SIBLING of the play face, never a button inside a button',
    await page.evaluate(() => [...document.querySelectorAll('#tiles .tmark')].every((b) => !b.closest('button:not(.tmark)'))));
  ok('the clip hearted in the list shows hearted on the wall',
    await page.$eval('#tiles .cell[data-id="old1"] .tmark.heart', (b) => b.classList.contains('on')));
  const beforeX = posted.filter((p) => p.vote).length;
  const wallImg = await page.evaluateHandle(() => document.querySelector('#tiles .cell[data-id="f1"] img'));
  await page.click('#tiles .cell[data-id="f1"] .tmark.nope');
  await page.waitForTimeout(150);
  const wx = posted.filter((p) => p.vote).pop();
  ok('crossing one out on the wall POSTs dislike to THAT clip', posted.filter((p) => p.vote).length === beforeX + 1
    && /f1\/vote$/.test(wx.vote) && wx.body.vote === 'dislike');
  ok('the mark lights and the poster dims, without playing the clip',
    (await page.$eval('#tiles .cell[data-id="f1"] .tmark.nope', (b) => b.classList.contains('on')))
    && (await page.$eval('#tiles .cell[data-id="f1"]', (c) => c.classList.contains('nay')))
    && (await page.$eval('#player', (e) => e.hidden)));
  ok('a mark never rebuilds the wall — the posters are not re-decoded',
    await page.evaluate((h) => h === document.querySelector('#tiles .cell[data-id="f1"] img'), wallImg));
  ok('and the list card agrees with the wall',
    await page.$eval('#job-f1 .nope', (b) => b.classList.contains('on')));
  // AT FOUR ACROSS A TILE IS ~80px — the size that still fits two marks
  await page.click('#v-cols');
  await page.waitForTimeout(150);
  const marks4 = await page.evaluate(() => {
    const c = document.querySelector('#tiles .cell');
    const h = c.querySelector('.tmark.heart').getBoundingClientRect();
    const n = c.querySelector('.tmark.nope').getBoundingClientRect();
    return { cell: Math.round(c.getBoundingClientRect().width), gap: Math.round(n.left - h.right) };
  });
  ok('the two marks still clear each other at four across ' + JSON.stringify(marks4), marks4.gap > 6);
  await page.click('#v-cols');
  await page.click('#tiles .cell[data-id="f1"] .tmark.nope');   // put it back

  // ── A TILE GOES TO ITS CARD (2026-09-10, Sophie: "clicking on a tile in
  // footage · scrolls to it in list view, or opens in a lightbox") ─────────
  // Every assertion is a MEASUREMENT: a tap that switches the view and never
  // moves the window, one that lands on some other card, and one that also
  // opens the trimmer are the same markup to any source assertion.
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell .tdoor').length > 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  // BOTH DOORS ARE ON THE TILE (2026-09-10, Sophie: "can u have a play button,
  // and a list view button on tiles · so both options are available"), and the
  // POSTER itself is not a third, hidden one.
  const doors = await page.evaluate(() => {
    const c = document.querySelector('#tiles .cell[data-id="old1"]');
    const d = [...c.querySelectorAll('.tdoor')];
    const face = c.querySelector('.face');
    return { n: d.length, kinds: d.map((b) => b.className.replace('tdoor ', '')),
      glyphs: d.every((b) => !!b.querySelector('svg')),
      faceIsButton: face.tagName === 'BUTTON' || !!face.onclick,
      poster: !!face.querySelector('img') };
  });
  ok('a tile carries a play door and a card door, both drawn ' + JSON.stringify(doors.kinds),
    doors.n === 2 && doors.kinds.join(',') === 'play,card' && doors.glyphs);
  ok('and the poster under them is not a third, hidden door', doors.poster && !doors.faceIsButton);
  const noPlay = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#tiles .cell')].find((x) => !x.querySelector('.tdoor.play'));
    return c ? { id: c.dataset.id, card: !!c.querySelector('.tdoor.card') } : null;
  });
  ok('a clip with nothing to play yet carries only the door it can honour ' + JSON.stringify(noPlay),
    !!noPlay && noPlay.card);
  await page.click('#tiles .cell[data-id="old1"] .tdoor.card');
  await page.waitForFunction(() => !document.getElementById('feed').hidden);
  ok('tapping it opens the LIST, and never the player',
    !(await page.$eval('#feed', (e) => e.hidden)) && (await page.$eval('#tiles', (e) => e.hidden))
    && (await page.$eval('#v-list', (b) => b.classList.contains('on')))
    && (await page.$eval('#player', (e) => e.hidden)));
  // the SMOOTH scroll is waited out by watching it settle — asking whether the
  // card is on screen answers `true` before the scroll has even begun when it
  // happens to be below the fold already
  await page.evaluate(() => new Promise((res) => {
    let last = -1, still = 0;
    const tick = () => {
      const y = Math.round(window.scrollY);
      if (y === last) { if (++still > 8) return res(); } else { still = 0; last = y; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const landed = await page.evaluate(() => {
    const r = document.getElementById('job-old1').getBoundingClientRect();
    const doc = document.documentElement;
    return { top: Math.round(r.top), view: window.innerHeight, y: Math.round(window.scrollY),
      atEnd: Math.round(window.scrollY + window.innerHeight) >= doc.scrollHeight - 2,
      found: document.getElementById('job-old1').classList.contains('found') };
  });
  ok('the window lands ON the card she tapped ' + JSON.stringify(landed),
    landed.top >= -2 && landed.top < landed.view - 40 && (landed.top <= 40 || landed.atEnd));
  ok('and it flashes so she can see which one it is', landed.found);
  ok('the flash then leaves the card alone',
    await page.evaluate(() => new Promise((res) => setTimeout(
      () => res(!document.getElementById('job-old1').classList.contains('found')), 2000))));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForSelector('#job-old1');
  // the OTHER door on the same tile still plays it
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell .tdoor.play').length > 0);
  await page.click('#tiles .cell[data-id="old1"] .tdoor.play');
  await page.waitForFunction(() => !document.getElementById('player').hidden, { timeout: 5000 });
  ok('the play door on the same tile still opens the player', true);
  await page.evaluate(() => window.__navBack());
  await page.waitForFunction(() => document.getElementById('player').hidden);
  await page.click('#v-list');
  await page.waitForSelector('#job-old1');

  // ── NOTHING A DOOR SAYS MAY WIDEN THE PAGE ──────────────────────────────
  // (2026-09-10, Sophie: "bug where screen sometimes zooms extra or gets v
  // wide ?"). A refusal arrives as the door's own words, and every door has a
  // `gave no job id: ' + JSON.stringify(r)` branch — an UNBROKEN 200-char
  // token by construction, with Atlas handing back up to 600 characters of
  // raw body. With no wrap rule that is a ~4,000px line, and the viewport is
  // pinned `user-scalable=no`, so she cannot pinch back out of it.
  const wide = await page.evaluate(() => {
    const blob = 'x'.repeat(600);
    const err = document.getElementById('err');
    const was = err.textContent, hid = err.hidden;
    err.textContent = 'Atlas Cloud 400: ' + blob; err.hidden = false;
    const st = document.querySelector('#job-old1 [data-st]');
    const stWas = st.textContent;
    st.textContent = 'InputVideoSensitiveContentDetected.PrivacyInformation';
    const w = { doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth };
    err.textContent = was; err.hidden = hid; st.textContent = stWas;
    return w;
  });
  ok('600 unbroken characters from a door do not widen the page (' + wide.doc + ' vs ' + wide.view + ')', wide.doc <= wide.view);

  // ── THE BIGGER BOX HAS NO CEILING (2026-09-10, Sophie: "text box doesn't
  // extend enough") — a belt scene ran out of box at 52vh and scrolled inside
  // itself with a half-line clipped at the bottom edge.
  const scene = ('the interview room at night, fluorescent tubes buzzing overhead. ').repeat(20);
  const short0 = await page.$eval('#prompt', (t) => Math.round(t.getBoundingClientRect().height));
  await page.fill('#prompt', scene);
  await page.waitForTimeout(150);
  const grown = await page.$eval('#prompt', (t) => Math.round(t.getBoundingClientRect().height));
  ok('the box extends as she writes, clamped at 30vh so the controls stay on screen ('
    + short0 + ' → ' + grown + ' of 844)', short0 <= 140 && grown > short0 && grown <= Math.round(844 * 0.3) + 2);
  await page.click('#bigprompt');
  await page.waitForTimeout(250);
  const boxed = await page.$eval('#prompt', (t) => ({ h: Math.round(t.getBoundingClientRect().height),
    scroll: t.scrollHeight, client: t.clientHeight, max: getComputedStyle(t).maxHeight }));
  ok('the big box fits the whole scene rather than scrolling inside itself (' + JSON.stringify(boxed) + ')',
    boxed.max === 'none' && boxed.scroll <= boxed.client + 2 && boxed.h > 500);
  await page.click('#bigprompt');
  await page.fill('#prompt', '');

  // ── the player: the lightbox contract ────────────────────────────────────
  await page.click('#job-old1 .thumb');
  ok('tapping the thumb opens the player over the page, page locked', !(await page.$eval('#player', (e) => e.hidden)) && (await page.evaluate(() => document.body.style.overflow)) === 'hidden');
  ok('__navBack closes the player first', await page.evaluate(() => window.__navBack()) === true && (await page.$eval('#player', (e) => e.hidden)));
  ok('the page unlocks on close', (await page.evaluate(() => document.body.style.overflow)) === '');
  // THE WAY-OUT ROW PAINTS NOTHING — it is backdrop, and it must not wear the
  // INJECTED pill's `.ptop` (its back-to-top button: cream, `border-radius:50%`,
  // a shadow). On main it did, and the row rendered as a cream ellipse across
  // the screen behind the ✕ on every clip she opened. Only a reading of what
  // really renders can see that: every assertion about the row passed.
  await page.click('#job-old1 .thumb');
  ok('the player\'s top row paints nothing (it is backdrop, not the pill\'s button)',
    await page.$$eval('#player .pbar', (a) => {
      if (!a.length) return false;
      const c = getComputedStyle(a[0]);
      return /rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor) && c.borderRadius === '0px' && c.boxShadow === 'none';
    }));
  ok('and it is the full width of the screen, not a 38px button',
    await page.$$eval('#player .pbar', (a) => a.length === 1 && Math.round(a[0].getBoundingClientRect().width) === 390));
  await page.evaluate(() => window.__navBack());
  ok('still no page errors after the whole walk', errors.length === 0);

  // ── THE LAST FRAME, ON ITS CLIP'S OWN CARD (2026-09-11, Sophie: "how do i
  //    get these last frames") ──────────────────────────────────────────────
  // Every assertion here is a MEASUREMENT or a reading of what the saver was
  // really handed: a tile that renders and never decodes, one that opens the
  // CLIP instead of the picture, and a save that posts the clip's url under a
  // picture's tile all look identical in the source.
  {
    const tile = await page.$('#job-old1 .lfopen');
    ok('an Atlas clip carries its last frame under its references', Boolean(tile));
    ok('it rides in the SAME row as the references, not a row of its own', await page.$eval('#job-old1', (e) => {
      const g = e.querySelectorAll('.usedrefs');
      const cells = e.querySelectorAll('.usedrefs > *');
      return g.length === 1 && cells.length === 5 && cells[4].classList.contains('lfcell');
    }));
    ok('the picture really decodes (a src alone says nothing)',
      await page.$$eval('#job-old1 .lfcell img', (a) => a.length === 1 && a[0].complete && a[0].naturalWidth > 0));
    ok('it is the same width as a reference tile', await page.$eval('#job-old1', (e) => {
      const l = e.querySelector('.lfcell div'), r = e.querySelector('.ur:not(.lfcell) div');
      if (!l || !r) return false;
      return Math.abs(l.getBoundingClientRect().width - r.getBoundingClientRect().width) < 1.5;
    }));
    ok('and it wears no button plate of its own', await page.$$eval('#job-old1 .lfopen', (a) => {
      if (!a.length) return false;
      const c = getComputedStyle(a[0]);
      return c.borderTopWidth === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor);
    }));
    const tileWords = (id) => page.$$eval('#job-' + id + ' .lfopen', (a) => (a[0] ? a[0].textContent : '').trim());
    ok('an untrimmed clip\'s tile just says "last frame"', /^last frame$/.test(await tileWords('old1')));
    ok('a TRIMMED clip says the frame is the end of the WHOLE clip', /whole clip/.test(await tileWords('f1')));
    ok('a clip that went out through another door has no tile at all', (await page.$('#job-f0 .lfcell')) === null);
    // the tap: the PICTURE opens, in the one overlay, with no trim bar
    if (!tile) { report(); }
    await tile.click();
    // the picture is fetched on the tap — wait for it to land rather than
    // asking `complete` in the same tick (measured flaky on a longer feed)
    await page.waitForFunction(() => { const a = document.querySelectorAll('#player .pstage img.pimg'); return a.length === 1 && a[0].complete && a[0].naturalWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
    ok('tapping it opens the picture over the page, page locked',
      !(await page.$eval('#player', (e) => e.hidden))
      && (await page.$$eval('#player .pstage img.pimg', (a) => a.length === 1 && a[0].complete && a[0].naturalWidth > 0))
      && (await page.evaluate(() => document.body.style.overflow)) === 'hidden');
    ok('no video came with it, and no trim bar — there is nothing to mark',
      (await page.$('#player .pstage video')) === null && (await page.$eval('#trimbar', (e) => e.hidden)));
    ok('a tap ON the picture does not close it (the house rule)', await page.evaluate(() => {
      document.querySelector('#player .pstage img.pimg').click();
      return !document.getElementById('player').hidden;
    }));
    // SAVE: what the native bridge is really handed, never an href assertion
    const saved = [];
    await page.evaluate(() => { window.webkit = { messageHandlers: { forgeSave: { postMessage: (u) => window.__seenSave.push(u) } } }; window.__seenSave = []; });
    await page.click('#psave');
    // the save sits in the injected pill's own column — the player is z-index
    // 80 over the pill's 9, so it really does take the tap, and only
    // elementFromPoint can say so (a covered control passes every width test)
    ok('the save and the ✕ each take their own tap, over the pill\'s column',
      await page.evaluate(() => {
        const at = (e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return h && h.closest ? h : null; };
        const sv = at(document.getElementById('psave')), cl = at(document.querySelector('#player .pclose'));
        return Boolean(sv && sv.closest('#psave')) && Boolean(cl && cl.closest('.pclose'));
      }));
    ok('save hands the bridge the FRAME\'s url, not the clip\'s',
      (await page.evaluate(() => window.__seenSave)).join() === (await page.evaluate(() => document.querySelector('#job-old1 .lfcell img').src)));
    await page.evaluate(() => { delete window.webkit; });
    ok('the ✕ closes it and the page unlocks', await page.evaluate(() => { window.__navBack(); return document.getElementById('player').hidden; })
      && (await page.evaluate(() => document.body.style.overflow)) === '');
    ok('and the save goes away with it', await page.$eval('#psave', (e) => e.hidden));
    void saved;
  }

  // ── the sale is READ, and the card and the price line tell one story ─────
  ok('with no sale running the card says nothing about one', await page.$eval('#discline', (e) => e.hidden));
  atlasPays = 20;                              // Atlas's 80%-off Mini sale, read off its own model list
  await page.click('#help');
  await page.waitForFunction(() => !document.getElementById('discline').hidden);
  ok('opening the card picks the sale up live: ' + (await page.$eval('#discline', (e) => e.textContent)),
    /2\.0 Mini is 80% off right now/.test(await page.$eval('#discline', (e) => e.textContent)));
  await page.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
  ok('and the price under the star drops with it', priceNum(await page.$eval('#cost', (e) => e.textContent)) < priceNum(cost0));
  await page.click('body', { position: { x: 5, y: 820 } });

  // ── HER NOTES ON A CLIP (2026-09-10, her ask) ───────────────────────────
  // Every assertion here is a MEASUREMENT or a reading of what the server
  // really received: a box that opens and posts nothing, a note that lands on
  // the wrong chat, and a thread that never reaches the card all look
  // identical in the source.
  ok('the notes were read on load, under the chat /status served',
    noteReads.length > 0 && noteReads.every((c) => c === 'footage'));
  const noteBefore = noteReads.length;
  // a clip with no url has nothing to note ON — the Assets tab's silence rule
  const marks = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#feed .job')];
    const has = (el) => !!el.querySelector('.acts .note');
    const drawn = (el) => !!el.querySelector('.acts .save');   // save only exists with a url
    return {
      withVideo: !!document.querySelector('#job-old1 .acts .note'),
      everyDrawn: cards.filter(drawn).every(has),
      noneUndrawn: cards.filter((el) => !drawn(el)).every((el) => !has(el)),
      undrawn: cards.filter((el) => !drawn(el)).length,
    };
  });
  ok('every finished clip carries a note mark', marks.withVideo && marks.everyDrawn);
  ok('and a clip with no url yet carries none — nothing to note ON (' + marks.undrawn + ' such cards)', marks.noneUndrawn);
  // the box ships EMPTY (the house rule) and nothing was posted by opening it
  const postsBefore = posted.length;
  await page.click('#job-old1 .acts .note');
  await page.waitForSelector('#job-old1 .notebox textarea');
  ok('the box ships empty', (await page.$eval('#job-old1 .notebox textarea', (t) => t.value)) === ''
    && (await page.$eval('#job-old1 .notebox textarea', (t) => t.placeholder)) === 'Note');
  ok('opening it posts nothing', posted.length === postsBefore);
  // tapping the mark again puts it away and STILL writes nothing
  await page.click('#job-old1 .acts .note');
  ok('tapping the mark again closes it', (await page.$$('#job-old1 .notebox')).length === 0 && posted.length === postsBefore);
  // the round trip: what the server really received, and the thread on screen
  await page.click('#job-old1 .acts .note');
  await page.fill('#job-old1 .notebox textarea', 'the dog is on the wrong side');
  await page.click('#job-old1 .notebox .nsend');
  await page.waitForFunction(() => document.querySelectorAll('#job-old1 [data-thread] .nrow').length > 0);
  const gotNote = posted.filter((p) => p.note).pop();
  ok('the note reached the HOUSE route with the served chat, the clip url and from:sophie — ' + JSON.stringify(gotNote && gotNote.note),
    !!gotNote && gotNote.note.chat === 'footage' && /clip\.mp4$/.test(gotNote.note.url)
    && gotNote.note.from === 'sophie' && gotNote.note.text === 'the dog is on the wrong side');
  ok('her words are on the card, from the thread the server handed back',
    /the dog is on the wrong side/.test(await page.$eval('#job-old1 [data-thread]', (e) => e.textContent)));
  ok('the box closed on success and the mark says the clip has notes',
    (await page.$$('#job-old1 .notebox')).length === 0
    && (await page.$eval('#job-old1 .acts .note', (b) => b.classList.contains('has'))));
  ok('the note read was NOT re-run by writing one — the server\'s own answer is what painted it',
    noteReads.length === noteBefore);
  // a chat's answer reads back on the same clip
  threads[Object.keys(threads)[0]].push({ from: 'chat', text: 'redrawn, mirrored', at: new Date().toISOString() });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => /redrawn, mirrored/.test(document.querySelector('#job-old1 [data-thread]').textContent));
  ok('coming back to the tool re-reads the notes, and a chat\'s answer reads back under hers', true);
  // HER WORDS ARE NEVER LOST TO A REFUSAL
  await page.click('#job-old1 .acts .note');
  await page.fill('#job-old1 .notebox textarea', 'x'.repeat(2100));
  await page.click('#job-old1 .notebox .nsend');
  await page.waitForFunction(() => /too long/.test(document.querySelector('#job-old1 .nerr').textContent));
  ok('an over-length note is REFUSED with the reason and her words stay in the box',
    (await page.$eval('#job-old1 .notebox textarea', (t) => t.value)).length === 2100);
  await page.click('#job-old1 .notebox .ncancel');

  // A REBUILD MUST NOT TAKE THE BOX — OR HER WORDS — WITH IT. A note LANDING
  // was already outside the signature, but anything the card PRINTS changing
  // rewrites it whole, and a vote coming back is the ordinary one: she taps
  // the heart while she is halfway through a note and the box goes with it.
  // Driven through the real vote, which is the only honest way to ask.
  await page.click('#job-old1 .acts .note');
  await page.waitForSelector('#job-old1 .notebox textarea');
  await page.fill('#job-old1 .notebox textarea', 'half a sentence she is still');
  await page.click('#job-old1 .heart');
  await page.waitForTimeout(150);
  ok('a card rebuilt under her keeps the open box and every word in it',
    (await page.$$('#job-old1 .notebox')).length === 1
    && (await page.$eval('#job-old1 .notebox textarea', (t) => t.value)) === 'half a sentence she is still'
    && (await page.$eval('#job-old1 .acts .note', (b) => b.classList.contains('on'))));
  await page.click('#job-old1 .heart');                 // put her heart back
  await page.waitForTimeout(150);
  await page.click('#job-old1 .notebox .ncancel');

  // ── HER NOTE'S FIRST WORDS, ON TOP OF THE TILE (2026-09-10, Sophie: "i also
  // wanted notes to show as the firs words that fit on just the top of the
  // tile" · "just my notes · not claude's") ───────────────────────────────
  // MEASURED, not asserted: a strip that carries the right words below the
  // fold of its own tile, one that wraps to three lines, and one that eats the
  // taps under it are the same markup to any source assertion. The thread at
  // this point is HERS then a chat's answer on top of it, so a strip reading
  // the newest message and one reading her newest are told apart here.
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell .tnote').length > 0);
  await page.waitForFunction(() => /the dog is on the wrong side/.test(
    document.querySelector('#tiles .cell[data-id="old1"] .tnote').textContent));
  const strip = await page.evaluate(() => {
    const c = document.querySelector('#tiles .cell[data-id="old1"]');
    const n = c.querySelector('.tnote'), cr = c.getBoundingClientRect(), nr = n.getBoundingClientRect();
    const mid = document.elementFromPoint(Math.round(nr.left + nr.width / 2), Math.round(nr.top + nr.height / 2));
    return { text: n.textContent, noted: c.classList.contains('noted'),
      fromTop: Math.round(nr.top - cr.top), lines: Math.round(nr.height / parseFloat(getComputedStyle(n).lineHeight)),
      insideTile: nr.right <= cr.right + 1 && nr.left >= cr.left - 1,
      eatsTaps: !!(mid && mid.closest('.ttop')) };
  });
  ok('HER newest note is on top of its tile, and a chat\'s answer never is ' + JSON.stringify(strip),
    strip.text === 'the dog is on the wrong side' && strip.noted && strip.fromTop <= 4
    && strip.lines === 1 && strip.insideTile);
  ok('and the strip is a message, never a control that eats the tap under it', !strip.eatsTaps);
  // A LONG NOTE IS CUT BY THE BROWSER at whatever the column count leaves —
  // "the first words that fit", asked of the layout rather than counted out
  threads[Object.keys(threads)[0]].push({ from: 'sophie',
    text: 'the light on her face goes flat halfway through and the room reads green after that', at: new Date().toISOString() });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => /the light on her face/.test(
    document.querySelector('#tiles .cell[data-id="old1"] .tnote').textContent));
  const longNote = await page.evaluate(() => {
    const n = document.querySelector('#tiles .cell[data-id="old1"] .tnote');
    return { cut: n.scrollWidth > n.clientWidth,
      lines: Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)) };
  });
  ok('a long note is cut to the words that fit, on ONE line ' + JSON.stringify(longNote),
    longNote.cut && longNote.lines === 1);
  // A CLIP ONLY A CHAT HAS SPOKEN ON STAYS QUIET — the strip is her side of it
  const key = Object.keys(threads)[0];
  const kept = threads[key];
  threads[key] = [{ from: 'chat', text: 'redrawn, mirrored', at: new Date().toISOString() }];
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => !document.querySelector('#tiles .cell[data-id="old1"]').classList.contains('noted'));
  ok('a clip only a chat has spoken on draws no strip at all',
    (await page.$eval('#tiles .cell[data-id="old1"] .tnote', (n) => n.textContent)) === '');
  threads[key] = kept;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => document.querySelector('#tiles .cell[data-id="old1"]').classList.contains('noted'));
  const quiet = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#tiles .cell')].find((x) => !x.querySelector('.tdoor.play'));
    if (!c) return null;
    return { noted: c.classList.contains('noted'), shown: getComputedStyle(c.querySelector('.ttop')).display !== 'none' };
  });
  ok('a clip nobody has said anything about carries no strip at all ' + JSON.stringify(quiet),
    !!quiet && !quiet.noted && !quiet.shown);
  await page.click('#v-list');
  await page.waitForSelector('#job-old1');

  // THE PLAYER: the shared tap-to-note, and the tap-out that must not eat it
  await page.click('#job-old1 .thumb');
  await page.waitForFunction(() => !document.getElementById('player').hidden);
  await page.waitForTimeout(400);
  const inPlayer = await page.evaluate(() => ({
    note: !!document.querySelector('#player .notebtn'),
    close: !!document.querySelector('#player .pclose'),
  }));
  ok('the shared /filmnote.js note button is on the player', inPlayer.note);
  if (inPlayer.note) {
    await page.click('#player .notebtn');
    await page.waitForTimeout(300);
    ok('tapping its own button does NOT close the player (the old rule closed on anything that was not a VIDEO)',
      !(await page.$eval('#player', (e) => e.hidden)));
  }
  await page.click('#player', { position: { x: 6, y: 500 } });
  await page.waitForFunction(() => document.getElementById('player').hidden);
  ok('a tap on the backdrop still closes it', true);
  // the ✕ is TAPPED, never merely found — a presence check passed for a day
  // while the video painted over it on every portrait clip (2026-09-11)
  await page.click('#job-old1 .thumb');
  await page.waitForFunction(() => !document.getElementById('player').hidden);
  await page.waitForTimeout(300);
  const reach = await page.evaluate(() => {
    const c = document.querySelector('#player .pclose'); const q = c.getBoundingClientRect();
    const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
    return { ok: !!(hit && hit.closest('.pclose')), x: q.x + q.width / 2, y: q.y + q.height / 2 };
  });
  ok('the close button is reachable', inPlayer.close && reach.ok);
  await page.mouse.click(reach.x, reach.y);
  await page.waitForTimeout(200);
  ok('and the close button closes it', await page.$eval('#player', (e) => e.hidden));


  // ── THE FIRST FRAME, ON THE PAGE (2026-09-11) ───────────────────────────
  // The last frame of one clip pinned as the frame the next one starts on.
  // In its OWN context, because the marks and the strip ride localStorage and
  // every assertion above was written against a page with neither.
  //
  // Every check here is a MEASUREMENT or a reading of what the server really
  // received: a flag that lights and never reaches the request, a slot line
  // that renumbers on screen and not in her prompt, and a warning that renders
  // below the fold all look identical in the source.
  {
    const ctxK = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const pk = await ctxK.newPage();
    const kerr = [];
    pk.on('pageerror', (e) => kerr.push(String(e)));
    await pk.addInitScript(INSET(47), 47);
    await pk.goto(`http://127.0.0.1:${port}/footage`);
    await pk.waitForSelector('#job-old1');
    await pk.waitForTimeout(400);
    // A missing control must give a COUNT, not a crash — against the page
    // before this pass there is no `#pfirst` at all and every step after the
    // first would throw or time out.
    try {

    // THE LAST-FRAME TILE IS THE DOOR — no save-and-re-attach
    await pk.click('#job-old1 .lfopen');
    await pk.waitForFunction(() => !document.getElementById('player').hidden);
    await pk.waitForTimeout(250);
    const doors = await pk.evaluate(() => {
      const hit = (q) => { const e = document.querySelector(q);
        if (!e) return { shown: false, reach: false, right: 0 };
        const r = e.getBoundingClientRect();
        const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { shown: !!(r.width && r.height), reach: !!(h && h.closest(q)), right: Math.round(r.right) }; };
      return { first: hit('#pfirst'), ref: hit('#pref'), save: hit('.psave'), w: innerWidth };
    });
    ok('the frame opens big with BOTH doors onto the next clip, beside save ' + JSON.stringify(doors),
      doors.first.shown && doors.first.reach && doors.ref.shown && doors.ref.reach && doors.save.shown && doors.save.reach);
    ok('and the three of them fit the row at 390pt', doors.save.right <= doors.w);
    await pk.click('#pfirst');
    await pk.waitForFunction(() => document.getElementById('player').hidden);
    await pk.waitForTimeout(250);
    const landed = await pk.evaluate(() => ({
      n: document.querySelectorAll('#refs .ref').length,
      lit: document.querySelectorAll('#refs .kf.on').length,
      label: (document.querySelector('#refs .slot') || {}).textContent,
      isSpan: (document.querySelector('#refs .slot') || {}).tagName,
      open: (() => { const r = document.getElementById('refs').getBoundingClientRect(); return !!(r.width && r.height); })(),
    }));
    ok('tapping "first frame" attaches it and marks it, with the references fold open ' + JSON.stringify(landed),
      landed.n === 1 && landed.lit === 1 && landed.label === 'first frame' && landed.open);
    ok('a marked picture wears the WORD in place of its slot, and the slot is no longer a button to tap in',
      landed.isSpan === 'SPAN');
    // BOTH OF THESE WERE FOUND BY PHOTOGRAPHING THE PAGE, and neither is
    // visible to any markup assertion: a <span> inherits neither the button
    // rule's serif nor a button's centred text, so the marked cell's label
    // sat left-aligned in the SANS beside its neighbours' centred serif.
    const look = await pk.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#refs .kfslot'));
      const b = getComputedStyle(document.querySelector('#refs button.slot') || document.querySelector('#refs .kfslot'));
      const e = document.querySelector('#refs .kfslot');
      return { fam: s.fontFamily, bfam: b.fontFamily, align: s.textAlign, over: e.scrollWidth > e.clientWidth };
    });
    ok('the marked label reads as the slot line it replaces — same family, centred, not overflowing ' + JSON.stringify(look),
      look.align === 'center' && look.fam === look.bfam && !look.over);

    // THE SHAPE REACHES THE SERVER — the price and the door she reads have to
    // be the ones this tap will really get
    await pk.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
    const q1 = estQ[estQ.length - 1];
    ok('the estimate is asked with first=1 and NO refs — a keyframe is not a reference ' + JSON.stringify(q1),
      q1 && q1.first === '1' && q1.refs === undefined);
    ok('with the keyframe alone there is nothing to warn about — every door takes it',
      await pk.$eval('#kfnote', (e) => e.hidden));

    // A PICTURE BESIDE IT: the doors disagree, so she is told BEFORE she taps
    await pk.setInputFiles('#file', { name: 'wall.png', mimeType: 'image/png', buffer: PNG });
    await pk.waitForFunction(() => document.querySelectorAll('#refs .ref').length === 2);
    await pk.waitForFunction(() => !document.getElementById('kfnote').hidden);
    const note = await pk.evaluate(() => {
      const e = document.getElementById('kfnote'); const r = e.getBoundingClientRect();
      return { text: e.textContent, bad: e.classList.contains('bad'), onScreen: r.top >= 0 && r.top < innerHeight && r.height > 0,
        door: document.getElementById('cost').dataset.door,
        cost: document.getElementById('cost').textContent };
    });
    ok('a first frame beside a reference says so plainly, on screen, before the tap: ' + note.text,
      /APIFRAME only/.test(note.text) && note.onScreen && !note.bad);
    ok('and the price line names the door that tap will really go to: ' + note.cost, note.door === 'apiframe');
    // THE ✕ AND THE NEXT CELL'S FLAG EACH HANG 6px OFF THEIR CORNER, so at
    // the old 8px gap they overlapped by 4px and the flag painted over the ✕
    // beside it — asked with elementFromPoint, the only honest question.
    const corners = await pk.evaluate(() => {
      const cells = [...document.querySelectorAll('#refs .ref')];
      const at = (e) => { const r = e.getBoundingClientRect();
        const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!(h && (h === e || h.closest('.x') === e || h.closest('.kf') === e)); };
      return { x0: at(cells[0].querySelector('.x')), kf1: at(cells[1].querySelector('.kf')),
        rows: new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top))).size };
    });
    ok('the ✕ and the next cell\'s flag each take their own tap, and two cells still share a row ' + JSON.stringify(corners),
      corners.x0 && corners.kf1 && corners.rows === 1);
    const slots2 = await pk.$$eval('#refs .slot', (ns) => ns.map((n) => n.textContent));
    ok('the picture beside it is [Image1] — the keyframe took no slot: ' + JSON.stringify(slots2),
      slots2.filter((s) => /Image/.test(s)).join(',') === '[Image1]');

    // HER PROMPT IS RENUMBERED, NOT REWRITTEN — three pictures, mark the
    // middle one, and read the box. This is the ✕'s own rule from the other
    // end and it is the half that is invisible from any markup assertion.
    await pk.setInputFiles('#file', { name: 'chair.png', mimeType: 'image/png', buffer: PNG });
    await pk.waitForFunction(() => document.querySelectorAll('#refs .ref').length === 3);
    // take the frame's own mark off so all three are ordinary references
    await pk.evaluate(() => document.querySelector('#refs .kf.on').click());
    await pk.evaluate(() => document.querySelector('#refs .kf.on').click());
    await pk.waitForFunction(() => document.querySelectorAll('#refs .kf.on').length === 0);
    await pk.fill('#prompt', 'a in [Image1], b in [Image2], c in [Image3]');
    await pk.evaluate(() => document.querySelectorAll('#refs .kf')[1].click());
    await pk.waitForTimeout(200);
    const renum = await pk.evaluate(() => ({
      prompt: document.getElementById('prompt').value,
      labels: [...document.querySelectorAll('#refs .slot')].map((n) => n.textContent),
    }));
    ok('marking the middle picture takes its name out of the box and renumbers the rest: ' + renum.prompt,
      renum.prompt === 'a in [Image1], b in, c in [Image2]');
    ok('and the strip says the same thing: ' + JSON.stringify(renum.labels),
      renum.labels.join(',') === '[Image1],first frame,[Image2]');
    // …and unmarking gives the name back and puts the numbering up again
    await pk.evaluate(() => document.querySelector('#refs .kf.on').click());
    await pk.evaluate(() => document.querySelector('#refs .kf.on').click());
    await pk.waitForFunction(() => document.querySelectorAll('#refs .kf.on').length === 0);
    const back = await pk.$eval('#prompt', (e) => e.value);
    ok('unmarking it renumbers the rest back up: ' + back, back === 'a in [Image1], b in, c in [Image3]');
    // the cycle's middle stop
    await pk.evaluate(() => document.querySelectorAll('#refs .kf')[1].click());
    await pk.evaluate(() => document.querySelectorAll('#refs .kf')[1].click());
    await pk.waitForTimeout(150);
    ok('a second press is LAST frame, a third is neither — the mark cycles',
      (await pk.$eval('#refs .slot + .slot, #refs .kfslot', (e) => e.textContent)) === 'last frame');

    // WITH NO DOOR OPEN FOR THAT SHAPE SHE IS TOLD WHAT TO CHANGE
    noApiframe = true;
    await pk.evaluate(() => { document.getElementById('ratio').dispatchEvent(new Event('change')); });
    await pk.waitForFunction(() => document.getElementById('kfnote').classList.contains('bad'));
    const badNote = await pk.$eval('#kfnote', (e) => e.textContent);
    ok('with no door open for that shape the line says what to take off: ' + badNote,
      /take the references off, or take the frame off/i.test(badNote));
    noApiframe = false;

    // WHAT REALLY LEAVES THE PHONE
    // it is sitting on LAST; the cycle is none → first → last → none, so two
    // presses bring it back round to FIRST
    await pk.evaluate(() => document.querySelectorAll('#refs .kf')[1].click());
    await pk.waitForTimeout(120);
    await pk.evaluate(() => document.querySelectorAll('#refs .kf')[1].click());
    await pk.waitForFunction(() => document.querySelectorAll('#refs .kfslot').length === 1
      && document.querySelector('#refs .kfslot').textContent === 'first frame');
    await pk.fill('#prompt', 'she walks out of the office');
    const wasSent = posted.filter((p) => p.prompt).length;
    await pk.click('#go');
    await pk.waitForFunction((n) => true, wasSent);
    await pk.waitForTimeout(400);
    const k = posted.filter((p) => p.prompt).pop();
    ok('GO carries firstFrameUrl, and the marked picture is still in refs with its role for the log',
      k && typeof k.firstFrameUrl === 'string' && /ref\.png/.test(k.firstFrameUrl) && k.refs.length === 3);
    ok('and no lastFrameUrl when she marked no last frame', k && k.lastFrameUrl === undefined);
    // the optimistic card says which end it is rather than a blank label
    const cardLab = await pk.evaluate(() => {
      const c = document.querySelector('#feed .job .usedrefs');
      return c ? c.textContent : '';
    });
    ok('the new card labels the keyframe by name, never with an empty slot: ' + cardLab, /first frame/.test(cardLab));

    // A KEYFRAME SURVIVES A RELOAD — the draft carries it, or a reload would
    // send it as an ordinary reference with nothing on screen saying so
    await pk.reload();
    await pk.waitForFunction(() => document.querySelectorAll('#refs .ref').length === 3);
    await pk.waitForTimeout(250);
    ok('the mark rides the draft across a reload',
      (await pk.$$eval('#refs .kf.on', (n) => n.length)) === 1);

    // …and a card with no keyframe CLEARS the marks, the only-what-the-record-
    // knows rule the seed and the photo reference already follow
    await pk.click('#job-f0 .copy');
    await pk.waitForTimeout(300);
    ok('putting back a clip that had no keyframe clears the marks',
      (await pk.$$eval('#refs .kf.on', (n) => n.length)) === 0);

    ok('no page errors in the keyframe pass — ' + kerr.join(' | '), kerr.length === 0);
    } catch (e) { ok('the keyframe pass ran to the end — ' + String(e).slice(0, 120), false); }
    await pk.close();
    await ctxK.close();
  }

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

  // ── THE PROJECT (2026-09-11, Sophie: "group projects and character
  // references so when I switch between projects, I can only see those
  // references offered to me and only related files in the tiles list view
  // area"). Every assertion a MEASUREMENT of what the page shows or what the
  // stub really received — a picker that paints and filters nothing, a send
  // that drops the field, and a hand-off that never switches all look fine
  // in the source. ──────────────────────────────────────────────────────────
  {
  const ctxP = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pgP = await ctxP.newPage();
  await pgP.goto(`http://127.0.0.1:${port}/footage`);
  await pgP.waitForSelector('#job-old1');
  await pgP.waitForTimeout(400);
  const pick0 = await pgP.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('#project option')).map((o) => o.value + '=' + o.textContent),
    val: document.getElementById('project').value,
    cards: document.querySelectorAll('#feed .job:not([hidden])').length,
    wardTag: /The ward/.test(document.querySelector('#job-old1 .tags').textContent),
    noneTag: /The ward/.test(document.querySelector('#job-f4 .tags').textContent),
  }));
  ok('the picker opens on All with the cast\'s films and a New row — ' + pick0.rows.join(' '), pick0.val === '' && pick0.rows[0] === '=All' && pick0.rows[1] === 'ward=The ward' && pick0.rows[pick0.rows.length - 1] === '__new=New…');
  ok('on All every clip shows and a ward clip SAYS so on its card, a project-less one does not', pick0.cards === new Set(jobs.map((j) => j.id)).size && pick0.wardTag && !pick0.noneTag);
  ok('the feed read under All asked for no project', projReads.length > 0 && projReads.every((p) => p === ''));
  // pick the ward
  const n0 = projReads.length;
  await pgP.selectOption('#project', 'ward');
  await pgP.waitForFunction(() => document.querySelectorAll('#feed .job').length === 5);
  await pgP.waitForTimeout(300);
  const pick1 = await pgP.evaluate(() => ({
    ids: Array.from(document.querySelectorAll('#feed .job:not([hidden])')).map((e) => e.dataset.id).sort().join(','),
    wardTag: /The ward/.test(document.querySelector('#job-old1 .tags').textContent),
    saved: localStorage.getItem('footage_project'),
    fold: document.getElementById('ctlfoldlab').textContent,
  }));
  ok('picking the ward re-asks the feed FOR the ward — ' + projReads.slice(n0).join('|'), projReads.slice(n0).length >= 1 && projReads.slice(n0).every((p) => p === 'ward'));
  ok('and only the ward\'s five clips are on screen — ' + pick1.ids, pick1.ids === 'c1,f0,f1,f2,old1');
  ok('inside a project the card does not repeat its name', !pick1.wardTag);
  ok('the pick is remembered', pick1.saved === 'ward');
  // the picker sits on the PANEL's fold row (2026-09-11 — it moved up there
  // with the whole-panel fold, because that row is the one thing a shut panel
  // still draws and the picker narrows the feed as well as the clip), on one
  // line with it, clear of the pill
  const seat = await pgP.evaluate(() => {
    const p = document.getElementById('project'), f = document.getElementById('panelfold');
    const pr = p.getBoundingClientRect(), fr = f.getBoundingClientRect(), pill = document.querySelector('body > .float').getBoundingClientRect();
    const hit = document.elementFromPoint(pr.x + pr.width / 2, pr.y + pr.height / 2);
    return { sameRow: p.closest('.foldrow') === f.closest('.foldrow'), level: Math.abs((pr.y + pr.height / 2) - (fr.y + fr.height / 2)) < 4, clear: pr.right <= pill.left, tappable: !!(hit && hit.closest('#project')), val: p.value };
  });
  ok('the picker sits on the panel fold row, level with it, clear of the pill and tappable — ' + JSON.stringify(seat), seat.sameRow && seat.level && seat.clear && seat.tappable && seat.val === 'ward');
  // the tiles narrow too
  await pgP.click('#v-tiles');
  await pgP.waitForTimeout(300);
  const tiles1 = await pgP.evaluate(() => Array.from(document.querySelectorAll('#tiles .cell:not([hidden])')).map((e) => e.dataset.id).sort().join(','));
  ok('the wall is the same five — ' + tiles1, tiles1 === 'c1,f0,f1,f2,old1');
  await pgP.click('#v-list');
  // a send carries it
  const nPost = posted.length;
  await pgP.fill('#prompt', 'the ward corridor, camera at eye level');
  await pgP.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
  await pgP.click('#go');
  await pgP.waitForSelector('#job-new1');
  const sentP = posted.slice(nPost).find((p) => p.prompt);
  ok('the job the server really received carries project=ward', sentP && sentP.project === 'ward');
  const newShown = await pgP.evaluate(() => !document.getElementById('job-new1').hidden);
  ok('and the new clip is on screen inside the project', newShown);
  // an upload lands in the project\'s own album
  const nUp = posted.length;
  await pgP.setInputFiles('#file', { name: 'edna.png', mimeType: 'image/png', buffer: PNG });
  await pgP.waitForTimeout(600);
  const up = posted.slice(nUp).find((p) => p.upload);
  ok('an upload under the ward lands in the "The ward" Dump album', up && up.upload.bundle === 'The ward');
  // the character sheet opens on the project\'s shelf, with no film chips
  const nCast = castReads.length;
  await pgP.click('#casttog');
  await pgP.waitForTimeout(300);
  const castV = await pgP.evaluate(() => ({ chips: document.querySelectorAll('#cast .films').length, open: !document.getElementById('cast').hidden }));
  ok('the character sheet reads the ward\'s shelf — ' + castReads.slice(nCast).join('|'), castReads.slice(nCast).length === 1 && castReads.slice(nCast)[0] === 'ward');
  ok('and draws no film chips — the picker is the control', castV.open && castV.chips === 0);
  await pgP.click('#casttog');
  // a reload remembers, and All brings everything back
  await pgP.reload();
  await pgP.waitForSelector('#job-old1');
  await pgP.waitForTimeout(400);
  const afterReload = await pgP.evaluate(() => ({ val: document.getElementById('project').value, ids: Array.from(document.querySelectorAll('#feed .job:not([hidden])')).map((e) => e.dataset.id).sort().join(',') }));
  ok('a reload opens on the remembered project with only its clips — ' + afterReload.ids, afterReload.val === 'ward' && afterReload.ids === 'c1,f0,f1,f2,new1,old1');
  await pgP.selectOption('#project', '');
  await pgP.waitForFunction(() => document.querySelectorAll('#feed .job').length === 10);
  const allAgain = await pgP.evaluate(() => ({ n: document.querySelectorAll('#feed .job:not([hidden])').length, from: document.querySelector('#job-c1 .tags').textContent, own: document.querySelector('#job-old1 .tags').textContent }));
  ok('All brings the other four back', allAgain.n === 10);
  ok('a chat\'s clip says which chat sent it and the page\'s own does not — ' + allAgain.from, /from mom-character-clip/.test(allAgain.from) && !/from /.test(allAgain.own));
  // ── MOVE A CLIP (2026-09-11, Sophie: "can you also add the move project
  // UI"). The card's drop-down: the films, No project first, the clip's own
  // project lit; picking another POSTs it and the card leaves a project view
  // it no longer belongs to. Measured off what the stub really received.
  {
    const dd = await pgP.evaluate(() => {
      const s = document.querySelector('#job-f4 .projsel select');
      s.scrollIntoView({ block: 'center' });
      const r = s.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { rows: Array.from(s.options).map((o) => o.value + '=' + o.textContent), val: s.value, h: r.height, tappable: !!(hit && hit.closest('.projsel')),
        wardVal: document.querySelector('#job-old1 .projsel select').value };
    });
    ok('every card carries the move drop-down — No project first, the films after, the clip\'s own project lit — ' + dd.rows.join(' '), dd.rows[0] === '=No project' && dd.rows[1] === 'ward=The ward' && dd.val === '' && dd.wardVal === 'ward');
    ok('it is the icons\' height and takes its own tap — ' + dd.h + ' ' + dd.tappable, Math.abs(dd.h - 32) < 1 && dd.tappable);
    await pgP.selectOption('#job-f4 .projsel select', 'ward');
    await pgP.waitForFunction(() => document.querySelector('#toast').classList.contains('show'));
    const mv = await pgP.evaluate(() => ({ toast: document.querySelector('#toast').textContent, tag: document.querySelector('#job-f4 .tags').textContent, val: document.querySelector('#job-f4 .projsel select').value }));
    ok('moving f4 to the ward POSTs it and the card says so — ' + mv.toast, projMoves.length === 1 && projMoves[0].id === 'f4' && projMoves[0].project === 'ward' && /Moved to The ward/.test(mv.toast) && /The ward/.test(mv.tag) && mv.val === 'ward');
    // inside the ward, taking f4 OFF makes it leave the view
    await pgP.selectOption('#project', 'ward');
    await pgP.waitForFunction(() => document.querySelectorAll('#feed .job:not([hidden])').length === 7);
    await pgP.selectOption('#job-f4 .projsel select', '');
    await pgP.waitForFunction(() => document.getElementById('job-f4').hidden);
    const gone = await pgP.evaluate(() => ({ n: document.querySelectorAll('#feed .job:not([hidden])').length, toast: document.querySelector('#toast').textContent }));
    ok('inside a project, taking a clip off it POSTs \'\' and the card leaves the view — ' + gone.toast, projMoves.length === 2 && projMoves[1].id === 'f4' && projMoves[1].project === '' && gone.n === 6 && /Taken off/.test(gone.toast));
    await pgP.selectOption('#project', '');
    await pgP.waitForFunction(() => document.querySelectorAll('#feed .job:not([hidden])').length === 10);
  }
  // A HAND-OFF SWITCHES THE PROJECT — written by a second page on the same
  // origin, the way a belt writes it; the map is on /status
  const pgB = await ctxP.newPage();
  await pgB.goto(`http://127.0.0.1:${port}/ref.png`);
  await pgB.evaluate(() => localStorage.setItem('footage_handoff', JSON.stringify({ prompt: 'from the belt', refs: [], model: 'mini', res: '480p', ratio: '16:9', from: 'climax-dissociation-accounts', title: 'the office', at: Date.now() })));
  await pgP.waitForFunction(() => document.getElementById('project').value === 'ward' && document.querySelectorAll('#feed .job:not([hidden])').length === 6);
  const hoff = await pgP.evaluate(() => ({ val: document.getElementById('project').value, prompt: document.getElementById('prompt').value, ids: Array.from(document.querySelectorAll('#feed .job:not([hidden])')).map((e) => e.dataset.id).sort().join(',') }));
  ok('a hand-off from a ward belt switches the picker to the ward and narrows the feed — ' + hoff.ids, hoff.val === 'ward' && hoff.prompt === 'from the belt' && hoff.ids === 'c1,f0,f1,f2,new1,old1');
  // a belt that DECLARES a project the shelf has never heard of names a new one
  const nFilms = filmsPosted.length;
  await pgB.evaluate(() => localStorage.setItem('footage_handoff', JSON.stringify({ prompt: 'ticky tack scene', refs: [], model: 'mini', res: '480p', ratio: '16:9', from: 'ticky-tack-film-page-dupe', project: 'ticky-tack', title: 't', at: Date.now() })));
  await pgP.waitForFunction(() => document.getElementById('project').value === 'ticky-tack');
  await pgP.waitForTimeout(300);
  const tt = await pgP.evaluate(() => ({ rows: Array.from(document.querySelectorAll('#project option')).map((o) => o.value), cards: document.querySelectorAll('#feed .job:not([hidden])').length, empty: !document.getElementById('feedempty').hidden }));
  ok('a declared project the shelf lacks becomes a row, is filed on the shelf, and shows an empty feed — ' + tt.rows.join(' '), tt.rows.indexOf('ticky-tack') > 0 && filmsPosted.slice(nFilms).some((f) => f.slug === 'ticky-tack') && tt.cards === 0);
  await pgB.close();
  await ctxP.close();
  }

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
