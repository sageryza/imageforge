#!/usr/bin/env node
/*
 * test-playground-characters.js — the Playground's character picker
 * (2026-08-27).
 *
 * Sophie: "can you add a little button in the playground right next to where
 * it says dreamy make sure it's the same style with a character icon that
 * shows the five most recent characters that were put and then also the rest
 * of the sheet and characters with a search".
 *
 * Three halves, and the third is where most of the asks actually live —
 * "right next to", "the same style" and "five" are all measurements, and a
 * button that renders in the wrong place or at the wrong height passes every
 * markup assertion ever written about it.
 *
 *  1. THE SERVER CONTRACT (no network). The cast rides at the VERY END of the
 *     attachments, because charLine() — the SHARED sentence, the same one the
 *     Story Room sends — says "the last attached image(s)". Which means the
 *     photo's own line, which has always said "the LAST attached image", is
 *     re-anchored the moment a character rides behind it. And a run that
 *     picked nobody must be byte-for-byte the run it has always been.
 *  2. THE ONE-COPY RULES. The wording lives in pad-characters.js and is
 *     SERVED to the page, never transcribed into it; the library is the
 *     Character Creator's own collection, never a second pile; and "recent"
 *     is defined once, so the picker's five and the cast sheet's five can
 *     never mean different things.
 *  3. THE REAL PAGE in headless Chromium.
 *
 *   node scripts/test-playground-characters.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const charSrc = fs.readFileSync(path.join(ROOT, 'character.js'), 'utf8');
const padChars = require('../pad-characters');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. the server contract ───────────────────────────────────────────────
console.log('the attachment order');
const job = serverSrc.slice(serverSrc.indexOf('async function runPromptLabGptJob'),
  serverSrc.indexOf('// ── A PANELS RUN'));
const iStyle = job.indexOf('playgroundRefs(st)');
const iCard = job.indexOf('refs.push(playgroundRef(PL_GPT.characterFile))');
const iPhoto = job.indexOf('refs.push(cfg.photoBuf)');
const iChars = job.indexOf('playgroundCharRefs(cfg.chars)');
ok(iChars > -1, 'the picked characters are attached');
ok(iChars > iStyle && iChars > iCard && iChars > iPhoto,
  'they ride LAST — after the style refs, the Sophie card AND the photo');
ok(/throw new Error\(`character reference fetch/.test(serverSrc),
  'a reference that will not fetch FAILS the run rather than drawing a stranger');

console.log('the disclosed lines');
ok(/photoLineWithChars:/.test(serverSrc),
  'the photo line has a re-anchored twin for the run that carries both');
// The re-anchor must actually stop claiming the photo is last, or the whole
// point of having a second string is lost.
const anchored = (serverSrc.match(/photoLineWithChars: ' The attached image just before[^;]*;/) || [''])[0];
ok(anchored && !/LAST attached image/.test(anchored),
  'and it no longer calls the photo "the LAST attached image"');
ok(/pickedChars\.length\s*\n?\s*\?\s*\(st\.photoLineWithChars/.test(serverSrc)
  || /pickedChars\.length[\s\S]{0,120}photoLineWithChars/.test(serverSrc),
  'the re-anchored line is sent ONLY when characters really ride');
ok(/\$\{photoBuf \? photoLine : ''\}\$\{charsLine\}/.test(serverSrc),
  'the character sentence rides at the end of the head, mirroring the attach order');
// The untouched run. With no characters `charsLine` is '' and the photo keeps
// its original sentence, so nothing about an ordinary run moved.
ok(padChars.charLine([]) === '', 'no characters picked → no sentence at all');
ok(/const charsLine = padChars\.charLine\(pickedChars\)/.test(serverSrc),
  'the sentence comes from the SHARED rule, not a copy in server.js');

console.log('one copy of everything');
ok(/require\('\.\/pad-characters'\)/.test(serverSrc),
  'server.js draws the rule from pad-characters.js');
ok(/app\.get\('\/pad-characters\.js'/.test(serverSrc),
  'and the same file is SERVED to the page');
ok(/<script src="\/pad-characters\.js">/.test(pageSrc),
  'the page loads it rather than transcribing the wording');
ok(!/is NOT a style reference/.test(pageSrc) && !/CHARACTER reference/.test(pageSrc),
  'promptlab.html holds NO copy of the character sentence');
ok(!/The LAST attached image is a photo reference/.test(pageSrc)
  && !/just before the character/.test(pageSrc),
  'nor of either photo line');
ok(/window\.__padCharacters/.test(pageSrc), 'it calls the real charLine()');
// The library. `forge-characters` is the Character Creator's collection and
// the cast sheet's and the dream flow's — a second pile would mean a
// character she made in one place is invisible in the other.
ok(/charLib\(\)\.charactersByIds/.test(serverSrc) && /charLib\(\)\.listCharacters/.test(serverSrc),
  'the Playground reads the Character Creator’s own library');
ok(!/collection\(['"`]forge-characters/.test(serverSrc),
  'and never opens that collection itself — character.js owns it');
// "Recent" means the last time she DREW with one, defined once.
ok(/async function markUsed\(/.test(charSrc)
  && /await markUsed\(req\.body\?\.ids\)/.test(charSrc),
  'markUsed is ONE function, and the /used route calls it');
ok(/charLib\(\)\.markUsed\(pickedChars\.map/.test(serverSrc),
  'drawing here marks the characters used, so the five recent slots move');
ok(/lastUsedAt \? Date\.parse\(c\.lastUsedAt\)/.test(serverSrc),
  'recent = the last time she drew with one, falling back to when it was made');
// Express matches in order — the same trap /styles carries a note about.
ok(serverSrc.indexOf("app.get('/api/promptlab/characters'") > -1
  && serverSrc.indexOf("app.get('/api/promptlab/characters'") < serverSrc.indexOf("app.get('/api/promptlab/:id'"),
  'the picker route is registered ABOVE /api/promptlab/:id');
ok(/\.\.\.\(pickedChars\.length \? \{ characters: pickedChars \} : \{\}\)/.test(serverSrc),
  'the run doc records WHICH characters rode it');
// A character card off Storage is a webp, and every reference used to be
// declared image/png whatever it held.
ok(/function imageTypeOf\(/.test(serverSrc) && /const t = imageTypeOf\(b\)/.test(serverSrc),
  'each attached reference is declared as the type its BYTES say it is');

console.log('the cap');
ok(padChars.MAX_PICKED > 0, 'the shared cap exists');
ok(/padChars\.MAX_PICKED/.test(serverSrc),
  'the server caps a run with the shared number, not one of its own');
ok(!/MAX_PICKED = \d/.test(pageSrc), 'and the page does not hardcode it either');

// ── 2. the page contract ─────────────────────────────────────────────────
console.log('the page');
// "right next to where it says dreamy" — the style row, not the control row
// below it. Measured properly in the headless half; this is the markup half.
const stylesRow = (pageSrc.match(/<div class="styles">[\s\S]*?<\/div>/) || [''])[0];
ok(/id="charsbtn"/.test(stylesRow),
  'the button is inside the style row, beside the picker');
ok(/id="charq"/.test(pageSrc) && /id="charrecent"/.test(pageSrc) && /id="charall"/.test(pageSrc),
  'the sheet has its recent row, its rest, and a search box');
ok(/placeholder="Search characters"/.test(pageSrc),
  'the search box NAMES itself and holds no example answer');

// ── 3. the real page ─────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const PHOTO_LINE = ' The LAST attached image is a photo reference.';
const PHOTO_LINE_CHARS = ' The attached image just before the character reference(s) at the end is a photo reference.';
// A 3x3 red png, served as every character's face.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC',
  'base64');
// Enough that five is genuinely a top slice, the rest is genuinely a rest,
// and the page is long enough for the injected pill to appear at all — which
// it must, since the pill's column is half of what this file measures.
const CAST = ['doug', 'sophie', 'jonathan', 'mommy', 'shayna', 'penny', 'evan', 'nancy',
  'susan', 'sean', 'steve', 'mason', 'charlie', 'ian', 'josh', 'nick', 'sage', 'noah',
  'sandy', 'jess', 'ruth', 'omar', 'lena', 'kai', 'wren']
  .map((n, i) => ({ id: 'c' + i, name: n, url: '/face.png', aliases: i === 0 ? ['bernstein'] : [], usedAt: 1000 - i }));

(async () => {
  let posted = null;
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
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        posted = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'test1', poll: '/api/promptlab/test1' }));
      });
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        photoLine: PHOTO_LINE, photoLineWithChars: PHOTO_LINE_CHARS,
        maxChars: padChars.MAX_PICKED,
        styles: {
          evan: { label: 'Sandy mirror', prefix: 'EVAN PREFIX', suffix: 'EVAN SUFFIX',
                  characterLine: ' Use the second attached image as a character reference.', refs: [] },
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX', characterLine: '', refs: [] },
        },
      }));
    }
    // THE REAL INJECTED PILL rides along, exactly as serveGated appends it —
    // it is what owns the corner the sheet opens into, so a harness without
    // it would green-light the collision this file exists to pin.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc + fs.readFileSync(path.join(ROOT, 'public', 'pill-inject.html'), 'utf8'));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/playground?prompt=doug%20on%20a%20bench&style=dreamy');
  await page.waitForTimeout(400);

  // "Visible" is not the question — the question is whether a tap reaches it.
  const hit = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || !el.offsetParent) return false;
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(at && (at === el || el.contains(at)));
  }, sel);

  console.log('the button');
  ok(await hit('#charsbtn'), 'the character button is tappable on a gpt style');
  // "right next to where it says dreamy" — MEASURED. Same line as the style
  // picker, immediately to its right, not wrapped onto a row of its own.
  const beside = await page.evaluate(() => {
    const s = document.getElementById('stylepick').getBoundingClientRect();
    const b = document.getElementById('charsbtn').getBoundingClientRect();
    return { gap: Math.round(b.left - s.right), sameLine: Math.abs(b.top - s.top) < 4,
      sh: Math.round(s.height), bh: Math.round(b.height) };
  });
  ok(beside.sameLine, 'it sits on the SAME line as the style picker');
  ok(beside.gap >= 0 && beside.gap <= 16, 'immediately to its right (' + beside.gap + 'px)');
  // "make sure it's the same style" — the picker's own height and its ink
  // border, the two things that would make it read as a stranger on that row.
  ok(beside.bh === beside.sh, 'the same height as the picker (' + beside.bh + 'px)');
  const sameInk = await page.evaluate(() => {
    const c = (el) => getComputedStyle(el);
    return c(document.getElementById('charsbtn')).borderTopColor === c(document.getElementById('stylepick')).borderTopColor
      && c(document.getElementById('charsbtn')).borderRadius === c(document.getElementById('stylepick')).borderRadius;
  });
  ok(sameInk, 'and the same ink border and 6px corner');

  console.log('the sheet');
  await page.click('#charsbtn');
  await page.waitForTimeout(300);
  const counts = await page.evaluate(() => ({
    recent: document.querySelectorAll('#charrecent .charcard').length,
    rest: document.querySelectorAll('#charall .charcard').length,
    first: [...document.querySelectorAll('#charrecent .nm')].map((n) => n.textContent),
  }));
  ok(counts.recent === 5, 'FIVE most recent across the top (' + counts.recent + ')');
  ok(counts.rest === CAST.length - 5, 'and the rest under them (' + counts.rest + ')');
  ok(counts.first[0] === 'doug', 'newest-used first, in the order the server sent');
  ok(await hit('#charq'), 'the search box is tappable');
  // A derived display copy, not the original — a saved character card is a
  // full render (1.2MB apiece, measured) and this is a 52px tile.
  ok(await page.evaluate(() => {
    const s = document.querySelector('#charrecent .charcard img').getAttribute('src');
    return /^\/api\/story\/thumb\?w=240/.test(s) || s === '/face.png';
  }), 'a Storage face is drawn through the derived-thumb service, not raw');

  // THE PILL OWNS THE TOP-RIGHT CORNER AND THE SHEET OPENS INTO IT. Measured
  // pre-fix: `#spd`, the pill's own speed label, sat on the FIFTH recent
  // card's corner — and on her phone the safe-area inset pushes the pill
  // ~33px lower, onto that card's middle. The reservation is HORIZONTAL, so
  // it holds at any inset; what is asked here is that every card, and the
  // last one in particular, ends before the pill's column.
  console.log('the pill’s column');
  const pillFit = await page.evaluate(() => {
    const pill = document.querySelector('.float');
    if (!pill) return { nopill: true };
    const spd = document.getElementById('spd');
    const p = pill.getBoundingClientRect();
    if (!p.width) return { nopill: true };   // a zero rect is no pill at all
    const left = Math.min(p.left, spd ? (spd.getBoundingClientRect().left || p.left) : p.left);
    const worst = (sel) => Math.max(...[...document.querySelectorAll(sel)]
      .map((el) => el.getBoundingClientRect().right), 0);
    return { left, recent: worst('#charrecent .charcard'), rest: worst('#charall .charcard') };
  });
  ok(!pillFit.nopill, 'the page really has a pill to collide with (or this proves nothing)');
  ok(pillFit.nopill || pillFit.recent <= pillFit.left,
    'every recent card ends before the pill’s column');
  ok(pillFit.nopill || pillFit.rest <= pillFit.left,
    'and so does every card in the rest');
  // The corner that was actually covered.
  ok(await page.evaluate(() => {
    const el = document.querySelector('#charrecent .charcard:nth-child(5)');
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.right - 3, r.top + 3);
    return !!(at && el.contains(at));
  }), 'a tap on the fifth card’s top-right corner reaches the card');

  console.log('the search');
  await page.fill('#charq', 'bernstein');   // doug's ALIAS, and doug is in the top five
  await page.waitForTimeout(300);
  const found = await page.evaluate(() => [...document.querySelectorAll('#charall .nm')].map((n) => n.textContent));
  ok(found.length === 1 && found[0] === 'doug',
    'a search reaches the WHOLE library, the five recent included, and matches aliases');
  await page.fill('#charq', 'zzz');
  await page.waitForTimeout(300);
  ok((await page.textContent('#charnote')).indexOf('Nothing matches') > -1, 'and says so when nothing does');
  await page.fill('#charq', '');
  await page.waitForTimeout(300);

  console.log('picking');
  await page.click('#charrecent .charcard:nth-child(3)');   // jonathan
  await page.click('#charrecent .charcard:nth-child(1)');   // doug
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.getElementById('charsn').textContent === '2'),
    'the button wears the count');
  ok(await page.evaluate(() => document.getElementById('charsbtn').classList.contains('on')),
    'and lights, so a cast can never ride unnoticed');
  ok(await page.evaluate(() => document.querySelectorAll('.charcard.on').length === 2),
    'the picked faces are marked');

  console.log('the disclosure');
  await page.click('#promptbtn');
  await page.waitForTimeout(200);
  const added = await page.evaluate(() => document.querySelector('#promptpanel .added').textContent);
  // The REAL sentence, from the real shared rule — pick order, so the names
  // line up with the pictures they attach as.
  const want = padChars.charLine([{ name: 'jonathan' }, { name: 'doug' }]).trim();
  ok(added.indexOf(want) > -1, 'the Prompt panel prints the real charLine(), word for word');
  ok(added.indexOf('jonathan, doug') > -1, 'in HER pick order, which is the attach order');

  console.log('the photo line, re-anchored');
  await page.setInputFiles('#photofile', { name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(300);
  const both = await page.evaluate(() => document.querySelector('#promptpanel .added').textContent);
  ok(both.indexOf(PHOTO_LINE_CHARS.trim()) > -1,
    'with characters riding, the photo line is the re-anchored one');
  ok(both.indexOf('The LAST attached image is a photo reference') === -1,
    'and never the one that calls the photo last');

  console.log('the run');
  await page.click('#go');
  await page.waitForTimeout(500);
  ok(posted && Array.isArray(posted.characters) && posted.characters.join(',') === 'c2,c0',
    'the run POSTs the picked ids in her pick order');

  console.log('where it does NOT belong');
  await page.evaluate(() => setStyle('watercolor'));
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.getElementById('charsbtn').offsetParent),
    'gone on the WTR LoRA, which has no attachment slot at all');
  ok(await page.evaluate(() => !document.getElementById('charpanel').classList.contains('on')),
    'and the sheet closes with it, rather than sitting open over nothing');
  // PANELS TAKE IT NOW (2026-08-27, Sophie: "I want both. Descriptions as well
  // as pictures: two options"). This assertion read the other way for one day,
  // on the reasoning that charLine() names "the last attached image" — but
  // that sentence says "image(s)" and is as true of a sheet as of a single
  // picture. The two that genuinely cannot ride a sheet are the Sophie card
  // and her photo, which name a POSITION for ONE picture, and those are
  // asserted off in test-playground-panels.js.
  await page.evaluate(() => { setStyle('dreamy'); setTab('panels'); });
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !!document.getElementById('charsbtn').offsetParent),
    'STAYS on the Panels tab — a sheet carries a cast like any other picture');

  console.log('an ordinary run is unchanged');
  await page.evaluate(() => { setTab('picture'); setStyle('dreamy'); pickedChars.length = 0; paintCharsBtn(); });
  await page.waitForTimeout(200);
  posted = null;
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(posted && posted.characters === undefined,
    'with nobody picked the request carries no `characters` field at all');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
