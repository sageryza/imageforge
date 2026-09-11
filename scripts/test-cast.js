#!/usr/bin/env node
/* THE CHARACTER LIBRARY FOR FOOTAGE (2026-09-11, Sophie: "a version of
   'characters' for footage so i can click a button and it auto adds the line
   at the top, adding and referencing videos and stills · characters w multiple
   outfits · these pajamas float w any patient · per film - diff folders ·
   some characters are just stills for now").

   THE PURE HALF is cast-line.js — the one thing in this feature that can be
   wrong in a way nobody sees: a line stored against `[Video1]` reads perfectly
   and points at somebody ELSE'S clip the moment a second character rides
   along, and the clip still draws, just of the wrong person. So every slot
   here is computed against a strip that already has something in it.

   THE PAGE HALF drives the REAL public/footage.html in headless Chromium and
   MEASURES what a tap does: what is in the prompt box afterwards, and what the
   strip really holds. A lit chip and a sheet that renders say nothing about
   either — an attach that computes the right line and never reaches the box,
   one that reaches the box with the library's own stale slots in it, and one
   that adds the same sentence twice all look identical in the source.

   Run: node scripts/test-cast.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('CAST — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('CAST — ' + pass + ' passed');
}

const CL = require('../cast-line');
const C = require('../cast');

// ── the shelf the whole file is driven against ──────────────────────────────
// Her ward library in miniature: Sophie with two outfits and a clip, the
// pajamas as their own entry (head off by default, a three-still set named),
// Mayra as a STILL-ONLY character who wears the same pajamas, and a place.
// THE THREE STILLS HERE ARE THE FIXTURE'S, NOT THE SHELF'S — since 2026-09-11
// her real `sophie` wardrobe look carries ONE full-body still ("just the
// full body pajama, no tape pocket or second"); three stay here because a
// line counting several slots is what the renumbering below has to prove.
const JAZZ = 'https://x/jazz.mp4', HEADLESS = 'https://x/pj-headless.png', POCKET = 'https://x/pj-pocket.png';
const FACE = 'https://x/sophie-face.png';
const PJA = 'https://x/pj-a.png', PJC = 'https://x/pj-c.png', MAYRA = 'https://x/mayra.png', ROOM = 'https://x/room.png';
const SOPHIE_PJ = 'sophie is the woman in {1}.  she wears the blue hospital pajamas in {2}, {3} and {4}, NOT the dress in {1}';
const sophie = { slug: 'sophie', name: 'Sophie', kind: 'person', looks: [
  { key: 'pajamas', name: 'the blue pajamas', line: SOPHIE_PJ, refs: [{ url: JAZZ, kind: 'video' }], wear: ['blue-pajamas:sophie'] },
  { key: 'street', name: 'street clothes', line: 'sophie is the woman in {1}.', refs: [{ url: JAZZ, kind: 'video' }], wear: [] },
  { key: 'face', name: 'the face still only', line: 'sophie is the woman in {1}.', refs: [{ url: FACE, kind: 'image' }], wear: [] },
] };
const pj = { slug: 'blue-pajamas', name: 'the blue hospital pajamas', kind: 'wardrobe', looks: [
  { key: 'headless', name: 'head off', line: 'she wears the blue hospital pajamas in {1} and {2}.', refs: [{ url: HEADLESS, kind: 'image' }, { url: POCKET, kind: 'image' }], wear: [] },
  { key: 'sophie', name: "Sophie's three", line: '', refs: [{ url: PJA, kind: 'image' }, { url: PJC, kind: 'image' }, { url: POCKET, kind: 'image' }], wear: [] },
] };
const mayra = { slug: 'mayra', name: 'Mayra', kind: 'person', looks: [
  { key: 'pajamas', name: 'the blue pajamas', line: 'Mayra: the woman in {1}. she wears the blue hospital pajamas in {2} and {3}.', refs: [{ url: MAYRA, kind: 'image' }], wear: ['blue-pajamas'] },
] };
const place = { slug: 'her-room', name: 'her room', kind: 'setting', looks: [
  { key: 'default', name: 'her room', line: 'setting: mental hospital. her room in {1}.', refs: [{ url: ROOM, kind: 'image' }], wear: [] },
] };
const BY = { sophie, 'blue-pajamas': pj, mayra, 'her-room': place };

// ── the pure half ───────────────────────────────────────────────────────────
{
  // THE SLOT IS DECIDED BY THE WHOLE STRIP, NOT BY THE LIBRARY. Sophie's line
  // was written when her three pajama stills were [Image1..3]; attached on top
  // of a room still they are [Image2..4], and the line has to follow.
  const alone = CL.plan({ refs: [], entry: sophie, look: sophie.looks[0], byslug: BY });
  ok('on an empty strip her ward line resolves exactly as it has always read',
    alone.line === 'sophie is the woman in [Video1].  she wears the blue hospital pajamas in [Image1], [Image2] and [Image3], NOT the dress in [Video1]');
  const after = CL.plan({ refs: [{ url: ROOM, kind: 'image' }], entry: sophie, look: sophie.looks[0], byslug: BY });
  ok('attached behind a still she already had, every pajama slot moves up one',
    after.line === 'sophie is the woman in [Video1].  she wears the blue hospital pajamas in [Image2], [Image3] and [Image4], NOT the dress in [Video1]');
  ok('the clip is still [Video1] — the kinds are counted apart', /the woman in \[Video1\]/.test(after.line));

  // THE ORDER IS THE DOORS' — images, then videos, then audio, which is what
  // footage.js numbers and what the page paints. A plan that appended in tap
  // order would hand back slots the server then renumbers.
  ok('the strip comes back images first, then videos', after.refs.map((r) => r.kind).join(',') === 'image,image,image,image,video');
  ok('the strip it hands back agrees with footage.js about every slot name', (function () {
    const slots = require('../footage').slotsOf(after.refs);
    return slots.every((r) => after.slots[r.url] === r.slot);
  })());

  // THE PAJAMAS FLOAT — one copy of the stills, worn by anyone
  const m = CL.plan({ refs: [], entry: mayra, look: mayra.looks[0], byslug: BY });
  ok('a still-only character wears the same pajama entry',
    m.line === 'Mayra: the woman in [Image1]. she wears the blue hospital pajamas in [Image2] and [Image3].');
  ok('`wear` with no look named takes the wardrobe\'s FIRST look — head off, her rule',
    m.refs.some((r) => r.url === HEADLESS) && !m.refs.some((r) => r.url === PJA));
  ok('`wear` can name a look — Sophie\'s line counts three, so it gets her three',
    alone.refs.filter((r) => r.kind === 'image').map((r) => r.url).join(',') === [PJA, PJC, POCKET].join(','));
  ok('a wardrobe slug that is not on the shelf is skipped, never guessed',
    CL.plan({ refs: [], entry: { name: 'X', looks: [{ key: 'a', line: '{1}', refs: [{ url: MAYRA }], wear: ['nope'] }] }, look: null, byslug: BY }).refs.length === 1);

  // NOTHING IS ATTACHED TWICE, and the count says what really landed
  const twice = CL.plan({ refs: alone.refs, entry: sophie, look: sophie.looks[0], byslug: BY });
  ok('attaching the same look twice adds nothing and says so', twice.added === 0 && twice.refs.length === alone.refs.length);
  ok('a shared still rides ONCE and keeps one slot', (function () {
    // POCKET is in both of the wardrobe's looks; Sophie's own three include it
    const n = alone.refs.filter((r) => r.url === POCKET).length;
    return n === 1;
  })());
  ok('`added` counts only what was genuinely new', after.added === 4 && after.total === 4);

  // A LINE THAT LOST ITS REFERENCE READS WRONG RATHER THAN READING FINE
  ok('a token past the end is left as it is, never dropped',
    CL.resolveLine('a {1} and {9}', [{ url: JAZZ }], { [JAZZ]: '[Video1]' }) === 'a [Video1] and {9}');

  // NO LINE, NO INVENTED WORDING
  const bare = CL.plan({ refs: [], entry: { name: 'Nurse Edna', looks: [{ key: 'a', line: '', refs: [{ url: 'https://x/edna.mp4' }] }] }, look: null, byslug: {} });
  ok('a look with no line gets the barest true sentence — a name and a slot', bare.line === 'Nurse Edna: [Video1].');
  ok('the default describes NOTHING about the reference', !/woman|man|nurse in|wearing|dress/.test(bare.line.replace('Nurse Edna', '')));
  ok('several references read as a list', CL.defaultLine({ name: 'A' }, [{}, {}, {}]) === 'A: {1}, {2} and {3}.');
  ok('a look with nothing on it at all makes no line', CL.plan({ refs: [], entry: { name: 'Anastasia', looks: [{ key: 'a', refs: [] }] }, look: null, byslug: {} }).empty === true);

  // THE LINE GOES TO THE TOP — her word — and never twice
  ok('the line lands at the TOP of what she has typed', CL.withLine('the door opens', 'A: [Image1].') === 'A: [Image1].\n\nthe door opens');
  ok('an empty box takes the line alone', CL.withLine('', 'A: [Image1].') === 'A: [Image1].');
  ok('tapping the same character again does not write the sentence twice',
    CL.withLine('A: [Image1].\n\nthe door opens', 'A: [Image1].') === 'A: [Image1].\n\nthe door opens');
  ok('a blank line changes nothing', CL.withLine('the door opens', '') === 'the door opens');

  // ── TAKING A REFERENCE OFF (2026-09-11, Sophie: "if i delete an image, it
  // shud remove the tags associated w that image") ───────────────────────────
  // The one that can be wrong in a way nobody sees, from the other end: a ✕
  // that leaves her words alone leaves a name pointing at a DIFFERENT picture,
  // and the clip still draws.
  {
    const strip = alone.refs;                       // [Image1..3] + [Video1]
    const line = alone.line;
    const mid = CL.dropPlan({ refs: strip, index: 1, prompt: line });
    ok('the ✕ on the middle still takes its own name out of her prompt',
      mid.slot === '[Image2]' && mid.prompt.indexOf('[Image3]') < 0);
    ok('and renumbers the one behind it, so no name points at another picture',
      mid.prompt === 'sophie is the woman in [Video1].  she wears the blue hospital pajamas in [Image1], and [Image2], NOT the dress in [Video1]'
      && JSON.stringify(mid.renamed) === '[{"from":"[Image3]","to":"[Image2]"}]');
    ok('the strip it hands back is the strip that is left, renumbered the same way',
      mid.refs.length === 3 && CL.slotMap(mid.refs).names.join(',') === '[Image1],[Image2],[Video1]');
    ok('the kinds are counted apart — dropping a still never moves the clip',
      /the woman in \[Video1\]/.test(mid.prompt) && /NOT the dress in \[Video1\]$/.test(mid.prompt));

    // EVERY OCCURRENCE, because her line names the clip twice
    const clip = CL.dropPlan({ refs: strip, index: 3, prompt: line });
    ok('a name she used twice comes out both times',
      clip.slot === '[Video1]' && clip.prompt.indexOf('[Video1]') < 0
      && clip.prompt.indexOf('[Image1], [Image2] and [Image3]') > 0);

    // THE LAST ONE, and the first one
    ok('dropping the last still renumbers nothing',
      CL.dropPlan({ refs: strip, index: 2, prompt: line }).renamed.length === 0);
    const first = CL.dropPlan({ refs: strip, index: 0, prompt: line });
    ok('dropping the first still moves both the others',
      first.renamed.map((r) => r.from + '→' + r.to).join(',') === '[Image2]→[Image1],[Image3]→[Image2]');
    // ONE PASS — two sequential renames would eat `[Image2]` twice and leave
    // her prompt naming the same picture in two places
    ok('one pass, so a rename never lands on a token another rename reads',
      first.prompt === 'sophie is the woman in [Video1].  she wears the blue hospital pajamas in, [Image1] and [Image2], NOT the dress in [Video1]');
    ok('no picture is named twice after a rename — the whole point of one pass',
      (first.prompt.match(/\[Image1\]/g) || []).length === 1 && (first.prompt.match(/\[Image2\]/g) || []).length === 1);

    // HER WORDS ARE NOT REWRITTEN — only the names and the space each sat in
    ok('the name takes its own space with it and nothing else',
      CL.dropPlan({ refs: [{ url: 'https://x/a.png' }], index: 0, prompt: 'the dog in [Image1] eats.' }).prompt === 'the dog in eats.');
    ok('a name in front of punctuation leaves no space behind it',
      CL.dropPlan({ refs: [{ url: 'https://x/a.png' }], index: 0, prompt: 'the woman in [Image1].' }).prompt === 'the woman in.');
    ok('a dangling comma is HERS and is left alone',
      /\[Image1\], and \[Image2\]/.test(mid.prompt));

    // TOLERANT OF HER TYPING, canonical on the way out
    ok('a name she typed loosely is still found', (function () {
      const r = CL.dropPlan({ refs: [{ url: 'https://x/a.png' }, { url: 'https://x/b.png' }], index: 0, prompt: 'a [image 1] and a [IMAGE2]' });
      return r.prompt === 'a and a [Image1]';
    })());
    ok('a name nothing maps is left verbatim rather than quietly changed',
      CL.dropPlan({ refs: [{ url: 'https://x/a.png' }], index: 0, prompt: 'a [Image1] and a [Image7]' }).prompt === 'a and a [Image7]');

    // A ✕ THAT POINTS AT NOTHING CHANGES NOTHING
    const none = CL.dropPlan({ refs: strip, index: 9, prompt: line });
    ok('an index off the end drops nothing and says so',
      none.ok === false && none.changed === false && none.prompt === line && none.refs.length === 4);
    ok('a reference can also be named by url', CL.dropPlan({ refs: strip, url: POCKET, prompt: line }).slot === '[Image3]');
    ok('a prompt that never named it comes back untouched',
      CL.dropPlan({ refs: strip, index: 0, prompt: 'a woman at a window' }).changed === false);
  }

  // KINDS ARE READ THE WAY footage.js READS THEM
  ok('a .mov is a video and a .m4a is audio, declared or not',
    CL.kindOf({ url: 'https://x/a.mov' }) === 'video' && CL.kindOf({ url: 'https://x/a.m4a' }) === 'audio' && CL.kindOf({ url: 'https://x/a.png' }) === 'image');
  ok('a declared kind wins over the extension', CL.kindOf({ url: 'https://x/a.png', kind: 'video' }) === 'video');
  ok('a reference with no http url is dropped rather than sent', CL.cleanRef({ url: 'nope' }) === null);
}

// ── the module's own shapes ─────────────────────────────────────────────────
{
  const looks = [{ key: '', name: 'The Blue Pajamas!', line: 'x', refs: [{ url: JAZZ }], wear: ['a', 'a', ''] }].map(C.cleanLook);
  ok('a look with no key takes one off its name', looks[0].key === 'the-blue-pajamas');
  ok('`wear` is deduped and the empties dropped', JSON.stringify(looks[0].wear) === '["a"]');
  ok('an unknown kind lands on person rather than being refused', C.kindOk('nonsense') === 'person');
  ok('a doc id is scoped by film, so two films may both have a sophie',
    C.docId('ward', 'sophie') === 'ward__sophie' && C.docId('ticky', 'sophie') === 'ticky__sophie');

  const rows = [
    C.cardOf('ward__her-room', { film: 'ward', slug: 'her-room', name: 'her room', kind: 'setting', looks: place.looks }),
    C.cardOf('ward__blue-pajamas', { film: 'ward', slug: 'blue-pajamas', name: 'pj', kind: 'wardrobe', looks: pj.looks }),
    C.cardOf('ward__sophie', { film: 'ward', slug: 'sophie', name: 'Sophie', kind: 'person', looks: sophie.looks }),
    C.cardOf('ticky__thomas', { film: 'ticky', slug: 'thomas', name: 'Thomas', kind: 'person', looks: [] }),
  ];
  ok('the shelf reads people, then what they wear, then where',
    C.shelfOrder(rows.filter((r) => r.film === 'ward')).map((r) => r.kind).join(',') === 'person,wardrobe,setting');
  const films = C.filmsOf(rows, { films: { ward: { name: 'The ward', order: 1 } } });
  ok('the folders are derived from the entries, so a film cannot go missing', films.map((f) => f.slug).sort().join(',') === 'ticky,ward');
  ok('a named folder shows her name and an unnamed one shows its slug',
    films.find((f) => f.slug === 'ward').name === 'The ward' && films.find((f) => f.slug === 'ticky').name === 'ticky');
  ok('the counts are per kind', (function () { const w = films.find((f) => f.slug === 'ward'); return w.people === 1 && w.wardrobe === 1 && w.settings === 1; })());
  ok('a hidden entry is counted nowhere', C.filmsOf([C.cardOf('a__b', { film: 'a', slug: 'b', kind: 'person', hidden: true, looks: [] })], {})[0].people === 0);

  // A STILLS-ONLY CHARACTER IS A NORMAL ENTRY, and the row has to say so
  const m = C.cardOf('ward__mayra', { film: 'ward', slug: 'mayra', name: 'Mayra', kind: 'person', looks: mayra.looks });
  ok('a stills-only character counts its stills and no clips', m.stills === 1 && m.clips === 0);
  // COUNTED DISTINCT — the jazz clip is on two of Sophie's looks and she has
  // one clip, not two; the pocket still is in both pajama looks and is one
  const soph = C.cardOf('ward__sophie', { film: 'ward', slug: 'sophie', name: 'Sophie', kind: 'person', looks: sophie.looks });
  ok('a reference on several looks is counted once — the jazz clip is on two looks', soph.clips === 1 && soph.stills === 1);
  ok('the wardrobe entry counts its own stills once too',
    C.cardOf('ward__pj', { film: 'ward', slug: 'blue-pajamas', kind: 'wardrobe', looks: pj.looks }).stills === 4);
  ok('the face is the first picture anywhere on the entry', m.face === MAYRA);
  ok('a video-only character still tiles — off its poster, else nothing',
    C.faceOf([{ refs: [{ url: JAZZ, kind: 'video', poster: 'https://x/p.png' }] }]) === 'https://x/p.png'
    && C.faceOf([{ refs: [{ url: JAZZ, kind: 'video', poster: '' }] }]) === '');
}

// ── the source pins ─────────────────────────────────────────────────────────
{
  const page = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
  ok('the page links the shared rule rather than keeping a copy of the slot arithmetic',
    /<script src="\/cast-line\.js">/.test(page) && !/function\s+resolveLine/.test(page));
  ok('server.js serves /cast-line.js the pause-plan.js way and mounts /api/cast', (function () {
    const s = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    return /app\.get\('\/cast-line\.js'/.test(s) && /app\.use\('\/api\/cast', require\('\.\/cast'\)\.router\)/.test(s);
  })());
  ok('nothing in the library stores a literal slot name — they are templates',
    !/\{ key: '[^']*', name: '[^']*', line: '[^']*\[(Image|Video|Audio)\d/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'seed-cast-ward.js'), 'utf8')));
  ok('the seed is dry by default', /const GO = process\.argv\.includes\('--go'\)/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'seed-cast-ward.js'), 'utf8')));
  ok('an entry only ever hides — there is no delete route', !/router\.delete/.test(fs.readFileSync(path.join(ROOT, 'cast.js'), 'utf8')));
}

// ── the page half ───────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('cast: playwright not installed — page half skipped'); report(); return; }
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

const F = require('../footage');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
// TWO FILMS, so "diff folders" is measured rather than asserted
const shelves = {
  ward: [sophie, pj, mayra, place].map((e, i) => C.cardOf('ward__' + e.slug, { ...e, film: 'ward', order: i })),
  ticky: [{ slug: 'thomas', name: 'Thomas', kind: 'person', looks: [{ key: 'a', name: 'the duck pond', line: 'Thomas: the boy in {1}.', refs: [{ url: 'https://x/thomas.png', kind: 'image' }], wear: [] }] }]
    .map((e) => C.cardOf('ticky__' + e.slug, { ...e, film: 'ticky' })),
};
const FILMS = [{ slug: 'ward', name: 'The ward', order: 1, people: 2, wardrobe: 1, settings: 1 },
  { slug: 'ticky', name: 'Ticky Tack', order: 2, people: 1, wardrobe: 0, settings: 0 }];
let castReads = 0;

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
  if (u.pathname === '/api/cast/') {
    castReads += 1;
    const film = u.searchParams.get('film') || 'ward';
    return json({ ok: true, film, films: FILMS, entries: shelves[film] || [] });
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, balances: {}, models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', about: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [] });
  if (u.pathname.indexOf('/api/gallery/assets/notes') === 0) return json({ ok: true, assets: [] });
  json({ ok: true });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/footage`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle' });

  const shown = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; }, sel);
  const box = () => page.evaluate(() => document.getElementById('prompt').value);
  const strip = () => page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#refs .ref .slot'), (b) => b.textContent).join(','));

  ok('the character icon is on the controls row from the first paint', await shown('#casttog'));
  // IT IS AN ICON IN A ROUNDED SQUARE, never a word and never a circle
  const btn = await page.evaluate(() => {
    const b = document.getElementById('casttog');
    const cs = getComputedStyle(b);
    return { text: b.textContent.trim(), svg: b.querySelectorAll('svg').length, r: cs.borderRadius, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) };
  });
  ok('the button carries a glyph and no words', btn.svg === 1 && btn.text === '');
  ok('it is a rounded square at the house 6px, the size of its neighbours', btn.r === '6px' && btn.w === 34 && btn.h === 34);

  ok('the shelf is not read until she opens it', castReads === 0);
  await page.click('#casttog');
  await page.waitForSelector('#cast .ent');
  ok('opening it reads the shelf once', castReads === 1);
  ok('the sheet is under the controls, not a slab over the prompt box', await page.evaluate(() => {
    const c = document.getElementById('cast').getBoundingClientRect();
    const p = document.getElementById('prompt').getBoundingClientRect();
    return c.top >= p.bottom && getComputedStyle(document.getElementById('cast')).position === 'static';
  }));
  const names = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#cast .who .nm b'), (b) => b.textContent));
  ok('every entry in the film is listed', names.join(',') === 'Sophie,Mayra,the blue hospital pajamas,her room');
  const groups = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#cast .grp'), (g) => g.textContent));
  ok('they are grouped — who, what they wear, where', groups.join('|') === 'Who|What they wear|Where');
  ok('a stills-only character says so on its own row', await page.evaluate(() =>
    Array.prototype.some.call(document.querySelectorAll('#cast .who'), (w) => /Mayra/.test(w.textContent) && /1 still/.test(w.textContent) && !/clip/.test(w.textContent))));

  // ── ONE LOOK IS ONE TAP, several looks open ────────────────────────────────
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#cast .who'), (w) => /Sophie/.test(w.textContent)).click());
  await page.waitForSelector('#cast .ent.open .lk');
  const looks = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#cast .ent.open .lk b'), (b) => b.textContent));
  ok('a character with outfits opens to its looks', looks.join(',') === 'the blue pajamas,street clothes,the face still only');
  // THE SHEET SHOWS THE LINE IT IS ABOUT TO INSERT, resolved
  const preview = await page.evaluate(() => document.querySelector('#cast .ent.open .lk i').textContent);
  ok('each look shows the resolved line it will add',
    preview === 'sophie is the woman in [Video1].  she wears the blue hospital pajamas in [Image1], [Image2] and [Image3], NOT the dress in [Video1]');

  // ── THE TAP: the references land AND the line goes to the top ──────────────
  await page.evaluate(() => document.getElementById('prompt').value = 'she stands at the window');
  await page.evaluate(() => document.querySelector('#cast .ent.open .lk').click());
  await page.waitForTimeout(120);
  ok('the line lands at the TOP of her words', /^sophie is the woman in \[Video1\]\./.test(await box()) && /she stands at the window$/.test(await box()));
  ok('the references really reached the strip', (await strip()) === '[Image1],[Image2],[Image3],[Video1]');
  ok('the line and the strip agree about every slot', (function (b, s) {
    return b.indexOf('[Video1]') >= 0 && s.indexOf('[Video1]') >= 0;
  })(await box(), await strip()));

  // EVERY OTHER LOOK ON SCREEN IS RE-RESOLVED — a preview left saying the
  // slot it would have taken on an empty strip is a sheet lying about what
  // the next tap does, and a repaint that never happens looks identical in
  // the source to one that does.
  const stale = await page.evaluate(() => {
      const b = Array.prototype.find.call(document.querySelectorAll('#cast .ent.open .lk'), (x) => /face still only/.test(x.textContent));
      return b ? b.querySelector('i').textContent : 'NO ROW';
  });
  ok("the looks she did NOT tap now show the slots they would really get",
    stale === 'sophie is the woman in [Image4].');

  // ── A SECOND CHARACTER GETS THE SLOTS IT REALLY LANDS ON ───────────────────
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#cast .who'), (w) => /Mayra/.test(w.textContent)).click());
  await page.waitForTimeout(120);
  const b2 = await box();
  ok('Mayra rides in one tap — she has one look', /Mayra: the woman in/.test(b2));
  // THE POCKET STILL IS IN BOTH OUTFITS AND RIDES ONCE — so Mayra's line
  // points at the slot it ALREADY has ([Image3]) rather than attaching a
  // second copy of the same picture and naming that.
  ok("her slots are the ones she really got, not the library's",
    /Mayra: the woman in \[Image4\]\. she wears the blue hospital pajamas in \[Image5\] and \[Image3\]\./.test(b2));
  ok("Sophie's line was not rewritten under her", /she wears the blue hospital pajamas in \[Image1\], \[Image2\] and \[Image3\]/.test(b2));
  ok('the pajamas she already had were not attached twice — five stills, not six',
    (await strip()) === '[Image1],[Image2],[Image3],[Image4],[Image5],[Video1]');

  // ── TAPPING THE SAME ONE AGAIN DOES NOT WRITE THE SENTENCE TWICE ───────────
  const before = await box();
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#cast .who'), (w) => /Mayra/.test(w.textContent)).click());
  await page.waitForTimeout(120);
  ok('a second tap on the same look changes nothing', (await box()) === before);

  // ── THE ✕ TAKES THE NAME OUT OF THE BOX (2026-09-11, Sophie: "if i delete an
  // image, it shud remove the tags associated w that image") ─────────────────
  // MEASURED on the real page: a ✕ that removes the row and leaves her words
  // alone, one that removes the wrong row, and one that renumbers nothing all
  // look identical in the source — and the failure is silent, because the clip
  // still draws, of the wrong reference.
  {
    const had = await box();
    ok('the strip is full and her box names every slot, before the tap',
      (await strip()) === '[Image1],[Image2],[Image3],[Image4],[Image5],[Video1]'
      && had.indexOf('[Image5]') > 0);
    // the SECOND still — the one whose removal moves three names behind it
    await page.evaluate(() => document.querySelectorAll('#refs .ref')[1].querySelector('.x').click());
    await page.waitForTimeout(80);
    const now = await box();
    ok('the strip is one shorter and renumbered', (await strip()) === '[Image1],[Image2],[Image3],[Image4],[Video1]');
    ok('her prompt no longer names the slot that is gone off the end', now.indexOf('[Image5]') < 0);
    ok('the name she had used for it came out of the box',
      /pajamas in \[Image1\], and \[Image2\]/.test(now));
    ok('the names behind it moved with the strip — Mayra still points at her own stills',
      /Mayra: the woman in \[Image3\]\. she wears the blue hospital pajamas in \[Image4\] and \[Image2\]\./.test(now));
    ok('the clip is untouched — the kinds are counted apart', /the woman in \[Video1\]/.test(now));
    ok('her words around the names are hers — nothing else was rewritten',
      /sophie is the woman in \[Video1\]\./.test(now) && /NOT the dress in \[Video1\]/.test(now)
      && /she stands at the window$/.test(now) && now.length === had.length - '[Image5] '.length);
    // A CHANGE TO HER PROMPT SHE CANNOT SEE IS THE FAILURE THIS SAYS OUT LOUD
    ok('the toast says what came out and how many names moved', await page.evaluate(() => {
      const t = document.getElementById('toast');
      return /\[Image2\] came out of the box/.test(t.textContent) && /renumbered/.test(t.textContent);
    }));
    // THE LAST ONE RENUMBERS NOTHING, so there is nothing to announce about it
    await page.evaluate(() => document.getElementById('prompt').value = 'a woman at a window');
    await page.evaluate(() => document.querySelectorAll('#refs .ref')[0].querySelector('.x').click());
    await page.waitForTimeout(80);
    ok('a prompt that never named it is left exactly as she typed it', (await box()) === 'a woman at a window');
    ok('and the reference really came off anyway', (await strip()) === '[Image1],[Image2],[Image3],[Video1]');
  }

  // ── THE FOLDERS ────────────────────────────────────────────────────────────
  ok('both films are on the chip row', await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('#cast .films button'), (b) => b.textContent).join(',') === 'The ward,Ticky Tack'));
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#cast .films button'), (b) => b.textContent === 'Ticky Tack').click());
  await page.waitForFunction(() => /Thomas/.test(document.getElementById('cast').textContent));
  ok('a film is its own shelf and nobody crosses', await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('#cast .who .nm b'), (b) => b.textContent).join(',') === 'Thomas'));
  // THE FOLDER IS REMEMBERED — she works one film for a run of clips
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#casttog');
  await page.waitForSelector('#cast .ent');
  ok('the film she was in comes back on the next load', await page.evaluate(() =>
    /Thomas/.test(document.getElementById('cast').textContent)));

  ok('no page errors', errs.length === 0 || fails.push('page errors: ' + errs.join(' | ')) && false);
  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
