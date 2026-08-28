#!/usr/bin/env node
/* ONE BUTTON FOR THE VOICEOVER AND THE STORY DESCRIPTION — headless, against
   the real public/scratchpad.html (2026-08-26, Sophie: "put the voiceover and
   story description behind one button but think carefully about the layout").

   It was two buttons and two sheets: a book glyph over her description and her
   two recordings as native <audio controls>, and a waveform over the memos and
   episodes as rows. Everything in both is the same thing, so it is one sheet —
   and the layout is the part that had to be got right, so almost every
   assertion here is a MEASUREMENT rather than a check that some markup exists.

   The order was decided by counting her real stories the day it merged (all 67,
   live): 47 carry anything at all, 43 of those have a RECORDING and only 17 a
   description — and a description runs ~2,300 characters at the median and
   10,593 at the longest. So the recordings lead (that is what a tap is for) and
   her words sit underneath, folded to six lines behind the house `.moretxt`
   opener, which is what keeps the whole sheet on one screen.

   Run: node scripts/test-storyroom-about.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('storyroom-about: playwright not installed — skipped');
    process.exit(0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  try {
    if (fs.existsSync(path.join(root, 'chromium'))) return path.join(root, 'chromium');
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall back to playwright's own lookup */ }
  return undefined;
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

/* A real decodable wav, because the scrubber, the duration a row learns from
   the file, and the pause glyph are all things only a playing element knows. */
function wav(sec) {
  const sr = 8000, n = sr * sec, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(3000 * Math.sin(i / 20)), 44 + i * 2);
  return b;
}

/* Her real shapes, from the live count. `full` is the one that mixes
   everything; the other three are how most of her stories actually look. */
const LONG = 'okay so basically '.repeat(600);   // ~10,800 — her longest is 10,593
const SHORT = 'a short note about the story.';
const AUDIOS = [
  { title: 'Discussion on Coincidence and Science', date: '2026-07-09', seconds: 2024, url: '/au/m1.wav', src: 'm1' },
  { title: 'Evan — the long cut v6', seconds: 294, url: '/au/m2.wav' },   // an episode: no src, no transcript
  { title: 'A guess from a chat', date: '2026-06-01', seconds: 610, candidate: true, url: '/au/m3.wav' },
];
const SHAPES = {
  // Her voiceover IS one of the attached memos — 11 of her 67 stories, live.
  // Before 2026-08-26 that drew the file twice and one playback lit both.
  dupe:      { description: '',    descriptionAudio: null,           voiceover: '/au/m1.wav',   audios: AUDIOS },
  full:      { description: LONG,  descriptionAudio: '/au/desc.wav', voiceover: '/au/vo.wav',   audios: AUDIOS,
               voText: 'the narration, word for word. '.repeat(90) },
  same:      { description: SHORT, descriptionAudio: '/au/vo.wav',   voiceover: '/au/vo.wav',   audios: [] },
  audioonly: { description: '',    descriptionAudio: null,           voiceover: null,           audios: AUDIOS },
  textonly:  { description: SHORT, descriptionAudio: null,           voiceover: null,           audios: [] },
  none:      { description: '',    descriptionAudio: null,           voiceover: null,           audios: [] },
};

