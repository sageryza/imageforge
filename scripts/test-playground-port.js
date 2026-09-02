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
 * the port indicator is really gone from the page (2026-08-31, "delete the
 * red" ×2) — including after she taps a different tile, which used to repaint
 * it and would now throw if a call to the deleted painter were left behind.
 *
 *   node scripts/test-playground-port.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
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
  // The Triangle tile (2026-08-31) attaches the SAME reference file as Dreamy
  // and quotes the same prefix, so a triangle card carries BOTH tiles'
  // evidence — the equilateral clause has to out-reach them, or every card the
  // Triset game ever drew ports back as a plain Dreamy picture.
  ['refs/dream-mystery.jpg — copy its drawing style but do NOT copy its content. '
    + require(path.join(ROOT, 'triangle-clause.js')).TRIANGLE_CLAUSE,
  'triangle', true, 'a triangle card → Triangle, not Dreamy underneath it'],
  // EVERY WORDING THE CLAUSE HAS EVER HAD, verbatim off her filed cards
  // (measured 2026-09-02 over all 715 of them). A reword never rewrites the
  // style halves already on file, so these are permanent fixtures — the same
  // rule the old reference FILENAMES follow — and they are what caught the
  // live bug: 565 of the 715 were porting back as plain Dreamy pictures.
  ['The FIRST attached image is a STYLE reference — copy its drawing style but do NOT '
    + 'copy its content, subjects, or composition.\n\n[content]\n\nRender as ONE single '
    + 'illustration — NOT a grid, NOT split panels. The illustration is an EQUILATERAL '
    + 'TRIANGLE-SHAPED CARD, all three sides exactly the same length, point up',
  'triangle', true, 'the wording 537 of her cards carry (gen 1) → Triangle'],
  ['copy its drawing style but do NOT copy its content, subjects, or composition.'
    + '\n\n[content]\n\nThe illustration is a TRIANGLE-SHAPED CARD, point up: a triangle '
    + 'with a plain paper border and a hand-drawn frame line',
  'triangle', true, 'the earliest triset wording (gen 0) → Triangle'],
  ['The attached image is a STYLE reference — copy its style but do NOT copy its '
    + 'content, subjects, or composition.\n\ncenter the content of the image in an '
    + 'equilateral triangle with a hand drawn border, like the reference photo. do not '
    + 'draw multiple panels. no text.\n\n[content]\n\nno text.',
  'triangle', true, 'the hand-written wording, before the tile existed → Triangle'],
  ['After the style reference, the three attached images are three triangular picture '
    + 'cards from a matching game. Play the game: either find ONE quality all three '
    + "cards share, or invent a fourth thing.\n\n[content]\n\nEQUILATERAL TRIANGLE-SHAPED CARD",
  'triangle', true, "an 'auto' venn card → Triangle"],
  // …and the tile it is DERIVED from still answers for itself.
  ['refs/dream-mystery.jpg — copy its drawing style but do NOT copy its content.',
    'dreamy', true, 'a plain Dreamy picture is still Dreamy'],
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
// `evidence:false` is a DELIBERATE opt-out, and exactly one tile may claim it:
// the plain ChatGPT tile sends her words with no reference and no baked prefix,
// so nothing on a picture's record can ever name it. Every other tile must be
// identifiable by something, or a picture made on it can never route back.
port.PORT_STYLES.forEach((s) => {
  if (s.evidence === false) return;
  ok((s.refs || []).length + (s.prefixes || []).length + (s.triggers || []).length > 0,
    s.key + ' has evidence that can identify it');
});
ok(port.PORT_STYLES.filter((s) => s.evidence === false).length === 1,
  'exactly one tile opts out of evidence (the reference-less ChatGPT one)');
ok(port.PORT_STYLES.find((s) => s.evidence === false).key === 'plain',
  'and it is `plain`');

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
// Borders have been round the houses. The tail imported from nde-panel.py
// BANNED one, on a reference whose own drawn frames are the look; a cut that
// asked for one shipped for an hour and she took it back out ("take your
// borderline out"); then on 2026-08-22 she dictated the whole tail herself and
// put it back — "Draw it inside a hand-drawn border, like the frames in the
// style reference". So it ASKS for one now, in her words, and the thing to
// guard is that it never goes back to banning one.
ok(/hand-drawn border/i.test(dream.suffix), 'the sent suffix asks for a hand-drawn border');
ok(!/no border|without a border/i.test(dream.suffix), 'and never bans one');
ok(!/caption box/i.test(dream.suffix), 'and does not ban caption boxes (her ask — the reference has them)');
// "Minimal text only." until 2026-08-22, a flat "no text." in her own rewrite
// — and back to "minimal text." on 2026-08-27, when she made the two options
// the TOGGLE's two words ("just two options minimal and none and it should
// just be those words"). So the baked tail says `minimal text.` and `no text.`
// is what the switch sends; this line asserted the switch's word for four
// days and failed on main the whole time. The No-text TOGGLE swaps this exact
// clause, so test-playground-notext.js pins it against dreamy.noText.from —
// this only checks the tail still has one.
ok(/minimal text\./i.test(dream.suffix), 'it says "minimal text.", her 2026-08-27 default');
// The canvas toggles now, so the prompt must not name a shape.
ok(!/vertical|portrait|square/i.test(dream.prefix + dream.suffix),
  'and it names no orientation, because the canvas toggles');
ok(dream.noCharacter === true,
  'no Sophie character card on Dreamy (hers is the watercolor look)');

// THE TRIANGLE TILE IS DERIVED, NOT A LITERAL (2026-08-31, Sophie: "add
// triangle as a new playground style · w image and prompt w new equilateral").
// server.js builds it out of the dreamy entry above with triangle-clause.js's
// own builder, so the honest check is to run that REAL builder over the REAL
// dreamy literal and assert on what comes out — the same rule as the block
// above, one step further along.
const tri = require(path.join(ROOT, 'triangle-clause.js'));
const triangle = tri.triangleStyle(dream);
ok(serverSrc.indexOf("PL_GPT_STYLES.triangle = require('./triangle-clause').triangleStyle(PL_GPT_STYLES.dreamy)") >= 0,
  'server.js derives the Triangle tile from dreamy, rather than transcribing it');
ok(triangle.swapped === true,
  "dreamy's border clause was found to swap (the anchor still matches)");
ok(triangle.refFiles[0] === 'dream-mystery.jpg',
  'Triangle attaches the SAME reference image as Dreamy — her "w image"');
ok(triangle.prefix === dream.prefix, "and Dreamy's prefix, byte for byte");
ok(/EQUILATERAL TRIANGLE-SHAPED CARD/.test(triangle.suffix)
  && /all three sides exactly the same length/.test(triangle.suffix),
  'the tail asks for an EQUILATERAL triangle card — her "new equilateral"');
// NOTHING IS ADDED BESIDE THE EQUILATERAL LINE (2026-08-31, Sophie: "i didn't
// ask you to add the triangle lines" · "add more importance to the equilateral
// line if anything"). A clause telling the model to compose INTO the triangle
// shipped for one batch and she cut it — it bent the subjects to the frame — so
// this pins its ABSENCE. It used to pin its presence; that is history.
ok(!/Compose the subject to USE the triangle/i.test(triangle.suffix),
  'and the composition line she cut is not back');
ok(!/hand-drawn border, like the frames in the style reference\. minimal/.test(triangle.suffix),
  "and dreamy's rectangular border clause is GONE, not argued with");
ok(/do not draw its content/i.test(triangle.suffix)
  && /green tank top/i.test(triangle.suffix),
  "the rest of dreamy's tail rides along — the anti-content bookend and the ban");
// Her no-text toggle sits AFTER the border clause, so the swap must not eat it.
ok(triangle.noText && triangle.noText.from === dream.noText.from
  && triangle.suffix.includes(triangle.noText.from),
  'her no-text toggle still has its clause to swap on this tile');
// Every gpt tile offers Panels. Dreamy's sheet anchor is the clause this tile
// just consumed, so it needs its own or a sheet run ships "NOT a grid".
const sheetTail = require(path.join(ROOT, 'sheet-grid.js'))
  .applySheet(triangle.suffix, triangle.sheet, 'a 2x2 grid');
ok(sheetTail.includes('a 2x2 grid') && !/NOT a grid/.test(sheetTail),
  'a panels run swaps the anti-grid sentence out, and keeps the triangle');
ok(/each one is an EQUILATERAL TRIANGLE-SHAPED CARD/.test(sheetTail),
  'so every cell of a sheet is still a triangle card');
// A reworded tail (anchor gone) PREPENDS the clause rather than losing it.
const reworded = tri.triangleStyle({ ...dream, suffix: 'A reworded tail.',
  sheet: { from: 'nope', to: '' } });
ok(reworded.swapped === false && /TRIANGLE-SHAPED CARD/.test(reworded.suffix)
  && reworded.suffix.includes('A reworded tail.'),
  'a reworded dreamy tail keeps both the triangle clause and her words');
// ONE COPY OF THE WORDING: triset.js draws the same card and must not carry a
// transcript of it.
const trisetSrc = fs.readFileSync(path.join(ROOT, 'triset.js'), 'utf8');
ok(/require\('\.\/triangle-clause'\)/.test(trisetSrc)
  && trisetSrc.indexOf('EQUILATERAL TRIANGLE-SHAPED CARD') < 0,
  'triset.js reads the clause from triangle-clause.js and keeps no copy');

// THE PORT'S EVIDENCE IS CHECKED AS BEHAVIOUR, NOT AS A QUOTE (2026-09-02).
// It was a 150-character transcript of the clause, and it went stale twice —
// the second time silently handing 565 of her 715 filed triangle cards back
// to Dreamy. So what is asserted is that the REAL text this tile sends today
// routes to Triangle, which a reword cannot quietly break: it either still
// says "triangle-shaped card" and passes, or it fails here loudly.
const triHalf = triangle.prefix + '\n\n[content]\n\n' + triangle.suffix;
ok(port.matchStyle(triHalf, '').style === 'triangle',
  "today's real Triangle style half routes to the Triangle tile");
ok(port.PORT_STYLES.find((s2) => s2.key === 'triangle').prefixes
  .some((f) => triHalf.toLowerCase().indexOf(f.toLowerCase()) >= 0),
  'at least one listed fragment is verbatim in the clause as it stands now');
// A PAST WORDING IS NEVER DROPPED — a reword does not rewrite the thousands of
// style halves already filed, exactly as with the old reference filenames. The
// list may only grow; these are the ones her library actually holds.
['triangle-shaped card', 'equilateral triangle with a hand drawn border',
  'triangular picture cards from a matching game'].forEach((f) => {
  ok(port.PORT_STYLES.find((s2) => s2.key === 'triangle').prefixes.indexOf(f) >= 0,
    'the wording "' + f.slice(0, 34) + '…" is still listed');
});
// The relationship, not a length race: Triangle IS dreamy with one clause
// swapped, so both always match and Triangle must win however short its quote.
ok((port.PORT_STYLES.find((s2) => s2.key === 'triangle').beats || []).indexOf('dreamy') >= 0,
  'Triangle is declared to out-rank the tile it is derived from');
ok(port.matchStyle('copy its drawing style but do NOT copy its content, subjects, '
  + 'or composition. A TRIANGLE-SHAPED CARD.', '').style === 'triangle',
  "…so a SHORT triangle quote still beats Dreamy's longer one");

// Every `prefixes` fragment must be a verbatim substring of that style's REAL
// baked wording in server.js — otherwise it is a vibe, not evidence.
const GPT_ID = { chatgpt: 'evan', dreamy: 'dreamy', pastel: 'pastel', scarry: 'scarry',
  hoonies: 'hoonies', plain: 'plain' };
port.PORT_STYLES.forEach((s) => {
  (s.prefixes || []).forEach((frag) => {
    const id = GPT_ID[s.key];
    // The Triangle tile has no literal block to read and its evidence is in
    // the TAIL, not the prefix — the clause triangle-clause.js swaps in, which
    // is exactly the text that reaches the model.
    if (!id) {
      // The Triangle tile has no literal block in server.js, and its list
      // holds PAST wordings on purpose (see its comment) — a fragment that is
      // not in today's clause is a historical alias, and the fixtures above
      // are what prove each one still earns its place. What must hold here is
      // that TODAY's clause is covered; that is asserted once, below.
      ok(s.key === 'triangle', s.key + ': the only table with no server literal');
      return;
    }
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

// The OLDER wording is still in the repo and still right for what it was built
// for, so both copies carry a note saying a newer one exists and that picking
// between them is deliberate (Sophie's ask, 2026-08-20: "a note that says
// there's a new prompt in town … so other chats can decide if they want that
// one or the new one"). A silent old copy is exactly how this tile shipped a
// day-stale tail in the first place.
console.log('the old wording is signposted, not orphaned');
// The marker is the CODE line, not the word — the note itself talks about the
// SUFFIX, so a bare 'SUFFIX' matched inside the note and read the wrong window.
[['scripts/nde-panel.py', 'SUFFIX = ('], ['scripts/style-triptych.js', "id: 'dream'"]]
  .forEach(([rel, marker]) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const at = src.indexOf(marker);
    const before = src.slice(Math.max(0, at - 1600), at);
    ok(/PL_GPT_STYLES\.dreamy/.test(before),
      rel + ' points at the current wording by name');
    ok(/newer|current one/i.test(before) && /choose|choice|pick/i.test(before),
      rel + ' says it is a choice, not a replacement');
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
// (Aug 2026: the canvas gained resolution TIERS, so the lookup moved from the
// flat PL_GPT.sizes onto PL_GPT.res — the rule it is guarding is unchanged.)
ok(/PL_GPT\.res\[String\(req\.body\.canvas \|\| ''\)\] \? String\(req\.body\.canvas\) : 'portrait'/.test(serverSrc),
  'an unknown canvas still falls back to a REAL size on the server, never an invented one');
// SQUARE is the first-ever default only — the shape is REMEMBERED since Aug
// 2026 ("make it not default to square, but just whatever the last option
// was"), so what this pins now is that an unknown stored value still falls
// back to a real shape rather than riding through as an invented one.
ok(/localStorage\.getItem\('promptlab_canvas'\) : 'square'/.test(pageSrc),
  'the page falls back to SQUARE when nothing valid is stored');
ok(/size:\s*cfg\.size \|\| PL_GPT\.size/.test(serverSrc),
  'the render job uses the RUN\'s size, not the module default');
// The page must not carry its own copy of the style prompt — that is the whole
// reason the endpoint exists, and a copy is what went stale before.
// A NON-EMPTY literal is the thing to catch. `prefix: ''` is the LoRA's
// synthesised shape saying it has no prefix at all (bakedFor, 2026-08-24) —
// the opposite of a stale copy, and the looser regex flagged it as one.
ok(!/prefix:\s*'[^']/.test(pageSrc), 'promptlab.html holds NO copy of a style prefix');
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
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
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
  // ── THE INDICATOR IS GONE (2026-08-31) ──────────────────────────────
  // Sophie scribbled it out twice — first the same-tile sentence, then, on the
  // build that shipped without it, the one naming the tile she had moved off:
  // "delete the red" · "still there". So the whole row went, and the sender's
  // `sameref` flag (asserted live in the matcher above, and in
  // test-asset-doors.js) is simply no longer read by this page.
  console.log('the indicator is gone');
  await page.goto(base + '/playground?prompt=a%20cat&style=dreamy&sameref=1');
  await page.waitForSelector('#prompt');
  ok(await page.$('#reftag') === null, 'no indicator on a matched port');
  ok(await page.inputValue('#prompt') === 'a cat', 'and the content half still landed in the box');

  // The two branches that used to speak: switching tile, and a port nothing
  // identified. Neither may draw anything now, and neither may throw — the
  // painter is deleted, so a leftover call would take the whole script down
  // and every assertion after it with it.
  await page.selectOption('#stylepick', 'pastel');
  ok(await page.$('#reftag') === null, 'nothing after switching tile');
  ok(await page.inputValue('#prompt') === 'a cat',
    'and the style tap did not throw — her words are still there');
  await page.goto(base + '/playground?prompt=a%20cat&style=chatgpt&sameref=0');
  await page.waitForSelector('#prompt');
  ok(await page.$('#reftag') === null, 'nothing on an unmatched port either');
  // innerText, never textContent: the latter includes the <script>, where a
  // comment about the deleted row lives, so it would fail on the prose
  // explaining the deletion. The honest question is what RENDERS.
  const shown = await page.evaluate(() => document.body.innerText);
  ok(!/reference and style prompt|not the one behind it|This picture was made on/.test(shown),
    'and none of the three sentences renders anywhere on the page');

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

  // ── the style drop-down ────────────────────────
  // She sees the style she is on and nothing else — the other five are behind
  // the tap, and a chevron says so.
  console.log('the style drop-down');
  const pick = await page.evaluate(() => {
    const sel = document.getElementById('stylepick');
    const cs = getComputedStyle(sel);
    return {
      exists: !!sel,
      tiles: document.querySelectorAll('.styles .stylebtn').length,
      options: sel.options.length,
      value: sel.value,
      chevron: /svg/.test(cs.backgroundImage),
      font: parseFloat(cs.fontSize),
    };
  });
  ok(pick.exists && pick.tiles === 0, 'the row of tiles is gone — one control in its place');
  // Counted off the page's own STYLES, never a literal — a new tile is one
  // entry in that table and must not also be a number to remember here.
  ok(pick.options === pageKeys.length,
    'every style is still reachable inside it (' + pick.options + ' of ' + pageKeys.length + ')');
  ok(pick.chevron, 'and it wears an arrow so it reads as a drop-down');
  ok(pick.font >= 16, 'at 16px, or iOS zooms the page when it opens the picker');

  // ── the canvas toggle ───────────────────────────────────────────────
  console.log('the canvas toggle');
  ok(await page.isVisible('#canvastog'), 'the toggle shows on a gpt style');
  ok(await page.evaluate(() => document.getElementById('c-square').classList.contains('on')),
    'square is lit by default');
  // She could not find this control at all on her phone: flex squeezed the
  // group to 50px, "Portrait" bled out of its box and the Square half was
  // clipped off the row. Measure the real boxes rather than trusting
  // isVisible(), which was true the whole time it was unusable.
  const seg = await page.evaluate(() => {
    const g = document.getElementById('canvastog');
    const b = g.getBoundingClientRect();
    return Array.prototype.map.call(g.querySelectorAll('button'), (x) => {
      const r = x.getBoundingClientRect();
      return { w: r.width, sw: x.scrollWidth, inside: r.right <= b.right + 1 };
    });
  });
  ok(seg.length === 2 && seg.every((x) => x.inside),
    'both segments sit inside the group — neither is clipped off the row');
  ok(seg.every((x) => x.w >= x.sw - 1),
    'and neither label is squeezed narrower than its own words');
  ok(/0\.5/.test(await page.getAttribute('#c-portrait', 'title'))
    && /0\.6/.test(await page.getAttribute('#c-square', 'title')),
    'both say what they cost, because the square is the DEARER one');
  await page.click('#c-square');
  ok(await page.evaluate(() => document.getElementById('c-square').classList.contains('on')),
    'and it switches');

  // The LoRA rides a different shape parameter, so the CANVAS toggle comes
  // off. The Prompt button does NOT — the LoRA wraps her words too (the `wtr`
  // trigger in front, `White background` after) and hiding the panel on the
  // tile the page opens on is what made her say there was no way to see the
  // style prompt at all (2026-08-24). These three used to assert the opposite.
  await page.selectOption('#stylepick', 'watercolor');
  ok(await page.isVisible('#promptbtn'), 'the prompt button stays on the LoRA');
  ok(!(await page.isVisible('#canvastog')), 'no canvas toggle on the LoRA');
  // The button is a TOGGLE and the panel was left open above, so close it
  // first — otherwise this taps it shut and calls that a failure.
  if (await page.isVisible('#promptpanel')) await page.click('#promptbtn');
  await page.click('#promptbtn');
  ok(await page.isVisible('#promptpanel'), "and the LoRA's own panel opens");
  ok(/wtr/.test(await page.textContent('#promptpanel')),
    "and it shows the LoRA's own trigger word");

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
