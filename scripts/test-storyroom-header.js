#!/usr/bin/env node
/* THE STORY ROOM OWNS ITS HEADER, AND THE SHELF HAS A BACK BUTTON — headless,
   against the real public/scratchpad.html and the real public/pagehead.js
   (Aug 2026, Sophie: "I made the impression that we had gotten rid of the
   Apple native header, but I think story room still has it cause there's a
   back Chevron … right now in the story room when I go to the shelf, there's
   like an X to get out of it and a weird icon. I just want it to be a back
   button and no X … the header should be like normal it should say the shelf
   just like all the other pages have a header at the top. Make sure the
   pattern is consistent everywhere").

   AND THE SHELF IS THE ROOM (2026-08-23, Sophie: "the story room architecture
   is backwards. the shelf is the main room. the back button goes to the shelf.
   story room opens on the shelf. we don't need a separate shelf button. the
   back button IS the shelf button"). So there is no door to tap any more, the
   page opens on the shelf, and __navBack runs the other way round: a bare
   story steps UP to the shelf, and the shelf is where the app leaves.

   Three states have to hold, because the two halves ship at different times —
   the page with a deploy, the Swift half with a TestFlight build:

     • WEB (no bridge, no native bar): the page's own name shows, and because
       nothing injects a chevron the page draws its own so a story is never a
       dead end; every sheet opens with a back chevron at the left and its
       name centred.
     • OLD BUILD (window.__nativeNavBar, no __forgeLeave): Apple's bar is
       still there and still says STORY ROOM, so the page's own name stays
       hidden — never two titles.
     • NEW BUILD (the bridge injected): pagehead.js draws the chevron into the
       page's own header row and the name comes back.

   And in every state: NO ✕ anywhere in this page's chrome, and every header
   row — the page's and all four sheets' — is the same shape.

   Run: node scripts/test-storyroom-header.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('storyroom-header: playwright not installed — skipped');
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

/* The pad the page loads, and the shelf behind the door. Enough shape for the
   header to draw; the beats themselves are not what this test is about. */
const PADS = { pads: [
  { id: 'a', title: 'Evan', beats: 12, category: null, cover: '' },
  { id: 'b', title: 'Moon milk', beats: 8, category: null, cover: '' },
]};
const PAD = { pad: { id: 'a', title: 'Evan', beats: [], category: null } };

/* Serve public/ the way serveGated does — the page PLUS the pagehead.js tag
   the server appends to every gated page. Reading the real files is the
   point: a hand-copied page would pass this while the shipped one broke. */
function serve() {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/scratchpad/pads')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(PADS));
    }
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(u.pathname.startsWith('/api/scratchpad') ? PAD : {}));
    }
    const rel = u.pathname === '/' ? 'scratchpad.html' : u.pathname.replace(/^\//, '');
    const f = path.join(PUB, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    let body = fs.readFileSync(f);
    if (rel === 'scratchpad.html') {
      body = body.toString() + '\n<script src="/pagehead.js" defer></script>';
    }
    const ext = path.extname(f);
    res.writeHead(200, {
      'content-type': ext === '.js' ? 'text/javascript'
        : ext === '.css' ? 'text/css' : 'text/html; charset=utf-8',
    });
    res.end(body);
  });
}

/** Every header row this page draws, in the order she walks them: the shelf
 *  she opens on, the story below it, and a sheet inside that story. `reach`
 *  is cumulative — each step starts from where the one before it left her. */
const HEADS = [
  ['the shelf', '#stories .sheethead', null],
  ['the page', 'header', async (pg) => { await pg.click('.stile'); }],
  ['the inbox', '#inbox .sheethead', async (pg) => { await pg.click('#inboxbtn'); }],
];

