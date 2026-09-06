#!/usr/bin/env node
/**
 * SEVERAL PHOTO REFERENCES ON ONE PLAYGROUND RUN (2026-09-04, Sophie: "i want
 * to add a second reference photo to the playground … either make a way to
 * add a second or third etc photo").
 *
 * The one-photo contract (scripts/test-playground-photo-ref.js) is untouched:
 * one photo still POSTs `photo`, still gets the singular line byte for byte.
 * This pins what a SECOND photo adds — the page's row of thumbs, the plural
 * line with the count written in, the POST carrying `photos` in her order,
 * the record putting every photo back — and that server.js and the page
 * agree on the number words.
 *
 * Every page assertion is a measurement of the real page: a thumb that never
 * rendered, a line that never pluralised and a POST carrying one photo all
 * pass any source assertion ever written about them.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const sweep = require('../promptlab-sweep');
const servePublic = require('./lib/public-asset');
let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the server');
ok(/photoLineMany:/.test(serverSrc) && /photoLineManyWithChars:/.test(serverSrc),
  'PL_GPT carries the plural pair');
ok(/photoLineMany: PL_GPT\.photoLineMany/.test(serverSrc), 'the plural lines are SERVED, not copied');
ok(/photoBufs\.length > 1\s*\n?\s*\? photoLineN\.replace\('\{n\}', photoWords\(photoBufs\.length\)\) : photoLine1/.test(serverSrc),
  'one photo sends the singular line; several send the plural one with the count');
ok(/Array\.isArray\(req\.body\.photos\)/.test(serverSrc) && /\[req\.body\.photo\]/.test(serverSrc),
  '`photos` is read first and `photo` as a list of one');
ok(/photoUrls\.length > 1 \? \{ photoRefs: photoUrls \}/.test(serverSrc),
  'the doc records every photo as `photoRefs`, only when there is more than one');
const job = serverSrc.slice(serverSrc.indexOf('async function runPromptLabGptJob'));
const iFirst = job.indexOf('refs.push(cfg.photoBuf)');
const iRest = job.indexOf("(cfg.photoBufs || []).slice(1)");
const iChars = job.indexOf('playgroundCharRefs(cfg.chars)');
ok(iFirst > -1 && iRest > iFirst && iChars > iRest,
  'the extra photos attach right behind the first and before her cast');
// The number words: one copy each side, pinned equal.
const words = (src) => (src.match(/PHOTO_WORDS = \[([^\]]+)\]/) || [])[1];
ok(words(serverSrc) && words(serverSrc) === words(pageSrc), 'server.js and the page spell the counts the same');
ok(!/The LAST \{n\} attached images/.test(pageSrc), 'the page holds NO copy of the plural line');

console.log('the sweep');
const c = sweep.singleCfgOf({ prompt: 'x', fullPrompt: 'x', photoRef: 'https://x/a.jpg', photoRefs: ['https://x/a.jpg', 'https://x/b.jpg'] });
ok(Array.isArray(c.photoUrls) && c.photoUrls.length === 2 && c.photoUrls[1] === 'https://x/b.jpg',
  'a redraw names every photo by url');
ok(c.photoUrl === 'https://x/a.jpg', 'and the first under the older name');
const c1 = sweep.singleCfgOf({ prompt: 'x', fullPrompt: 'x', photoRef: 'https://x/a.jpg' });
ok(c1.photoUrls.length === 1 && c1.photoUrls[0] === 'https://x/a.jpg', 'a one-photo record is a list of one');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const LINE1 = ' The LAST attached image is a photo reference: use it for the subject.';
const LINEN = ' The LAST {n} attached images are photo references: use them for the subject.';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC';
// A second, different 3x3 png (green).
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2Nk+M/wn4EIwDiqkL4KAWr1BAWPRjYRAAAAAElFTkSuQmCC';

(async () => {
  let posted = null;
  const RUNS = [];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (ch) => { body += ch; });
      return req.on('end', () => {
        posted = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'test1', poll: '/api/promptlab/test1' }));
      });
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        photoLine: LINE1, photoLineMany: LINEN, maxPhotos: 6,
        styles: {
          evan: { label: 'ChatGPT', prefix: 'EVAN PREFIX', suffix: 'EVAN SUFFIX',
                  characterLine: ' Use the second attached image as a character reference.', refs: [] },
        },
      }));
    }
    if (url.pathname.startsWith('/i/')) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(Buffer.from(PNG.split(',')[1], 'base64'));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  RUNS.push({ id: 'r2', engine: 'gptimage', gptStyle: 'evan', prompt: 'two photos', fullPrompt: 'EVAN PREFIX\n\ntwo photos', status: 'done',
    images: [base + '/i/out.png'], quality: 'low', outputs: 1, aspectRatio: '2:3',
    photoRef: base + '/i/rabbit.png', photoRefs: [base + '/i/rabbit.png', base + '/i/snake.png'], createdAt: Date.now() });
  RUNS.push({ id: 'r0', engine: 'gptimage', gptStyle: 'evan', prompt: 'no photo', fullPrompt: 'EVAN PREFIX\n\nno photo', status: 'done',
    images: [base + '/i/out2.png'], quality: 'low', outputs: 1, aspectRatio: '2:3', photoRef: '', createdAt: Date.now() - 1000 });
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(base + '/playground?prompt=a%20cat&style=chatgpt');
  await page.waitForTimeout(400);
  const hit = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || !el.offsetParent) return false;
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(at && (at === el || el.contains(at)));
  }, sel);
  const thumbs = () => page.evaluate(() => Array.from(document.querySelectorAll('#photomore .photothumb img')).map((i) => i.src));

  console.log('one photo, then a second');
  ok(!(await hit('#photoadd')), 'no plus while nothing is attached');
  await page.setInputFiles('#photofile', { name: 'rabbit.png', mimeType: 'image/png', buffer: Buffer.from(PNG.split(',')[1], 'base64') });
  await page.waitForTimeout(300);
  ok(await hit('#photoadd'), 'once one photo is on, the plus to add another is tappable');
  ok((await thumbs()).length === 0, 'and there is no second thumb yet');
  await page.click('#photoadd');
  await page.setInputFiles('#photofile', { name: 'snake.png', mimeType: 'image/png', buffer: Buffer.from(PNG2.split(',')[1], 'base64') });
  await page.waitForTimeout(300);
  ok(await page.evaluate((p) => document.querySelector('#photopick img').src === p, PNG), 'the first photo is still the first');
  const t = await thumbs();
  ok(t.length === 1 && t[0] === PNG2, 'the second photo is its own thumb, after it');
  ok(await hit('#photomore .photothumb .photox'), 'with its own x, tappable');
  ok(await page.evaluate(() => window.photoRef && window.photoRef.data) === PNG, 'window.photoRef is still the first (older readers)');

  console.log('the disclosure');
  await page.click('#promptbtn');
  await page.waitForTimeout(150);
  let added = await page.evaluate(() => { const e = document.querySelector('#promptpanel textarea[data-part="extra"]') || document.querySelector('#promptpanel .added'); return e ? (e.value != null ? e.value : e.textContent) : ''; });
  ok(added.indexOf(LINEN.replace('{n}', 'two').trim()) > -1, 'the Prompt panel prints the plural line with "two" written in');
  ok(added.indexOf(LINE1.trim()) === -1, 'and not the singular one');

  console.log('the run');
  await page.click('#go');
  await page.waitForTimeout(500);
  ok(posted && posted.photo === PNG, 'the POST still carries the first as `photo`');
  ok(posted && Array.isArray(posted.photos) && posted.photos.length === 2 && posted.photos[0] === PNG && posted.photos[1] === PNG2,
    'and both as `photos`, in her order');

  console.log('taking the second off');
  await page.click('#photomore .photothumb .photox');
  await page.waitForTimeout(150);
  ok((await thumbs()).length === 0, 'the thumb is gone');
  added = await page.evaluate(() => { const e = document.querySelector('#promptpanel textarea[data-part="extra"]') || document.querySelector('#promptpanel .added'); return e ? (e.value != null ? e.value : e.textContent) : ''; });
  ok(added.indexOf(LINE1.trim()) > -1 && added.indexOf('attached images') === -1, 'the panel is back to the singular line');
  posted = null;
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(posted && posted.photo === PNG && posted.photos === undefined, 'a one-photo run POSTs no `photos` at all');

  console.log('taking the first off');
  await page.click('#photoclear');
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !document.getElementById('photowrap').classList.contains('has')), 'nothing attached');

  console.log('putting a two-photo run back');
  await page.evaluate(() => { restorePhoto(runsById.r2); });
  await page.waitForTimeout(200);
  ok(await page.evaluate((b) => document.querySelector('#photopick img').src === b + '/i/rabbit.png', base), 'the first photo is back');
  ok((await thumbs())[0] === base + '/i/snake.png', 'and the second, after it');
  ok(await page.evaluate(() => /2 photo refs/.test(document.querySelector('[data-id="r2"], .run') ? document.body.textContent : '')),
    'the run card says "2 photo refs"');
  await page.evaluate(() => { restorePhoto(runsById.r0); });
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !document.getElementById('photowrap').classList.contains('has') && document.querySelectorAll('#photomore .photothumb').length === 0),
    'a record with no photo takes BOTH off');

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
