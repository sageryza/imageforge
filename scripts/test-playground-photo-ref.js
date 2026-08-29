#!/usr/bin/env node
/*
 * test-playground-photo-ref.js — the Playground's photo reference (Aug 2026).
 *
 * Sophie: "Freeform has the ability to upload a photo reference, but
 * playground doesn't — could you add a little file icon so I can upload a
 * photo reference. In the case of dreamy or watercolor, where they already
 * have references, it will go as the second reference automatically."
 *
 * Two halves. The FIRST needs no network and pins the server contract:
 *   • the photo rides LAST in the attachment list. This is the one ordering
 *     that can never be wrong: PL_GPT.characterLine says "the second attached
 *     image is a character reference", so slotting the photo in front of the
 *     Sophie card would make that sentence describe the wrong picture.
 *   • the photo line is DISCLOSED — served by /api/promptlab/styles so the
 *     page can print it, never a copy living in the page.
 *   • an ordinary run (no photo) is byte-for-byte what it always was.
 * The SECOND drives the real promptlab.html in headless Chromium: the button
 * is there on a gpt style and gone on the LoRA, picking a file lights it and
 * puts the photo's own thumbnail on it, the Prompt panel then prints the
 * added line word for word, and the run POSTs the photo.
 *
 *   node scripts/test-playground-photo-ref.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. the server contract ───────────────────────────────────────────────
console.log('the server');
ok(/photoLine:/.test(serverSrc), 'PL_GPT carries a photoLine');
// The ORDER, and the reason for it.
const job = serverSrc.slice(serverSrc.indexOf('async function runPromptLabGptJob'));
const iChar = job.indexOf('refs.push(playgroundRef(PL_GPT.characterFile))');
const iPhoto = job.indexOf('refs.push(cfg.photoBuf)');
ok(iChar > -1 && iPhoto > iChar, 'the photo is attached AFTER the Sophie character card');
ok(job.indexOf('playgroundRefs(st)') < iPhoto, 'the photo is attached AFTER the style references');
// The line only rides when a photo actually does.
ok(/photoBuf \? photoLine : ''/.test(serverSrc),
  'the photo line is added ONLY when a photo is attached');
// Since 2026-08-24 a STYLE may own the sentence: the house one names a style
// reference, which is a lie on the reference-less ChatGPT tile where her photo
// is the only attachment. See scripts/test-playground-plain.js.
// (2026-08-27: the line is now picked from a PAIR — the same sentence
// re-anchored when character references ride behind the photo — so this pins
// the RULE rather than one spelling of it. See test-playground-characters.js.)
ok(/\(st\.photoLine \? ` \$\{st\.photoLine\}` : PL_GPT\.photoLine\)/.test(serverSrc),
  "and a style's own line wins over the house one");
ok(/photoLine: PL_GPT\.photoLine/.test(serverSrc),
  'the photo line is SERVED to the page, not copied into it');
ok(!/The LAST attached image is a photo reference/.test(pageSrc),
  'promptlab.html holds NO copy of the photo line');
// An untouched run must be unchanged: with no photo and no character the head
// is exactly the prefix, so the sent prompt is what it always was.
// The trailing .trim() (2026-08-24) is a no-op for every style that has a
// prefix — no house prefix has edge whitespace and both extra lines start with
// a space — and is what keeps the reference-less tile, whose prefix is '', from
// opening its prompt with one.
const headLine = (serverSrc.match(/const head = `.*`\.trim\(\);/) || [''])[0];
ok(/\$\{prefix\}/.test(headLine) && /head \? '\\n\\n' : ''/.test(serverSrc),
  'with no photo and no character the head is just the prefix');
ok(/photoRef: photoUrl/.test(serverSrc), 'the run doc records the photo it was made with');

// ── 2. the page contract ─────────────────────────────────────────────────
console.log('the page');
ok(/id="photopick"/.test(pageSrc) && /id="photofile"/.test(pageSrc),
  'the page has the file button and its input');
ok(/accept="image\/\*"/.test(pageSrc), 'the picker asks for images');
ok(/r\.photoRef/.test(pageSrc), 'a run made with a photo says so on its card');

// ── 3. the real page ─────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const PHOTO_LINE = ' The LAST attached image is a photo reference: use it for the subject.';

(async () => {
  let posted = null;
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
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
        photoLine: PHOTO_LINE,
        styles: {
          evan: { label: 'ChatGPT', prefix: 'EVAN PREFIX', suffix: 'EVAN SUFFIX',
                  characterLine: ' Use the second attached image as a character reference.', refs: [] },
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX', characterLine: '', refs: [] },
        },
      }));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage();
  await page.goto(base + '/playground?prompt=a%20cat&style=chatgpt');
  await page.waitForFunction(() => window.PHOTO_LINE !== undefined || true);
  await page.waitForTimeout(300);

  console.log('the button');
  // "Visible" is not the question — the question is whether a tap reaches it.
  const hit = (id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el || !el.offsetParent) return false;
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(at && (at === el || el.contains(at)));
  }, id);
  ok(await hit('photopick'), 'the file button is tappable on a ChatGPT-engine style');
  ok(await page.evaluate(() => !document.getElementById('photoclear').offsetParent),
    'no x while nothing is attached');

  // A 3x3 red png — small and already a png, so it is sent byte-for-byte.
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC';
  await page.setInputFiles('#photofile', {
    name: 'penny.png', mimeType: 'image/png',
    buffer: Buffer.from(PNG.split(',')[1], 'base64'),
  });
  await page.waitForTimeout(300);

  console.log('once a photo is attached');
  ok(await page.evaluate(() => document.getElementById('photowrap').classList.contains('has')),
    'the button lights');
  ok(await page.evaluate(() => {
    const img = document.querySelector('#photopick img');
    return !!img && /^data:image\//.test(img.src);
  }), 'the button wears the photo itself');
  ok(await hit('photoclear'), 'the x to take it back off is tappable');
  // A small png must go through UNTOUCHED — nothing quietly transformed.
  ok(await page.evaluate((p) => window.photoRef && window.photoRef.data === p, PNG),
    'a small png is kept byte-for-byte, not re-encoded');

  console.log('the disclosure');
  await page.click('#promptbtn');
  await page.waitForTimeout(150);
  const added = await page.evaluate(() => {
    const el = document.querySelector('#promptpanel .added');
    return el ? el.textContent : '';
  });
  ok(added.indexOf(PHOTO_LINE.trim()) > -1,
    'the Prompt panel prints the added line word for word');
  // The character line is only listed when the Sophie card is actually on.
  ok(added.indexOf('character reference') === -1,
    'the character line is not listed while the Sophie card is off');
  await page.click('#charpick');
  await page.waitForTimeout(150);
  ok((await page.evaluate(() => document.querySelector('#promptpanel .added').textContent))
      .indexOf('character reference') > -1,
    'turning the Sophie card on adds its line to the panel');

  console.log('the run');
  await page.click('#go');
  await page.waitForTimeout(500);
  ok(posted && posted.photo === PNG, 'the run POSTs the photo');

  console.log('on the LoRA');
  await page.evaluate(() => setStyle('watercolor'));
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !document.getElementById('photowrap').offsetParent),
    'the button is gone on the WTR LoRA, which has no attachment slot');

  console.log('?photo= — a picture sent from Meta Assets');
  // (2026-08-28, Sophie: "meta assets missing its send to playground") — a
  // promptless picture arrives as the PHOTO REFERENCE. The sticky style is
  // the LoRA from the block above, which has no attachment slot, so the link
  // must also land her somewhere the photo can actually ride.
  const SENT = base + '/i/sent-from-meta.png';
  await page.goto(base + '/playground?photo=' + encodeURIComponent(SENT));
  await page.waitForTimeout(400);
  ok(await page.evaluate((u) => window.photoRef && window.photoRef.data === u, SENT),
    'the picture is attached as the photo reference, by its own url');
  ok(await page.evaluate(() => document.getElementById('photowrap').classList.contains('has')),
    'and the button lights');
  ok(await page.evaluate(() => window.STYLES[window.styleKey]
      && window.STYLES[window.styleKey].engine === 'gptimage'),
    'a LoRA sticky style steps aside for one with an attachment slot');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
