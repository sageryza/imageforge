#!/usr/bin/env node
'use strict';

// A CLIP BEAT WITH NO POSTER TILES BLANK (2026-08-26, Sophie, on the Evan
// story: "why isn't the third panel showing an image preview").
//
// A clip's face IS its poster, copied onto the beat's slot when the clip is
// placed. The Dump bakes that frame best-effort and ONE-SHOT, so a file whose
// ffmpeg died at dump time hands the pad a null and nothing ever looks again —
// measured that day, 6 of 133 video files in the Dump carried no poster, and
// her third beat was one of them (`drops/_/24214ffe…mp4`, poster null while the
// clip two rows down had one).
//
// Two rules, in two files:
//   dropbox.js   — the frame is bakeable AFTER the fact, from the bytes already
//                  in Storage (`ensurePoster` / `posterForUrl`, POST /poster).
//   scratchpad.js— the pad asks for one on read, for a clip that has none.
//
// Pure — no Firestore, no network, no bytes.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { clipsNeedingPoster } = require('../scratchpad.js');
const drop = require('../dropbox.js');

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log('  ok  ' + name); } catch (e) {
    console.error('  FAIL ' + name + '\n       ' + e.message);
    process.exitCode = 1;
  }
};

console.log('\nwhich clips are missing a poster');

// The real shape of her third beat, lifted off the live pad.
const EVAN3 = {
  id: 'UUKqhcyzjZHksYjGa2f2',
  url: 'https://storage.googleapis.com/x/claude-deliveries/panel-1c.png',
  text: 'They call it a gift.',
  alt: {
    dreamy: {
      kind: 'clip',
      url: 'https://storage.googleapis.com/x/drops/_/24214ffe.mp4',
      poster: null,
      seconds: 0,
      title: 'sophiespincher_…',
      clipId: null,
    },
  },
};
// Its neighbour, which DID get a poster at dump time.
const EVAN5 = {
  id: '8021YwK7SlMkRMYvqaV7',
  url: 'https://storage.googleapis.com/x/claude-deliveries/panel-2a.png',
  alt: {
    dreamy: {
      kind: 'clip',
      url: 'https://storage.googleapis.com/x/drops/_/1b555935.mp4',
      poster: 'https://storage.googleapis.com/x/drops/_/1b555935-poster.jpg',
    },
  },
};

t('the posterless clip is found, and named by its STYLE', () => {
  const want = clipsNeedingPoster({ beats: [EVAN3, EVAN5] });
  assert.strictEqual(want.length, 1);
  assert.strictEqual(want[0].id, EVAN3.id);
  assert.strictEqual(want[0].style, 'dreamy');
  assert.strictEqual(want[0].url, EVAN3.alt.dreamy.url);
});

t('a clip that already has one is never re-asked', () => {
  assert.strictEqual(clipsNeedingPoster({ beats: [EVAN5] }).length, 0);
});

// A PICTURE IS NOT A CLIP. The watercolor slot IS the beat root, so a plain
// beat has a `url` and no `poster` — exactly the shape a careless test would
// match — and asking the Dump to poster a png is a wasted query forever.
t('an ordinary picture beat is not a clip and is left alone', () => {
  const plain = { id: 'p', url: 'https://x/art.png', text: 'a picture' };
  assert.strictEqual(clipsNeedingPoster({ beats: [plain] }).length, 0);
});

// A CLIP IS PER-SLOT (2026-08-23: "The beats should be added, but the Art
// should not"), so the watercolor root is asked as well as the dreamy side.
t('a clip on the WATERCOLOR side (the beat root) is found too', () => {
  const b = { id: 'w', kind: 'clip', url: 'https://x/drops/_/aa.mp4', poster: null };
  const want = clipsNeedingPoster({ beats: [b] });
  assert.strictEqual(want.length, 1);
  assert.strictEqual(want[0].style, 'watercolor');
});

t('both sides of one beat can each want one', () => {
  const b = {
    id: 'two', kind: 'clip', url: 'https://x/drops/_/a.mp4', poster: null,
    alt: { dreamy: { kind: 'clip', url: 'https://x/drops/_/b.mp4', poster: null } },
  };
  assert.deepStrictEqual(
    clipsNeedingPoster({ beats: [b] }).map((w) => w.style).sort(),
    ['dreamy', 'watercolor'],
  );
});

