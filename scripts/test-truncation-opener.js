#!/usr/bin/env node
// TRUNCATED TEXT OPENS WITH AN UNDERLINED WORD, NEVER A BUTTON (Aug 2026,
// Sophie: "the ... button for longer than two line prompt is huge. why? it
// shud be fixed everywhere. truncated text shud always just be a ...with a
// line under it that links to open (untruncate) or it can say 'more' or 'see
// more'. never a separate button. document that as a ui pattern").
//
// Two passes: a pure one over the stylesheets, and a headless one over the
// real Playground page for WHERE the opener sits.
//
// PASS 1 — every rule that styles a known opener class
// must be borderless, unpadded and underlined (or carry the line on its inner
// span, the dashed-underline variant).
//
// EVERY rule for the class, which is the whole point: the Playground's opener
// was written correctly the first time — `.morebtn`, borderless, padding 0 —
// and then the "Older" paging button took the same class further down the
// same file with a 1px border and 9x18 of padding. The later rule won and the
// "…" rendered as a big empty box. A check that read only the first
// declaration would have called that green.
//
// It cannot check a class the next page invents, which is why the pattern
// names ONE class — `.moretxt` — in docs/design-rules.md. Add the page here
// when you add an opener.
//
//   node scripts/test-truncation-opener.js
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (m) => console.log('  ok  ' + m);

// The opener classes in play, per file. A page not listed here has no opener.
const OPENERS = {
  'promptlab.html': ['moretxt'],
  'dreamapp.html': ['moretxt', 'dmore'],
  'dreams-archive.html': ['more'],
  'chats.html': ['wrapmore', 'wrapmore2'],
};
// `.dmore` wears its line on the inner span (a dashed underline) rather than
// on the button — the same pattern, drawn one level in.
const UNDERLINE_ON_SPAN = { 'dreamapp.html': ['dmore'] };

// Every `.cls{…}` rule body for one class, ignoring @media overrides that
// only recolour (they carry no border/padding here — and if one ever does,
// this catches it too, which is the point).
function rulesFor(css, cls) {
  const out = [];
  const re = new RegExp('(^|[,{}\\s])\\.' + cls + '(?![\\w-])[^{}]*\\{([^{}]*)\\}', 'g');
  let m;
  while ((m = re.exec(css))) out.push(m[2]);
  return out;
}
const decl = (body, prop) => {
  const m = new RegExp('(^|;)\\s*' + prop + '\\s*:([^;]*)', 'i').exec(body);
  return m ? m[2].trim() : null;
};
const boxy = (body) => {
  const b = decl(body, 'border'), bs = decl(body, 'border-style'), bw = decl(body, 'border-width');
  const pad = decl(body, 'padding');
  const bg = decl(body, 'background');
  const bad = [];
  if (b && !/^(0|none)\b/.test(b)) bad.push('border: ' + b);
  if (bs && !/^none\b/.test(bs)) bad.push('border-style: ' + bs);
  if (bw && !/^0/.test(bw)) bad.push('border-width: ' + bw);
  // Any non-zero padding makes it read as a box rather than as a word.
  if (pad && /[1-9]/.test(pad)) bad.push('padding: ' + pad);
  if (bg && !/^(none|transparent|0)\b/.test(bg)) bad.push('background: ' + bg);
  return bad;
};

console.log('THE OPENERS');
for (const [file, classes] of Object.entries(OPENERS)) {
  const css = fs.readFileSync(path.join(PUB, file), 'utf8');
  for (const cls of classes) {
    const bodies = rulesFor(css, cls);
    if (!bodies.length) { fail(`${file}: no rule for .${cls} — did it get renamed?`); continue; }
    const bad = bodies.flatMap(boxy);
    if (bad.length) { fail(`${file} .${cls} is drawn as a box — ${bad.join(' · ')}`); continue; }
    const onSpan = (UNDERLINE_ON_SPAN[file] || []).includes(cls);
    const lined = onSpan
      ? new RegExp('\\.' + cls + '\\s+span\\s*\\{[^{}]*border-bottom\\s*:').test(css)
      : bodies.some(b => /text-decoration\s*:\s*underline/.test(b));
    if (!lined) fail(`${file} .${cls} has no line under it`);
    else ok(`${file} .${cls} — a word with a line under it`);
  }
}

// PASS 2 — WHERE IT SITS (Aug 2026, Sophie: "Button should be part of the
// text, not separated from it on the side"). It shipped as a SIBLING of the
// clamped words, so on a flex header row it parked at the far end, nowhere
// near the sentence it opens. It must be a CHILD of the words and land on
// their LAST line — measured, because "it is in the DOM" says nothing about
// where it rendered.
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.log('\n(skipping the placement pass — playwright not installed)'); return finish(); }
  const http = require('http');
  const T0 = 1786000000000;
  const RUN = {
    id: 'r0', status: 'done', engine: 'gptimage', model: 'gpt-image-2', quality: 'medium',
    aspectRatio: '2:3', images: ['/px.png'], votes: {}, createdAt: T0,
    prompt: 'pretend land is a magical place where people can pretend to be who they '
      + 'want to be, and nobody minds at all, and the sky is always a little purple',
  };
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [RUN], more: false }));
    }
    if (u.pathname === '/px.png') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"></svg>');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(f => fs.existsSync(f));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(base + '/playground');
  await pg.waitForSelector('.runhead .moretxt');

  console.log('\nWHERE IT SITS');
  const m = await pg.evaluate(() => {
    const p = document.querySelector('.runhead .p');
    const b = p.querySelector('.moretxt');
    const pb = p.getBoundingClientRect(), bb = b.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(p).lineHeight);
    return { child: !!b, lh, pTop: pb.top, pBottom: pb.bottom, pRight: pb.right,
      bTop: bb.top, bBottom: bb.bottom, bRight: bb.right };
  });
  if (!m.child) fail('the opener is not inside the words');
  else ok('the opener is a child of the words, not a sibling beside them');
  // On the LAST line: its top is at least one line down, and it ends within
  // the text block rather than out on the header row.
  if (m.bTop < m.pTop + m.lh - 2) fail('it sits on the first line, not the last');
  else ok('on the last line of the words');
  if (m.bBottom > m.pBottom + 2) fail('it hangs below the clamped words');
  else ok('inside the clamped block');
  if (m.bRight > m.pRight + 2) fail('it juts out past the words to the side');
  else ok('within the width of the words');

  await browser.close();
  server.close();
  finish();
})();

function finish() { console.log(process.exitCode ? '\nFAILED' : '\nAll good.'); }

