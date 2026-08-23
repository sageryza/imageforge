#!/usr/bin/env node
// TRUNCATED TEXT OPENS WITH AN UNDERLINED WORD, NEVER A BUTTON (Aug 2026,
// Sophie: "the ... button for longer than two line prompt is huge. why? it
// shud be fixed everywhere. truncated text shud always just be a ...with a
// line under it that links to open (untruncate) or it can say 'more' or 'see
// more'. never a separate button. document that as a ui pattern").
//
// Pure — no network, no browser. Every rule that styles a known opener class
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

if (!process.exitCode) console.log('\nAll good.');
