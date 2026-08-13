#!/usr/bin/env node
/**
 * check-derived.js — the repo's "re-run script X after you edit Y" rules,
 * enforced instead of remembered.
 *
 * Several files in here are BUILT from another file, and several strings are
 * deliberately duplicated in two places. Both arrangements rely on whoever
 * edits the source also doing the second step, and chats keep not doing it —
 * public/writing.html shipped for weeks carrying a pill older than
 * scripts/pill.py, which is exactly the failure this catches.
 *
 * Two families:
 *
 *   REBUILD AND COMPARE — re-runs each free, deterministic, repo-local
 *   generator against a TEMP COPY of only the inputs it reads, then diffs its
 *   output against what is committed. A mismatch means someone edited the
 *   source and skipped the rebuild. The real working tree is never written to:
 *   every generator runs with its ROOT pointed at the temp copy.
 *
 *   COPIES IN SYNC — extracts the text that must be identical in two places
 *   and compares it. Each extraction is anchored on the constant's NAME and
 *   fails loudly ("couldn't find …") if the anchor is gone, so a renamed
 *   constant can never turn into a silent pass.
 *
 * Node stdlib only, no npm install, no network, no API keys, nothing paid.
 *
 *     node scripts/check-derived.js          exit 1 if anything failed
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const rel = (...p) => path.join(ROOT, ...p);
const read = f => fs.readFileSync(rel(f), 'utf8');

const results = [];
const pass = (group, name, detail) => results.push({ group, state: 'PASS', name, detail });
const skip = (group, name, why) => results.push({ group, state: 'SKIP', name, why });
const fail = (group, name, why, fix) => results.push({ group, state: 'FAIL', name, why, fix });

/* ───────────────────────── family A: rebuild and compare ─────────────────
 * Each entry declares exactly which paths its generator READS, because the
 * whole tree is 176MB and copying it per check would make this unusable. Read
 * the generator before adding one: it must touch nothing outside `inputs`,
 * reach no network, need no key, and embed no clock — a generator whose output
 * moves on its own would turn this into a checker nobody trusts.
 */
const GENERATORS = [
  {
    name: 'chats auto-poster setup script',
    script: 'scripts/build-chats-setup.py',
    // reads the hook body and wraps it in a fixed header/footer — nothing else.
    inputs: ['scripts/build-chats-setup.py', '.claude/hooks/post-to-feed.sh'],
    outputs: ['docs/chats-autopost-setup-script.sh', 'public/setup.sh'],
    fix: 'python3 scripts/build-chats-setup.py   (then commit both rebuilt files)',
    source: '.claude/hooks/post-to-feed.sh',
  },
  {
    name: 'injected autoscroll pill',
    script: 'scripts/gen-pill-inject.py',
    inputs: ['scripts/gen-pill-inject.py', 'scripts/pill.py'],
    outputs: ['public/pill-inject.html'],
    fix: 'python3 scripts/gen-pill-inject.py   (then commit public/pill-inject.html)',
    source: 'scripts/pill.py',
  },
  {
    name: 'Scratch Pad / Story Room page',
    script: 'scripts/gen-scratchpad.py',
    inputs: ['scripts/gen-scratchpad.py', 'ios/ImageForge/EBGaramond.ttf'],
    outputs: ['public/scratchpad.html'],
    fix: 'python3 scripts/gen-scratchpad.py   (then commit public/scratchpad.html)',
    source: 'scripts/gen-scratchpad.py',
  },
  {
    name: 'Writing Room page + dates.json',
    script: 'scripts/gen-writing.py',
    inputs: [
      'scripts/gen-writing.py', 'scripts/pill.py',
      'ios/ImageForge/EBGaramond.ttf',
      'docs/dating-book/working-drafts/featured2.json',
      'docs/dating-book/working-drafts/originals.json',
      'docs/dating-book/working-drafts/images2',
      'docs/dating-book/reference/date-thumbnails',
    ],
    outputs: ['public/writing.html', 'docs/dating-book/working-drafts/dates.json'],
    fix: 'python3 scripts/gen-writing.py   (then commit public/writing.html and docs/dating-book/working-drafts/dates.json)',
    source: 'scripts/pill.py, featured2.json, originals.json',
    // The ONE non-deterministic thing in this generator: the index tiles'
    // cover thumbnails are re-encoded to 340px WEBP by Pillow when Pillow is
    // installed, and fall back to the whole file base64'd when it isn't (and
    // a different Pillow could encode the same picture to different bytes).
    // So both sides get those data URIs blanked before the diff — the check
    // still catches every text change, which is where the drift lives.
    normalize: {
      'public/writing.html': s => s.replace(
        /(<span class="t-cover"><img alt="" src="data:image\/webp;base64,)[^"]*/g,
        '$1<COVER-THUMB-NORMALIZED>'),
    },
    note: 'cover thumbnails normalized (Pillow-dependent bytes)',
  },
];