function serve(shape) {
  const s = SHAPES[shape];
  /* NO CATEGORY, deliberately: an untagged story falls into whichever pile
     the shelf opens on, so this fixture cannot go stale the day that default
     moves (it moved on 2026-08-26 — 'personal' → 'unsorted' — and every test
     pinning the old word stopped finding its own tile). */
  const PADS = { pads: [{ id: 'a', title: 'Evan', beats: 12, category: null, cover: '' }] };
  const PAD = {
    pad: { id: 'a', title: 'Evan', beats: [], category: null },
    title: 'Evan', beats: [],
    description: s.description,
    descriptionAudio: s.descriptionAudio,
    voiceover: s.voiceover ? { url: s.voiceover, source: 'recording', text: s.voText || '' } : null,
    audios: s.audios,
  };
  return http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/au/')) {
      const b = wav(6);
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': b.length, 'accept-ranges': 'bytes' });
      return res.end(b);
    }
    if (u.pathname.startsWith('/api/scratchpad/pads') && !/pads\/[a-z]/.test(u.pathname)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(PADS));
    }
    if (u.pathname.startsWith('/api/search/transcript/')) {
      const id = decodeURIComponent(u.pathname.split('/').pop());
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id, kind: 'memo', title: id,
        text: id === 'm1' ? 'so anyway that is the thing I was saying. '.repeat(80) : '' }));
    }
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(u.pathname.startsWith('/api/scratchpad') ? PAD : {}));
    }
    const rel = u.pathname === '/' ? 'scratchpad.html' : u.pathname.replace(/^\//, '');
    const f = path.join(PUB, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    let body = fs.readFileSync(f);
    if (rel === 'scratchpad.html') body = body.toString() + '\n<script src="/pagehead.js" defer></script>';
    const ext = path.extname(f);
    res.writeHead(200, {
      'content-type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html; charset=utf-8',
    });
    res.end(body);
  });
}

/** Open a story of the given shape and return the page sitting on it. */
async function story(browser, shape) {
  const srv = serve(shape);
  await new Promise(r => srv.listen(0, r));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/scratchpad.html');
  await pg.waitForTimeout(400);
  try { await pg.waitForSelector('.stile', { timeout: 8000 }); }
  catch (e) { console.log('  !! no tiles. errors:', errs, 'html:',
    (await pg.$eval('#shelftiles', el => el.innerHTML)).slice(0, 200)); throw e; }
  await pg.click('.stile');
  await pg.waitForTimeout(600);
  return { pg, errs, close: async () => { await ctx.close(); srv.close(); } };
}

/** Every row and header in the sheet, in the order they are drawn. */
const LIST = `[...document.querySelectorAll('#audios > .aurow, #audios > .auhead')].map(e =>
  e.classList.contains('auhead') ? '— ' + e.textContent
  : e.querySelector('.aunm').textContent)`;

