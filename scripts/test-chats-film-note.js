#!/usr/bin/env node
// TAP-TO-NOTE on a pinned film (Aug 2026, Sophie: "I watch the video but I can
// tap it and then the video pauses and a field comes up where I can write a
// note and then once I tap done, the video keeps playing and the note
// disappears and gets sent to you or whatever chat I'm using it for").
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. opening a pinned film draws the tap layer, and the tap layer stops
//      ABOVE the native control bar (play/scrub must stay reachable),
//   2. tapping it pauses the video and raises the note sheet, showing the
//      video position as m:ss,
//   3. Done with text POSTs to /api/gallery/assets/note with the [m:ss] stamp,
//      the chat's name and the FILM's url, from "sophie" — the thread a chat's
//      normal notes sweep already reads,
//   4. after a successful send the sheet is GONE and the video plays again,
//   5. Cancel sends nothing, closes the sheet, resumes,
//   6. an audio pin gets NO tap layer (films only).
//
//   node scripts/test-chats-film-note.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MSGS = [
  { id: 'm1', chat: 'film-chat', from: 'claude', text: 'v16 is up', tldr: 'v16', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'audio-chat', from: 'claude', text: 'the cut', tldr: 'cut', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
];
const notePosts = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: {
        'film-chat': { lastSeen: MSGS[0].created, pinned: { url: '/clip.mp4', title: 'Evan — v16 (4:25)', kind: 'video' } },
        'audio-chat': { lastSeen: MSGS[1].created, pinned: { url: '/clip.m4a', title: 'the cut', kind: 'audio' } },
      } }));
  }
  if (url.pathname === '/api/gallery/assets/note' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      notePosts.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: { from: 'sophie' }, thread: [], waiting: 'chat' }));
    });
    return;
  }
  if (url.pathname === '/clip.mp4' || url.pathname === '/clip.m4a') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('mp4') ? 'video/mp4' : 'audio/mp4' });
    return res.end(Buffer.alloc(0));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="film-chat"]');
  await page.click('#grid .crow[data-chat="film-chat"]');
  await page.waitForSelector('.pinned', { timeout: 4000 }).catch(() => fail('pinned row never rendered'));
  await page.click('.pinned');
  await page.waitForSelector('#pinfull', { timeout: 3000 }).catch(() => fail('the player did not open'));

  // 1. the tap layer exists and leaves the control bar uncovered
  const geom = await page.evaluate(() => {
    const tap = document.querySelector('#pinfull .notetap');
    if (!tap) return null;
    const t = tap.getBoundingClientRect();
    return { bottom: t.bottom, vh: window.innerHeight };
  });
  if (!geom) fail('no tap layer on a pinned film');
  else if (geom.bottom > geom.vh - 80) fail('the tap layer covers the native control bar');

  // 2. tapping pauses and raises the sheet with the position
  await page.evaluate(() => {
    const v = document.querySelector('#pinfull video');
    Object.defineProperty(v, 'currentTime', { value: 41.4, writable: true });
    v.play = () => { v.__played = true; return Promise.resolve(); };
    v.pause = () => { v.__paused = true; };
  });
  await page.click('#pinfull .notetap');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 }).catch(() => fail('tapping did not raise the note sheet'));
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__paused)) fail('tapping did not pause the video');
  const stamp = await page.$eval('#pinfull .nsheet .nt', (n) => n.textContent).catch(() => '');
  if (!stamp.includes('0:41')) fail('the sheet does not show the video position: ' + stamp);

  // 3 + 4. Done sends the stamped note to the chat's thread on the film url
  await page.fill('#pinfull .nsheet textarea', 'the uh sound here');
  await page.click('#pinfull .nsheet .send');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 3000 })
    .catch(() => fail('the sheet did not close after Done'));
  if (!notePosts.length) fail('Done never POSTed the note');
  else {
    const p = notePosts[0];
    if (p.chat !== 'film-chat') fail('note filed to the wrong chat: ' + p.chat);
    if (!/clip\.mp4$/.test(p.url)) fail('note not keyed to the film url: ' + p.url);
    if (p.from !== 'sophie') fail('note not from sophie: ' + p.from);
    if (!/^\[0:41\] the uh sound here$/.test(p.text)) fail('note text lost its stamp: ' + p.text);
  }
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__played)) fail('the video did not resume after Done');

  // 5. Cancel sends nothing and resumes
  await page.evaluate(() => { document.querySelector('#pinfull video').__played = false; });
  await page.click('#pinfull .notetap');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 });
  await page.fill('#pinfull .nsheet textarea', 'never mind');
  await page.click('#pinfull .nsheet .cxl');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 })
    .catch(() => fail('Cancel did not close the sheet'));
  if (notePosts.length !== 1) fail('Cancel still sent a note');
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__played)) fail('the video did not resume after Cancel');
  await page.click('#pinfull .x');

  // 6. an audio pin gets no tap layer
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="audio-chat"]');
  await page.click('#grid .crow[data-chat="audio-chat"]');
  await page.waitForSelector('.pinned', { timeout: 4000 });
  await page.click('.pinned');
  await page.waitForSelector('#pinfull', { timeout: 3000 });
  if (await page.$('#pinfull .notetap')) fail('an audio pin drew a film tap layer');

  await browser.close(); server.close();
  console.log(process.exitCode ? 'FAILED' : 'PASS: tap-to-note pauses, stamps, files to the chat, resumes; films only');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
