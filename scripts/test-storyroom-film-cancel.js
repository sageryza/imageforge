#!/usr/bin/env node
/* THE FILM BUTTON CANCELS, AND THE "?" SAYS WHAT EVERY BUTTON DOES
   (Aug 2026, Sophie: "add a cancel button to the play which makes the film
   button in story room" · "also add an info icon that says what all the
   buttons do").

   Two halves, and each is a MEASUREMENT rather than a look:

   • THE CANCEL. The play button is one control with two states, because the
     title row already carries six 34px icons on a 390pt phone and a seventh
     would squeeze the story's name to nothing. So the honest questions are:
     does the glyph actually change while a render is running, does the tap
     POST /film/cancel, does the button come back as PLAY, and — the one that
     bit in design — can a poll answer that is already IN FLIGHT when she
     cancels paint 'making' back over it with no timer left to correct it.
     A wrong answer to the last one is a render she stopped, stuck on screen
     forever, and it is invisible to any assertion that only looks once.

   • THE LEGEND. Every row's glyph is CLONED from the real control, so the
     test asks whether the drawings MATCH the page's own buttons — a
     hand-copied icon would pass a "there is an svg here" check and drift the
     first time one changed. It also asks that the play row's glyph follows
     the button's live state, since the list is built on the tap.

   Run: node scripts/test-storyroom-film-cancel.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('storyroom-film-cancel: playwright not installed — skipped');
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

/* One story with one drawn beat — enough for the play button to show, which
   is all this test needs on the pad itself. */
const PADS = { pads: [{ id: 'a', title: 'Evan', beats: 1, category: null, cover: '' }] };
const BEAT = { id: 'b1', text: 'the first beat', url: 'https://example.invalid/a.png' };

/* The server's film state, driven by the test. `state.film` is what GET /
   answers with, so the page's poll sees whatever the case sets up. */
const state = { film: null, cancels: 0, holdGet: null };

function serve() {
  return http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/scratchpad/film/cancel') {
      state.cancels++;
      state.film = { status: 'canceled', at: Date.now() };
      return json({ ok: true, status: 'canceled', running: true });
    }
    if (u.pathname === '/api/scratchpad/film') {
      state.film = { status: 'making', at: Date.now(), progress: '' };
      return json({ ok: true, status: 'making' });
    }
    if (u.pathname.startsWith('/api/scratchpad/pads')) return json(PADS);
    if (u.pathname === '/api/scratchpad' || u.pathname === '/api/scratchpad/') {
      const body = { pad: { id: 'a' }, title: 'Evan', beats: [BEAT], style: 'watercolor',
        film: state.film, updatedAt: 1000, uploads: [], audios: [] };
      // A held GET is how the in-flight-poll case is built: the answer is
      // parked, the cancel happens, and only then is the stale answer let go.
      if (state.holdGet) { state.holdGet(() => json(body)); state.holdGet = null; return; }
      return json(body);
    }
    if (u.pathname.startsWith('/api/')) return json({});
    const rel = u.pathname === '/' ? 'scratchpad.html' : u.pathname.replace(/^\//, '');
    const f = path.join(PUB, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    const ext = path.extname(f);
    res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(f));
  });
}

/** Which glyph the play button is wearing, by its path data rather than by
 *  any class the page might set: the play triangle is one filled path, the
 *  stop mark is the two crossed strokes. */
const glyphOf = (html) => (/M6 4\.5v15l13-7\.5z/.test(html) ? 'play'
  : /M18 6 6 18/.test(html) ? 'stop' : 'other');

