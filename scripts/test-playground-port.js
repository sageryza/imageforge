#!/usr/bin/env node
/*
 * test-playground-port.js — the Assets → Playground port (Aug 2026).
 *
 * Two halves. The FIRST always runs and needs no network:
 *   1. the matcher's decision table, including the cases measured live on
 *      2026-08-20 that the old four-regex router got wrong;
 *   2. the three copies of the style table are pinned to each other —
 *      playground-port.js's keys against promptlab.html's STYLES keys, and
 *      every `refs` entry / `prefixes` fragment against the REAL reference
 *      filenames and the REAL baked prefixes in server.js. That pin is the
 *      point: the port's whole claim is "this tile carries the same reference
 *      and prompt", and it becomes a lie the moment a table drifts.
 * The SECOND drives the real promptlab.html in headless Chromium and asserts
 * the indicator says the right one of its three things — and keeps saying the
 * right one after she taps a different tile.
 *
 *   node scripts/test-playground-port.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const port = require(path.join(ROOT, 'public', 'playground-port.js'));

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── 1. the decision table ────────────────────────────────────────────────
// Each row is a real shape seen in the live filed prompts, with the count it
// appeared at on 2026-08-20 where that is the reason the row exists.
console.log('the matcher');
[
  // the new tile, and the OLD filename that outnumbers the current one 174:84
  ['Attached: refs/movie-style.jpg', 'dreamy', true, 'old dream ref name → Dreamy'],
  ['refs/dream-mystery.jpg', 'dreamy', true, 'current dream ref name → Dreamy'],
  // the LoRA has no reference, so its trigger is the evidence
  ['wtr watercolor drawing, white background', 'watercolor', true, 'wtr trigger → WTR'],
  // …and prose about watercolour is NOT that. 224 pictures used to be sent to
  // the LoRA — a different engine — on this alone.
  ['Antique occult plate: hand-inked etching with muted watercolor wash',
    'chatgpt', false, 'prose saying "watercolor" is not the WTR LoRA'],
  // a tile's own baked prefix, quoted with no filename anywhere (29 + 8 rows)
  ['Use the attached images ONLY as a STYLE reference for the linework: bold ink',
    'pastel', true, 'pastel prefix quoted, no filename → Pastel'],
  ['house-pastel: gpt-image-2 edits against witch-school/refs/style-1+2',
    'pastel', true, 'the style-1+2 shorthand → Pastel'],
  ['Use the attached images ONLY as a style reference — copy their drawing style, not their content.',
    'hoonies', true, 'hoonies prefix quoted → Hoonies'],
  // the two style-N.png families are told apart ONLY by their directory
  ['hoonies/refs/style-1.png attached', 'hoonies', true, 'hoonies/ path → Hoonies'],
  ['witch-school/refs/style-2.png attached', 'pastel', true, 'witch-school/ path → Pastel'],
  // the retired Replicate LoRA is a different engine from the Hoonies tile
  ['HOONIE, [content], linocut relief print, white background (flux-dev)',
    'chatgpt', false, 'the HOONIE LoRA is not the Hoonies tile'],
  ['', 'chatgpt', false, 'nothing filed → fallback, and honest about it'],
].forEach(([style, wantStyle, wantMatched, what]) => {
  const m = port.matchStyle(style, '');
  ok(m.style === wantStyle && m.matched === wantMatched,
    what + ' (got ' + m.style + '/' + m.matched + ')');
});
ok(port.matchQuality('', 'gpt-image-2 · medium') === 'medium', 'quality read off the caption');
ok(port.matchQuality('', 'gpt-image-2') === '', 'no quality on the record → empty, never guessed');

// ── 2. the three copies of the style table agree ─────────────────────────
console.log('the tables are in step');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// promptlab.html's STYLES keys, read off the real file
const stylesBlock = pageSrc.slice(pageSrc.indexOf('var STYLES = {'));
const pageKeys = [];
stylesBlock.slice(0, stylesBlock.indexOf('\n  };')).replace(
  /^\s{4}(\w+):\s*\{/gm, (_, k) => { pageKeys.push(k); return _; });
const portKeys = port.PORT_STYLES.map((s) => s.key);
ok(pageKeys.length >= 6, 'read ' + pageKeys.length + ' styles off promptlab.html');
ok(JSON.stringify(portKeys.slice().sort()) === JSON.stringify(pageKeys.slice().sort()),
  'every port key is a real STYLES key and vice versa'
  + (JSON.stringify(portKeys.slice().sort()) === JSON.stringify(pageKeys.slice().sort())
    ? '' : ' — port ' + portKeys + ' vs page ' + pageKeys));
ok(portKeys.indexOf('dreamy') >= 0 && pageKeys.indexOf('dreamy') >= 0, 'Dreamy is a tile');
ok(port.PORT_STYLES.some((s) => s.key === port.FALLBACK), 'the fallback names a real tile');

// Every style must be identifiable by SOMETHING, or a picture made on it can
// never route back to it.
port.PORT_STYLES.forEach((s) => {
  ok((s.refs || []).length + (s.prefixes || []).length + (s.triggers || []).length > 0,
    s.key + ' has evidence that can identify it');
});

// The server's real dreamy recipe. ASSERT ON THE VALUES, NOT THE SOURCE TEXT:
// the first cut of these checks regexed the raw block and matched the COMMENT
// above the suffix — which explains why "no borders" was removed and therefore
// contains the words — so it reported a ban that the sent prompt does not have.
// Evaluating the literal is the only honest read of what reaches the model.
function styleObj(id) {
  const i = serverSrc.indexOf('\n  ' + id + ': {');
  const b = serverSrc.slice(i + ('\n  ' + id + ': ').length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');          // drop comment lines
  return eval('(' + lit + ')');                     // eslint-disable-line no-eval
}
const dream = styleObj('dreamy');
ok(dream.refFiles && dream.refFiles[0] === 'dream-mystery.jpg',
  'Dreamy attaches refs/dream-mystery.jpg');
ok(fs.existsSync(path.join(ROOT, 'refs', 'dream-mystery.jpg')),
  'that reference file is actually on disk');
// BOOKENDED (Sophie's ask): the anti-content rule opens the prefix AND closes
// the suffix, because the suffix is the last thing the model reads.
ok(/do NOT copy its content/.test(dream.prefix), 'the anti-content rule OPENS the prefix');
ok(/STYLE reference only/.test(dream.suffix) && /do not draw its content/.test(dream.suffix),
  'and CLOSES the suffix — bookended');
// Sophie, 2026-08-20: "it should have a border" — the tail imported from
// nde-panel.py banned one, on a reference whose own drawn frames are the look.
ok(!/no borders/i.test(dream.suffix), 'the sent suffix does NOT ban borders');
ok(/hand-drawn border/.test(dream.suffix), 'it asks for one');
// The canvas toggles now, so the prompt must not name a shape.
ok(!/vertical|portrait|square/i.test(dream.prefix + dream.suffix),
  'and it names no orientation, because the canvas toggles');
ok(dream.noCharacter === true,
  'no Sophie character card on Dreamy (hers is the watercolor look)');

// Every `prefixes` fragment must be a verbatim substring of that style's REAL
// baked prefix in server.js — otherwise it is a vibe, not evidence.
const GPT_ID = { chatgpt: 'evan', dreamy: 'dreamy', pastel: 'pastel', scarry: 'scarry', hoonies: 'hoonies' };
port.PORT_STYLES.forEach((s) => {
  (s.prefixes || []).forEach((frag) => {
    const id = GPT_ID[s.key];
    const block = serverSrc.slice(serverSrc.indexOf('\n  ' + id + ': {'));
    let one = block.slice(0, block.indexOf('\n  },') + 4);
    // `evan` writes `prefix: PL_GPT.prefix` — the words live on the PL_GPT
    // const above it, so pull that in rather than let the check pass vacuously.
    if (/prefix:\s*PL_GPT\.prefix/.test(one)) {
      const pg = serverSrc.slice(serverSrc.indexOf('const PL_GPT = {'));
      one += pg.slice(0, pg.indexOf('\n};') + 3);
    }
    // the prefix as written in JS is split across ' + ' concatenations
    const joined = one.replace(/'\s*\+\s*\n?\s*'/g, '').replace(/\s+/g, ' ').toLowerCase();
    ok(joined.indexOf(frag.toLowerCase()) >= 0,
      s.key + ': "' + frag.slice(0, 40) + '…" is verbatim in its real prefix');
  });
});

// Every `refs` entry must either be a file this repo actually attaches, or be
// listed here as a deliberate OLD name. Nothing else may sit in the table.
const OLD_NAMES = ['evan-film-style.png', 'datescan0013.png', 'movie-style.jpg',
  'witch-school/refs/style-1', 'witch-school/refs/style-2', 'richard-scarry-2.png'];
port.PORT_STYLES.forEach((s) => {
  (s.refs || []).forEach((ref) => {
    const base = ref.split('/').pop();
    const live = serverSrc.indexOf("'" + base + "'") >= 0
      || serverSrc.indexOf(ref) >= 0
      || fs.existsSync(path.join(ROOT, 'refs', base));
    ok(live || OLD_NAMES.indexOf(ref) >= 0,
      s.key + ': ' + ref + ' is either live or a declared old name');
  });
});

// ── 2b. the canvas, and the prompt the page is allowed to edit ───────────
console.log('canvas + editable prompt');
const plgpt = serverSrc.slice(serverSrc.indexOf('const PL_GPT = {'));
const plgptOne = plgpt.slice(0, plgpt.indexOf('\n};') + 3);
ok(/portrait:\s*\{\s*size:\s*'1024x1536'/.test(plgptOne), 'portrait is 1024x1536');
ok(/square:\s*\{\s*size:\s*'1024x1024'/.test(plgptOne), 'square is 1024x1024');
// The default must stay portrait: it is what every run to date used AND the
// cheaper of the two (gpt-image-2 charges MORE for the square — the one price
// table in docs/modules/pictures.md).
ok(/PL_GPT\.sizes\[String\(req\.body\.canvas \|\| ''\)\] \|\| PL_GPT\.sizes\.portrait/.test(serverSrc),
  'an absent or unknown canvas falls back to portrait, never an invented size');
ok(/size:\s*cfg\.size \|\| PL_GPT\.size/.test(serverSrc),
  'the render job uses the RUN\'s size, not the module default');
// The page must not carry its own copy of the style prompt — that is the whole
// reason the endpoint exists, and a copy is what went stale before.
ok(!/prefix:\s*'/.test(pageSrc), 'promptlab.html holds NO copy of a style prefix');
ok(/\/api\/promptlab\/styles/.test(pageSrc), 'the page reads the real text from the server');
// Express matches in order — `:id` would swallow `styles` and answer 404.
ok(serverSrc.indexOf("'/api/promptlab/styles'") < serverSrc.indexOf("'/api/promptlab/:id'"),
  'the styles route is registered ABOVE /api/promptlab/:id');
// An untouched run must be byte-for-byte what it always was.
ok(/typeof v === 'string' \? v\.trim\(\)/.test(serverSrc),
  'only a STRING overrides a half — an absent field keeps the baked text');

// ── 3. the indicator on the real page ────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {
        dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX', refs: ['dream-mystery.jpg'] },
        evan: { label: 'ChatGPT', prefix: 'EVAN PREFIX', suffix: 'EVAN SUFFIX', refs: [] },
      } }));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8'));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  // The container ships a chromium at /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH)
  // that a freshly-installed playwright may not match by build number. Try the
  // normal launch, fall back to the one that is actually on disk.
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage();
  const tag = () => page.evaluate(() => {
    const el = document.getElementById('reftag');
    return { cls: el.className, text: el.textContent };
  });

  console.log('the indicator');
  // Arrived from a picture we could identify → the tile IS the picture's.
  await page.goto(base + '/playground?prompt=a%20cat&style=dreamy&sameref=1');
  let t = await tag();
  ok(/\bon\b/.test(t.cls) && /same/.test(t.cls), 'matched port: the line shows, marked same');
  ok(/Dreamy/.test(t.text) && /reference and style prompt/.test(t.text),
    'and names the tile + what it carries');
  ok(await page.inputValue('#prompt') === 'a cat', 'the content half landed in the box');

  // She taps a different tile — the claim must stop being "this picture's".
  await page.click('.stylebtn:has-text("Pastel")');
  t = await tag();
  ok(/\bon\b/.test(t.cls) && !/same/.test(t.cls), 'after switching tile: no longer "same"');
  ok(/Pastel/.test(t.text) && /Dreamy/.test(t.text),
    'and it names both where she is and where the picture came from');

  // Nothing identified the picture → say so, do not let the fallback imply it.
  await page.goto(base + '/playground?prompt=a%20cat&style=chatgpt&sameref=0');
  t = await tag();
  ok(/\bon\b/.test(t.cls) && !/same/.test(t.cls), 'unmatched port: the line shows, not "same"');
  ok(/not the one behind it/.test(t.text), 'and admits the reference is not the picture\'s');

  // A plain visit is not a port — the line must stay silent.
  await page.goto(base + '/playground');
  t = await tag();
  ok(t.cls === '' && t.text === '', 'a plain visit shows no indicator at all');

  // A LoRA carries no reference, so it must not claim one.
  await page.goto(base + '/playground?prompt=a%20cat&style=watercolor&sameref=1');
  t = await tag();
  ok(/style prompt/.test(t.text) && !/reference/.test(t.text),
    'WTR says "style prompt" only — it attaches no reference');

  // ── the PROMPT button ───────────────────────────────────────────────
  console.log('the prompt button');
  await page.goto(base + '/playground?prompt=a%20cat&style=dreamy&sameref=1');
  await page.waitForFunction(() => window.fetch && document.getElementById('promptbtn'));
  ok(await page.isVisible('#promptbtn'), 'the button shows on a gpt style');
  ok(!(await page.isVisible('#promptpanel')), 'and the panel starts closed');
  await page.click('#promptbtn');
  await page.waitForSelector('#promptpanel textarea');
  const boxes = await page.$$eval('#promptpanel textarea',
    (ts) => ts.map((t) => ({ part: t.getAttribute('data-part'), val: t.value })));
  ok(boxes.length === 2, 'it opens two boxes');
  ok(boxes.some((b) => b.part === 'prefix' && b.val === 'HOUSE PREFIX'),
    'the BEFORE box holds the real baked prefix, read from the server');
  ok(boxes.some((b) => b.part === 'suffix' && b.val === 'HOUSE SUFFIX'),
    'the AFTER box holds the real baked suffix');
  ok(/a cat/.test(await page.textContent('#promptpanel .yours')),
    'and her own words are shown in between, where they land');

  // Editing marks the style and rides the next run.
  await page.fill('#promptpanel textarea[data-part="suffix"]', 'MY OWN TAIL');
  ok(await page.evaluate(() => document.getElementById('promptbtn').classList.contains('edited')),
    'an edit marks the button, so her wording is never silently in play');
  ok(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('promptlab_prompt_dreamy')).suffix === 'MY OWN TAIL'),
    'and is kept per style');
  await page.click('#promptpanel .prow button');   // Reset
  ok(await page.evaluate(() => !localStorage.getItem('promptlab_prompt_dreamy')),
    'Reset puts the house wording back');
  ok(!(await page.evaluate(() => document.getElementById('promptbtn').classList.contains('edited'))),
    'and clears the mark');

  // ── the canvas toggle ───────────────────────────────────────────────
  console.log('the canvas toggle');
  ok(await page.isVisible('#canvastog'), 'the toggle shows on a gpt style');
  ok(await page.evaluate(() => document.getElementById('c-portrait').classList.contains('on')),
    'portrait is the default — the shape every run has used, and the cheaper one');
  ok(/0\.5/.test(await page.getAttribute('#c-portrait', 'title'))
    && /0\.6/.test(await page.getAttribute('#c-square', 'title')),
    'both say what they cost, because the square is the DEARER one');
  await page.click('#c-square');
  ok(await page.evaluate(() => document.getElementById('c-square').classList.contains('on')),
    'and it switches');

  // The LoRA has no baked prefix and rides a different shape parameter.
  await page.click('.stylebtn:has-text("WTR")');
  ok(!(await page.isVisible('#promptbtn')), 'no prompt button on the LoRA');
  ok(!(await page.isVisible('#canvastog')), 'no canvas toggle on the LoRA');
  ok(!(await page.isVisible('#promptpanel')), 'and an open panel closes with it');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