function copyInto(tmp, p) {
  const src = rel(p);
  const dest = path.join(tmp, p);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function havePython() {
  const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function runGenerators() {
  const G = 'REBUILD AND COMPARE';
  if (!havePython()) {
    for (const g of GENERATORS) skip(G, g.name, 'python3 is not on PATH');
    return;
  }
  for (const g of GENERATORS) {
    const missing = [...g.inputs, ...g.outputs].filter(p => !fs.existsSync(rel(p)));
    if (missing.length) {
      fail(G, g.name, `missing from the repo: ${missing.join(', ')} — update scripts/check-derived.js`,
        'fix the paths in GENERATORS in scripts/check-derived.js');
      continue;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-derived-'));
    try {
      for (const p of g.inputs) copyInto(tmp, p);
      // the generators write straight to their output paths and do not mkdir
      for (const p of g.outputs) fs.mkdirSync(path.join(tmp, path.dirname(p)), { recursive: true });

      const r = spawnSync('python3', [g.script], {
        cwd: tmp, encoding: 'utf8', timeout: 10 * 60 * 1000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      });
      if (r.status !== 0) {
        const why = (r.stderr || r.error?.message || '').trim().split('\n').slice(-3).join(' / ');
        skip(G, g.name, `the generator would not run here: ${why || 'exit ' + r.status}`);
        continue;
      }

      const stale = [];
      for (const out of g.outputs) {
        const builtPath = path.join(tmp, out);
        if (!fs.existsSync(builtPath)) {
          stale.push(`${out} (the generator did not write it)`);
          continue;
        }
        const norm = g.normalize?.[out];
        let same;
        if (norm) {
          same = norm(fs.readFileSync(builtPath, 'utf8')) === norm(read(out));
        } else {
          same = fs.readFileSync(builtPath).equals(fs.readFileSync(rel(out)));
        }
        if (!same) stale.push(out);
      }
      if (stale.length) {
        fail(G, g.name,
          `${stale.join(', ')} — stale, the committed copy is not what ${g.script} builds today (source: ${g.source})`,
          g.fix);
      } else {
        pass(G, g.name, g.outputs.join(', ') + (g.note ? ` — ${g.note}` : ''));
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

/* ─────────────────── tiny JS readers for the copies-in-sync half ──────────
 * Deliberately not a parser: each reader is anchored on the constant's name
 * and throws with a plain sentence when the anchor is gone, so a rename shows
 * up as a loud failure of THIS file rather than a check that quietly passes.
 */
class AnchorGone extends Error {}
const gone = msg => { throw new AnchorGone(msg); };

// walk `src` from `i`, skipping whitespace and comments; returns the new index
function skipTrivia(src, i) {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.startsWith('//', i)) { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (src.startsWith('/*', i)) { const n = src.indexOf('*/', i); i = n < 0 ? src.length : n + 2; continue; }
    return i;
  }
}

// read one string literal starting at src[i] (which must be a quote)
function readStringLiteral(src, i) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== '`') gone(`expected a string literal at offset ${i}`);
  let out = '';
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const e = src[i + 1];
      i += 2;
      if (e === 'n') out += '\n';
      else if (e === 't') out += '\t';
      else if (e === 'r') out += '\r';
      else if (e === '\n') { /* line continuation */ }
      else if (e === 'u') {
        if (src[i] === '{') { const end = src.indexOf('}', i); out += String.fromCodePoint(parseInt(src.slice(i + 1, end), 16)); i = end + 1; }
        else { out += String.fromCharCode(parseInt(src.substr(i, 4), 16)); i += 4; }
      } else if (e === 'x') { out += String.fromCharCode(parseInt(src.substr(i, 2), 16)); i += 2; }
      else out += e;
      continue;
    }
    if (c === q) return { value: out, end: i + 1 };
    if (q === '`' && c === '$' && src[i + 1] === '{') gone('a template literal with ${…} is not a plain constant here');
    out += c;
    i++;
  }
  gone(`unterminated string literal at offset ${i}`);
}

/**
 * Move past a string starting at src[i], returning the index after it. Unlike
 * readStringLiteral this only SKIPS — so it handles a template literal with
 * `${…}` in it (buildDeck in the tarot deck is full of them), including any
 * strings nested inside the interpolation.
 */
function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === q) return i + 1;
    if (q === '`' && c === '$' && src[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < src.length && depth) {
        const d = src[i];
        if (d === '"' || d === "'" || d === '`') { i = skipString(src, i); continue; }
        if (d === '{') depth++;
        else if (d === '}') depth--;
        i++;
      }
      continue;
    }
    i++;
  }
  gone(`unterminated string starting at offset ${i}`);
}

