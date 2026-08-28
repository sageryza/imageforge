#!/usr/bin/env node
// THE PROMPT DOOR on a paused film (2026-08-27, Sophie: "in the play pause
// feedback pinned video tool, add a way to see image prompts"). Drives the
// REAL public/chats.html and the REAL public/filmnote.js — the shared
// implementation both hosts of the tap-to-note player use — with a stubbed
// /api/filmshots, and asserts:
//
//   1. a film with NO shot map shows no Prompt button at all (the Assets
//      tab's own silence — never "no prompt filed"),
//   2. paused BEFORE the first mapped shot: still no button (a film that
//      opens on a title card its map does not name),
//   3. paused on a mapped picture: the button appears, and behind it the
//      label, the MODEL · QUALITY · SIZE caption and the CONTENT half —
//      the house default, because what the picture is OF is what she
//      stopped to ask about,
//   4. Style shows the other half; the half she picked rides along as she
//      moves through the film,
//   5. a tap on the WORDS puts them away and never reaches the film's own
//      pause/play toggle underneath,
//   6. stepping to a picture with NOTHING filed hides the button and the
//      words with it,
//   7. playing puts the door away; NOTE stays reachable under the words
//      ("this prompt is wrong" must not cost a tap to say), and raising the
//      sheet takes the screen from them,
//   8. an AUDIO pin asks for no map and shows no button.
//
//   node scripts/test-film-prompt.js
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
  { id: 'm1', chat: 'film-chat', from: 'claude', text: 'the reel v1', tldr: 'v1', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'plain-chat', from: 'claude', text: 'a film nobody mapped', tldr: 'v1', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'audio-chat', from: 'claude', text: 'the cut', tldr: 'cut', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
// The map as the server hands it over: times joined to the chat's own filed
// pictures. Shot 3 is a picture with a label and no prompt — the case that
// must show nothing rather than an empty panel.
const SHOTS = [
  { at: 1, end: 4, url: 'https://x/pic-1.webp', label: 'The veil (beat 1)',
    caption: 'gpt-image-2 · medium · 1/4 (4K)',
    style: 'The FIRST attached image is a STYLE reference — copy its drawing style.',
    content: 'a gauzy veil drifting down over the whole earth' },
  { at: 4, end: 7, url: 'https://x/pic-2.webp', label: 'Grab the gold (beat 21)',
    content: 'reaching to grab a dangling piece of gold' },
  { at: 7, end: 9, url: 'https://x/pic-3.webp', label: 'a label and nothing else' },
];
const shotAsks = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: {
        'film-chat': { lastSeen: MSGS[0].created, pinned: { url: '/clip.mp4', title: 'Hate of the Game — the reel v1 (5:42)', kind: 'video' } },
        'plain-chat': { lastSeen: MSGS[1].created, pinned: { url: '/other.mp4', title: 'a film nobody mapped (1:00)', kind: 'video' } },
        'audio-chat': { lastSeen: MSGS[2].created, pinned: { url: '/clip.m4a', title: 'the cut', kind: 'audio' } },
      } }));
  }
  if (url.pathname === '/api/filmshots') {
    shotAsks.push(url.searchParams.get('url') || '');
    const mapped = (url.searchParams.get('url') || '').includes('/clip.mp4');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(mapped
      ? { ok: true, found: true, chat: 'film-chat', seconds: 9, shots: SHOTS }
      : { ok: true, found: false, shots: [] }));
  }
  if (/\.(mp4|m4a)$/.test(url.pathname)) {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('mp4') ? 'video/mp4' : 'audio/mp4' });
    return res.end(Buffer.alloc(0));
  }
  // the page's own scripts are REAL files — the door lives in /filmnote.js
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
let fails = 0;
const fail = (m) => { fails++; console.log('  FAIL — ' + m); process.exitCode = 1; };
const ok = (m) => console.log('  ok — ' + m);
const check = (cond, m) => (cond ? ok(m) : fail(m));

