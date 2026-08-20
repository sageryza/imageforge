#!/usr/bin/env node
// TAP-TO-NOTE on a pinned film — v2 (Aug 2026, Sophie's rework after first
// real use: "even pressing play on the video triggers the note thing").
// Drives the REAL public/chats.html with a FAKED mic and asserts:
//   1. tapping the video raises NO sheet — it shows the floating Note button,
//      and a second tap hides it (the native controls' rhythm),
//   2. tapping Note pauses the video, raises the sheet stamped m:ss, and the
//      mic is ALREADY recording (her default: just talk),
//   3. ONE Done while recording: the video resumes IMMEDIATELY and the note
//      files in the background — voice held (hold:true, not filed by the
//      voice route), then the text route gets "[m:ss] transcript (voice: url)"
//      from "sophie" on the FILM's url in the chat's own thread,
//   4. tapping the TEXT BOX mid-recording stops the mic, puts the transcript
//      in the box (video stays paused), and Done then files the EDITED text,
//   5. Cancel files nothing and resumes,
//   6. an audio pin gets no Note button.
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
const notePosts = [], voicePosts = [];
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
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      notePosts.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: { from: 'sophie' }, thread: [], waiting: 'chat' }));
    });
    return;
  }
  if (url.pathname === '/api/gallery/assets/note-voice' && req.method === 'POST') {
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      voicePosts.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, url: 'https://x/voice.webm', transcript: 'the uh sound here', held: true }));
    });
    return;
  }
  if (url.pathname === '/clip.mp4' || url.pathname === '/clip.m4a') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('mp4') ? 'video/mp4' : 'audio/mp4' });
    return res.end(Buffer.alloc(0));
  }
  // the page's own scripts are REAL files now — tap-to-note lives in
  // /filmnote.js, shared with compare.js's video lightbox, so serving a stub
  // here would test a page with the feature missing
  if (/^\/[a-z0-9-]+\.js$/.test(url.pathname)) {
    const f = path.join(PUB, url.pathname.slice(1));
    if (fs.existsSync(f)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      return res.end(fs.readFileSync(f, 'utf8'));
    }
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
  // a mic that always works: records one fake chunk, stops instantly
  await page.addInitScript(() => {
    window.MediaRecorder = class {
      constructor() { this.state = 'recording'; window.__recs = (window.__recs || 0) + 1; }
      start() {}
      stop() {
        this.state = 'inactive'; window.__recStopped = true;
        if (this.ondataavailable) this.ondataavailable({ data: new Blob([new Uint8Array(64)], { type: 'audio/webm' }) });
        if (this.onstop) this.onstop();
      }
    };
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = () => Promise.resolve({ getTracks: () => [] });
  });
  const openFilm = async () => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="film-chat"]');
    await page.click('#grid .crow[data-chat="film-chat"]');
    await page.waitForSelector('.pinned', { timeout: 4000 });
    await page.click('.pinned');
    await page.waitForSelector('#pinfull', { timeout: 3000 });
    await page.evaluate(() => {
      const v = document.querySelector('#pinfull video');
      Object.defineProperty(v, 'currentTime', { value: 41.4, writable: true });
      v.play = () => { v.__played = true; return Promise.resolve(); };
      v.pause = () => { v.__paused = true; };
    });
  };

  // 1. a tap on the video shows the button (no sheet), a second tap hides it
  await openFilm();
  await page.evaluate(() => document.querySelector('#pinfull video').click());
  if (await page.$('#pinfull .nsheet')) fail('tapping the video raised the sheet');
  if (await page.$eval('#pinfull .notebtn', (n) => n.classList.contains('off'))) fail('a tap did not show the Note button');
  await page.evaluate(() => document.querySelector('#pinfull video').click());
  if (!await page.$eval('#pinfull .notebtn', (n) => n.classList.contains('off'))) fail('a second tap did not hide the Note button');

  // 2. Note pauses, stamps, and the mic is already on
  await page.evaluate(() => document.querySelector('#pinfull video').click());
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 }).catch(() => fail('Note did not raise the sheet'));
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__paused)) fail('Note did not pause the video');
  const stamp = await page.$eval('#pinfull .nsheet .nt', (n) => n.textContent).catch(() => '');
  if (!stamp.includes('0:41')) fail('the sheet does not show the video position: ' + stamp);
  await page.waitForFunction(() => window.__recs >= 1, null, { timeout: 2000 })
    .catch(() => fail('the mic did not start by itself'));

  // 3. ONE Done: resume now, file in the background (hold, then text)
  await page.click('#pinfull .nsheet .send');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 })
    .catch(() => fail('Done did not close the sheet'));
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__played)) fail('the video did not resume on Done');
  await page.waitForFunction(() => true, null, { timeout: 300 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  if (!voicePosts.length) fail('the voice was never uploaded');
  else if (!voicePosts[0].hold) fail('the voice route was asked to FILE instead of hold');
  if (!notePosts.length) fail('the note was never filed');
  else {
    const p = notePosts[0];
    if (p.chat !== 'film-chat') fail('note filed to the wrong chat: ' + p.chat);
    if (!/clip\.mp4$/.test(p.url)) fail('note not keyed to the film url: ' + p.url);
    if (p.from !== 'sophie') fail('note not from sophie: ' + p.from);
    if (p.text !== '[0:41] the uh sound here (voice: https://x/voice.webm)') fail('wrong filed text: ' + p.text);
  }

  // 4. tapping the box stops the mic and lands the words there for editing
  await page.click('#pinfull .x');
  await openFilm();
  await page.evaluate(() => { window.__recStopped = false; document.querySelector('#pinfull video').click(); });
  await page.click('#pinfull .notebtn');
  // openFilm navigated, so the fresh page's recorder counter starts over
  await page.waitForFunction(() => window.__recs >= 1, null, { timeout: 2000 })
    .catch(() => fail('the mic did not start on the second note'));
  await page.focus('#pinfull .nsheet textarea');
  await page.waitForFunction(() => window.__recStopped, null, { timeout: 2000 })
    .catch(() => fail('tapping the box did not stop the mic'));
  await page.waitForFunction(() => document.querySelector('#pinfull .nsheet textarea').value.length > 0, null, { timeout: 2000 })
    .catch(() => fail('the transcript never landed in the box'));
  if (await page.evaluate(() => document.querySelector('#pinfull video').__played &&
      !document.querySelector('#pinfull .nsheet'))) fail('editing resumed the video too early');
  await page.fill('#pinfull .nsheet textarea', 'the uh sound here, edited');
  await page.click('#pinfull .nsheet .send');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 3000 })
    .catch(() => fail('Done after editing did not close the sheet'));
  const edited = notePosts[notePosts.length - 1];
  if (!edited || edited.text !== '[0:41] the uh sound here, edited (voice: https://x/voice.webm)') {
    fail('the edited text did not file: ' + JSON.stringify(edited && edited.text));
  }

  // 5. Cancel files nothing and resumes
  const before = notePosts.length;
  await page.evaluate(() => { const v = document.querySelector('#pinfull video'); v.__played = false; v.click(); });
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 });
  await page.click('#pinfull .nsheet .cxl');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 });
  await new Promise((r) => setTimeout(r, 300));
  if (notePosts.length !== before) fail('Cancel still filed a note');
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__played)) fail('Cancel did not resume the video');
  await page.click('#pinfull .x');

  // 6. an audio pin gets no Note button
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="audio-chat"]');
  await page.click('#grid .crow[data-chat="audio-chat"]');
  await page.waitForSelector('.pinned', { timeout: 4000 });
  await page.click('.pinned');
  await page.waitForSelector('#pinfull', { timeout: 3000 });
  if (await page.$('#pinfull .notebtn')) fail('an audio pin drew the Note button');

  await browser.close(); server.close();
  console.log(process.exitCode ? 'FAILED' : 'PASS: note button follows the controls, mic-first notes file and resume, editing works, films only');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
