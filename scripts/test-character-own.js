#!/usr/bin/env node
// test-character-own.js — HER OWN PICTURE AS THE CHARACTER (2026-08-29,
// Sophie: "add my own picture button to characters").
//
//   node scripts/test-character-own.js
//
// Two halves, and each is asked the only honest way:
//
//   • THE SERVER'S ONE RULE, pure, over REAL encoded images: a picture a
//     browser can already show, sitting upright, is stored BYTE FOR BYTE
//     (the house "nothing stands between the source and the output" rule).
//     Only an EXIF-rotated photo and a format no <img> can decode are
//     re-encoded, and only losslessly. A byte comparison is what says that —
//     a mime-type assertion passes against a page that silently re-encodes
//     everything.
//   • THE PAGE, headless, driving the REAL button: what it POSTs, that it
//     spends nothing (the draw route is never called), and that Regenerate —
//     which would replace her picture with a drawn one — is not offered.
const http = require('http'), fs = require('fs'), path = require('path');
const servePublic = require('./lib/public-asset');
const PUB = path.join(__dirname, '..', 'public');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };

(async () => {
  // ── 1. the server's rule, over real bytes ────────────────────────────────
  let sharp = null;
  try { sharp = require('sharp'); } catch (_) {}
  if (!sharp) {
    console.log('sharp not installed — skipping the byte half');
  } else {
    const { ownPicture } = require('../character');
    const px = { create: { width: 40, height: 60, channels: 3, background: { r: 200, g: 120, b: 60 } } };

    for (const [fmt, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
      const src = await sharp(px)[fmt]().toBuffer();
      const out = await ownPicture(src);
      ok(out.buffer.equals(src), 'an upright ' + fmt + ' is stored BYTE FOR BYTE (' + out.buffer.length + ' vs ' + src.length + ')');
      ok(out.contentType === mime, 'and labelled ' + mime + ' (got ' + out.contentType + ')');
      ok(out.converted === false, 'and reports itself unconverted');
    }

    // An EXIF-rotated phone photo: every cell would draw it sideways, so this
    // is the one shape worth touching — and the rotation must really happen.
    const sideways = await sharp(px).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const rot = await ownPicture(sideways);
    ok(rot.converted === true, 'an EXIF-rotated photo IS converted');
    ok(rot.contentType === 'image/png', 'and to PNG — lossless, never a lossy webp (got ' + rot.contentType + ')');
    const m = await sharp(rot.buffer).metadata();
    ok(m.width === 60 && m.height === 40, 'the rotation is baked into the pixels (' + m.width + 'x' + m.height + ')');

    // Nothing sharp can read at all must not throw the whole save away — it
    // falls through to the re-encode, which is where it fails honestly.
    let threw = false;
    try { await ownPicture(Buffer.from('not an image at all')); } catch (_) { threw = true; }
    ok(threw, 'bytes that are not an image fail loudly rather than storing garbage');
  }

  // ── 2. the real page ─────────────────────────────────────────────────────
  let pw; try { pw = require('playwright'); }
  catch (_) { try { pw = require('playwright-core'); } catch (_2) { console.log('playwright not installed — skipping the page half'); process.exit(fails ? 1 : 0); } }

  const calls = [];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const p = new URL(req.url, 'http://x').pathname;
    const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
    if (p === '/' || p === '/character') {
      let html = fs.readFileSync(path.join(PUB, 'character.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      html += '<script src="/pagehead.js" defer></script>';
      html += fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
      return send('text/html; charset=utf-8', html);
    }
    if (p === '/api/character/own' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        let b = {}; try { b = JSON.parse(body); } catch (_) {}
        calls.push({ path: p, body: b });
        send('application/json', JSON.stringify({ ok: true, converted: false,
          character: { id: 'own1', name: b.name, gender: b.gender, url: '/x.png', tier: 'side',
            aliases: b.aliases || [], own: true } }));
      });
    }
    if (p === '/api/character/make' && req.method === 'POST') {
      calls.push({ path: p });
      return send('application/json', JSON.stringify({ ok: true, jobId: 'j1' }));
    }
    if (p === '/api/character/make/j1') {
      return send('application/json', JSON.stringify({ ok: true, status: 'done',
        character: { id: 'd2', name: 'Nancy', url: '/x.png', tier: 'side' } }));
    }
    if (p === '/api/character') {
      return send('application/json', JSON.stringify({ characters: [
        { id: 'own1', name: 'Mason', tier: 'side', aliases: [], url: '/x.png', own: true },
        { id: 'd1', name: 'Sage', tier: 'main', aliases: [], url: '/x.png', quality: 'medium', model: 'gpt-image-2' },
      ] }));
    }
    if (p.startsWith('/api/')) { calls.push({ path: p }); return send('application/json', JSON.stringify({ ok: true })); }
    if (p === '/x.png') return send('image/png', Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    res.writeHead(404); res.end('');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((f) => { try { fs.accessSync(f); return true; } catch (_) { return false; } });
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || preinstalled || undefined, args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 390, height: 800 } });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#own', { timeout: 8000 });

  ok(!!(await page.$('#own')), 'the page has a "my picture" button');
  // It is NOT the gold generate treatment: a tap that spends nothing must not
  // look like the tap that spends money.
  const paint = await page.evaluate(() => {
    const o = getComputedStyle(document.getElementById('own'));
    const g = getComputedStyle(document.getElementById('gen'));
    return { obg: o.backgroundColor, gbg: g.backgroundColor, radius: o.borderTopLeftRadius,
      ow: o.width, oh: o.height, gw: g.width, gh: g.height };
  });
  ok(paint.obg !== paint.gbg, 'it is not painted like ✦ (' + paint.obg + ' vs ' + paint.gbg + ')');
  ok(paint.radius === '6px', 'a rounded square at the house 6px, never a circle (' + paint.radius + ')');
  ok(paint.ow === paint.gw && paint.oh === paint.gh, 'the two taps are the same size (' + paint.ow + 'x' + paint.oh + ')');

  // Both buttons need the same two things, and neither is armed without them.
  const armed0 = await page.evaluate(() => ({ own: document.getElementById('own').disabled,
    gen: document.getElementById('gen').disabled }));
  ok(armed0.own && armed0.gen, 'with no photo and no name, neither button is armed');

  // A real picked photo + a name. The photo lives in a closure variable, so it
  // is set the way the file reader really sets it: a real file on the real
  // input, firing the real change event.
  await page.setInputFiles('#file', { name: 'me.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.fill('#name', 'Mason');
  await page.fill('#aliases', 'Mase');
  await page.click('.seg button[data-g="he"]');
  await page.waitForTimeout(300);
  const armed1 = await page.evaluate(() => ({ own: document.getElementById('own').disabled,
    gen: document.getElementById('gen').disabled }));
  ok(!armed1.own && !armed1.gen, 'a photo and a name arm both buttons');

  await page.click('#own');
  await page.waitForTimeout(600);
  const post = calls.find((c) => c.path === '/api/character/own');
  ok(!!post, 'tapping it posts to /api/character/own');
  ok(post && post.body.name === 'Mason', 'it carries the name (' + (post && post.body.name) + ')');
  ok(post && post.body.gender === 'he', 'and the gender she picked (' + (post && post.body.gender) + ')');
  ok(post && Array.isArray(post.body.aliases) && post.body.aliases[0] === 'Mase',
    'and her aliases (' + JSON.stringify(post && post.body.aliases) + ')');
  ok(post && typeof post.body.photo === 'string' && post.body.photo.startsWith('data:image/'),
    'and the picture itself');
  // IT SPENDS NOTHING — the drawing route is never called.
  ok(!calls.some((c) => c.path.startsWith('/api/character/make')),
    'it never starts a draw — this tap costs nothing');

  const after = await page.evaluate(() => ({
    shown: !document.getElementById('result').classList.contains('hidden'),
    src: document.getElementById('portrait').getAttribute('src'),
    regenHidden: document.getElementById('regen').classList.contains('hidden'),
    saveShown: !document.getElementById('saveMain').classList.contains('hidden'),
    status: document.getElementById('status').textContent,
  }));
  ok(after.shown && after.src === '/x.png', 'the saved character comes back on screen');
  ok(after.regenHidden, 'Regenerate is not offered — there is nothing to re-draw');
  ok(after.saveShown, '★ Add to sheet still is — an own picture is a character like any other');
  ok(/Mason/.test(after.status), 'the status names her (' + after.status + ')');

  // The sheet says what it is rather than leaving the caption blank.
  await page.click('#toggleSheet');
  await page.waitForSelector('.cell', { timeout: 8000 });
  const caps = await page.$$eval('.cell', (n) => n.map((c) => ({
    nm: c.querySelector('.nm').textContent, ql: c.querySelector('.ql') ? c.querySelector('.ql').textContent : '' })));
  const mason = caps.find((c) => c.nm === 'MASON'), sage = caps.find((c) => c.nm === 'SAGE');
  ok(mason && mason.ql === 'your picture', 'an own picture is captioned "your picture" (' + (mason && mason.ql) + ')');
  ok(sage && /medium/.test(sage.ql), 'a drawn one still says MODEL · QUALITY (' + (sage && sage.ql) + ')');

  // ...and is findable by it.
  await page.fill('#q', 'your picture');
  await page.waitForTimeout(400);
  const found = await page.$$eval('.cell .nm', (n) => n.map((x) => x.textContent));
  ok(found.length === 1 && found[0] === 'MASON', 'searching finds it (' + found.join(',') + ')');

  // THE COMPLEMENT, and the reason it is worth a second run: hiding Regenerate
  // is a piece of STATE, so starting over has to clear it — otherwise the next
  // DRAWN character silently loses its re-roll and nothing on screen says why.
  await page.fill('#q', '');
  await page.click('#toggleSheet');
  await page.click('#fresh');
  await page.waitForTimeout(200);
  await page.setInputFiles('#file', { name: 'x.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.fill('#name', 'Nancy');
  await page.waitForTimeout(300);
  await page.click('#gen');
  await page.waitForTimeout(900);
  const drawn = await page.evaluate(() => ({
    shown: !document.getElementById('result').classList.contains('hidden'),
    regenHidden: document.getElementById('regen').classList.contains('hidden'),
  }));
  ok(drawn.shown, 'a DRAWN character still comes back on screen');
  ok(!drawn.regenHidden, 'and Regenerate is offered again — the own flag was cleared');

  await b.close();
  server.close();
  console.log(fails ? '\n' + fails + ' failed' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