(async () => {
  const srv = serve();
  await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: exe() });

  /** Open the page in one of the three states. */
  async function open(state) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    if (state !== 'web') {
      const bridge = state === 'new';
      await pg.addInitScript(`window.__nativeNavBar = true;
        ${bridge ? 'window.__forgeLeave = function () { window.__left = true; };' : ''}`);
    }
    await pg.goto(base + '/scratchpad.html');
    await pg.waitForTimeout(500);
    return { ctx, pg };
  }

  // ── NO ✕ ANYWHERE, in any state ────────────────────────────────────────
  // Her ask is literal: "I just want it to be a back button and no X". The
  // ✕ is an SVG path, so the honest question is whether the page's markup
  // still carries the two crossed strokes — not whether a button is labelled
  // "Close".
  console.log('the ✕ is gone from the page\'s chrome');
  {
    const html = fs.readFileSync(path.join(PUB, 'scratchpad.html'), 'utf8');
    const heads = html.match(/<div class="sheethead">[\s\S]*?<\/div>\s*\n/g) || [];
    ok('every sheet head exists', heads.length >= 3, 'found ' + heads.length);
    const withX = heads.filter(h => /M18 6 6 18/.test(h));
    ok('no sheet head draws an ✕', withX.length === 0, withX.length + ' still do');
    const withChev = heads.filter(h => /m15 18-6-6 6-6/.test(h));
    ok('every sheet head draws the back chevron',
      withChev.length === heads.length, withChev.length + ' of ' + heads.length);
  }

  // ── THE SHELF SAYS WHAT IT IS, AND IT IS WHERE THE PAGE OPENS ──────────
  console.log('the shelf has a normal header, and the room opens on it');
  {
    const { ctx, pg } = await open('new');
    const name = (await pg.textContent('#stories .sheethead > .no') || '').trim();
    ok('it is named "The shelf"', name === 'The shelf', JSON.stringify(name));
    ok('the page opens on it, with no door to tap', await pg.isVisible('#stories'));
    ok('the separate shelf door is gone', !(await pg.$('#storiesbtn')));

    // Centred on the SCREEN, not on the leftover flex space — the reason the
    // rule is absolute rather than flex:1 (the pill owns the right 56px).
    const box = await pg.$eval('#stories .sheethead > .no', el => {
      const r = el.getBoundingClientRect();
      return { mid: r.left + r.width / 2, cs: getComputedStyle(el).position };
    });
    ok('the name is centred absolutely', box.cs === 'absolute', box.cs);
    ok('centred on the screen', Math.abs(box.mid - 195) < 2, 'mid ' + Math.round(box.mid));

    // The back control is at the LEFT, and it is the first thing in the row.
    const left = await pg.$eval('#storiesclose', el => el.getBoundingClientRect().left);
    ok('the back chevron is at the left', left < 40, 'left ' + Math.round(left));
    ok('it is labelled Back',
      (await pg.getAttribute('#storiesclose', 'aria-label')) === 'Back');

    // ...and because nothing is behind the shelf any more, it leaves the tool
    // rather than dropping onto a story. That is the whole inversion: it used
    // to close onto the pad, which is what made the pad read as the room.
    await pg.click('#storiesclose');
    await pg.waitForTimeout(300);
    ok('back off the shelf leaves the tool', await pg.evaluate(() => window.__left === true));
    ok('it does not drop onto a story', await pg.isVisible('#stories'));
    await ctx.close();
  }

  // ── ONE SHAPE, EVERY ROW ───────────────────────────────────────────────
  console.log('the pattern is the same in every row');
  {
    const { ctx, pg } = await open('new');
    await pg.waitForSelector('.stile');
    const rows = [];
    for (const [label, sel, reach] of HEADS) {
      if (reach) { await reach(pg); await pg.waitForTimeout(400); }
      const shape = await pg.$eval(sel, el => {
        const cs = getComputedStyle(el);
        const name = el.querySelector(':scope > .no');
        const first = el.firstElementChild;
        return {
          flex: cs.display,
          named: Boolean(name),
          nameAbs: name ? getComputedStyle(name).position : null,
          firstIsButton: Boolean(first && first.tagName === 'BUTTON'),
          firstLeft: first ? Math.round(first.getBoundingClientRect().left) : -1,
          rowTop: Math.round(el.getBoundingClientRect().top),
        };
      });
      rows.push([label, shape]);
      ok(label + ': the row is a flex row', shape.flex === 'flex', shape.flex);
      ok(label + ': it carries a name', shape.named);
      ok(label + ': the name is centred absolutely', shape.nameAbs === 'absolute');
      ok(label + ': a button leads the row', shape.firstIsButton);
      ok(label + ': that button is at the left', shape.firstLeft >= 0 && shape.firstLeft < 40,
        'left ' + shape.firstLeft);
    }
    /* THE SAME ROW, IN THE SAME PLACE, ON EVERY SURFACE (2026-08-23, Sophie's
       two screenshots: "the header is different in both, and not at the
       top"). Measured before the fix: the page's row started at y=8 and the
       shelf's at y=25 (a flat `3vh` on `.sheet .wrap` that also ignored the
       safe area), and the chevron sat at x=16 where pagehead drew it against
       x=20 where the page drew its own. Both are MEASUREMENTS — a row that is
       17px lower is perfectly valid markup and looks fine on its own screen;
       it only reads as wrong beside the one it is supposed to match. */
    const tops = rows.map(([, r]) => r.rowTop);
    const lefts = rows.map(([, r]) => r.firstLeft);
    ok('every row starts at the same height',
      Math.max(...tops) - Math.min(...tops) === 0,
      rows.map(([l, r]) => l + ' ' + r.rowTop).join(' · '));
    ok('every leading chevron starts at the same x',
      Math.max(...lefts) - Math.min(...lefts) === 0,
      rows.map(([l, r]) => l + ' ' + r.firstLeft).join(' · '));
    ok('and the row is at the TOP of the screen', Math.max(...tops) <= 8,
      'top ' + Math.max(...tops));
    await ctx.close();
  }

  // ── THE THREE STATES ───────────────────────────────────────────────────
  console.log('the page\'s own name, in all three states');
  for (const [state, wantChevron, wantName] of
       [['web', false, true], ['old', false, false], ['new', true, true]]) {
    const { ctx, pg } = await open(state);
    const drawn = await pg.$('#forgeback');
    ok(state + ': pagehead ' + (wantChevron ? 'draws' : 'draws no') + ' chevron',
      Boolean(drawn) === wantChevron);
    const shown = await pg.$eval('header > .no',
      el => getComputedStyle(el).display !== 'none');
    ok(state + ': the page\'s name is ' + (wantName ? 'shown' : 'hidden'),
      shown === wantName);
    if (wantChevron) {
      // it must sit BEFORE the name, at the left — the house position
      const l = await pg.$eval('#forgeback', el => el.getBoundingClientRect().left);
      ok(state + ': the chevron is at the left', l < 40, 'left ' + Math.round(l));
    }
    // ...and on a STORY there must be exactly ONE chevron. The page draws its
    // own (#shelfback, the way back up to the shelf) for a plain browser,
    // where nothing is injected — so under either app build it stands down,
    // or a story wears two identical chevrons side by side.
    await pg.waitForSelector('.stile');
    await pg.click('.stile');
    await pg.waitForTimeout(400);
    const mine = await pg.$eval('#shelfback',
      el => getComputedStyle(el).display !== 'none');
    ok(state + ": on a story the page's own chevron is "
       + (state === 'web' ? 'the one there is' : 'stood down'),
      mine === (state === 'web'), 'drawn: ' + mine);
    ok(state + ': exactly one chevron on the row',
      (mine ? 1 : 0) + (drawn ? 1 : 0) === (state === 'old' ? 0 : 1));
    await ctx.close();
  }

  // ── THE BACK BUTTON IS THE SHELF BUTTON ────────────────────────────────
  // The inversion, asserted as the walk itself: a story steps UP to the shelf
  // and the shelf is the floor. Before this it ran the other way — the shelf
  // closed onto a story, and the story was what handed back to the app, which
  // is what made the pad read as the room.
  console.log('the back button is the shelf button');
  {
    const { ctx, pg } = await open('new');
    await pg.waitForSelector('.stile');
    await pg.click('.stile');
    await pg.waitForTimeout(400);
    ok('a tile opens that story', !(await pg.isVisible('#stories')));
    const stepped = await pg.evaluate(() => window.__navBack());
    ok('__navBack on a story opens the shelf rather than leaving', stepped === true);
    ok('the shelf really came back', await pg.isVisible('#stories'));
    const outOf = await pg.evaluate(() => window.__navBack());
    ok('the shelf hands back to the app', outOf === false);
    ok('and it stays on screen while the app leaves', await pg.isVisible('#stories'));
    await ctx.close();
  }
  {
    // ...and the same walk by TAP in a plain browser, where the only chevron
    // is the one the page drew for itself.
    const { ctx, pg } = await open('web');
    await pg.waitForSelector('.stile');
    await pg.click('.stile');
    await pg.waitForTimeout(400);
    ok('web: the page draws its own way back', await pg.isVisible('#shelfback'));
    await pg.click('#shelfback');
    await pg.waitForTimeout(400);
    ok('web: tapping it returns to the shelf', await pg.isVisible('#stories'));
    ok('web: and it stands down once she is there',
      !(await pg.isVisible('#shelfback')));
    await ctx.close();
  }

  // ── THE TOP STAYS PUT, AND THE NAME HAS A LINE TO ITSELF ───────────────
  // 2026-08-26, Sophie: "header layout sucks. back button not sticky. title
  // too crowded." Both halves are MEASUREMENTS, because both looked fine in
  // markup: only `.titlerow` was sticky, so the row carrying the way out
  // scrolled off a long story; and the name shared its line with six 34px
  // buttons, which at 390pt left it about 2px and wrapped it one LETTER to a
  // line — a tall column down the left of her screenshot.
  console.log('the top stays put, and the name has a line to itself');
  for (const state of ['web', 'new']) {
    const { ctx, pg } = await open(state);
    await pg.waitForSelector('.stile');
    await pg.click('.stile');
    await pg.waitForTimeout(400);
    await pg.evaluate(() => {
      const t = document.getElementById('title');
      t.textContent = 'Evan — the shape';
      t.classList.remove('blank');
      // every button, including the ones a bare story hides
      document.querySelectorAll('.iconrow .iconbtn').forEach(b => { b.hidden = false; });
    });
    await pg.waitForTimeout(200);

    // the name is alone on its row and takes the width — never a narrow column
    const name = await pg.$eval('#title', el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height),
        line: parseFloat(cs.lineHeight) || 0 };
    });
    ok(state + ': the name has the row to itself', name.w > 240, 'width ' + name.w);
    ok(state + ': and it is not wrapped into a column',
      name.line > 0 && name.h < name.line * 2.5, 'height ' + name.h);

    // the six buttons still share ONE line, clear of the pill's 56px column
    const btns = await pg.$$eval('.iconrow .iconbtn', els => els
      .filter(e => e.offsetParent)
      .map(e => { const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), right: Math.round(r.right) }; }));
    // NOTHING COUNTS THE BUTTONS (2026-08-26 — two of them became one when
    // the description and the recordings moved behind a single button, and a
    // hardcoded 6 here is exactly the edit that claim exists to prevent). The
    // question is whether however many the page has share a line.
    ok(state + ': every button is on one line',
      btns.length > 1 && new Set(btns.map(b => b.top)).size === 1,
      btns.length + ' buttons, ' + new Set(btns.map(b => b.top)).size + ' rows');
    ok(state + ': and none of them reaches the pill\'s column',
      Math.max(...btns.map(b => b.right)) <= 326,
      'right ' + Math.max(...btns.map(b => b.right)));

    // ...and the way out is still on screen a long way down the story
    await pg.evaluate(() => window.scrollTo(0, 900));
    await pg.waitForTimeout(300);
    const id = state === 'web' ? 'shelfback' : 'forgeback';
    const back = await pg.$eval('#' + id, el => {
      const r = el.getBoundingClientRect();
      // elementFromPoint is the only honest question: a sticky row can be on
      // screen and still be under the beats it is meant to sit over.
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const btn = hit && hit.closest('button');
      return { top: Math.round(r.top), reaches: btn ? btn.id : (hit && hit.tagName) };
    });
    ok(state + ': the back chevron is still on screen after scrolling',
      back.top >= 0 && back.top < 60, 'top ' + back.top);
    ok(state + ': and a tap there reaches it', back.reaches === id, back.reaches);
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