// read `'a' + 'b' + …` starting at i
function readStringConcat(src, i) {
  let value = '';
  for (;;) {
    i = skipTrivia(src, i);
    const piece = readStringLiteral(src, i);
    value += piece.value;
    i = skipTrivia(src, piece.end);
    if (src[i] === '+') { i++; continue; }
    return { value, end: i };
  }
}

// index just past the `{` (or `[`) that opens `re`'s match, plus the matching close
function balanced(src, openIdx, open, close) {
  let depth = 0, i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); continue; }
    if (src.startsWith('//', i)) { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (src.startsWith('/*', i)) { const n = src.indexOf('*/', i); i = n < 0 ? src.length : n + 2; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) return i; }
    i++;
  }
  gone(`unbalanced ${open}${close} from offset ${openIdx}`);
}

/** The string value of a top-level field of `const <objName> = { … }`. */
function constObjectString(src, where, objName, field) {
  const m = new RegExp(`\\bconst\\s+${objName}\\s*=\\s*\\{`).exec(src);
  if (!m) gone(`couldn't find \`const ${objName} = {\` in ${where} — update scripts/check-derived.js`);
  const open = m.index + m[0].length - 1;
  const close = balanced(src, open, '{', '}');
  // scan the object body at depth 1 only, so a nested `prefix:` can't be mistaken for it
  let i = open + 1, depth = 1;
  while (i < close) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); continue; }
    if (src.startsWith('//', i)) { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (src.startsWith('/*', i)) { const n = src.indexOf('*/', i); i = n < 0 ? src.length : n + 2; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (depth === 1) {
      const key = new RegExp(`^${field}\\s*:`).exec(src.slice(i, i + field.length + 8));
      const before = src[i - 1];
      if (key && /[\s,{]/.test(before)) return readStringConcat(src, i + key[0].length).value;
    }
    i++;
  }
  gone(`couldn't find \`${field}:\` on ${objName} in ${where} — update scripts/check-derived.js`);
}

/** The source text of a `const NAME = [ … ];` / `function NAME() { … }` block. */
function declSource(src, where, re, open, close, label) {
  const m = re.exec(src);
  if (!m) gone(`couldn't find ${label} in ${where} — update scripts/check-derived.js`);
  const openIdx = m.index + m[0].length - 1;
  return src.slice(m.index, balanced(src, openIdx, open, close) + 1);
}

/* ───────────────────────── family B: copies in sync ───────────────────── */

/** (1) the Scratch Pad's art prompt, which server.js owns. */
function checkArtPrompt() {
  const G = 'COPIES IN SYNC';
  const name = 'Scratch Pad art prompt (scratchpad.js ART ← server.js PL_GPT)';
  try {
    const server = read('server.js');
    const pad = read('scratchpad.js');
    const bad = [];
    for (const field of ['prefix', 'characterLine']) {
      const truth = constObjectString(server, 'server.js', 'PL_GPT', field);
      const copy = constObjectString(pad, 'scratchpad.js', 'ART', field);
      if (truth !== copy) bad.push(field);
    }
    if (bad.length) {
      fail(G, name,
        `ART.${bad.join(' and ART.')} in scratchpad.js no longer matches PL_GPT in server.js`,
        'copy PL_GPT.prefix / PL_GPT.characterLine from server.js into ART in scratchpad.js verbatim — server.js is the source of truth');
    } else {
      pass(G, name, 'prefix + characterLine identical');
    }
  } catch (e) {
    fail(G, name, e.message, 'update the anchors in scripts/check-derived.js');
  }
}

/** (2) the 78-card tarot deck, which witch.html owns. */
function checkTarotDeck() {
  const G = 'COPIES IN SYNC';
  const name = 'tarot deck (tarot-email.js ← public/witch.html)';
  const build = (src, where) => {
    const parts = [
      declSource(src, where, /\bconst\s+MAJORS\s*=\s*\[/, '[', ']', '`const MAJORS = [`'),
      declSource(src, where, /\bconst\s+SUITS\s*=\s*\[/, '[', ']', '`const SUITS = [`'),
      declSource(src, where, /\bconst\s+RANKS\s*=\s*\[/, '[', ']', '`const RANKS = [`'),
      declSource(src, where, /\bfunction\s+buildDeck\s*\(\s*\)\s*\{/, '{', '}', '`function buildDeck()`'),
    ];
    // Run the extracted declarations only — an isolated context with nothing
    // in it, so this can never reach a file, the network or a key.
    return vm.runInNewContext(
      parts.join('\n;\n') + '\n;JSON.stringify(buildDeck())',
      Object.create(null), { timeout: 5000, filename: `${where}#deck` });
  };
  try {
    const truth = build(read('public/witch.html'), 'public/witch.html');
    const copy = build(read('tarot-email.js'), 'tarot-email.js');
    const n = JSON.parse(truth).length;
    if (truth !== copy) {
      const a = JSON.parse(truth), b = JSON.parse(copy);
      const first = a.length !== b.length
        ? `${a.length} cards in witch.html against ${b.length} in tarot-email.js`
        : `first card that differs: ${(a.find((c, i) => JSON.stringify(c) !== JSON.stringify(b[i])) || {}).name}`;
      fail(G, name,
        `the built decks differ — ${first}. The daily email would then show a different card from the website.`,
        'copy MAJORS / SUITS / RANKS / buildDeck from public/witch.html into tarot-email.js verbatim — witch.html is the source of truth');
    } else {
      pass(G, name, `${n} cards, name + meanings + orientation text all identical`);
    }
  } catch (e) {
    fail(G, name, e.message, 'update the anchors in scripts/check-derived.js');
  }
}

/** (3) the SetPyramid glyph, drawn twice at two box sizes. */
function checkSetPyramid() {
  const G = 'COPIES IN SYNC';
  const name = 'SetPyramid glyph (promptlab.html ↔ iOS setpyramid.svg)';
  // Compare the SHAPE, not the text: the two copies live in a 64 box and a 24
  // box, so every coordinate is scaled into the same 0..1 space first and
  // compared with a tolerance (the copies are each rounded to 2dp in their own
  // box, which is ~0.0004 apart once normalized). The iOS file's wrapping
  // <g class="norm" transform> is deliberately ignored: that is
  // normalize-glyphs.py's doing, it re-centres the ink inside the iOS box, and
  // it has no counterpart in the web copy.
  const TOL = 0.001;
  const paths = (svg, where) => {
    const vb = /viewBox="\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(svg);
    if (!vb) gone(`no viewBox in ${where} — update scripts/check-derived.js`);
    const w = parseFloat(vb[1]);
    const out = [];
    for (const m of svg.matchAll(/<path\b([^>]*)\/?>/g)) {
      const attrs = m[1];
      const d = /\bd="([^"]*)"/.exec(attrs);
      if (!d) continue;
      const fill = /\bfill="([^"]*)"/.exec(attrs);
      const cmds = d[1].match(/[A-Za-z]/g) || [];
      const nums = (d[1].match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(x => parseFloat(x) / w);
      out.push({ cmds: cmds.join(''), nums, filled: !!fill && fill[1] !== 'none' });
    }
    if (!out.length) gone(`no <path> found in ${where} — update scripts/check-derived.js`);
    return out;
  };
  try {
    const ios = paths(read('ios/ImageForge/Assets.xcassets/SetPyramid.imageset/setpyramid.svg'),
      'ios/…/SetPyramid.imageset/setpyramid.svg');
    const web = paths(read('public/promptlab.html').match(/pyramid:\s*'([^']*)'/)?.[1]
      ?? gone("couldn't find `pyramid:` in ICONS in public/promptlab.html — update scripts/check-derived.js"),
      'public/promptlab.html ICONS.pyramid');
    const bad = [];
    if (ios.length !== web.length) {
      bad.push(`${ios.length} paths in the iOS asset against ${web.length} in promptlab.html`);
    } else {
      ios.forEach((p, i) => {
        const q = web[i];
        if (p.cmds !== q.cmds) bad.push(`path ${i + 1}: commands ${p.cmds} vs ${q.cmds}`);
        else if (p.nums.length !== q.nums.length) bad.push(`path ${i + 1}: ${p.nums.length} vs ${q.nums.length} numbers`);
        else {
          const off = p.nums.map((v, k) => Math.abs(v - q.nums[k])).filter(d => d > TOL);
          if (off.length) bad.push(`path ${i + 1}: ${off.length} coordinate(s) off by up to ${(Math.max(...off) * 64).toFixed(2)} in a 64 box`);
        }
        if (p.filled !== q.filled) bad.push(`path ${i + 1}: filled ${p.filled} vs ${q.filled}`);
      });
    }
    if (bad.length) {
      fail(G, name, `the two drawings have diverged — ${bad.join('; ')}`,
        'redraw the changed copy so both match: ios/ImageForge/Assets.xcassets/SetPyramid.imageset/setpyramid.svg (64 box) and ICONS.pyramid in public/promptlab.html (24 box) — scale every coordinate by 24/64, then run python3 scripts/normalize-glyphs.py');
    } else {
      pass(G, name, `${ios.length} paths, same commands and same geometry once scaled`);
    }
  } catch (e) {
    fail(G, name, e.message, 'update the anchors in scripts/check-derived.js');
  }
}

/* ───────────────── glyph normalization (only if its deps are here) ────── */
function checkGlyphNormalization() {
  const G = 'REBUILD AND COMPARE';
  const name = 'every bundled glyph fills 0.90 of its own box';
  const script = rel('scripts/normalize-glyphs.py');
  if (!fs.existsSync(script)) { skip(G, name, 'scripts/normalize-glyphs.py is gone'); return; }
  const deps = spawnSync('python3', ['-c', 'import PIL, numpy'], { encoding: 'utf8' });
  const chrome = /CHROME\s*=\s*"([^"]+)"/.exec(fs.readFileSync(script, 'utf8'))?.[1];
  if (deps.status !== 0 || !chrome || !fs.existsSync(chrome)) {
    skip(G, name, 'needs Pillow + numpy and a headless Chromium at the hardcoded path in normalize-glyphs.py — not installed here (a GitHub runner has none of the three)');
    return;
  }
  const r = spawnSync('python3', ['scripts/normalize-glyphs.py', '--check'],
    { cwd: ROOT, encoding: 'utf8', timeout: 5 * 60 * 1000 });
  if (r.status === 0) pass(G, name, 'normalize-glyphs.py --check');
  else fail(G, name, (r.stdout || r.stderr || '').trim().split('\n').slice(-4).join(' / '),
    'python3 scripts/normalize-glyphs.py   (then commit the rewritten SVGs)');
}

