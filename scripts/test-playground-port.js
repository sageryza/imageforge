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

// The server's real dreamy recipe: the reference it attaches, and the
// bookending Sophie asked for.
const dreamyBlock = serverSrc.slice(serverSrc.indexOf('  dreamy: {'));
const dreamy = dreamyBlock.slice(0, dreamyBlock.indexOf('\n  },') + 4);
ok(/refFiles:\s*\['dream-mystery\.jpg'\]/.test(dreamy),
  'Dreamy attaches refs/dream-mystery.jpg');
ok(fs.existsSync(path.join(ROOT, 'refs', 'dream-mystery.jpg')),
  'that reference file is actually on disk');
// BOOKENDED (Sophie's ask): the anti-content rule opens the prefix AND closes
// the suffix, because the suffix is the last thing the model reads.
ok(/prefix:[\s\S]*do NOT copy[\s\S]*?its content/.test(dreamy),
  'the anti-content rule OPENS the prefix');
ok(/suffix:[\s\S]*STYLE reference only[\s\S]*do not draw its content/.test(dreamy),
  'and CLOSES the suffix — bookended');
ok(/noCharacter:\s*true/.test(dreamy),
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

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
