#!/usr/bin/env node
/* THE BOILERPLATE STYLE TOGGLE IN FREEFORM (2026-08-28, Sophie: "add a default
   boiler style not content prompt to freeform with a toggle on off button" ·
   "boiler plate" · "the text we use for dreamy or watercolor" · "ex: copy the
   style etc / not content").

   THE WORDING IS SERVER.JS'S. The first cut invented a style line, which is
   the reconstruction this repo's exact-prompt rule forbids — and needless,
   since PL_GPT_STYLES already holds the settled recipe. So the assertions
   below read the real table out of server.js: this test fails the day the
   style id goes stale, and the day someone pastes a copy into freeform.js or
   into the page.

   Freeform's whole promise is that nothing is added, so what this really
   guards is that the toggle can never add words INVISIBLY:

   - OFF is byte-for-byte the verbatim surface it has always been, and files
     NO style half (an empty one would be a reconstruction).
   - ON wraps her words the way the house recipe does — prefix before, suffix
     after — with her words untouched in the middle and the seam marked
     [content].
   - The page prints BOTH halves and says where each lands.
   - It is OFF on every load and not sticky.
   - Putting a run back restores the toggle to what THAT run had.

   Run: node scripts/test-freeform-boiler.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(PATHROOT(), 'public');
function PATHROOT() { return path.join(__dirname, '..'); }

const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

const ff = require('../freeform.js');
const { BOILER, boilerFields } = ff;

// ── the house table, read out of server.js and handed in as server.js hands
//    it in ────────────────────────────────────────────────────────────────
const SERVER = fs.readFileSync(path.join(PATHROOT(), 'server.js'), 'utf8');
const FREEFORM_SRC = fs.readFileSync(path.join(PATHROOT(), 'freeform.js'), 'utf8');
const styleBlock = SERVER.slice(SERVER.indexOf('const PL_GPT_STYLES = {'));
const entryStart = styleBlock.indexOf('\n  ' + BOILER.id + ': {');
const entry = entryStart < 0 ? '' : styleBlock.slice(entryStart, styleBlock.indexOf('\n  },', entryStart));
const joined = (lit) => lit.split(/'\s*\+\s*'/).join('').replace(/^'/, '').replace(/'\s*$/, '');
function grab(key) {
  const m = entry.match(new RegExp(key + ":\\s*((?:'[^']*'\\s*\\+?\\s*)+|PL_GPT\\.\\w+)"));
  if (!m) return null;
  if (/^PL_GPT\./.test(m[1])) {
    const name = m[1].split('.')[1];
    const head = SERVER.slice(SERVER.indexOf('const PL_GPT = {'));
    const m2 = head.match(new RegExp('\\n  ' + name + ":\\s*((?:'[^']*'\\s*\\+?\\s*)+)"));
    return m2 ? joined(m2[1].trim()) : null;
  }
  return joined(m[1].trim());
}
ff.init({ gptStyles: { [BOILER.id]: { label: 'Sandy mirror', prefix: grab('prefix'), suffix: grab('suffix') } } });

ok('the boiler style id exists in PL_GPT_STYLES', entryStart >= 0);
ok('server.js hands the style table in',
  /require\('\.\/freeform'\)\.init\(\{\s*gptStyles: PL_GPT_STYLES/.test(SERVER));
ok('the wording came out of server.js', !!BOILER.prefix && !!BOILER.suffix);
ok('the prefix is the house style-reference clause', /style of the attached style reference/.test(BOILER.prefix));
ok('it says the style and NOT the content', /ignore its content/i.test(BOILER.prefix));
ok('freeform.js keeps no copy of the wording', !FREEFORM_SRC.includes('ignore its content'));
// STYLE, NOT CONTENT: the clause is about the drawing and never about a
// subject, or it would fight every prompt it rode on.
ok('the boiler names no subject of its own', !/a cat|a woman|a girl/i.test(BOILER.prefix + BOILER.suffix));

// ── pure: the assembler ────────────────────────────────────────────────────
const off = boilerFields('a cat on a fence', false);
ok('off sends her words untouched', off.sent === 'a cat on a fence');
ok('off files no style half', !('promptStyle' in off));
ok('off files the content half', off.promptContent === 'a cat on a fence');

const on = boilerFields('a cat on a fence', true);
ok('on wraps her words the way the house recipe does',
  on.sent === BOILER.prefix + '\n\na cat on a fence\n\n' + BOILER.suffix);
ok('on keeps her words verbatim in the middle', on.sent.includes('\n\na cat on a fence\n\n'));
ok('on files the whole sent text', on.fullPrompt === on.sent);
ok('on marks the seam with [content]',
  on.promptStyle === BOILER.prefix + '\n\n[content]\n\n' + BOILER.suffix);
ok('on never puts her words in the style half', !on.promptStyle.includes('a cat'));

// ── the real page ──────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { chromium = null; }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const PRIOR = [
  { id: 'r1', prompt: 'the boiler one', quality: 'medium', size: 'portrait',
    status: 'done', images: [], refs: [], refIds: [], outputs: 1, boiler: true },
  { id: 'r2', prompt: 'the plain one', quality: 'medium', size: 'portrait',
    status: 'done', images: [], refs: [], refIds: [], outputs: 1, boiler: false },
];

let posted = null;
function serve() {
  return http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (p === '/freeform') {
      const h = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.setHeader('content-type', 'text/html'); return res.end(h);
    }
    // The REAL constant, served the way the route serves it.
    if (p === '/api/freeform/style') return json({ ok: true, style: BOILER });
    if (p === '/api/freeform/refs') return json({ ok: true, refs: [] });
    if (p === '/api/freeform/runs') return json({ ok: true, runs: PRIOR });
    if (p === '/api/freeform/run' && req.method === 'POST') {
      let body = ''; req.on('data', (c) => { body += c; });
      return req.on('end', () => { posted = JSON.parse(body || '{}'); json({ ok: true, id: 'new1', status: 'drawing' }); });
    }
    const f = path.join(PUB, p);
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.setHeader('content-type', path.extname(f) === '.js' ? 'text/javascript' : 'text/css');
      return res.end(fs.readFileSync(f));
    }
    res.statusCode = 404; return json({});
  });
}

function report() {
  console.log(`freeform boiler: ${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
}

(async () => {
  // The page must not carry the words either — checked as source, because a
  // page with its own copy passes every rendered assertion right up until
  // someone rewords the style in server.js.
  const src = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8');
  ok('the page keeps no copy of the boiler text',
    !src.includes(BOILER.prefix.slice(0, 40)) && !src.includes(BOILER.suffix.slice(0, 20)));

  if (!chromium) { report(); return; }
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const path0 = exe();
  const browser = await chromium.launch(path0 ? { executablePath: path0 } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/freeform`);
  await page.waitForFunction(() => document.querySelectorAll('.run').length > 0);

  const state = () => page.evaluate(() => {
    const b = document.getElementById('boiler');
    const t = document.getElementById('boilertext');
    return {
      lit: b.classList.contains('on'),
      pressed: b.getAttribute('aria-pressed'),
      shown: !t.hidden && t.offsetParent !== null,
      text: t.textContent,
      label: b.textContent.trim(),
    };
  });

  let s = await state();
  ok('the toggle is OFF on load', !s.lit && s.pressed === 'false');
  ok('nothing is disclosed while it is off', !s.shown);
  await page.waitForFunction(() => /style/i.test(document.getElementById('boiler').textContent));
  ok('the button names the style it sends', /sandy mirror/i.test((await state()).label));

  await page.fill('#prompt', 'a cat on a fence');
  await page.click('#boiler');
  s = await state();
  ok('tapping lights it', s.lit && s.pressed === 'true');
  ok('lit, it prints both halves exactly as served',
    s.shown && s.text.includes(BOILER.prefix) && s.text.includes(BOILER.suffix));
  ok('it says where each half lands',
    /before your words/i.test(s.text) && /after your words/i.test(s.text));

  const reach = await page.evaluate(() => {
    const r = document.getElementById('boiler').getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el && el.closest('#boiler') ? 'boiler' : 'BLOCKED-by-' + (el && el.className);
  });
  ok('the toggle takes its own tap', reach === 'boiler');

  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('.run').length > 2);
  ok('the run carries boiler:true', posted && posted.boiler === true);
  ok('the run still sends her words alone — the server wraps them',
    posted && posted.prompt === 'a cat on a fence');

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.run').length > 0);
  ok('it is off again after a reload', !(await state()).lit);

  await page.click('.run:nth-of-type(1) .copybtn');
  await page.waitForFunction(() => document.getElementById('boiler').classList.contains('on'));
  ok('putting back a boiler run turns it ON', (await state()).lit);
  await page.click('.run:nth-of-type(2) .copybtn');
  await page.waitForFunction(() => !document.getElementById('boiler').classList.contains('on'));
  ok('putting back a plain run turns it OFF', !(await state()).lit);

  await browser.close(); srv.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
