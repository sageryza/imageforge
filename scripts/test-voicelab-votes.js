#!/usr/bin/env node
// THE ♥ / ✕ AND THE TWO FILTERS IN VOICE STUDIO (2026-08-28, Sophie: "add the
// same playground heart x hide pattern in voice studio").
//
// Two halves. The PURE half pins the server contract in voicelab.js by source
// (the route exists, it validates the id, and it syncs to the Assets tab), and
// pins that server.js calls back the other way — a ♥ that only travels one
// direction leaves a stuck heart on whichever surface she did not tap.
//
// The HEADLESS half drives the REAL public/voice.html, served the way
// serveGated serves a `{ pill: true }` page. Everything here is a state change
// across several nodes, which no source assertion can see:
//   1. a finished take wears a ♥ and an ✕ on its meta row, a rendering one and
//      a failed one wear none (nothing finished to have an opinion about),
//   2. a tap lights the mark AND posts the vote; tapping the lit one clears it,
//   3. hearts-only keeps only the hearted, hide-the-✕'d drops only the ✕'d,
//      and the two stack,
//   4. THE FILTER IS ONE SETTING ACROSS BOTH TABS (her call) — lighting it on
//      Text has it lit on Voice, from the same tap,
//   5. an emptied list SAYS why, rather than looking like a lost history,
//   6. the filters survive a reload (they are sticky) and the marks come back
//      off the server's own record,
//   7. the filter box stays CLEAR of the injected pill's fixed column with the
//      iPhone 13's real 47px safe-area inset applied, and a tap at each
//      button's centre reaches it (`elementFromPoint` — a covered control
//      passes every width assertion while failing).
//
//   npm install playwright --no-save && node scripts/test-voicelab-votes.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

// ── the server contract, by source (no network, no firestore) ──────────
console.log('THE SERVER CONTRACT');
const vl = fs.readFileSync(path.join(ROOT, 'voicelab.js'), 'utf8');
const sv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
ok(/router\.post\('\/render\/:id\/vote'/.test(vl), 'POST /render/:id/vote exists');
ok(/\/render\/:id\/vote'[\s\S]{0,900}\^vl\[a-f0-9\]\{12\}\$/.test(vl),
  'it validates the take id the way every other route here does');
ok(/syncVoteToAssets\(r\.url, vote\)/.test(vl),
  'a vote lands on the take\'s Assets record too (her call: "so the two agree")');
ok(/\(r\.kind \|\| 'tts'\) !== 'sts'/.test(vl),
  'and only for a TTS take — the changer files no Assets record to sync with');
ok(/voteFromAssets/.test(vl) && /module\.exports[\s\S]{0,200}voteFromAssets/.test(vl),
  'voteFromAssets is exported for the other direction');
ok(/require\('\.\/voicelab'\)\.voteFromAssets\(url, vote\)/.test(sv),
  'and the Assets vote route calls it, so an un-heart there clears the mark here');

// ── the page ───────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(process.exitCode || 0); }
}

const VOICES = [
  { voiceId: 'UTkHGl2ImiT6gwtAFCql', name: 'Sophie — morning', category: 'professional', color: '#e0a8c0' },
];
const iso = (n) => new Date(Date.now() - n * 60000).toISOString();
// Five takes across both tabs: a hearted one, a ✕'d one, an unmarked one, a
// still-rendering one and a failed one.
const RENDERS = [
  { id: 'vlaaaaaaaaaa01', kind: 'tts', voiceName: 'Sophie — morning', text: 'the hearted line',
    status: 'done', url: 'https://x/voice-lab/vlaaaaaaaaaa01.mp3', vote: 'like', createdAt: iso(5) },
  { id: 'vlaaaaaaaaaa02', kind: 'tts', voiceName: 'Sophie — morning', text: 'the crossed out line',
    status: 'done', url: 'https://x/voice-lab/vlaaaaaaaaaa02.mp3', vote: 'dislike', createdAt: iso(6) },
  { id: 'vlaaaaaaaaaa03', kind: 'tts', voiceName: 'Sophie — morning', text: 'the plain line',
    status: 'done', url: 'https://x/voice-lab/vlaaaaaaaaaa03.mp3', createdAt: iso(7) },
  { id: 'vlaaaaaaaaaa04', kind: 'tts', voiceName: 'Sophie — morning', text: 'the one still going',
    status: 'rendering', createdAt: iso(2) },
  { id: 'vlaaaaaaaaaa05', kind: 'tts', voiceName: 'Sophie — morning', text: 'the one that died',
    status: 'failed', error: 'render failed', createdAt: iso(9) },
];
const CHANGES = [
  { id: 'vlbbbbbbbbbb01', kind: 'sts', voiceName: 'Sophie — morning', text: 'recording.m4a',
    status: 'done', url: 'https://x/voice-lab/vlbbbbbbbbbb01.mp3', createdAt: iso(4) },
];

