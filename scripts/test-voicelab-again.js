#!/usr/bin/env node
// test-voicelab-again.js — a failed take's way back, driven on the REAL page.
//
// Sophie's science take (4,842 characters, 2026-08-27) was orphaned by a deploy
// restart. Two things had to change for that to stop reading as "Voice Studio
// missing": the server has to stop the doc spinning on `rendering` forever
// (pinned pure by test-voicelab-stuck.js), and the page has to offer a way
// back that is not retyping 4,842 characters into the box. This is that half.
//
// The button is asked with `elementFromPoint`, not `isVisible()` — this page's
// injected autoscroll pill owns a fixed corner, and a control the pill is
// sitting on passes every markup and width assertion while being untappable.

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
];
// Her real case: a long take that never finished, swept to `failed` by the
// server with the honest reason. This is exactly what her page now loads.
const LONG = 'It’s not a coincidence that two things often trade places in public opinion. '.repeat(9);
const STUCK_REASON = 'interrupted by a server restart — nothing was lost but the render itself';
const HIST = {
  tts: [
    { id: 'vlaaaaaaaaaaaa', voiceName: 'Sophie — morning', text: 'a finished one',
      status: 'done', url: 'https://example.invalid/old.mp3', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'vle76c77d7c788', voiceName: 'Sophie — morning', text: LONG,
      status: 'failed', error: STUCK_REASON, createdAt: '2026-08-27T03:16:30.358Z' },
  ],
  sts: [],
};

const againCalls = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/voicelab/status') return json({ ok: true });
  if (url.pathname === '/api/voicelab/voices') return json({ voices: VOICES });
  if (url.pathname === '/api/voicelab/history') {
    return json({ renders: (HIST[url.searchParams.get('kind') || 'tts'] || []).slice() });
  }
  if (url.pathname.endsWith('/again') && req.method === 'POST') {
    againCalls.push(url.pathname);
    return json({ id: 'vlnew000000001' });
  }
  if (url.pathname.startsWith('/api/voicelab/render/')) {
    // The retry stays on `rendering` for this test — what matters here is that
    // the page draws a live card for it, not that a stub can finish a render.
    return json({ id: 'vlnew000000001', voiceName: 'Sophie — morning', text: LONG, status: 'rendering' });
  }
  if (url.pathname === '/voice') {
    let out = fs.readFileSync(path.join(PUB, 'voice.html'), 'utf8');
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
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) {
    if (!fs.existsSync('/opt/pw-browsers/chromium')) throw e;
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(base + '/voice', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#renders .render').length >= 2);

  // 1 — the failed take says what happened, and offers the way back
  const shown = await page.evaluate((id) => {
    const card = document.querySelector('.render[data-id="' + id + '"]');
    if (!card) return { none: true };
    const btn = card.querySelector('.again');
    return {
      err: (card.querySelector('.rerr') || {}).textContent || '',
      hasBtn: Boolean(btn),
      label: btn ? btn.textContent.trim() : '',
      svgs: btn ? btn.querySelectorAll('svg').length : 0,
      radius: btn ? getComputedStyle(btn).borderRadius : '',
      spinning: card.classList.contains('pending'),
    };
  }, 'vle76c77d7c788');
  if (shown.none) fail('the failed take drew no card at all');
  if (!/interrupted by a server restart/.test(shown.err)) fail('the failed take does not say what happened');
  else ok('the failed take says what happened, in the server’s own words');
  if (!shown.hasBtn) fail('a failed take has no way back');
  else ok('a failed take offers Render again');
  if (!/render again/i.test(shown.label)) fail('the button does not say what it does: ' + JSON.stringify(shown.label));
  else ok('the button says Render again');
  if (shown.svgs !== 1) fail('expected one glyph on the button, got ' + shown.svgs);
  else ok('the button wears one glyph');
  // House rule: rounded rectangles, never a pill and never a circle.
  if (shown.radius !== '6px') fail('the button is not the house 6px: ' + shown.radius);
  else ok('the button is the house rounded rectangle');
  if (shown.spinning) fail('a failed take is still painted as pending');
  else ok('a failed take has stopped spinning');

  // 2 — a FINISHED take must not grow one. The way back belongs to a failure.
  const onDone = await page.evaluate(() =>
    Boolean(document.querySelector('.render[data-id="vlaaaaaaaaaaaa"] .again')));
  if (onDone) fail('a finished take offers Render again, which it must not');
  else ok('a finished take offers no Render again');

  // 3 — is it really TAPPABLE? The pill owns the top-right corner of this page.
  const reach = await page.evaluate(() => {
    const btn = document.querySelector('.render[data-id="vle76c77d7c788"] .again');
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { reached: Boolean(hit && btn.contains(hit)), got: hit ? hit.className || hit.tagName : 'nothing' };
  });
  if (!reach.reached) fail('the Render again button is covered by ' + reach.got);
  else ok('the Render again button is really tappable');

  // 4 — tapping it asks the server for that take again, and a live card appears
  await page.click('.render[data-id="vle76c77d7c788"] .again');
  await page.waitForFunction(() => document.querySelector('.render[data-id="vlnew000000001"]'), null, { timeout: 5000 })
    .catch(() => {});
  if (againCalls.length !== 1) fail('expected one /again call, got ' + againCalls.length);
  else ok('one call, and only one');
  if (!againCalls[0] || !againCalls[0].includes('vle76c77d7c788')) {
    fail('the retry named the wrong take: ' + againCalls[0]);
  } else ok('the retry names the take that failed');

  const after = await page.evaluate(() => {
    const fresh = document.querySelector('.render[data-id="vlnew000000001"]');
    const old = document.querySelector('.render[data-id="vle76c77d7c788"]');
    return {
      fresh: Boolean(fresh),
      pending: fresh ? fresh.classList.contains('pending') : false,
      carriedText: fresh ? /public opinion/.test(fresh.textContent) : false,
      oldStillThere: Boolean(old),
      oldStillFailed: Boolean(old && old.querySelector('.rerr')),
    };
  });
  if (!after.fresh) fail('the retry drew no card');
  else ok('the retry lands as its own card');
  if (!after.pending) fail('the retry card is not painted as rendering');
  else ok('the retry card spins while it works');
  // The card is drawn from the OLD take's words, so it reads right immediately
  // — the server has said nothing but an id at this point.
  if (!after.carriedText) fail('the retry card lost her words');
  else ok('the retry card carries her words straight away');
  // A re-render is a FRESH take. Overwriting the failed one would erase the
  // record of what happened to it.
  if (!after.oldStillThere || !after.oldStillFailed) fail('the retry ate the failed take');
  else ok('the failed take stays on the page, saying what happened');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})().catch((e) => { console.error(e); process.exit(1); });
