#!/usr/bin/env node
// THE WHOLE PROMPT IS STORED WHEREVER AN IMAGE IS MADE (2026-08-24, Sophie:
// "yes make it store the whole prompt. this is a hard rule. anytime an image
// is made ANYWHERE the whole prompt shud be stored").
//
// Pins the shared builder AND sweeps the tree so a new image surface cannot
// quietly file a picture with only its typed words:
//   1. the full text is the LITERAL sent string when the caller has one,
//      never a rebuild that could differ by a space,
//   2. the style half marks the seam with [content] — the convention the
//      Assets PROMPT overlay documents — and is EMPTY when nothing wrapped
//      her words (a verbatim surface files no style half rather than an
//      invented one),
//   3. empty fields are dropped, so nothing writes "" onto a doc,
//   4. every caller of the two gallery filers passes a full prompt,
//   5. Meta Assets carries the stored halves through to the overlay.
//
//   node scripts/test-prompt-record.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { promptRecord, promptFields, CONTENT_MARK } = require('../prompt-record.js');
const { buildMetaAssets } = require('../meta-assets.js');

const root = (f) => path.join(__dirname, '..', f);
let n = 0;
const ok = (cond, name) => { assert.ok(cond, name); n++; };

// 1 — the literal sent text wins over a rebuild
{
  const r = promptRecord({ full: 'EXACT  SENT   TEXT', prefix: 'PRE', content: 'words', suffix: 'SUF' });
  ok(r.fullPrompt === 'EXACT  SENT   TEXT', 'the sent string is stored verbatim, odd spacing and all');
  const b = promptRecord({ prefix: 'PRE', content: 'a red door', suffix: 'SUF' });
  ok(b.fullPrompt === 'PRE\n\na red door\n\nSUF', 'with no sent copy it is rebuilt from the parts');
}

// 2 — the seam, and the honest empty
{
  const r = promptRecord({ prefix: 'PRE', content: 'a red door', suffix: 'SUF' });
  ok(r.promptStyle === `PRE\n\n${CONTENT_MARK}\n\nSUF`, 'the style half marks where her words go');
  ok(r.promptContent === 'a red door', 'the content half is her words verbatim');
  const v = promptRecord({ content: 'verbatim only' });
  ok(v.promptStyle === '', 'nothing wrapped her words → NO style half, never an invented one');
  ok(v.fullPrompt === 'verbatim only', 'and the full prompt is just her words');
  const pre = promptRecord({ prefix: 'ONLY A TRIGGER', content: 'a crow' });
  ok(pre.promptStyle === `ONLY A TRIGGER\n\n${CONTENT_MARK}`, 'a prefix with no suffix still makes a half');
}

// 3 — empties are dropped, never written as ""
{
  const f = promptFields({ content: 'just words' });
  ok(f.promptStyle === undefined, 'an empty style half is omitted from the doc');
  ok(f.fullPrompt === 'just words' && f.promptContent === 'just words', 'the two real fields are there');
  ok(Object.keys(promptFields({})).length === 0, 'nothing at all writes nothing at all');
}