(async () => {
  const browser = await chromium.launch({ executablePath: exe() });

  // ── THE TWO BUTTONS ARE ONE, AND THE OLD SHEET IS GONE ────────────────
  console.log('one button, one sheet');
  {
    const html = fs.readFileSync(path.join(PUB, 'scratchpad.html'), 'utf8');
    for (const dead of ['descbtn', 'audiobtn', 'descsheet', 'descclose', 'descaudios']) {
      ok('nothing named ' + dead + ' is left', !html.includes('"' + dead + '"'));
    }
    ok('the one button exists', html.includes('id="aboutbtn"'));
  }

  // ── THE ORDER, WHICH IS THE WHOLE LAYOUT DECISION ─────────────────────
  console.log('recordings lead, her words come last');
  {
    const { pg, errs, close } = await story(browser, 'full');
    ok('the header carries the one button, and neither old one',
      await pg.isVisible('#aboutbtn') && !(await pg.$('#descbtn')) && !(await pg.$('#audiobtn')));
    await pg.click('#aboutbtn');
    await pg.waitForTimeout(400);

    const rows = await pg.evaluate(LIST);
    ok('hers lead the list',
      rows[0] === 'As you told it' && rows[1] === 'Your narration',
      JSON.stringify(rows.slice(0, 2)));
    ok('the attached ones take a header under hers', rows[2] === '— Recordings', rows[2]);
    ok('candidates keep their own header, last',
      rows.indexOf('— Candidates') === rows.length - 2, JSON.stringify(rows));

    // Her words are BELOW every row, not above them — the reason is the
    // measurement in the header of this file.
    const order = await pg.evaluate(() => {
      const last = document.querySelector('#audios .aurow:last-of-type').getBoundingClientRect();
      const body = document.getElementById('descbody').getBoundingClientRect();
      const head = document.getElementById('deschead').getBoundingClientRect();
      return { rowsEnd: last.bottom, headTop: head.top, bodyTop: body.top };
    });
    ok('her words sit under the recordings',
      order.headTop >= order.rowsEnd - 1 && order.bodyTop > order.headTop,
      JSON.stringify(order));
    ok('and they are headed "What you said"',
      (await pg.textContent('#deschead')).trim() === 'What you said');

    // ONE SCREEN. Folded, the whole sheet fits an iPhone; opened, it does not
    // — which is what the fold is for.
    const folded = await pg.$eval('#descbody', e => Math.round(e.getBoundingClientRect().height));
    ok('the words are folded', folded > 0 && folded < 200, 'height ' + folded);
    ok('the opener is the house underlined word, never a button',
      await pg.$eval('#descbody .moretxt', e => {
        const cs = getComputedStyle(e);
        return e.textContent === '… more' && cs.textDecorationLine === 'underline'
          && cs.borderTopWidth === '0px' && cs.padding === '0px'
          && cs.backgroundColor === 'rgba(0, 0, 0, 0)';
      }));
    const whole = await pg.$eval('#ausheet .wrap', e => Math.round(e.getBoundingClientRect().height));
    ok('and the sheet opens on one screen', whole <= 844, 'height ' + whole);

    await pg.click('#descbody .moretxt');
    await pg.waitForTimeout(200);
    const open = await pg.$eval('#descbody', e => Math.round(e.getBoundingClientRect().height));
    ok('tapping it opens the words', open > folded * 5, folded + ' → ' + open);
    ok('and the opener becomes "less"',
      (await pg.textContent('#descbody .moretxt')).trim() === 'less');

    // ── NOTHING PASSES UNDER THE SHEET'S OWN PILL ───────────────────────
    // The sheet is its own scroller with its own FIXED pill, so every row
    // rides through that corner on the way up. Measured as INK (a Range over
    // the text) rather than as boxes: padding keeps a box wide while its words
    // stop short, so a box rect would report a collision that is not there.
    ok('the sheet gets its own autoscroll pill',
      (await pg.$$('#ausheet .sfloat')).length === 1);
    const over = await pg.evaluate(() => {
      const p = document.querySelector('#ausheet .sfloat').getBoundingClientRect();
      const out = [];
      document.querySelectorAll('#audios .aurow, #audios .auhead, #deschead, #descbody, .aunm, .audur')
        .forEach(el => {
          let r = el.getBoundingClientRect();
          if (el.firstChild && el.firstChild.nodeType === 3) {
            const g = document.createRange(); g.selectNodeContents(el);
            r = g.getBoundingClientRect();
          }
          if (r.width && r.right > p.left) out.push((el.className || el.id) + ' ' + Math.round(r.right));
        });
      return out;
    });
    ok('nothing in the sheet prints under the pill', over.length === 0, over.join(' · '));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await close();
  }

  // ── THE SCRUBBER, WHICH IS WHAT THE MERGE OWED HER ────────────────────
  // Her description recording and her narration were native <audio controls>,
  // i.e. scrubbable. Folding them into a list of play buttons would have taken
  // that away on the two recordings most worth scrubbing, so the ROW grew a
  // scrubber — which also gives the memos one, having never had it.
  console.log('the playing row carries a scrubber');
  {
    const { pg, errs, close } = await story(browser, 'full');
    await pg.click('#aboutbtn');
    await pg.waitForTimeout(300);
    ok('no row shows one before anything plays', (await pg.$$('#audios .auseek')).length === 0);

    await pg.locator('#audios .aurow').nth(1).locator('.iconbtn').click();
    await pg.waitForTimeout(900);
    const state = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#audios .aurow')];
      const i = rows.findIndex(r => r.querySelector('.auseek'));
      return {
        which: i, seeks: document.querySelectorAll('#audios .auseek').length,
        filled: i < 0 ? '' : rows[i].querySelector('.auseek i').style.width,
        learned: i < 0 ? '' : rows[i].querySelector('.audur').textContent,
        glyph: i < 0 ? '' : rows[i].querySelector('.iconbtn svg rect') ? 'pause' : 'play',
      };
    });
    ok('exactly one row has it, the one playing', state.seeks === 1 && state.which === 1,
      JSON.stringify(state));
    ok('it fills as she listens', parseFloat(state.filled) > 0, state.filled);
    ok('that row shows the pause glyph', state.glyph === 'pause', state.glyph);
    // Her narration is a bare url on the pad doc with no `seconds` — the row
    // learns its length off the file rather than staying blank forever.
    ok('a row with no recorded length learns one', /^\d+:\d\d$/.test(state.learned), state.learned);

    // A TAP AT THE RIGHT END OF THE STRIP MUST REACH THE STRIP — the pill owns
    // that corner, and elementFromPoint is the only honest way to ask.
    const reach = await pg.evaluate(() => {
      const r = document.querySelector('.auseek').getBoundingClientRect();
      const e = document.elementFromPoint(r.right - 6, r.top + 8);
      return e ? (e.className || e.tagName) : 'none';
    });
    ok('and its far end is reachable, not under the pill', reach === 'auseek', reach);

    // ...and a tap at 80% of the strip really MOVES the recording, which is
    // the whole point of having grown one. Driven as a real pointer at a real
    // coordinate: a click on the ELEMENT lands at its centre and would look
    // the same whatever the arithmetic did with it.
    const moved = await pg.evaluate(async () => {
      const el = document.querySelector('.auseek');
      const r = el.getBoundingClientRect();
      const a = document.querySelector('#audios .auseek i').style.width;
      el.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.8, clientY: r.top + 8, bubbles: true, pointerId: 1 }));
      await new Promise(f => setTimeout(f, 200));
      return { before: parseFloat(a) || 0,
        after: parseFloat(document.querySelector('#audios .auseek i').style.width) || 0 };
    });
    ok('a tap at four fifths along really seeks there',
      moved.after > 70 && moved.after < 90 && moved.after > moved.before,
      JSON.stringify(moved));

    // Playing a DIFFERENT row moves the scrubber with it — one player, one
    // strip, never two rows looking live at once.
    await pg.locator('#audios .aurow').nth(2).locator('.iconbtn').click();
    await pg.waitForTimeout(600);
    const moved2 = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#audios .aurow')];
      return { which: rows.findIndex(r => r.querySelector('.auseek')),
        seeks: document.querySelectorAll('#audios .auseek').length };
    });
    ok('the strip follows the player', moved2.seeks === 1 && moved2.which === 2,
      JSON.stringify(moved2));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await close();
  }

  // ── THE SHAPES MOST OF HER STORIES ACTUALLY ARE ───────────────────────
  console.log('the other shapes, measured against her real spread');
  {
    // ONE recording when the description audio and the voiceover are the same
    // file (a lesson whose source IS her read-aloud) — never the same player
    // twice under two names.
    const a = await story(browser, 'same');
    await a.pg.click('#aboutbtn'); await a.pg.waitForTimeout(300);
    const rows = await a.pg.evaluate(LIST);
    ok('one file, one row', rows.length === 1 && rows[0] === 'Your recording', JSON.stringify(rows));
    // A description that fits gets NO opener — the fold is measured, never
    // counted in characters.
    ok('short words get no opener', !(await a.pg.$('#descbody .moretxt')));
    ok('no page errors', a.errs.length === 0, a.errs.join(' | '));
    await a.close();

    // The commonest shape: recordings and nothing else. It must look exactly
    // as it did before the merge — a bare list, no "Recordings" header over it
    // and no words block at all.
    const b = await story(browser, 'audioonly');
    await b.pg.click('#aboutbtn'); await b.pg.waitForTimeout(300);
    const r2 = await b.pg.evaluate(LIST);
    ok('the list starts bare when none of it is hers',
      r2[0] === AUDIOS[0].title, JSON.stringify(r2.slice(0, 2)));
    ok('no words block', await b.pg.$eval('#descbody', e => e.hidden)
      && await b.pg.$eval('#deschead', e => e.hidden));
    await b.close();

    // Words and no recordings at all — the button still shows, because there
    // is something to read.
    const c = await story(browser, 'textonly');
    ok('a story with only words still has the button', await c.pg.isVisible('#aboutbtn'));
    await c.pg.click('#aboutbtn'); await c.pg.waitForTimeout(300);
    ok('and no rows', (await c.pg.$$('#audios .aurow')).length === 0);
    ok('but the words show', !(await c.pg.$eval('#descbody', e => e.hidden)));
    await c.close();

    // Nothing at all — no button. An empty sheet is a tap that says nothing.
    const d = await story(browser, 'none');
    ok('a story with neither hides the button', !(await d.pg.isVisible('#aboutbtn')));
    // ...and the legend says so once, not twice.
    await d.pg.click('#helpbtn'); await d.pg.waitForTimeout(400);
    const named = await d.pg.$$eval('#helpbody .hrow .hnm', els =>
      els.map(e => e.textContent).filter(t => /about this story|listen/i.test(t)));
    ok('the legend carries one row for it, not two',
      named.length === 1 && named[0] === 'About this story', JSON.stringify(named));
    await d.close();
  }

  // ── ONE FILE, ONE ROW ─────────────────────────────────────────────────
  // 2026-08-26, Sophie: "it looks like I pressed play on one and the other one
  // also started playing". Nothing played twice — her voiceover was ALSO in the
  // attached list (11 of her 67 stories, measured live), so two rows carried
  // one url and a single playback lit both.
  console.log('one file is one row, however many fields point at it');
  {
    const { pg, errs, close } = await story(browser, 'dupe');
    await pg.click('#aboutbtn');
    await pg.waitForTimeout(400);
    const rows = await pg.evaluate(LIST);
    ok('the file she narrated appears once',
      (await pg.$$('#audios .aurow')).length === AUDIOS.length, JSON.stringify(rows));
    ok('and it keeps the memo\'s own name', rows[0] === AUDIOS[0].title, rows[0]);
    ok('with her role beside the date, not instead of it',
      /2026-07-09/.test(await pg.$eval('#audios .aurow .audate', e => e.textContent))
      && /Your narration/.test(await pg.$eval('#audios .aurow .audate', e => e.textContent)),
      await pg.$eval('#audios .aurow .audate', e => e.textContent));
    ok('every row has its own url',
      await pg.$$eval('#audios .aurow', els => new Set(els.map(e => e._url)).size === els.length));

    // The bug as she saw it: play one, and count what looks live.
    await pg.locator('#audios .aurow').first().locator('.iconbtn').click();
    await pg.waitForTimeout(700);
    const live = await pg.$$eval('#audios .aurow', els => ({
      pausing: els.filter(e => e.querySelector('.iconbtn svg rect')).length,
      seeks: els.filter(e => e.querySelector('.auseek')).length,
    }));
    ok('exactly one row reads as playing', live.pausing === 1 && live.seeks === 1,
      JSON.stringify(live));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await close();
  }

  // ── IT STOPS WHEN SHE LEAVES ──────────────────────────────────────────
  // 2026-08-26, Sophie: "it keeps playing even if I leave the storage room even
  // if I leave the app that's a problem". The player is a detached Audio() that
  // nothing was ever asked to stop.
  console.log('the recording stops when she leaves');
  {
    const { pg, errs, close } = await story(browser, 'audioonly');
    const playing = () => pg.evaluate(() => {
      const a = [...document.querySelectorAll('audio')];
      return { any: a.some(e => !e.paused), n: a.length };
    });
    async function start() {
      await pg.click('#aboutbtn'); await pg.waitForTimeout(250);
      await pg.locator('#audios .aurow').first().locator('.iconbtn').click();
      await pg.waitForTimeout(500);
      return (await pg.$$eval('#audios .aurow', els =>
        els.some(e => e.querySelector('.auseek'))));
    }
    ok('a recording starts', await start());

    // Closing the SHEET is deliberately not leaving — that rule predates this
    // and she has not asked to change it: a recording is meant to keep going
    // while she reads the beats it became.
    await pg.click('#auclose'); await pg.waitForTimeout(300);
    ok('closing the sheet leaves it playing', (await pg.evaluate(
      () => !document.querySelector('#audios .aurow .auseek') ? 'gone' : 'live')) === 'live');

    // Leaving the STORY does stop it.
    await pg.evaluate(() => window.__navBack());
    await pg.waitForTimeout(400);
    ok('stepping up to the shelf stops it', !(await pg.evaluate(
      () => [...document.querySelectorAll('audio')].some(e => !e.paused))));

    // ...and so does the app going away. The page cannot see the app's tab
    // bar, so the honest test is the event iOS actually sends.
    await pg.click('.stile'); await pg.waitForTimeout(600);
    ok('a recording starts again', await start());
    await pg.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await pg.waitForTimeout(300);
    ok('the app going to the background stops it', !(await pg.evaluate(
      () => [...document.querySelectorAll('audio')].some(e => !e.paused))));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await close();
  }

  // ── READING THE WORDS ─────────────────────────────────────────────────
  // 2026-08-26, Sophie: "there should be a button where I can read the
  // transcription."
  console.log('a row opens its own words');
  {
    const { pg, errs, close } = await story(browser, 'full');
    await pg.click('#aboutbtn');
    await pg.waitForTimeout(400);

    const where = await pg.$$eval('#audios .aurow', els => els.map(e =>
      Boolean(e.querySelector('.aureadbtn'))));
    // Her narration carries its own text on the pad doc; the memo is fetched;
    // the episode has no transcript on file and shows no way in; and her
    // description recording's words are already on screen as "What you said",
    // so a second copy under the row would be the same answer twice.
    ok('only the rows with words to show offer it',
      JSON.stringify(where) === JSON.stringify([false, true, true, false, false]),
      JSON.stringify(where));

    // HER NARRATION — no request at all, the words ride the pad doc.
    let calls = 0;
    pg.on('request', r => { if (/\/transcript\//.test(r.url())) calls++; });
    await pg.locator('#audios .aurow').nth(1).locator('.aureadbtn').click();
    await pg.waitForTimeout(300);
    const vo = await pg.evaluate(() => {
      const b = document.querySelector('#audios .autext:not([hidden])');
      return b ? { text: b.textContent.slice(0, 30), folded: b.classList.contains('clamp'),
        h: Math.round(b.getBoundingClientRect().height),
        opener: b.querySelector('.moretxt') ? b.querySelector('.moretxt').textContent : null } : null;
    });
    ok('her narration opens with no request', calls === 0, calls + ' requests');
    ok('and its words are there', vo && /the narration/.test(vo.text), JSON.stringify(vo));
    ok('folded, with the house opener', vo && vo.folded && vo.opener === '… more'
      && vo.h > 0 && vo.h < 200, JSON.stringify(vo));
    ok('the word became "hide"',
      (await pg.$$eval('#audios .aureadbtn', e => e[0].textContent)) === 'hide');
    await pg.locator('#audios .aurow').nth(1).locator('.aureadbtn').click();
    await pg.waitForTimeout(200);
    ok('tapping it again puts them away',
      await pg.$eval('#audios .autext', e => e.hidden));

    // A MEMO — one request, then cached on the row.
    await pg.locator('#audios .aurow').nth(2).locator('.aureadbtn').click();
    await pg.waitForTimeout(600);
    ok('a memo is fetched once', calls === 1, calls + ' requests');
    ok('and its words open',
      /that is the thing I was saying/.test(
        await pg.$$eval('#audios .autext', els =>
          els.map(e => e.hidden ? '' : e.textContent).join(''))));
    await pg.locator('#audios .aurow').nth(2).locator('.aureadbtn').click();
    await pg.waitForTimeout(150);
    await pg.locator('#audios .aurow').nth(2).locator('.aureadbtn').click();
    await pg.waitForTimeout(300);
    ok('re-opening it asks nothing again', calls === 1, calls + ' requests');
    // SIX CLEAN LINES — a seventh bleeding under the fold is what the box's
    // own bottom padding does if the clamp does not zero it.
    ok('the fold shows whole lines only', await pg.evaluate(() => {
      const b = document.querySelector('#audios .autext:not([hidden])');
      const cs = getComputedStyle(b);
      const lh = parseFloat(cs.lineHeight);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      // The box's own bottom padding lets a SEVENTH line bleed under the fold
      // unless the clamp zeroes it — six clean lines is the whole point.
      return Math.abs((b.getBoundingClientRect().height - pad) / lh - 6) < 0.05;
    }));
    if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT });
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