const posted = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/voicelab/status') return json({ ok: true });
  if (url.pathname === '/api/voicelab/voices') return json({ voices: VOICES });
  if (url.pathname === '/api/voicelab/history') {
    return json({ renders: (url.searchParams.get('kind') === 'sts' ? CHANGES : RENDERS).slice().reverse() });
  }
  const m = url.pathname.match(/^\/api\/voicelab\/render\/([^/]+)\/vote$/);
  if (m && req.method === 'POST') {
    let b = '';
    req.on('data', (c) => { b += c; });
    return req.on('end', () => {
      let v = '';
      try { v = (JSON.parse(b || '{}') || {}).vote || ''; } catch (e) { /* below */ }
      posted.push({ id: m[1], vote: v });
      const r = RENDERS.concat(CHANGES).find((x) => x.id === m[1]);
      if (r) { if (v) r.vote = v; else delete r.vote; }
      json({ ok: true, vote: v });
    });
  }
  if (url.pathname === '/voice') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'voice.html'), 'utf8')
      + '<script src="/pagehead.js" defer></script>'
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  if (url.pathname === '/pagehead.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'pagehead.js'), 'utf8'));
  }
  res.writeHead(404); res.end('no');
});

const shown = (page) => page.evaluate(() => [].slice.call(document.querySelectorAll('#renders .render'))
  .filter((el) => !el.hidden).map((el) => el.querySelector('.rtext').textContent));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  let browser;
  try { browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {}); }
  catch (e) {
    if (!fs.existsSync('/opt/pw-browsers/chromium')) throw e;
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(base + '/voice', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.removeItem('voicelab_liked'); localStorage.removeItem('voicelab_hidex'); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#renders .render');

  console.log('\nTHE MARKS ON A TAKE');
  const marks = await page.evaluate(() => {
    const of = (id) => {
      const el = document.querySelector('#renders .render[data-id="' + id + '"]');
      if (!el) return null;
      const v = el.querySelectorAll('.rmeta .vote');
      return { n: v.length, lit: [].slice.call(v).filter((b) => b.classList.contains('on')).map((b) => b.dataset.vote) };
    };
    return { liked: of('vlaaaaaaaaaa01'), xed: of('vlaaaaaaaaaa02'), plain: of('vlaaaaaaaaaa03'),
      going: of('vlaaaaaaaaaa04'), dead: of('vlaaaaaaaaaa05') };
  });
  ok(marks.plain && marks.plain.n === 2 && marks.plain.lit.length === 0,
    'a finished take wears both marks, neither lit');
  ok(marks.liked && marks.liked.lit.join() === 'like', 'a hearted one shows its heart lit');
  ok(marks.xed && marks.xed.lit.join() === 'dislike', 'a crossed-out one shows its ✕ lit');
  ok(marks.going && marks.going.n === 0, 'a take still rendering carries no marks');
  ok(marks.dead && marks.dead.n === 0, 'and neither does a failed one');

  console.log('\nA TAP MARKS IT, AND A SECOND TAP CLEARS IT');
  await page.click('#renders .render[data-id="vlaaaaaaaaaa03"] .vote[data-vote="like"]');
  await page.waitForTimeout(120);
  ok(await page.evaluate(() => document.querySelector('#renders .render[data-id="vlaaaaaaaaaa03"] .vote[data-vote="like"]').classList.contains('on')),
    'the heart lights straight away');
  ok(posted.some((p) => p.id === 'vlaaaaaaaaaa03' && p.vote === 'like'), 'and the vote is posted');
  await page.click('#renders .render[data-id="vlaaaaaaaaaa03"] .vote[data-vote="like"]');
  await page.waitForTimeout(120);
  ok(!(await page.evaluate(() => document.querySelector('#renders .render[data-id="vlaaaaaaaaaa03"] .vote[data-vote="like"]').classList.contains('on'))),
    'tapping the lit one clears it');
  ok(posted.some((p) => p.id === 'vlaaaaaaaaaa03' && p.vote === ''), 'and the clear is posted too');

  console.log('\nTHE TWO FILTERS');
  const hearts = '#pane-say .filttog [data-filt="liked"]';
  const nox = '#pane-say .filttog [data-filt="hidex"]';
  await page.click(nox);
  await page.waitForTimeout(60);
  let list = await shown(page);
  ok(!list.includes('the crossed out line'), 'hide-the-✕\'d drops the crossed-out take');
  ok(list.includes('the plain line') && list.includes('the hearted line'),
    'and keeps everything it does not name');
  ok(list.includes('the one that died'), 'a failed take is not a ✕ and stays');
  await page.click(hearts);
  await page.waitForTimeout(60);
  list = await shown(page);
  ok(list.length === 1 && list[0] === 'the hearted line', 'hearts-only leaves only the hearted one');
  ok((await page.evaluate((s) => document.querySelector(s).classList.contains('on'), hearts))
    && (await page.evaluate((s) => document.querySelector(s).classList.contains('on'), nox)),
    'the two stack, both lit');

  console.log('\nONE SETTING ACROSS BOTH TABS');
  await page.click('#tab-change');
  await page.waitForTimeout(200);
  const other = await page.evaluate(() => {
    const b = document.querySelectorAll('#pane-change .filttog [data-filt]');
    return [].slice.call(b).map((x) => x.dataset.filt + ':' + x.classList.contains('on'));
  });
  ok(other.join(' ') === 'liked:true hidex:true',
    'the Voice tab\'s box shows the same state, from the tap on the Text tab');
  const changeShown = await page.evaluate(() => [].slice.call(document.querySelectorAll('#changes .render'))
    .filter((el) => !el.hidden).length);
  ok(changeShown === 0, 'and it filters that list too — nothing there is hearted');

  console.log('\nAN EMPTIED LIST SAYS WHY');
  const note = await page.evaluate(() => {
    const n = document.querySelector('#changes .emptynote');
    return n ? n.textContent : '';
  });
  ok(/nothing hearted/i.test(note), `it says why rather than looking like a lost history (${note})`);

  console.log('\nSTICKY, AND THE MARKS COME BACK OFF THE SERVER');
  await page.reload({ waitUntil: 'domcontentloaded' });
  // `attached`, not visible: the filters are sticky, so most cards come back
  // hidden — waiting for a VISIBLE card would time out on the very state this
  // step exists to check.
  await page.waitForSelector('#renders .render', { state: 'attached' });
  const after = await page.evaluate(() => ({
    lit: [].slice.call(document.querySelectorAll('#pane-say .filttog [data-filt]'))
      .map((b) => b.dataset.filt + ':' + b.classList.contains('on')).join(' '),
    shown: [].slice.call(document.querySelectorAll('#renders .render')).filter((el) => !el.hidden).length,
  }));
  ok(after.lit === 'liked:true hidex:true', 'both filters survive a reload');
  ok(after.shown === 1, 'and the list comes back filtered the same way');

  console.log('\nCLEAR OF THE AUTOSCROLL PILL (iPhone 13 safe-area inset)');
  await page.evaluate(() => {
    try { localStorage.setItem('voicelab_liked', ''); localStorage.setItem('voicelab_hidex', ''); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#renders .render', { state: 'attached' });
  // `top: max(14px, env(safe-area-inset-top))` puts the pill at 14 in headless
  // and at 47 on her phone, so simulate the inset — the collision only exists
  // at her real one.
  await page.addStyleTag({ content: '.float{top:47px !important;}' });
  await page.waitForTimeout(150);
  const gap = await page.evaluate(() => {
    const pill = document.querySelector('.float');
    const box = document.querySelector('#pane-say .filttog');
    if (!pill || !box) return { nopill: !pill };
    const p = pill.getBoundingClientRect(), b = box.getBoundingClientRect();
    const hits = [].slice.call(box.querySelectorAll('[data-filt]')).map((btn) => {
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return btn.dataset.filt + ':' + (el && el.closest('[data-filt]') === btn ? 'ok' : 'BLOCKED');
    });
    const overlaps = b.right > p.left && b.left < p.right && b.bottom > p.top && b.top < p.bottom;
    return { overlaps, hits, right: b.right, pillLeft: p.left };
  });
  ok(!gap.nopill, 'the pill is on the page (it is conditional — the page has to scroll)');
  ok(!gap.overlaps, `the filter box ends before the pill's column (${Math.round(gap.right)} vs ${Math.round(gap.pillLeft)})`);
  ok(gap.hits && gap.hits.every((h) => /ok$/.test(h)), `a tap at each button's centre reaches it (${(gap.hits || []).join(', ')})`);

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