// 4 — every IMAGE filing call passes a full prompt. The two filers live in
// server.js; fileCreationDoc is never called there directly — it is injected
// into modules (the movies.init pattern), so the sweep follows it in.
{
  const srv = fs.readFileSync(root('server.js'), 'utf8');
  function callArgs(src, name) {
    const out = [];
    // A dot-access counts — panels calls it as `deps.fileCreation(`.
    const re = new RegExp(`${name}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(src))) {
      const start = src.indexOf('(', m.index);
      // skip the definition itself
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index + name.length + 1))) continue;
      let d = 0, j = start;
      for (; j < src.length; j++) {
        if (src[j] === '(') d++;
        else if (src[j] === ')') { d--; if (!d) break; }
      }
      out.push(src.slice(start, j + 1));
    }
    return out;
  }
  const runCalls = callArgs(srv, 'fileRunToCreations').filter((a) => a.includes('images'));
  ok(runCalls.length >= 2, 'both Playground engines file their runs');
  runCalls.forEach((a, i) =>
    ok(/fullPrompt/.test(a), `fileRunToCreations call ${i} passes fullPrompt`));

  // The injected filer, followed into the modules that receive it.
  const injected = [...srv.matchAll(/fileCreation:\s*fileCreationDoc/g)];
  ok(injected.length >= 2, 'fileCreationDoc is handed to the modules that make deliverables');
  // panels.js MAKES IMAGES — every one of its filings carries the whole prompt.
  const pan = fs.readFileSync(root('panels.js'), 'utf8');
  const panCalls = callArgs(pan, 'fileCreation');
  ok(panCalls.length >= 2, 'panels files the sheet and each cut panel');
  // A call may carry the prompt through a shared object it spreads —
  // `Object.assign({ … }, shared)` — which is the right way to write two
  // filings of one run. So a call that names no fullPrompt itself is followed
  // ONE level into the object it spreads, and the field has to be there.
  // (Only one level: a chain of spreads would hide the field again.)
  const carries = (src, args) => {
    if (/fullPrompt/.test(args)) return true;
    // …\)\) — the args end with the Object.assign close AND the call's own.
    const spread = args.match(/,\s*([A-Za-z_$][\w$]*)\s*\)+\s*$/);
    if (!spread) return false;
    const decl = src.match(new RegExp(`const\\s+${spread[1]}\\s*=[\\s\\S]*?;`));
    return !!decl && /fullPrompt/.test(decl[0]);
  };
  panCalls.forEach((a, i) =>
    ok(carries(pan, a), `panels fileCreation call ${i} passes fullPrompt`));

  // photostudio and movies file through the injected filer too — their calls
  // must carry the whole prompt, or a mockup / a filed clip loses the one
  // copy of the text that made it.
  const photo = fs.readFileSync(root('photostudio.js'), 'utf8');
  const photoCalls = callArgs(photo, 'fileCreation').filter((a) => a.includes('url'));
  ok(photoCalls.length >= 1, 'photostudio files its mockups');
  photoCalls.forEach((a, i) =>
    ok(/fullPrompt/.test(a), `photostudio fileCreation call ${i} passes fullPrompt`));
  ok(/photostudio\.init\(\{\s*fileCreation: fileCreationDoc/.test(srv),
    'and server.js actually hands photostudio the filer');
  const mov = fs.readFileSync(root('movies.js'), 'utf8');
  const movCalls = callArgs(mov, 'fileCreation').filter((a) => a.includes('url'));
  ok(movCalls.length >= 1, 'movies files its clips');
  movCalls.forEach((a, i) =>
    ok(/fullPrompt/.test(a), `movies fileCreation call ${i} passes fullPrompt`));

  ok(/require\('\.\/prompt-record'\)/.test(srv), 'server.js uses the shared builder');
  // The require must be at module scope: fileCreationDoc is defined above
  // fileRunToCreations, and a require inside the latter is invisible to it.
  const req = srv.indexOf("require('./prompt-record')");
  ok(req > 0 && req < srv.indexOf('async function fileCreationDoc'),
    'and requires it at module scope, above the first filer that reads it');
  // Both filers must actually accept it, or a caller passing it is a no-op.
  ['fileRunToCreations', 'fileCreationDoc'].forEach((fn) => {
    const sig = srv.slice(srv.indexOf(`async function ${fn}`)).split('\n')[0];
    ok(/fullPrompt/.test(sig), `${fn} accepts fullPrompt`);
  });
}

// 5 — Meta Assets carries the stored halves to the overlay
{
  const [row] = buildMetaAssets([], [{
    url: 'https://x/a.png', prompt: 'a red door', type: 'image', ms: 5,
    style: 'Dreamy', model: 'gpt-image-2', quality: 'medium', size: '1568x2352',
    promptStyle: `PRE\n\n${CONTENT_MARK}\n\nSUF`, promptContent: 'a red door',
  }]);
  ok(row.promptStyle === `PRE\n\n${CONTENT_MARK}\n\nSUF`, 'the stored style half reaches the overlay');
  ok(row.promptContent === 'a red door', 'so does the content half');
  ok(row.prompt === 'Dreamy · gpt-image-2 · medium · 2K', 'and the caption still reads style first');
  // An older record has neither half — the content falls back to the typed
  // prompt, and the style half stays EMPTY rather than showing the label.
  const [old] = buildMetaAssets([], [{
    url: 'https://x/b.png', prompt: 'a fox', type: 'image', ms: 4, style: 'ChatGPT · medium' }]);
  ok(old.promptStyle === '', 'an older record shows no style half rather than a reconstruction');
  ok(old.promptContent === 'a fox', 'its typed prompt is still the content half');
  // The server must SELECT the fields, or they are undefined however well the
  // builder handles them — this is what hid the size slot.
  const src = fs.readFileSync(root('server.js'), 'utf8');
  // The Meta Assets read is the one with a select() whitelist — server.js
  // touches the creations collection in more than one place.
  const at = src.indexOf(".select('url', 'prompt'");
  ok(at > 0, 'the Meta Assets creations read uses a select() whitelist');
  const line = src.slice(at, src.indexOf('.get()', at));
  ['size', 'style', 'promptStyle', 'promptContent'].forEach((f) => {
    ok(line.includes(`'${f}'`), `the creations select() asks for ${f}`);
  });
}

console.log(`test-prompt-record: all good — ${n} checks`);
