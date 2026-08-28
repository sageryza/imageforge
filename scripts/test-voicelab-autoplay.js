#!/usr/bin/env node
// test-voicelab-autoplay.js — a take she is waiting on plays itself, ONCE.
//
// Sophie's ask (2026-08-28): "make just rendered takes in voice studio play
// once automatically". She taps Render, waits out a render that can run
// minutes, and then had to find the little player and tap it again.
//
// Everything here is asked of a REALLY PLAYING element (`currentTime` moving,
// `paused` false) rather than of a call count: a play() that iOS or Chromium
// refuses returns a rejected promise and leaves the page looking identical.
// The three refusals are the load-bearing half — history must stay silent,
// a repaint must not restart a take she is halfway through, and a take that
// lands while she is in another app must not talk out of her pocket.

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

// A real, decodable file — three seconds of quiet 8kHz PCM. An <audio> pointed
// at a fake byte string never leaves readyState 0, so it can neither play nor
// honestly refuse to.
function wav(seconds) {
  const rate = 8000, n = rate * seconds;
  const head = Buffer.alloc(44), data = Buffer.alloc(n * 2);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(2000 * Math.sin(i / 12)), i * 2);
  return Buffer.concat([head, data]);
}
const WAV = wav(3);

const HIST = {
  tts: [
    { id: 'vlold000000001', voiceName: 'Sophie — morning', text: 'a take from last week',
      status: 'done', url: '/take.wav', createdAt: '2026-08-01T00:00:00.000Z' },
  ],
  sts: [],
};

// The stub finishes the render on the SECOND poll, so the page really walks
// the rendering → done transition rather than being handed a finished doc.
let polls = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/voicelab/status') return json({ ok: true });
  if (url.pathname === '/api/voicelab/voices') return json({ voices: VOICES });
  if (url.pathname === '/api/voicelab/history') return json({ renders: (HIST[url.searchParams.get('kind') || 'tts'] || []).slice() });
  if (url.pathname === '/api/voicelab/render' && req.method === 'POST') { polls = 0; return json({ id: 'vlnew000000001' }); }
  if (url.pathname.startsWith('/api/voicelab/render/')) {
    polls++;
    const done = polls >= 2;
    return json({ id: 'vlnew000000001', voiceName: 'Sophie — morning', text: 'say this out loud',
      status: done ? 'done' : 'rendering', url: done ? '/take.wav' : undefined,
      createdAt: new Date().toISOString() });
  }
  if (url.pathname === '/take.wav') {
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': WAV.length, 'Accept-Ranges': 'bytes' });
    return res.end(WAV);
  }
  if (url.pathname === '/voice') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'voice.html'), 'utf8'));
  }
  res.writeHead(404); res.end('no');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (m) => console.log('  ok — ' + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await page.waitForFunction(() => document.querySelector('#renders .render'));

  // 1 — a take she is NOT waiting on stays quiet. History loads on every visit;
  // a page that talked on open would be unusable.
  await sleep(400);
  const old = await page.evaluate(() => {
    const a = document.querySelector('.render[data-id="vlold000000001"] audio');
    return { there: Boolean(a), paused: a ? a.paused : null };
  });
  if (!old.there) fail('the history take drew no player');
  else if (!old.paused) fail('a take from last week started playing by itself');
  else ok('history stays quiet — only a take she is waiting on plays');

  // 2 — render, and the take plays itself the moment it lands
  await page.evaluate(() => {
    document.getElementById('text').value = 'say this out loud';
    document.getElementById('text').dispatchEvent(new Event('input'));
  });
  await page.click('.vbtn');                     // her top voice is already lit; tap it anyway
  await page.click('#go');
  await page.waitForFunction(() => {
    const a = document.querySelector('.render[data-id="vlnew000000001"] audio');
    return a && !a.paused && a.currentTime > 0;
  }, null, { timeout: 8000 }).catch(() => {});

  const fresh = await page.evaluate(() => {
    const a = document.querySelector('.render[data-id="vlnew000000001"] audio');
    return a ? { paused: a.paused, t: a.currentTime, muted: a.muted, vol: a.volume } : null;
  });
  if (!fresh) fail('the finished take drew no player at all');
  else if (fresh.paused || !(fresh.t > 0)) fail('the just-rendered take did not play itself (paused=' + fresh.paused + ', t=' + fresh.t + ')');
  else ok('the take she waited for plays itself the moment it lands');
  if (fresh && (fresh.muted || fresh.vol === 0)) fail('it plays silently, which is the same as not playing');
  else if (fresh) ok('and out loud, not muted');

  // 3 — ONCE. The card repaints (the Blocks hand-off repaints it), and a
  // repaint that restarted the take would jump her back to the top of a line
  // she is halfway through.
  const again = await page.evaluate(async () => {
    const a = document.querySelector('.render[data-id="vlnew000000001"] audio');
    a.pause(); a.currentTime = 1.5;              // as if she paused it herself
    window.card(Object.assign({}, window.rdata['vlnew000000001']));
    await new Promise((r) => setTimeout(r, 400));
    const b = document.querySelector('.render[data-id="vlnew000000001"] audio');
    return { paused: b.paused };
  });
  if (!again.paused) fail('a repaint restarted a take she had paused');
  else ok('it plays once — a repaint never starts it again');

  // 4 — a take landing while she is in another app must not talk out of her
  // pocket. The card is still there when she comes back.
  const hidden = await page.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    window.card({ id: 'vlbg0000000001', voiceName: 'Sophie — morning', text: 'landed in the background',
      status: 'rendering', createdAt: new Date().toISOString() });
    window.watching['vlbg0000000001'] = true;
    window.card({ id: 'vlbg0000000001', voiceName: 'Sophie — morning', text: 'landed in the background',
      status: 'done', url: '/take.wav', createdAt: new Date().toISOString() });
    await new Promise((r) => setTimeout(r, 400));
    const a = document.querySelector('.render[data-id="vlbg0000000001"] audio');
    return { there: Boolean(a), paused: a ? a.paused : null };
  });
  if (!hidden.there) fail('the background take drew no card');
  else if (!hidden.paused) fail('a take that landed while she was away started talking');
  else ok('a take landing in the background stays quiet');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})().catch((e) => { console.error(e); process.exit(1); });
