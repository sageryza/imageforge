#!/usr/bin/env node
/* FOOTAGE — Seedance clips by her own hand (2026-09-09, Sophie: "build a
   point so I can just make things on my own time by describing them or
   uploading references").

   The pure half: the door decision (a person-safe job goes OpenRouter first
   and falls to APIFRAME; 1.5 Pro is APIFRAME only; a pinned door is obeyed),
   the estimate (OpenRouter by video tokens with the fee and the sale, APIFRAME
   per second), the slot names in attach order, and the body both doors take.
   The source pins: the mount, the page route, the link maps on both sides of
   the universal-link contract, the pill mirror, the pipeline stage.
   The page half drives the REAL public/footage.html in headless Chromium
   against a stub that RECORDS what the page really POSTs — a lit chip says
   nothing about what left the phone — and asserts the four page rules on the
   rendered boxes.

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

// ── the pure half ────────────────────────────────────────────────────────────
{
  const F = require('../footage');
  const both = { openrouter: true, apiframe: true };
  ok('auto: a 2.x model goes OpenRouter first with APIFRAME as the fallback',
    JSON.stringify(F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, both)) === '{"door":"openrouter","fallback":"apiframe"}');
  ok('1.5 Pro is APIFRAME only, whatever auto says', F.doorFor({ model: '1.5', door: 'auto', resolution: '480p' }, both).door === 'apiframe');
  ok('pinning OpenRouter on 1.5 Pro is refused with a reason', /only on APIFRAME/.test(F.doorFor({ model: '1.5', door: 'openrouter', resolution: '480p' }, both).error || ''));
  ok('a pinned APIFRAME door is obeyed with no fallback',
    JSON.stringify(F.doorFor({ model: '2.5', door: 'apiframe', resolution: '480p' }, both)) === '{"door":"apiframe","fallback":null}');
  ok('with OpenRouter unconfigured auto lands on APIFRAME', F.doorFor({ model: 'mini', door: 'auto', resolution: '480p' }, { openrouter: false, apiframe: true }).door === 'apiframe');
  ok('1080p on APIFRAME is unpriced and refused as a pinned door', Boolean(F.doorFor({ model: '2.0', door: 'apiframe', resolution: '1080p' }, both).error));
  ok('1080p auto goes OpenRouter with NO fallback (APIFRAME cannot price it)',
    JSON.stringify(F.doorFor({ model: '2.0', door: 'auto', resolution: '1080p' }, both)) === '{"door":"openrouter","fallback":null}');

  // the estimate — Mini 480×480×4s is 21,600 tokens at $3.5/M, ×sale ×fee
  const e = F.estimate({ model: 'mini', resolution: '480p', ratio: '1:1', seconds: 4, hasVideo: false, door: 'auto' }, both);
  const tokens = (480 * 480 * 24 * 4) / 1024;
  const expect = Math.round(tokens * 3.5e-6 * 0.72 * F.OR_FEE * 1000) / 10;
  ok('the OpenRouter estimate is video tokens × SKU × sale × fee (' + e.cents + '¢)', e.door === 'openrouter' && e.cents === expect && e.about === true);
  const ev = F.estimate({ model: 'mini', resolution: '480p', ratio: '1:1', seconds: 4, hasVideo: true, door: 'auto' }, both);
  ok('a reference VIDEO riding makes it cheaper per token', ev.cents < e.cents);
  const ea = F.estimate({ model: '2.5', resolution: '480p', ratio: '3:4', seconds: 4, hasVideo: false, door: 'apiframe' }, both);
  ok('the APIFRAME estimate is cents per second × seconds (13¢/s × 4)', ea.door === 'apiframe' && ea.cents === 52);
  ok('the canvas follows the model family (2.5 has its own sizes)', JSON.stringify(F.canvasOf(F.modelOf('2.5'), '480p', '3:4')) === '[560,752]'
    && JSON.stringify(F.canvasOf(F.modelOf('mini'), '480p', '3:4')) === '[480,640]');

  // slots in attach order: images, then videos, then audio
  const s = F.slotsOf([{ url: 'a.mp4' }, { url: 'b.png', kind: 'image' }, { url: 'c.m4a' }, { url: 'd.jpg' }]).map((r) => r.slot);
  ok('slots are numbered per kind, in list order', JSON.stringify(s) === '["[Video1]","[Image1]","[Audio1]","[Image2]"]');

  // the body both doors take
  const b = F.buildJob({ prompt: 'a cat', model: 'mini', seconds: 4, resolution: '480p', ratio: '3:4', sound: false,
    refs: [{ url: 'https://x/a.png', kind: 'image' }, { url: 'https://x/v.mp4', kind: 'video' }, { url: 'not a url' }] });
  ok('buildJob maps refs into the three reference lists and drops a bad url',
    !b.error && JSON.stringify(b.body.referenceImageUrls) === '["https://x/a.png"]' && JSON.stringify(b.body.referenceVideoUrls) === '["https://x/v.mp4"]'
    && b.body.referenceAudioUrls.length === 0 && b.refs.length === 2);
  ok('the body carries chat=footage, the seconds, the shape and sound off',
    b.body.chat === 'footage' && b.body.duration === 4 && b.body.aspectRatio === '3:4' && b.body.generateAudio === false && b.body.resolution === '480p');
  ok('a blank prompt is refused before anything is sent', Boolean(F.buildJob({ prompt: '  ' }).error));
  ok('seconds outside the model are refused (3s on Mini)', /seconds/.test(F.buildJob({ prompt: 'x', model: 'mini', seconds: 3 }).error || ''));
  ok('1.5 Pro takes only 4, 8 or 12', Boolean(F.buildJob({ prompt: 'x', model: '1.5', seconds: 5 }).error) && !F.buildJob({ prompt: 'x', model: '1.5', seconds: 8 }).error);
  ok('the minimum is the default when no seconds are sent', F.buildJob({ prompt: 'x', model: '2.5' }).seconds === 4);
  ok('1.5 Pro opens with sound OFF, the 2.x family ON', F.buildJob({ prompt: 'x', model: '1.5' }).audio === false && F.buildJob({ prompt: 'x', model: 'mini' }).audio === true);
  ok('the title is the prompt cut at a word', F.titleOf('a '.repeat(60)).length <= 70 && F.titleOf('short') === 'short');

  // the card off a log doc
  const c = F.cardOf('j1', { prompt: 'p', model: 'bytedance/seedance-2.0-mini', provider: 'openrouter', status: 'completed', video: 'https://v', cost: 0.054,
    params: { duration: 4, resolution: '480p', aspect_ratio: '3:4' }, references: { images: ['https://i'], videos: [], audio: [] } });
  ok('cardOf reads the model, the door, the status and the cost off the log doc',
    c.model === 'mini' && c.door === 'openrouter' && c.status === 'done' && c.cost === 5.4 && c.seconds === 4 && c.refs[0].slot === '[Image1]');

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
  ok('the page wears the house star on the one spend button', /gostar/.test(page) && /M 55\.8 31\.9/.test(page));
  ok('text boxes ship empty — no placeholder anywhere', !/placeholder=/.test(page) && /<textarea id="prompt"><\/textarea>/.test(page));
  ok('the page script is one IIFE (the injected pill\'s globals are safe)', /<script>\n\(function \(\) \{/.test(page));
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
let jobs = [
  { id: 'old1', prompt: 'a dog on a beach, camera at eye level', model: 'mini', modelLabel: '2.0 Mini', door: 'openrouter', seconds: 4, resolution: '480p', ratio: '3:4',
    sound: true, refs: [{ url: 'http://127.0.0.1:PORT/ref.png', kind: 'image', slot: '[Image1]' }], status: 'done', video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    cost: 5.6, estimate: 6, sentAt: '2026-09-09T01:00:00.000Z', vote: '', hidden: false },
];
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
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { openrouter: true, apiframe: true }, balances: { openrouter: { configured: true, left: 48 }, apiframe: { configured: true, credits: 817 } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') {
      const q = Object.fromEntries(u.searchParams);
      return json({ ok: true, ...F.estimate({ model: q.model, resolution: q.res, ratio: q.ratio, seconds: q.seconds, hasVideo: q.video === '1', door: q.door }, { openrouter: true, apiframe: true }) });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      posted.push(JSON.parse(body));
      jobs.unshift({ id: 'new1', prompt: posted[posted.length - 1].prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'openrouter', seconds: 5, resolution: '480p', ratio: '9:16',
        sound: true, refs: [], status: 'drawing', sentAt: new Date().toISOString(), estimate: 7, vote: '' });
      return json({ ok: true, jobId: 'new1', door: 'openrouter', fellBack: false, estimate: 7 }, 202);
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) { posted.push({ vote: u.pathname, body: JSON.parse(body) }); return json({ ok: true }); }
    if (u.pathname === '/api/drop/upload-file') {
      posted.push({ upload: Object.fromEntries(u.searchParams), ct: req.headers['content-type'], bytes: body.length });
      return json({ ok: true, item: { id: 'd1', url: 'http://127.0.0.1:' + server.address().port + '/ref.png', posterUrl: null, media: 'image' } });
    }
    res.writeHead(404); res.end('nope');
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  jobs = JSON.parse(JSON.stringify(jobs).replace(/PORT/g, String(port)));
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#models button');
  await page.waitForFunction(() => document.getElementById('cost').textContent.indexOf('about') === 0);

  // the four page rules, on the rendered page
  ok('no page errors', errors.length === 0);
  ok('the name appears once (one h1, no .sub, no eyebrow line above it)', await page.$$eval('h1', (h) => h.length) === 1);
  ok('the prompt box is empty', (await page.$eval('#prompt', (t) => t.value)) === '');
  const goBox = await page.$eval('#go', (b) => b.getBoundingClientRect().width);
  ok('the star button hugs its words (under 150px)', goBox < 150);
  const helpHidden = await page.$eval('#helpcard', (e) => e.hidden);
  ok('the explanation is behind the ? and shut', helpHidden);
  await page.click('#help');
  ok('tapping ? opens the card', !(await page.$eval('#helpcard', (e) => e.hidden)));
  await page.click('body', { position: { x: 5, y: 800 } });
  ok('any tap closes it', await page.$eval('#helpcard', (e) => e.hidden));

  // seconds open at the minimum, the price is asked from the server
  ok('seconds open at the model minimum (4)', (await page.$eval('#secs', (e) => e.textContent)) === '4');
  const cost0 = await page.$eval('#cost', (e) => e.textContent);
  ok('the price line says about how much and which door: ' + cost0, /^about \d+(\.\d)?¢ · OpenRouter$/.test(cost0));
  await page.click('#secup');
  await page.waitForFunction((c) => document.getElementById('cost').textContent !== c, cost0);
  ok('one more second is a higher price', parseFloat((await page.$eval('#cost', (e) => e.textContent)).replace('about ', '')) > parseFloat(cost0.replace('about ', '')));
  await page.click('#models button[data-model="1.5"]');
  await page.waitForFunction(() => /APIFRAME$/.test(document.getElementById('cost').textContent));
  ok('1.5 Pro moves the door to APIFRAME and the seconds to its own list', /APIFRAME$/.test(await page.$eval('#cost', (e) => e.textContent)) && (await page.$eval('#secs', (e) => e.textContent)) === '4');
  await page.click('#models button[data-model="mini"]');
  await page.waitForFunction(() => /OpenRouter$/.test(document.getElementById('cost').textContent));

  // the feed: the old card painted, its refs, its cost, its play thumb
  ok('the earlier clip is a card with its real cost', await page.$eval('#job-old1 .tags', (e) => /5\.6¢/.test(e.textContent) && /2\.0 Mini/.test(e.textContent)));
  ok('the card names its reference by slot', await page.$eval('#job-old1 .usedrefs', (e) => /Image1/.test(e.textContent)));
  const imgBefore = await page.evaluateHandle(() => document.querySelector('#job-old1 .thumb img'));
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  // a repaint with nothing changed keeps the node
  await page.evaluate(() => fetch('/api/footage/jobs?limit=40').then((r) => r.json()));
  await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
  const same = await page.evaluate((h) => h === document.querySelector('#job-old1 .thumb img'), imgBefore);
  ok('a repaint never rebuilds a card that did not change', same);

  // attach a reference through the Dump door; the slot appears; tapping it lands in the prompt
  await page.setInputFiles('#file', { name: 'mayra.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForSelector('#refs .ref');
  const up = posted.find((p) => p.upload);
  ok('the upload went to the Dump with the bundle and filename and the file\'s own type', up && up.upload.bundle === 'Footage' && up.upload.filename === 'mayra.png' && up.ct === 'image/png' && up.bytes > 0);
  ok('the attached reference shows its slot name', (await page.$eval('#refs .slot', (e) => e.textContent)) === '[Image1]');
  await page.fill('#prompt', 'her mother is the woman in');
  await page.click('#refs .slot');
  ok('tapping the slot drops it into the prompt', (await page.$eval('#prompt', (t) => t.value)) === 'her mother is the woman in [Image1]');

  // the star: what really left the phone (seconds went 5 → 4 with the 1.5 Pro round trip above — a model change re-clamps)
  await page.click('#ratios button[data-ratio="9:16"]');
  await page.click('#go');
  await page.waitForSelector('#job-new1');
  const sent = posted.find((p) => p.prompt);
  ok('the star POSTs the prompt, the reference with its kind, the model, seconds, resolution, shape, sound and door',
    sent && sent.prompt === 'her mother is the woman in [Image1]' && sent.refs.length === 1 && sent.refs[0].kind === 'image' && /ref\.png$/.test(sent.refs[0].url)
    && sent.model === 'mini' && sent.seconds === 4 && sent.resolution === '480p' && sent.ratio === '9:16' && sent.sound === true && sent.door === 'auto');
  ok('the new card is on top, drawing', await page.$eval('#feed', (f) => f.firstElementChild.id === 'job-new1' && /drawing/.test(f.firstElementChild.textContent)));
  ok('the draft is cleared once sent', await page.evaluate(() => localStorage.getItem('footage_draft') == null));

  // ♥ / ✕ — what the server really received
  await page.click('#job-old1 .heart');
  const v = posted.find((p) => p.vote);
  ok('a heart POSTs like to the clip\'s own vote route', v && /old1\/vote$/.test(v.vote) && v.body.vote === 'like');
  ok('the heart lights', await page.$eval('#job-old1 .heart', (b) => b.classList.contains('on')));

  // the player: the lightbox contract
  await page.click('#job-old1 .thumb');
  ok('tapping the thumb opens the player over the page, page locked', !(await page.$eval('#player', (e) => e.hidden)) && (await page.evaluate(() => document.body.style.overflow)) === 'hidden');
  ok('__navBack closes the player first', await page.evaluate(() => window.__navBack()) === true && (await page.$eval('#player', (e) => e.hidden)));
  ok('the page unlocks on close', (await page.evaluate(() => document.body.style.overflow)) === '');

  // the pill's corner is reserved on the panel it sits over
  const gap = await page.$eval('.panel', (p) => p.style.getPropertyValue('--pillgap') || p.style.getPropertyValue('--pilltop'));
  ok('the top panel reserves the pill\'s corner (' + gap + ')', Boolean(gap) && gap !== '0px');

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
