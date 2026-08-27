#!/usr/bin/env node
// THE VOICE CHANGER — the Voice Studio's second tab (Aug 2026, Sophie: "a
// separate hairline tab in the voice studio, at the bottom will be a place to
// record a voice or an option to upload a file or Voice Memo, and the recorded
// voice will also save to firebase").
//
// Drives the REAL public/voice.html headless against a stub API and asserts:
//   1. the tabs are the house hairline shape — two half-width labels over a
//      rule, the line sliding under the one she is reading — and tapping one
//      swaps the LOWER half while the voice picker stays put (it means the
//      same thing on both sides),
//   2. picking a file makes a take, and only then does Change light up,
//   3. Change POSTs the audio as the RAW body with the voice + ext on the
//      query, and the take SURVIVES the send (she runs one recording through
//      voice after voice, the same reason her words stay in the box),
//   4. the result lands in CHANGED, never in Renders, and a doc with no
//      `kind` (every render made before today) still lands in Renders,
//   5. a finished change plays BOTH halves — what went in and what came out,
//   6. BOTH tabs are really tappable at 375/390/430. The row sits inside the
//      injected autoscroll pill's x 324-374 / y 14-192 band, so this
//      hit-tests with elementFromPoint rather than trusting the 56px padding,
//      and checks the sliding line is a TAB's width, not half the padding box.
//
//   npm install playwright-core --no-save && node scripts/test-voice-changer.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const VOICES = [
  { voiceId: 'UTkHGl2ImiT6gwtAFCql', name: 'Sophie — morning', category: 'professional', color: '#e0a8c0' },
  { voiceId: 'ZOw6P0YnswJ6JNjpj9wF', name: 'Steve Ryza', category: 'cloned', color: '#6f8fa8' },
];
// One old render (NO `kind` — the pre-changer shape) and one finished change.
const HIST = {
  tts: [{ id: 'vlaaaaaaaaaaaa', voiceName: 'Sophie — morning', chars: 5, text: 'hello',
    status: 'done', url: 'https://example.invalid/old.mp3', createdAt: '2026-08-01T00:00:00.000Z' }],
  sts: [{ id: 'vlbbbbbbbbbbbb', kind: 'sts', voiceName: 'Steve Ryza', text: 'a memo',
    status: 'done', url: 'https://example.invalid/out.mp3',
    sourceUrl: 'https://example.invalid/in.m4a', createdAt: '2026-08-02T00:00:00.000Z' }],
};
const changes = [];   // what the page actually sent to /change

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/voicelab/status') return json({ ok: true });
  if (url.pathname === '/api/voicelab/voices') return json({ voices: VOICES });
  if (url.pathname === '/api/voicelab/history') {
    const kind = url.searchParams.get('kind') || 'tts';
    return json({ renders: (HIST[kind] || []).slice() });
  }
  if (url.pathname === '/api/voicelab/change' && req.method === 'POST') {
    const bufs = [];
    req.on('data', (c) => bufs.push(c));
    req.on('end', () => {
      changes.push({
        query: Object.fromEntries(url.searchParams),
        contentType: req.headers['content-type'] || '',
        bytes: Buffer.concat(bufs),
      });
      json({ id: 'vlcccccccccccc' });
    });
    return;
  }
  if (url.pathname.startsWith('/api/voicelab/render/')) {
    return json({ id: 'vlcccccccccccc', kind: 'sts', voiceName: 'Steve Ryza', text: 'take.m4a',
      status: 'done', url: 'https://example.invalid/new.mp3', sourceUrl: 'https://example.invalid/src.m4a' });
  }
  if (url.pathname === '/voice') {
    // Exactly what serveGated does — `?embed=1` (which is how the iOS wrapper
    // asks for it) and pagehead.js on top. Without those the header can only
    // ever be measured in its browser state, which is the ONE state the app
    // never shows her.
    let out = fs.readFileSync(path.join(PUB, 'voice.html'), 'utf8');
    if (url.searchParams.get('embed') === '1') {
      out += '<style>body.embed .app-header,body.embed .tool-eyebrow'
        + '{display:none !important}</style>'
        + '<script>if(!window.__forgeLeave)document.body.classList.add("embed")</script>';
    }
    out += '<script src="/pagehead.js" defer></script>';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(out);
  }
  if (url.pathname === '/pagehead.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'pagehead.js'), 'utf8'));
  }
  res.writeHead(404); res.end('no');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (m) => console.log('  ok — ' + m);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  // The pinned playwright and the container's pre-installed Chromium can be
  // different builds; /opt/pw-browsers/chromium is the one that is really
  // there, so fall back to it rather than skipping a test that can run.
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) {
    if (!fs.existsSync('/opt/pw-browsers/chromium')) throw e;
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(base + '/voice', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.vbtn').length > 0);
  await page.waitForFunction(() => document.querySelectorAll('#renders .render, #changes .render').length >= 2);

  // 1 — the tabs, and what they swap
  const shape = await page.evaluate(() => {
    const row = document.getElementById('tabs');
    const cs = getComputedStyle(row);
    return {
      tabs: [...row.querySelectorAll('.acctab')].map((b) => b.textContent.trim()),
      boxed: [...row.querySelectorAll('.acctab')].some((b) => getComputedStyle(b).borderBottomWidth !== '0px'),
      rule: cs.borderBottomWidth,
      on: row.dataset.on,
    };
  });
  if (shape.tabs.join('|') !== 'Text|Voice') fail('tabs read ' + shape.tabs.join('|'));
  else ok('two tabs: Text · Voice');
  if (shape.boxed) fail('a tab is drawn as a box — the pattern is labels over a hairline');
  else if (shape.rule === '0px') fail('the tab row has no hairline');
  else ok('labels over a hairline, no boxes');

  let panes = await page.evaluate(() => ({
    say: !document.getElementById('pane-say').hidden,
    ch: !document.getElementById('pane-change').hidden,
    picker: !!document.querySelector('.vrow .vbtn'),
  }));
  if (!panes.say || panes.ch) fail('the page should open on Text');
  else ok('opens on Text');

  await page.click('#tab-change');
  panes = await page.evaluate(() => ({
    say: !document.getElementById('pane-say').hidden,
    ch: !document.getElementById('pane-change').hidden,
    picker: document.querySelector('.vrow').offsetParent !== null,
    on: document.getElementById('tabs').dataset.on,
    lit: document.getElementById('tab-change').classList.contains('on'),
  }));
  if (panes.say || !panes.ch) fail('tapping Voice did not swap the lower half');
  else ok('the Voice tab swaps the lower half');
  if (!panes.picker) fail('the voice picker vanished — it is shared by both tabs');
  else ok('the voice picker is shared, not swapped');
  if (panes.on !== '1' || !panes.lit) fail('the sliding line / lit tab did not follow');
  else ok('the line slides to the tab she is on');

  // 2 — a file makes a take, and Change lights up only then
  let goState = await page.evaluate(() => document.getElementById('chgo').disabled);
  if (!goState) fail('Apply voice was enabled with no recording');
  else ok('Apply voice is dead until there is something to change');

  await page.setInputFiles('#file', {
    name: 'take.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('0123456789abcdef'.repeat(64)),
  });
  await page.waitForFunction(() => !document.getElementById('take').hidden);
  goState = await page.evaluate(() => ({
    dis: document.getElementById('chgo').disabled,
    name: (document.querySelector('#take .tkname') || {}).textContent,
    plays: !!document.querySelector('#take audio'),
    drop: !!document.querySelector('#take .tkx'),
    dropInFlow: !!(document.querySelector('#take .tkx')
      && getComputedStyle(document.querySelector('#take .tkx')).position === 'absolute'),
  }));
  if (goState.dis) fail('Apply voice stayed dead after a file was picked');
  else ok('picking a file lights Apply voice');
  if (goState.name !== 'take.m4a') fail('the take is not named after the file: ' + goState.name);
  else ok('the take carries the file name');
  if (!goState.plays) fail('she cannot hear the take before spending on it');
  else ok('the take is playable before she sends it');
  if (!goState.drop) fail('no way to drop a take');
  else ok('a take can be dropped');
  if (!goState.dropInFlow) fail('the drop control is back in the flow beside the player');
  else ok('drop is an \u2715 in the corner, not a word beside play');

  // 2b — the \u2715 ASKS before it drops (an accidental tap must not cost the take)
  await page.click('#take .tkx');
  const asked = await page.evaluate(() => ({
    ask: !!document.querySelector('#take .tkask'),
    still: !document.getElementById('take').hidden,
  }));
  if (!asked.ask || !asked.still) fail('the \u2715 dropped the take with no confirm');
  else ok('the \u2715 asks first');
  await page.click('#take .tkask .no');
  if (await page.evaluate(() => document.getElementById('take').hidden)) fail('Keep it dropped the take anyway');
  else ok('Keep it keeps the take');

  // 3 — the send
  await page.click('#chgo');
  await page.waitForFunction(() => document.querySelectorAll('#changes .render').length >= 2);
  if (!changes.length) fail('nothing reached /change');
  else {
    const c = changes[0];
    if (c.query.voiceId !== 'UTkHGl2ImiT6gwtAFCql') fail('wrong voiceId sent: ' + c.query.voiceId);
    else ok('the picked voice rides on the query');
    if (c.query.ext !== 'm4a') fail('wrong ext sent: ' + c.query.ext);
    else ok('the file extension rides along (the server needs the container)');
    if (/multipart|json/.test(c.contentType)) fail('sent as ' + c.contentType + ' — the body must be the raw audio');
    else ok('the audio is the RAW body, not base64 in JSON');
    if (c.bytes.length !== 1024) fail('body was ' + c.bytes.length + ' bytes, expected 1024');
    else ok('every byte of the take arrived');
  }
  const kept = await page.evaluate(() => !document.getElementById('take').hidden);
  if (!kept) fail('the take was cleared by sending it — she runs one take through several voices');
  else ok('the take survives the send');

  // 4 + 5 — where the cards land, and what a change plays
  const lists = await page.evaluate(() => ({
    renders: [...document.querySelectorAll('#renders .render')].map((e) => e.dataset.id),
    changes: [...document.querySelectorAll('#changes .render')].map((e) => e.dataset.id),
    srcLabel: !!document.querySelector('#changes .render .rsrc'),
    audios: document.querySelectorAll('#changes .render:last-child audio').length,
  }));
  if (!lists.renders.includes('vlaaaaaaaaaaaa')) fail('the old kind-less render did not land in Renders');
  else ok('a render made before today still lands in Renders');
  if (lists.renders.includes('vlbbbbbbbbbbbb') || lists.renders.includes('vlcccccccccccc')) {
    fail('a change leaked into the Renders list');
  } else ok('changes never land in Renders');
  if (!lists.changes.includes('vlcccccccccccc')) fail('the new change is not in Changed');
  else ok('the change lands in Changed');
  if (!lists.srcLabel || lists.audios < 2) fail('a finished change does not play both halves');
  else ok('a finished change plays what went in and what came out');

  // 6b — KEEPING a take. The native player has no way out on a phone and a
  // cross-origin href ignores `download`, so both halves need a same-origin
  // attachment link — and the SOURCE (what she recorded) needs one too, since
  // it exists nowhere else she can reach.
  const dl = await page.evaluate(() => {
    const card = document.querySelector('#changes .render[data-id="vlcccccccccccc"]');
    card.scrollIntoView({ block: 'center' });   // elementFromPoint is viewport-relative
    const outA = card.querySelector('.rmeta .dl');
    const srcA = card.querySelector('.rsrc .dl');
    const at = (a) => {
      if (!a) return null;
      const r = a.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(el && el.closest('.dl') === a);
    };
    const ttsA = document.querySelector('#renders .render .dl');
    window.scrollTo(0, 0);   // hand the page back where the next check expects it
    return {
      out: outA && outA.getAttribute('href'), outHit: at(outA), outDl: outA && outA.hasAttribute('download'),
      src: srcA && srcA.getAttribute('href'), srcHit: at(srcA),
      tts: ttsA && ttsA.getAttribute('href'),
      pending: (window.card({ id: 'vlddddddddddd0', kind: 'sts', voiceName: 'Steve Ryza',
        text: 'still going', status: 'rendering' }),
      !!document.querySelector('.render[data-id="vlddddddddddd0"] .dl')),
    };
  });
  if (dl.out !== '/api/voicelab/file/vlcccccccccccc') fail('the finished take has no same-origin download: ' + dl.out);
  else ok('a finished take downloads from our own server');
  if (!dl.outDl) fail('the download link is missing the download attribute');
  else ok('the link is marked as a download');
  if (dl.src !== '/api/voicelab/file/vlcccccccccccc?src=1') fail('what she recorded has no download: ' + dl.src);
  else ok('what went in downloads too — the source is kept for a reason');
  if (!dl.tts) fail('a Text render has no download');
  else ok('a Text render downloads the same way');
  if (!dl.outHit || !dl.srcHit) fail('a download control is buried under something');
  else ok('both download controls are really tappable');
  if (dl.pending) fail('a still-rendering take offers a download of nothing');
  else ok('nothing to download until it is finished');

  // 6 — both tabs really tappable, and the line is a TAB wide
  for (const w of [375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    // The line MEASURES the lit tab now rather than being a fixed share of the
    // row, so it is correct on the first painted frame after a resize, not
    // inside the resize event — `resize` fires before the new layout is
    // committed. Settle a frame before asking, or this reads the old viewport's
    // width and calls a correct line wrong.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const hit = await page.evaluate(() => {
      const out = {};
      ['tab-say', 'tab-change'].forEach((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        out[id] = !!(el && el.id === id);
      });
      const row = document.getElementById('tabs');
      const rr = row.getBoundingClientRect();
      const tw = document.getElementById('tab-say').getBoundingClientRect().width;
      const line = parseFloat(getComputedStyle(row, '::after').width);
      out.lineOffByPx = Math.abs(line - tw);
      out.reserve = rr.width - (document.getElementById('tab-change').getBoundingClientRect().right - rr.left);
      return out;
    });
    if (!hit['tab-say'] || !hit['tab-change']) fail(`a tab is buried at ${w}px`);
    else ok(`both tabs tappable at ${w}px`);
    if (hit.lineOffByPx > 1.5) fail(`the sliding line is ${hit.lineOffByPx.toFixed(1)}px off a tab's width at ${w}px`);
    else ok(`the line is exactly a tab wide at ${w}px`);
    if (hit.reserve < 50) fail(`only ${hit.reserve.toFixed(0)}px reserved for the pill at ${w}px`);
    else ok(`the pill's corner is reserved at ${w}px`);
  }

  // 7 — THE HEADER (2026-08-27, Sophie: "this header doesn't match the app
  // pattern"). This page deliberately had no header row while Apple's nav bar
  // carried the title; once `.forgeWebToolBar` took that bar away, pagehead
  // found nothing to sit in and drew a bare strip holding a chevron and NOTHING
  // ELSE — the tool was nameless. Measured in BOTH build states, because the
  // failure her earlier ask fixed (the name twice, one strip above the other)
  // and the one this fixes (no name at all) live on opposite sides of the same
  // flag, and a check of one state alone cannot see the other coming back.
  await page.setViewportSize({ width: 390, height: 844 });

  // (a) the NEW build: Apple's bar is gone and the bridge is there.
  const app = await browser.newPage({ viewport: { width: 390, height: 844 } });
  app.on('pageerror', () => { /* the stub upsets some fetches; the header must draw anyway */ });
  await app.addInitScript('window.__nativeNavBar = true; window.__forgeLeave = function () {};');
  await app.goto(base + '/voice?embed=1', { waitUntil: 'domcontentloaded' });
  await app.waitForSelector('#forgeback', { state: 'attached' });
  await app.waitForTimeout(700);                       // levelRow's post-load syncs
  const head = await app.evaluate(() => {
    const h1s = [...document.querySelectorAll('h1')];
    const h1 = document.querySelector('.app-header h1');
    const b = document.getElementById('forgeback');
    if (!h1 || !b) return { none: !h1, nochev: !b };
    const r = h1.getBoundingClientRect(), q = b.getBoundingClientRect();
    // Is the name actually ON SCREEN and readable, or is it a 0-box / clipped
    // to nothing? A hidden element passes every "the markup is there" check.
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      titles: h1s.length,
      text: h1.textContent.trim(),
      inRow: b.parentElement === h1.parentElement,
      // centred on the SCREEN, not on the leftover flex space
      offCentre: Math.abs((r.left + r.right) / 2 - window.innerWidth / 2),
      clearsChevron: r.left >= q.right,
      // the injected pill owns x 324-374 at 390pt
      clearsPill: r.right <= 324,
      onScreen: !!(mid && (mid === h1 || h1.contains(mid))),
      aboveTabs: r.bottom <= document.getElementById('tabs').getBoundingClientRect().top,
    };
  });
  await app.close();
  if (head.none) fail('the tool is nameless in the app — no .app-header h1');
  else if (head.titles !== 1) fail('the name is on screen ' + head.titles + ' times, not once');
  else if (head.text !== 'Voice Studio') fail('the header reads "' + head.text + '"');
  else ok('the header says Voice Studio, once');
  if (!head.none) {
    if (!head.inRow) fail('the chevron sits in a strip of its own, not in the title row');
    else ok('the chevron and the title share one row');
    if (!head.onScreen) fail('the title is in the markup but nothing is painted there');
    else ok('the title really paints');
    if (head.offCentre > 2) fail('the title is ' + head.offCentre.toFixed(0) + 'px off centre');
    else ok('the title is centred on the screen');
    if (!head.clearsChevron || !head.clearsPill) fail('the title runs under the chevron or the pill');
    else ok('the title clears the chevron and the pill\u2019s column');
    if (!head.aboveTabs) fail('the header overlaps the tab row');
    else ok('the tabs sit below the header');
  }

  // (b) the OLD build: Apple's bar is still up, so the page must NOT add a
  // second name under it — her original complaint, which this must not undo.
  const old = await browser.newPage({ viewport: { width: 390, height: 844 } });
  old.on('pageerror', () => {});
  await old.goto(base + '/voice?embed=1', { waitUntil: 'domcontentloaded' });
  await old.waitForTimeout(400);
  const hidden = await old.evaluate(() => {
    const h = document.querySelector('.app-header');
    return !h || getComputedStyle(h).display === 'none';
  });
  await old.close();
  if (!hidden) fail('on the old build the page draws a title UNDER Apple\u2019s bar — twice again');
  else ok('on the old build the native bar keeps the title, alone');

  await browser.close();
  server.close();
  if (process.exitCode) console.error('\nFAILED');
  else console.log('\nAll good.');
})().catch((e) => { console.error(e); process.exit(1); });