// THE HOPELESS URL IS ASKED ONCE. A clip whose file the Dump has never heard of
// (a hand-pasted url, a deleted record) would otherwise cost a Firestore query
// on every single open of that story, forever.
t('a url already known to be posterless is skipped', () => {
  const skip = new Set([EVAN3.alt.dreamy.url]);
  assert.strictEqual(clipsNeedingPoster({ beats: [EVAN3] }, skip).length, 0);
});

t('an empty pad asks for nothing', () => {
  assert.strictEqual(clipsNeedingPoster({ beats: [] }).length, 0);
  assert.strictEqual(clipsNeedingPoster({}).length, 0);
  assert.strictEqual(clipsNeedingPoster(null).length, 0);
});

console.log('\nthe Dump can bake one after the fact');

t('dropbox exports the retry, and the pad calls it', () => {
  assert.strictEqual(typeof drop.ensurePoster, 'function');
  assert.strictEqual(typeof drop.posterForUrl, 'function');
  const pad = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
  assert.ok(/posterForUrl\(/.test(pad), 'scratchpad must ask the Dump, never bake its own frame');
});

// The path has to be the one storeOne would have written, or a re-bake makes a
// SECOND object beside the first every time it runs.
t('the poster path is the stored object with -poster.jpg in place of its ext', () => {
  const src = fs.readFileSync(path.join(ROOT, 'dropbox.js'), 'utf8');
  assert.ok(src.includes("`${stem}-poster.jpg`"), 'storeOne still writes <stem>-poster.jpg');
  assert.ok(/replace\(\/\\\.\[\^\.\/\]\+\$\/, ''\)\}-poster\.jpg/.test(src),
    'ensurePoster must derive the same path from storagePath');
});

// A DUMP MUST NEVER BE LOST TO A THUMBNAIL — the doc is written before the
// frame, and that ordering is why a missing poster is recoverable at all.
t('storeOne still writes the doc BEFORE it bakes the frame', () => {
  const src = fs.readFileSync(path.join(ROOT, 'dropbox.js'), 'utf8');
  const docAt = src.indexOf('const ref = await db().collection(COL).add(doc)');
  const bakeAt = src.indexOf('const posterBuf = poster || (video ?');
  assert.ok(docAt > 0 && bakeAt > docAt, 'the poster bake must stay after the doc write');
});

// The sweep holds a whole clip in memory per bake on a 512MB box — the very
// thing that loses a poster in the first place.
t('the sweep is dry by default and bakes one file at a time', () => {
  const src = fs.readFileSync(path.join(ROOT, 'dropbox.js'), 'utf8');
  const route = src.slice(src.indexOf("router.post('/poster'"), src.indexOf("// POST /upload —"));
  assert.ok(/b\.dry !== false/.test(route), 'must write only when dry is explicitly false');
  assert.ok(/for \(const id of todo/.test(route), 'must be a serial for-loop, never Promise.all');
  assert.ok(!/Promise\.all/.test(route));
});

// Recovering a thumbnail is not an edit to the story: bumping updatedAt would
// reshuffle the shelf and stale the film, exactly like /pads/pin and /category.
t('the heal patches the slot WITHOUT bumping updatedAt', () => {
  const pad = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
  const fn = pad.slice(pad.indexOf('async function healClipPosters'), pad.indexOf("router.get('/', async"));
  assert.ok(/tx\.set\(padRef\(padId\), \{ beats: cur \}, \{ merge: true \}\)/.test(fn),
    'the write must carry beats alone');
  assert.ok(!/updatedAt/.test(fn), 'a recovered thumbnail must not stale the story');
});

// She may have swapped the clip out while the frame was baking.
t('the patch only lands on the slot that still holds that url', () => {
  const pad = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
  const fn = pad.slice(pad.indexOf('async function healClipPosters'), pad.indexOf("router.get('/', async"));
  assert.ok(/slot\.url !== w\.url \|\| slot\.poster/.test(fn));
});

t('the read is never blocked on it', () => {
  const pad = fs.readFileSync(path.join(ROOT, 'scratchpad.js'), 'utf8');
  assert.ok(/healClipPosters\(pid, pad\)\.catch\(\(\) => \{\}\)/.test(pad),
    'fire-and-forget — a poster bake must never hold the pad read open');
});

console.log(`\n${pass} checks passed\n`);

// scratchpad.js holds a live handle open once required (the Admin SDK), so an
// otherwise-finished test would hang here rather than exit.
process.exit(process.exitCode || 0);