/* ────────────────────────────── report ───────────────────────────────── */
runGenerators();
checkGlyphNormalization();
checkArtPrompt();
checkTarotDeck();
checkSetPyramid();

const W = 74;
console.log('\nderived files + duplicated copies — the "re-run X after editing Y" rules\n');
for (const group of ['REBUILD AND COMPARE', 'COPIES IN SYNC']) {
  const rows = results.filter(r => r.group === group);
  if (!rows.length) continue;
  console.log(group);
  for (const r of rows) {
    console.log(`  ${r.state}  ${r.name}`);
    if (r.state === 'PASS' && r.detail) console.log(`        ${r.detail}`);
    if (r.state === 'SKIP') console.log(`        skipped: ${r.why}`);
    if (r.state === 'FAIL') {
      console.log(`        ${r.why}`);
      console.log(`        fix: ${r.fix}`);
    }
  }
  console.log('');
}

// Documented non-checks — written down so the next chat knows they were
// considered and why they are not here, instead of assuming they were missed.
console.log('NOT CHECKED (on purpose)');
console.log('  public/chats.html / scripts/gen-chats.py — the page is hand-edited and the');
console.log('        template is resynced FROM it (scripts/resync-gen-chats.py). Rebuilding');
console.log('        the page from a stale template REVERTS shipped work, which has happened');
console.log('        twice, so this checker never runs gen-chats.py. Run');
console.log('        `python3 scripts/resync-gen-chats.py --check` by hand after editing the page.');
console.log('');

const failed = results.filter(r => r.state === 'FAIL');
const skipped = results.filter(r => r.state === 'SKIP');
console.log(`${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
if (failed.length) {
  console.log('\nSomething derived is out of date. Run the fix line under each failure above,');
  console.log('commit the rebuilt/synced file, and this goes green.');
}
console.log('');
process.exit(failed.length ? 1 : 0);