// static: the words are never copied into the player — it holds no prompt of
// its own, only the map's fields. (The one-copy rule: a prompt lives in the
// chat's filed asset and nowhere else.)
{
  const src = fs.readFileSync(path.join(PUB, 'filmnote.js'), 'utf8');
  check(/api\/filmshots/.test(src), 'filmnote.js asks the server for the shot map');
  check(!/promptStyle|promptContent/.test(src), 'filmnote.js holds no copy of the assets’ prompt fields');
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = () => Promise.resolve({ getTracks: () => [] });
  });

  // A player whose playing state and position the test drives, firing the real
  // events filmnote listens to (the autoplayed player opens PLAYING).
  const openPin = async (chat) => {
    await page.goto(base + '/chats');
    await page.waitForSelector(`#grid [data-chat="${chat}"]`);
    await page.click(`#grid .crow[data-chat="${chat}"]`);
    await page.waitForSelector('.pinned', { timeout: 4000 });
    await page.click('.pinned');
    await page.waitForSelector('#pinfull', { timeout: 3000 });
    await page.evaluate(() => {
      const v = document.querySelector('#pinfull video, #pinfull audio');
      let t = 0, paused = false;
      Object.defineProperty(v, 'currentTime', {
        get: () => t,
        set: (n) => { t = n; v.dispatchEvent(new Event('seeked')); },
        configurable: true,
      });
      Object.defineProperty(v, 'paused', { get: () => paused, configurable: true });
      v.play = function () { paused = false; v.dispatchEvent(new Event('play')); return Promise.resolve(); };
      v.pause = function () { paused = true; v.dispatchEvent(new Event('pause')); };
      window.__filmNote.SCRIM_MS = 0;
    });
    // the map lands one fetch later
    await page.waitForTimeout(250);
  };
  const seek = (t) => page.evaluate((n) => { document.querySelector('#pinfull video').currentTime = n; }, t);
  const pauseFilm = () => page.evaluate(() => document.querySelector('#pinfull video').pause());
  const playFilm = () => page.evaluate(() => document.querySelector('#pinfull video').play());
  const btnOff = () => page.$eval('#pinfull .pbtn', (n) => n.classList.contains('off')).catch(() => 'none');

  // 8 (first, it needs its own open): an audio pin asks for no map at all
  await openPin('audio-chat');
  check(shotAsks.length === 0, 'an audio pin asks for no shot map');
  check(await page.$('#pinfull .pbtn') === null, 'an audio pin shows no Prompt button');
  await page.evaluate(() => document.querySelector('#pinfull .x').click());

  // 1. a film nobody has mapped: asked once, and no button either way
  await openPin('plain-chat');
  await pauseFilm();
  check(shotAsks.some((u) => u.includes('/other.mp4')), 'an unmapped film is asked about once');
  check(await page.$('#pinfull .pbtn') === null, 'an unmapped film shows no Prompt button');
  await page.evaluate(() => document.querySelector('#pinfull .x').click());

  // 2. paused before the first mapped shot — nothing to answer with
  await openPin('film-chat');
  await pauseFilm();
  await seek(0.4);
  check(await btnOff() === true, 'paused before the first shot: no button');

  // 3. paused on a mapped picture: the button, then the words
  await seek(2);
  check(await btnOff() === false, 'paused on a mapped picture: the Prompt button is there');
  await page.click('#pinfull .pbtn');
  await page.waitForSelector('#pinfull .fprompt', { timeout: 2000 }).catch(() => fail('Prompt opened nothing'));
  check(await page.$eval('#pinfull .fprompt .fphead', (n) => n.textContent) === 'The veil (beat 1)',
    'the label she reviews by leads the panel');
  check((await page.$eval('#pinfull .fprompt .fpcap', (n) => n.textContent)).includes('medium'),
    'the MODEL · QUALITY · SIZE caption is under it');
  check((await page.$eval('#pinfull .fprompt .fptext', (n) => n.textContent)).includes('gauzy veil'),
    'it opens on CONTENT — what the picture is OF');
  check(await page.$eval('#pinfull .fprompt .fptog button.on', (n) => n.dataset.half) === 'content',
    'and the Content half is the lit one');
  // the panel covers the film, so a tap in the middle can never reach the
  // pause/play toggle underneath — asked with elementFromPoint, the only
  // honest way to ask what a tap reaches
  const mid = await page.evaluate(() => {
    const el = document.elementFromPoint(195, 300);
    return el ? el.className || el.tagName : '';
  });
  check(/fprompt|fptext|fphead|fpcap|fptog/.test(String(mid)), 'the words cover the film (' + mid + ')');

  // 4. Style shows the other half, and the side rides along to the next shot
  await page.click('#pinfull .fprompt .fptog button[data-half="style"]');
  check((await page.$eval('#pinfull .fprompt .fptext', (n) => n.textContent)).includes('STYLE reference'),
    'Style shows the wrapper that was sent around her words');
  await seek(5);
  check(await page.$('#pinfull .fprompt') !== null, 'stepping to the next picture keeps the words open');
  check((await page.$eval('#pinfull .fprompt .fptext', (n) => n.textContent)).includes('dangling piece of gold'),
    'and the words are the NEW picture’s');
  check(await page.$('#pinfull .fprompt .fptog') === null,
    'a picture with only one half filed shows no Style|Content pair');

  // 5. a tap on the words puts them away — and does not start the film
  await page.evaluate(() => document.querySelector('#pinfull .fptext').click());
  check(await page.$('#pinfull .fprompt') === null, 'a tap on the words puts them away');
  check(await page.evaluate(() => document.querySelector('#pinfull video').paused),
    'and never reaches the film’s own pause/play toggle');
  check(await btnOff() === false, 'the button is still there to open them again');

  // 6. a picture with nothing filed: no button, and the open words go with it
  await page.click('#pinfull .pbtn');
  await seek(8);
  check(await page.$('#pinfull .fprompt') === null, 'stepping to an unfiled picture closes the words');
  check(await btnOff() === true, 'and takes the button with them');

  // 7. playing puts the door away; the Note sheet takes the screen
  await seek(2);
  await page.click('#pinfull .pbtn');
  await playFilm();
  check(await page.$('#pinfull .fprompt') === null, 'playing puts the words away');
  check(await btnOff() === true, 'and the button with them');
  await pauseFilm();
  await page.click('#pinfull .pbtn');
  // the Note button is still hers while the words are up — asked at its own
  // centre with elementFromPoint, because "visible" says nothing about
  // whether a panel is sitting on it
  const noteTop = await page.evaluate(() => {
    const b = document.querySelector('#pinfull .notebtn').getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return el ? (el.closest('.notebtn') ? 'notebtn' : el.className || el.tagName) : '';
  });
  check(noteTop === 'notebtn', 'Note is still reachable under the words (' + noteTop + ')');
  await page.click('#pinfull .notebtn');
  await page.waitForSelector('#pinfull .nsheet', { timeout: 2000 }).catch(() => fail('Note did not raise the sheet'));
  check(await page.$('#pinfull .fprompt') === null, 'the note sheet takes the screen from the words');
  check(await btnOff() === true, 'and the Prompt button steps aside while she writes');

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall good');
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
