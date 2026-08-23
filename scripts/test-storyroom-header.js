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

   Three states have to hold, because the two halves ship at different times —
   the page with a deploy, the Swift half with a TestFlight build:

     • WEB (no bridge, no native bar): the page's own name shows, the shelf
       door sits at the RIGHT of the header, every sheet opens with a back
       chevron at the left and its name centred.
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
  { id: 'a', title: 'Evan', beats: 12, category: 'personal', cover: '' },
  { id: 'b', title: 'Moon milk', beats: 8, category: 'personal', cover: '' },
]};
const PAD = { pad: { id: 'a', title: 'Evan', beats: [], category: 'personal' } };

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

/** Every header row this page draws: the page's own, and each sheet's. */
const HEADS = [
  ['the page', 'header', null],
  ['the shelf', '#stories .sheethead', '#storiesbtn'],
  ['the inbox', '#inbox .sheethead', '#inboxbtn'],
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

  // ── THE SHELF SAYS WHAT IT IS ──────────────────────────────────────────
  console.log('the shelf has a normal header');
  {
    const { ctx, pg } = await open('web');
    await pg.click('#storiesbtn');
    await pg.waitForTimeout(400);
    const name = (await pg.textContent('#stories .sheethead > .no') || '').trim();
    ok('it is named "The shelf"', name === 'The shelf', JSON.stringify(name));
    ok('the shelf is open', await pg.isVisible('#stories'));

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

    // ...and it takes her back to the story she was on, which is what the ✕
    // did. The chevron is the glyph, not a new destination.
    await pg.click('#storiesclose');
    await pg.waitForTimeout(300);
    ok('back closes the shelf', !(await pg.isVisible('#stories')));
    await ctx.close();
  }

  // ── ONE SHAPE, EVERY ROW ───────────────────────────────────────────────
  console.log('the pattern is the same in every row');
  {
    const { ctx, pg } = await open('new');
    for (const [label, sel, opener] of HEADS) {
      if (opener) { await pg.click(opener); await pg.waitForTimeout(350); }
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
        };
      });
      ok(label + ': the row is a flex row', shape.flex === 'flex', shape.flex);
      ok(label + ': it carries a name', shape.named);
      ok(label + ': the name is centred absolutely', shape.nameAbs === 'absolute');
      ok(label + ': a button leads the row', shape.firstIsButton);
      ok(label + ': that button is at the left', shape.firstLeft >= 0 && shape.firstLeft < 40,
        'left ' + shape.firstLeft);
      if (opener) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); }
      // the sheets stack, so close by their own control rather than by Escape
      const closeBtn = await pg.$(sel + ' > button');
      if (opener && closeBtn && await closeBtn.isVisible()) {
        await closeBtn.click(); await pg.waitForTimeout(250);
      }
    }
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
      // and it must be the only chevron on screen: the page's own back
      // control is the shelf door, which lives at the far right of the row as
      // an ACTION. "The right" is the row's own content edge, NOT the screen's
      // — the row reserves 56px for the injected pill's corner, so the door
      // stops short of the glass by design.
      const gap = await pg.$eval('#storiesbtn', el => {
        const row = el.parentElement.getBoundingClientRect();
        const cs = getComputedStyle(el.parentElement);
        return row.right - parseFloat(cs.paddingRight) - el.getBoundingClientRect().right;
      });
      ok(state + ': the shelf door hugs the right of the row', Math.abs(gap) < 2,
        'gap ' + Math.round(gap));
    }
    await ctx.close();
  }

  // ── THE CHEVRON WALKS THE PAGE'S OWN LEVELS FIRST ──────────────────────
  // The whole reason the header moved off Apple's bar: __navBack steps the
  // shelf shut before anything leaves the tool.
  console.log('the chevron asks the page first');
  {
    const { ctx, pg } = await open('new');
    await pg.click('#storiesbtn');
    await pg.waitForTimeout(400);
    const stepped = await pg.evaluate(() => window.__navBack());
    ok('__navBack closes the shelf rather than leaving', stepped === true);
    ok('the shelf really shut', !(await pg.isVisible('#stories')));
    const outOf = await pg.evaluate(() => window.__navBack());
    ok('a bare pad hands back to the app', outOf === false);
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
