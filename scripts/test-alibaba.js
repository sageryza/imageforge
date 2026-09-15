#!/usr/bin/env node
/*
 * test-alibaba.js — /alibaba, the fictional Alibaba chat prop (2026-09-15).
 *
 * Sophie sent the tool she had built elsewhere and then two REAL screenshots
 * of the app itself, so the thing being pinned here is FIDELITY: the export is
 * the size the phone really writes, the thread is scrolled to the newest
 * message the way a real one is, and the buttons above the keyboard really run
 * off the right edge.
 *
 * Every assertion below is a MEASUREMENT off the rendered canvas rather than a
 * source check, because the failures this page can have all look fine in the
 * source: a paragraph parser that silently makes four bubbles out of one
 * message, a thread anchored to the top leaving half a screen of empty grey, a
 * glyph whose path data draws a hook instead of a phone. The one that bit for
 * real was the last: the first cut's hand-laid video-call icon read as a
 * stray hook and only the photo showed it.
 *
 *   node scripts/test-alibaba.js
 *   (needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('alibaba: skipped (no playwright)'); process.exit(0); }

function exe() {
  let kids = [];
  try { kids = fs.readdirSync('/opt/pw-browsers'); } catch (e) { return null; }
  for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(name + '\n    want ' + JSON.stringify(want) + '\n    got  ' + JSON.stringify(got));
}
function ok(name, cond) { is(name, Boolean(cond), true); }
function near(name, got, want, tol) {
  if (Math.abs(got - want) <= tol) { pass++; return; }
  fails.push(name + '\n    want ' + want + ' ±' + tol + '\n    got  ' + got);
}

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'alibaba.html'), 'utf8');

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const u = req.url.split('?')[0];
    if (u === '/alibaba' || u === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(HTML);
    }
    res.writeHead(204); res.end();
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(base + '/alibaba', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__alibaba);

  is('no page errors', errors, []);

  /* ── the script parser ───────────────────────────────────────────────────
     A blank line INSIDE a message is a paragraph, not a new message. This is
     the whole reason the tool's own parser was replaced: hers split on every
     newline, and the real screenshot is one bubble of four paragraphs. */
  const parsed = await page.evaluate(() => {
    const box = document.getElementById('script');
    box.value = 'them: One.\n\nTwo.\ncarries on.\nimg:\n\nme: Mine.\n\nthem: Three.';
    box.dispatchEvent(new Event('input'));
    return window.__alibaba.parse();
  });
  is('one message per prefix, not per line', parsed.length, 3);
  is('a blank line inside a message is a paragraph', parsed[0].paras, ['One.', 'Two. carries on.']);
  is('an unprefixed line carries the message above it on', parsed[0].paras[1], 'Two. carries on.');
  is('img: hangs the picture on that message', [parsed[0].img, parsed[1].img], [true, false]);
  is('me/them both read', [parsed[1].from, parsed[2].from], ['me', 'them']);

  /* ── the export is the size the phone really writes ── */
  const size = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    return [c.width, c.height];
  });
  is('export is a real iPhone screenshot', size, [1170, 2532]);

  /* ── the thread is scrolled to the newest message ─────────────────────────
     Measured off the pixels: the lowest WHITE row in a column that runs down
     through the bubble. A top-anchored thread (what the first cut did, and
     what leaves half a screen of empty grey above the keyboard) puts this
     hundreds of points higher, which no source assertion would catch. */
  async function lowestWhite(colPt, stopPt) {
    return page.evaluate(([colPt, stopPt]) => {
      const c = document.getElementById('canvas');
      const g = c.getContext('2d');
      const S = c.width / 390;
      const x = Math.round(colPt * S);
      const d = g.getImageData(x, 0, 1, Math.round(stopPt * S)).data;
      for (let y = (d.length / 4) - 1; y >= 0; y--) {
        const i = y * 4;
        if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255) return y / S;
      }
      return -1;
    }, [colPt, stopPt]);
  }
  await page.evaluate(() => {
    document.getElementById('script').value = 'them: Hello my old friend.';
    document.getElementById('script').dispatchEvent(new Event('input'));
    const chips = document.getElementById('o-chips');
    chips.checked = false; chips.dispatchEvent(new Event('change'));
  });
  near('with no button row the thread sits on the composer', await lowestWhite(67, 750), 735, 5);

  await page.evaluate(() => {
    const chips = document.getElementById('o-chips');
    chips.checked = true; chips.dispatchEvent(new Event('change'));
  });
  near('the button row pushes the thread up by its own height', await lowestWhite(67, 700), 683, 5);

  /* the buttons above the keyboard, and the fact that they run off the edge */
  const chipPix = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    const g = c.getContext('2d');
    const S = c.width / 390;
    const at = (xPt, yPt) => Array.from(g.getImageData(Math.round(xPt * S), Math.round(yPt * S), 1, 1).data).slice(0, 3);
    return { inChip: at(67, 725), pastEdge: at(388, 725) };
  });
  is('a button above the keyboard is white', chipPix.inChip, [255, 255, 255]);
  ok('the row runs off the right edge', chipPix.pastEdge.join() !== '241,242,244');

  /* ── the notification banner ── */
  const banner = await page.evaluate(() => {
    const b = document.getElementById('o-banner');
    b.checked = true; b.dispatchEvent(new Event('change'));
    const c = document.getElementById('canvas');
    const g = c.getContext('2d');
    const S = c.width / 390;
    // the Reply pill's own middle, measured from the card's right edge
    const d = g.getImageData(Math.round(350 * S), Math.round(100 * S), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  ok('the banner draws its orange Reply pill', banner[0] > 200 && banner[1] > 70 && banner[1] < 130 && banner[2] < 60);

  /* ── the house rules ── */
  const rules = await page.evaluate(() => {
    const ph = [...document.querySelectorAll('input[type=text],input:not([type]),textarea')]
      .map((el) => el.getAttribute('placeholder')).filter(Boolean);
    const wide = [...document.querySelectorAll('.btn')]
      .filter((b) => b.getBoundingClientRect().width > 140).map((b) => b.textContent.trim());
    const titles = [...document.querySelectorAll('h1,.tool-eyebrow')].map((e) => e.textContent.trim());
    return { ph, wide, titles };
  });
  is('no pre-written text in anything she writes in', rules.ph, []);
  is('buttons hug their words', rules.wide, []);
  is('the title appears once', rules.titles, ['ALIBABA CHAT']);

  await browser.close();
  server.close();

  if (fails.length) {
    console.log('alibaba: ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('alibaba: ' + pass + ' passed');
})();