(async () => {
  const srv = serve();
  await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: exe() });

  async function openStory() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await pg.goto(base + '/scratchpad.html');
    await pg.waitForTimeout(400);
    await pg.click('.stile');
    await pg.waitForTimeout(400);
    return { ctx, pg };
  }

  // ── THE FILM BUTTON CANCELS ────────────────────────────────────────────
  console.log('the play button becomes the cancel while it is making');
  {
    state.film = null; state.cancels = 0;
    const { ctx, pg } = await openStory();

    ok('the play button is there', await pg.isVisible('#playbtn'));
    ok('it starts as PLAY', glyphOf(await pg.innerHTML('#playbtn')) === 'play');

    await pg.click('#playbtn');
    await pg.waitForTimeout(250);
    ok('tapping it starts the render', state.film && state.film.status === 'making');
    ok('and the button turns into the stop mark',
      glyphOf(await pg.innerHTML('#playbtn')) === 'stop');
    // The old build greyed it out for the whole render — a dead control.
    ok('it is not disabled while making', !(await pg.$eval('#playbtn', el => el.disabled)));
    // Measured off the COMPUTED value, not the inline string: the old page
    // set `.45` and the browser reports `0.45`, so a string compare against
    // the literal passed while the button was visibly faded.
    ok('and not greyed out',
      Number(await pg.$eval('#playbtn', el => getComputedStyle(el).opacity)) === 1,
      await pg.$eval('#playbtn', el => getComputedStyle(el).opacity));
    ok('the line says it is making', /making the film/.test(await pg.textContent('#filmnote')));

    await pg.click('#playbtn');
    await pg.waitForTimeout(250);
    ok('tapping it again cancels the render', state.cancels === 1, 'cancels=' + state.cancels);
    ok('the button goes back to PLAY at once',
      glyphOf(await pg.innerHTML('#playbtn')) === 'play');
    ok('and the line says it stopped', /stopped/.test(await pg.textContent('#filmnote')));
    await ctx.close();
  }

  // ── A POLL IN FLIGHT WHEN SHE CANCELS IS DROPPED ───────────────────────
  // The whole failure mode: the server has not written 'canceled' yet, so the
  // parked answer still says 'making'. Landing it would repaint the ✕ with no
  // timer left to correct it — the render she stopped, stuck forever.
  console.log('a poll already in flight cannot un-cancel it');
  {
    state.film = null; state.cancels = 0;
    const { ctx, pg } = await openStory();
    await pg.click('#playbtn');
    await pg.waitForTimeout(250);

    // Park the next poll's answer, let the poll fire, then cancel underneath it.
    let release = null;
    state.holdGet = (send) => { release = send; };
    await pg.waitForTimeout(5200);           // the poll interval
    ok('a poll went out and is parked', typeof release === 'function');

    await pg.click('#playbtn');              // cancel while it is parked
    await pg.waitForTimeout(200);
    state.film = { status: 'making', at: Date.now(), progress: 'picture 2' };  // the stale truth
    if (release) release();
    await pg.waitForTimeout(600);

    ok('the stale answer did not bring the ✕ back',
      glyphOf(await pg.innerHTML('#playbtn')) === 'play',
      await pg.innerHTML('#playbtn'));
    ok('and the line still says it stopped', /stopped/.test(await pg.textContent('#filmnote')));
    await ctx.close();
  }

  // ── THE "?" SAYS WHAT EVERY BUTTON DOES ────────────────────────────────
  console.log('the info icon opens a legend of the page\'s own buttons');
  {
    state.film = null;
    const { ctx, pg } = await openStory();

    ok('the "?" is on the name row', await pg.isVisible('#helpbtn'));
    // It must be REACHABLE — the injected pill owns the top-right corner, and
    // "visible" says nothing about what a tap actually lands on.
    const reached = await pg.$eval('#helpbtn', (el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(hit && (hit === el || el.contains(hit)));
    });
    ok('a tap at its centre reaches it', reached);

    await pg.click('#helpbtn');
    await pg.waitForTimeout(250);
    ok('the sheet opens', await pg.isVisible('#helpsheet'));
    ok('it is named', (await pg.textContent('#helpsheet .no') || '').trim() === 'What the buttons do');

    const rows = await pg.$$eval('#helpbody .hrow', els => els.map(e => ({
      nm: (e.querySelector('.hnm') || {}).textContent || '',
      what: (e.querySelector('.hwhat') || {}).textContent || '',
      glyph: (e.querySelector('.iconbtn') || {}).innerHTML || '',
    })));
    ok('every button on the title row has a row', rows.length >= 8, rows.length + ' rows');
    ok('every row says what it does', rows.every(r => r.what.length > 10));

    // THE CLONE RULE: the legend's drawings ARE the page's buttons. A second
    // hand-drawn copy would pass a "there is an svg" check and drift silently.
    for (const sel of ['#aboutbtn', '#drawallbtn', '#addbtn', '#inboxbtn', '#delbtn', '#micbtn']) {
      const real = (await pg.innerHTML(sel)).trim();
      ok('the legend draws the real ' + sel, rows.some(r => r.glyph.trim() === real));
    }

    // The list is built on the TAP, so the play row follows the live state.
    const playRow = rows.find(r => /Play the film/.test(r.nm));
    ok('the play row exists', Boolean(playRow));
    ok('and it shows PLAY while nothing is rendering', playRow && glyphOf(playRow.glyph) === 'play');
    ok('its line mentions the ✕ that stops it', playRow && /stops it/.test(playRow.what));

    // Back is a chevron, never an ✕ — the page's own header rule.
    ok('the sheet head has a back chevron', /m15 18-6-6 6-6/.test(await pg.innerHTML('#helpclose')));
    ok('and draws no ✕', !/M18 6 6 18/.test(await pg.innerHTML('#helpclose')));

    // __navBack closes it before it reaches the shelf.
    const back = await pg.evaluate(() => window.__navBack());
    ok('__navBack closes the sheet rather than leaving', back === true);
    await pg.waitForTimeout(150);
    ok('the sheet is closed', !(await pg.isVisible('#helpsheet')));
    ok('and the story is still there, not the shelf', !(await pg.isVisible('#stories')));

    await pg.click('#playbtn');
    await pg.waitForTimeout(250);
    await pg.click('#helpbtn');
    await pg.waitForTimeout(250);
    const live = await pg.$$eval('#helpbody .hrow', els => els.map(e => ({
      nm: (e.querySelector('.hnm') || {}).textContent || '',
      glyph: (e.querySelector('.iconbtn') || {}).innerHTML || '',
    })));
    const liveRow = live.find(r => /Play the film/.test(r.nm));
    ok('opened mid-render it shows the stop mark instead',
      liveRow && glyphOf(liveRow.glyph) === 'stop');
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
