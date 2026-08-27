#!/usr/bin/env node
// TAP-TO-NOTE on a pinned film — v3 (Aug 2026, Sophie's own spec after real
// use of the ported player). Drives the REAL public/chats.html with a faked
// mic and asserts her rules:
//   1. a tap anywhere on the film PAUSES it (and raises the Note button —
//      no sheet); a second tap plays it again and the button goes away,
//   1b. a tap on a PLAYING film while iOS's tinted controls overlay is still
//      up (the scrim window after any tap) only DISMISSES the overlay — it
//      never pauses (2026-08-27, Sophie: "when i tap to get rid of the
//      tinted pause screen, it also pauses the video"); the dismissing tap
//      clears the window, so the very next tap pauses as always,
//   2. Note raises the sheet stamped m:ss with the mic ALREADY recording,
//   3. ONE Done while recording: the sheet closes INSTANTLY, the video
//      resumes, and the note goes out in the background (voice held with
//      hold:true, then the text route gets "[m:ss] transcript (voice: url)"),
//   4. tapping the TEXT BOX mid-recording stops the mic and lands the
//      transcript there for editing; Done then files the EDITED text,
//   5. Cancel files nothing and resumes — the one deliberate discard,
//   6. PLAY while the sheet is open saves the note and dismisses it
//      ("pressing play after it's been paused should trigger the note to
//      save and disappear"),
//   7. THE OUTBOX: a note finished while the server is down closes the sheet
//      instantly anyway, waits in localStorage, and goes out by itself on
//      the next page load ("save them all and batch them so it doesn't have
//      to wait to send"),
//   8. an audio pin gets no Note button.
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
let failNotes = false;                    // step 7 flips this: the server "goes down"
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
      if (failNotes) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"error":"down"}'); }
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
  // the page's own scripts are REAL files — tap-to-note lives in /filmnote.js,
  // shared with compare.js's video lightbox, so a stub would test a page with
  // the feature missing
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
  // a mic that always works — and hands its chunk over ASYNC after stop(),
  // the way every real recorder does (dataavailable/stop fire on a later
  // task). The first version of this stub fired synchronously, which hid a
  // real bug: the player read `chunks` right after stop() and got an empty
  // blob in every real browser, silently dropping every talk-then-Done note.
  await page.addInitScript(() => {
    window.MediaRecorder = class {
      constructor() { this.state = 'recording'; window.__recs = (window.__recs || 0) + 1; }
      start() {}
      stop() {
        this.state = 'inactive'; window.__recStopped = true;
        const self = this;
        setTimeout(() => {
          if (self.ondataavailable) self.ondataavailable({ data: new Blob([new Uint8Array(64)], { type: 'audio/webm' }) });
          if (self.onstop) self.onstop();
        }, 40);
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
    // a video whose playing state the test controls, firing the real events
    // filmnote listens to (the autoplayed player opens PLAYING)
    await page.evaluate(() => {
      const v = document.querySelector('#pinfull video');
      Object.defineProperty(v, 'currentTime', { value: 41.4, writable: true });
      let paused = false;
      Object.defineProperty(v, 'paused', { get: () => paused, configurable: true });
      v.play = function () { paused = false; v.__played = true; v.dispatchEvent(new Event('play')); return Promise.resolve(); };
      v.pause = function () { paused = true; v.__paused = true; v.dispatchEvent(new Event('pause')); };
      // the test taps faster than iOS's real scrim ever fades — the window is
      // off by default here and raised only by the step that tests it (1b)
      window.__filmNote.SCRIM_MS = 0;
    });
  };
  const tapFilm = () => page.evaluate(() => document.querySelector('#pinfull video').click());

  // 1. a tap anywhere on the film pauses it and raises the Note button; a
  //    second tap plays it again and puts the button away. Never a sheet.
  await openFilm();
  await tapFilm();
  if (!await page.evaluate(() => document.querySelector('#pinfull video').paused)) fail('a tap did not pause the film');
  if (await page.$('#pinfull .nsheet')) fail('tapping the film raised the sheet');
  if (await page.$eval('#pinfull .notebtn', (n) => n.classList.contains('off'))) fail('pausing did not show the Note button');
  await tapFilm();
  if (await page.evaluate(() => document.querySelector('#pinfull video').paused)) fail('a second tap did not play the film again');
  if (!await page.$eval('#pinfull .notebtn', (n) => n.classList.contains('off'))) fail('playing did not put the Note button away');

  // 1b. iOS's tinted overlay is up right after a tap — with the window at its
  //     real width, the next tap only puts the overlay away, and the one
  //     after THAT pauses (the dismissing tap cleared the window)
  //     The film is PLAYING and step 1's last tap just armed the window —
  //     exactly the state her report describes.
  await page.evaluate(() => { window.__filmNote.SCRIM_MS = 3800; });
  await tapFilm();   // overlay up on a playing film → dismiss only
  if (await page.evaluate(() => document.querySelector('#pinfull video').paused)) fail('a scrim-dismiss tap paused the film');
  await tapFilm();   // the dismiss cleared the window → this one pauses
  if (!await page.evaluate(() => document.querySelector('#pinfull video').paused)) fail('the tap after dismissing the overlay did not pause');
  await page.evaluate(() => { window.__filmNote.SCRIM_MS = 0; });

  // 2. Note raises the stamped sheet with the mic already on (the film is
  //    already paused from 1b's last tap)
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 }).catch(() => fail('Note did not raise the sheet'));
  if (!await page.evaluate(() => document.querySelector('#pinfull video').paused)) fail('the film did not stay paused under the sheet');
  const stamp = await page.$eval('#pinfull .nsheet .nt', (n) => n.textContent).catch(() => '');
  if (!stamp.includes('0:41')) fail('the sheet does not show the video position: ' + stamp);
  await page.waitForFunction(() => window.__recs >= 1, null, { timeout: 2000 })
    .catch(() => fail('the mic did not start by itself'));

  // 3. ONE Done: the sheet closes instantly, the film resumes, the note goes
  //    out in the background (voice held, then the text route)
  await page.click('#pinfull .nsheet .send');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 })
    .catch(() => fail('Done did not close the sheet'));
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__played)) fail('the video did not resume on Done');
  await new Promise((r) => setTimeout(r, 900));   // the stub's async handoff + two background fetches
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
  await page.evaluate(() => { window.__recStopped = false; });
  await tapFilm();
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
  await new Promise((r) => setTimeout(r, 600));
  const edited = notePosts[notePosts.length - 1];
  if (!edited || edited.text !== '[0:41] the uh sound here, edited (voice: https://x/voice.webm)') {
    fail('the edited text did not file: ' + JSON.stringify(edited && edited.text));
  }

  // 5. Cancel files nothing and resumes — the one deliberate discard
  const before = notePosts.length;
  await page.evaluate(() => { const v = document.querySelector('#pinfull video'); v.__played = false; });
  await tapFilm();
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 });
  await page.click('#pinfull .nsheet .cxl');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 });
  await new Promise((r) => setTimeout(r, 400));
  if (notePosts.length !== before) fail('Cancel still filed a note');
  if (!await page.evaluate(() => document.querySelector('#pinfull video').__played)) fail('Cancel did not resume the video');

  // 6. PLAY while the sheet is open saves the note and dismisses it
  const before6 = notePosts.length;
  await tapFilm();
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 });
  await page.waitForFunction(() => window.__recs >= 3, null, { timeout: 2000 })
    .catch(() => fail('the mic did not start on the play-saves note'));
  await page.evaluate(() => document.querySelector('#pinfull video').play());
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 })
    .catch(() => fail('pressing play did not dismiss the sheet'));
  await new Promise((r) => setTimeout(r, 900));
  if (notePosts.length !== before6 + 1) fail('pressing play did not save the note (' + (notePosts.length - before6) + ' filed)');
  else if (!/voice:/.test(notePosts[notePosts.length - 1].text)) fail('the play-saved note lost its voice: ' + notePosts[notePosts.length - 1].text);

  // 7. THE OUTBOX: finished while the server is down → the sheet still closes
  //    instantly, the note waits on the device, and the next page load sends it
  failNotes = true;
  const before7 = notePosts.length;
  await tapFilm();
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 });
  await page.focus('#pinfull .nsheet textarea');
  await page.waitForFunction(() => document.querySelector('#pinfull .nsheet textarea').value.length > 0, null, { timeout: 2000 });
  await page.fill('#pinfull .nsheet textarea', 'stuck note');
  await page.click('#pinfull .nsheet .send');
  await page.waitForFunction(() => !document.querySelector('#pinfull .nsheet'), null, { timeout: 2000 })
    .catch(() => fail('a down server kept the sheet open — it must close instantly'));
  await new Promise((r) => setTimeout(r, 700));
  if (notePosts.length !== before7) fail('the note filed while the server was down??');
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('forge.filmnotes.outbox') || '[]').length);
  if (queued !== 1) fail('the unsent note is not waiting in the outbox (got ' + queued + ')');
  failNotes = false;
  await openFilm();                                // a fresh page load flushes the queue
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem('forge.filmnotes.outbox') || '[]').length === 0, null, { timeout: 6000 })
    .catch(() => fail('the outbox never emptied after the server came back'));
  const flushed = notePosts[notePosts.length - 1];
  if (notePosts.length !== before7 + 1 || !flushed || !/stuck note/.test(flushed.text)) {
    fail('the queued note never arrived: ' + JSON.stringify(flushed && flushed.text));
  }

  // 8. an audio pin gets no Note button
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="audio-chat"]');
  await page.click('#grid .crow[data-chat="audio-chat"]');
  await page.waitForSelector('.pinned', { timeout: 4000 });
  await page.click('.pinned');
  await page.waitForSelector('#pinfull', { timeout: 3000 });
  if (await page.$('#pinfull .notebtn')) fail('an audio pin drew the Note button');

  await browser.close(); server.close();
  console.log(process.exitCode ? 'FAILED'
    : 'PASS: tap pauses/plays, Note on the paused screen, play saves, notes queue and flush, films only');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
