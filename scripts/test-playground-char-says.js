#!/usr/bin/env node
/*
 * test-playground-char-says.js — the character sheet says what it adds to
 * her prompt (2026-08-29).
 *
 * Sophie: "when I click characters, it doesn't show how it looks in the Full
 * prompt on playground".
 *
 * The Prompt panel has printed those lines since the picker shipped, and the
 * panel is not where she is: it is CLOSED by default, it lives BELOW the
 * sheet, and the sheet is a library. MEASURED against a 25-character cast on
 * a 390x844 viewport, with the sheet open and the panel opened by hand, the
 * panel started 703px down the page — and her real library is 143 faces. So
 * this is a MEASUREMENT, not a markup assertion: a block that renders below
 * the fold is a block she cannot read.
 *
 * What is pinned:
 *  1. THE ONE-COPY RULE. The sheet prints charLine()/castBlock()'s own words,
 *     served, never a sentence transcribed into the page — the same contract
 *     the Prompt panel keeps.
 *  2. NOTHING RIDING → NOTHING DRAWN. An empty cast adds no clause (her
 *     rule), so there is nothing to disclose and no empty box.
 *  3. IT IS ON SCREEN, and it is the same words the run will send.
 *  4. IT IS NOT SAID TWICE. The note under the cards stopped naming who rides
 *     once the real sentence started naming them.
 *
 *   node scripts/test-playground-char-says.js
 *   (needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const padChars = require('../pad-characters');
const sheetGrid = require('../sheet-grid');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. one copy of the wording ───────────────────────────────────────────
console.log('one copy of the wording');
ok(/function paintCharSays\(/.test(pageSrc), 'the sheet has a painter for what it adds');
const painter = pageSrc.slice(pageSrc.indexOf('function paintCharSays('),
  pageSrc.indexOf('function charHay('));
ok(/charsLine\(\)/.test(painter) && /castClause\(/.test(painter),
  'it reads the two SHARED rules rather than composing a sentence');
ok(!/is NOT a style reference/.test(pageSrc) && !/CHARACTER reference/.test(pageSrc),
  'promptlab.html still holds NO copy of the character sentence');
ok(/castClause\(!onPanels\(\)\)/.test(painter),
  'and asks for the tab’s own wording, so it cannot disclose the other tab’s');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC',
  'base64');
// Enough faces that the sheet is a LIBRARY — which is the whole reason the
// Prompt panel below it is out of reach.
const CAST = ['doug', 'sophie', 'jonathan', 'mommy', 'shayna', 'penny', 'evan', 'nancy',
  'susan', 'sean', 'steve', 'mason', 'charlie', 'ian', 'josh', 'nick', 'sage', 'noah',
  'sandy', 'jess', 'ruth', 'omar', 'lena', 'kai', 'wren']
  .map((n, i) => ({ id: 'c' + i, name: n, url: '/face.png', aliases: [], usedAt: 1000 - i }));

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/face.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/pad-characters.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'pad-characters.js')));
    }
    if (url.pathname === '/api/promptlab/characters') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ characters: CAST, max: padChars.MAX_PICKED }));
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        photoLine: ' PL.', photoLineWithChars: ' PLC.', maxChars: padChars.MAX_PICKED,
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX',
                    characterLine: '', refs: [] },
        },
      }));
    }
    // The REAL injected pill rides along, exactly as serveGated appends it —
    // it owns the corner this sheet opens into.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc + fs.readFileSync(path.join(ROOT, 'public', 'pill-inject.html'), 'utf8'));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  // BOTH HEIGHTS. 844 is the iPhone 13 in Safari; 700 is the app's web view
  // with its own bottom bar taken off, and it is the one that matters — the
  // first cut of this block passed at 844 and left 21px of itself showing at
  // 700, which is the identical failure one box higher.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  await page.goto(base + '/playground?prompt=doug%20on%20a%20bench&style=dreamy');
  await page.waitForTimeout(400);

  const says = () => page.evaluate(() => {
    const b = document.getElementById('charsays');
    const t = document.getElementById('charsaystxt');
    const r = b.getBoundingClientRect();
    return { drawn: !b.hidden && !!b.offsetParent, text: (t.textContent || '').trim(),
      top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
  });

  console.log('the sheet, with nobody in it');
  await page.click('#charsbtn');
  await page.waitForTimeout(350);
  let s = await says();
  ok(!s.drawn, 'nothing riding → no block at all, and no empty box');

  console.log('a picked face');
  const cardTop = await page.evaluate(() =>
    document.querySelector('#charrecent .charcard').getBoundingClientRect().top);
  await page.click('#charrecent .charcard:nth-child(1)');   // doug
  await page.waitForTimeout(200);
  s = await says();
  ok(s.drawn, 'picking one draws the block');
  // The words are the RUN's own — the shared rule, asked here independently
  // rather than read back off the page's own arithmetic.
  const want1 = padChars.charLine([{ name: 'doug' }]).trim();
  ok(s.text === want1, 'and it is charLine()’s exact sentence, naming doug');
  // ON SCREEN is the whole point: the Prompt panel prints this too, 703px
  // down a 844px viewport with this same 25-face cast.
  ok(s.top >= 0 && s.bottom <= s.vh,
    'the WHOLE block is inside the viewport (' + s.top + '-' + s.bottom + ' of ' + s.vh + ')');
  // It sits at the FOOT of the sheet on purpose: appearing must not move a
  // card row, or her next pick lands on a different face.
  ok(await page.evaluate((y) => Math.abs(
    document.querySelector('#charrecent .charcard').getBoundingClientRect().top - y) < 1, cardTop),
    'and the cards it is about did not move when it appeared');
  ok(await page.evaluate(() => {
    const t = document.getElementById('charsaystxt');
    const r = t.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + 4, r.top + 4);
    return !!(at && (at === t || t.contains(at)));
  }), 'and nothing — the pill included — is sitting on top of it');

  console.log('a second face');
  await page.click('#charrecent .charcard:nth-child(2)');   // sophie
  await page.waitForTimeout(200);
  s = await says();
  ok(s.text === padChars.charLine([{ name: 'doug' }, { name: 'sophie' }]).trim(),
    'the sentence changes with the cast, in her pick order');

  console.log('it is not said twice');
  const note = (await page.textContent('#charnote')).trim();
  ok(note.indexOf('Riding this drawing') < 0 && note.indexOf('doug') < 0,
    'the note under the cards no longer names who rides — the sentence does');

  console.log('her typed cast');
  await page.click('.chartabs button[data-ct="desc"]');
  await page.waitForTimeout(200);
  await page.click('#castadd');
  await page.waitForTimeout(150);
  await page.fill('.castrow .cnm', 'Penny');
  await page.fill('.castrow .cds', 'a small dog in a red coat');
  await page.waitForTimeout(250);
  s = await says();
  const wantCast = sheetGrid.castBlock([{ name: 'Penny', description: 'a small dog in a red coat' }], true).trim();
  ok(s.text.indexOf(wantCast) > -1,
    'the typed clause is castBlock()’s own words, verbatim');
  ok(s.text.indexOf('Penny') > -1 && s.text.indexOf('doug') > -1,
    'and both halves ride together when both are cast');
  ok(s.drawn && s.top >= 0 && s.top < s.vh,
    'the block is on the Descriptions tab too (top ' + s.top + ')');

  console.log('the panel and the sheet agree');
  // The Prompt panel is what the run is built from; if the two ever disagree
  // the sheet is lying about the prompt, which is worse than saying nothing.
  await page.click('#promptbtn');
  await page.waitForTimeout(250);
  const panel = await page.evaluate(() => {
    const el = document.querySelector('#promptpanel .added');
    return el ? el.textContent : '';
  });
  ok(panel.indexOf('doug') > -1 && panel.indexOf('Penny') > -1,
    'the Prompt panel carries the same two lines');
  const sheetTxt = (await says()).text;
  ok(sheetTxt.split(/\s+/).every((w) => panel.indexOf(w) > -1),
    'and every word the sheet shows is in what the panel prints');

  console.log('emptying it');
  await page.click('.castrow .cx');
  await page.waitForTimeout(200);
  await page.click('.chartabs button[data-ct="pics"]');
  await page.waitForTimeout(200);
  await page.click('#charrecent .charcard:nth-child(1)');
  await page.click('#charrecent .charcard:nth-child(2)');
  await page.waitForTimeout(250);
  ok(!(await says()).drawn, 'putting the whole cast down takes the block away again');

  console.log('the app’s web view (390x700)');
  await page.setViewportSize({ width: 390, height: 700 });
  await page.click('.chartabs button[data-ct="pics"]');
  await page.click('#charrecent .charcard:nth-child(1)');
  await page.waitForTimeout(300);
  s = await says();
  ok(s.drawn && s.top >= 0 && s.bottom <= s.vh,
    'the whole block is still on screen at 700 (' + s.top + '-' + s.bottom + ')');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
