#!/usr/bin/env node
/* build-vo.js — the water reel in SOPHIE'S OWN VOICE (v8).
 *
 * She recorded every section in one sitting (2026-08-25, "17th St 378",
 * 7m50s) with several takes of most lines, out of order, and said: "in
 * general use the last take", and "the very last one is the very first one I
 * did" — the intro read at the end of the file is image A's.
 *
 * THE TAKE IS PICKED BY SLICING, NOT BY HOPING. editor.js's phraseSpan takes
 * the BEST-scoring window over whatever audio it is given, and with four
 * identical takes every window scores ~1.0, so the tie breaks to the EARLIEST
 * — the opposite of what she asked for. So her recording is cut into one
 * SOURCE per section, each holding only the take she wants (plain trims of
 * the original, generous silent margins, never a splice), and every phrase is
 * then unique inside its own source.
 *
 * Everything downstream is the house pipeline — scripts/vo-film.js — which
 * owns the cutting (phraseSpan + clampBounds + snapToSilence), the
 * word-timing pause clean, the per-shot verify and the stitch. This file only
 * prepares its inputs: the audio slices, one nominal zoom CLIP per shot (a
 * `video` shot is retimed to its own narration), and the spec.
 *
 *   node scripts/water-reel/build-vo.js --images <dir> --montage <dir> \
 *        --vo sophie-vo.m4a --work <dir> [--spec-only]
 *   node scripts/vo-film.js <work>/spec.json --dir <work>/film --final
 *
 * v9: the ear-goblins sheet is back, narrated by LAURA — she never recorded
 * any of its three lines ("I missed one… just use Laura's voice for that for
 * now"). It is the one borrowed section; `scripts/water-reel/tts-fill.js`
 * renders it, and swapping it back to her own take is one line in SLICES.
 *
 * Zoom targets are fractions of each 1024x1536 sheet, measured off the ink
 * rather than guessed (a band's dark-pixel bounds decide tx/ty/z). Two sheets
 * lay their reasons out as FULL-WIDTH ROWS, so their measured z is ~1.06 —
 * there is no cropping in to a row that already spans the page, and forcing
 * one would cut her lettering. Those get a gentle push instead.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const IMG = args.images, MON = args.montage, VO = args.vo;
const WORK = path.resolve(args.work || 'water-vo-work');
if (!IMG || !MON || !VO) { console.error('need --images --montage --vo'); process.exit(1); }
fs.mkdirSync(WORK, { recursive: true });
const run = (a) => execFileSync(ffmpeg, a, { stdio: ['ignore', 'ignore', 'pipe'] });

const FPS = 30, W = 1080, H = 1620, PADH = 1920, NOMINAL = 4;

// ── her takes: one slice per section, seconds into the raw recording ────────
// Each window holds the LAST usable take of the lines named under it, with
// silence either side so whisper never clips an opening word.
const SLICES = {
  intro: [448.3, 468.5],   // the image-A read — her FIRST take, the file's last
  intro1:[386.0, 391.1],   // "Scientists did a study…" — her LAST take of that
                           // line; the file-end one slurs the word (her v11
                           // note: "scientist is cut off" — the audio is
                           // complete, the take reads clipped)
  c:     [396.8, 429.6],   // fish / bones "on the inside"
  // She asked whether a take says "…faster and stranger THAN EVER BEFORE".
  // The words exist and she never said them in one breath: the line ends at
  // "stranger" (401.7) and "Than ever before." arrives on its own FOURTEEN
  // SECONDS later (415.3), as a pickup. So this shot is a SPLICE of the two —
  // two sources, joined at the phrase boundary, which is a thing she approves
  // by ear rather than something to ship silently.
  c1a:   [397.6, 402.4],   // "Water lubricates … faster and stranger"
  c1c:   [414.6, 417.6],   // "Than ever before." — her separate pickup
  d12:   [107.0, 121.0],   // one: spine ghosts · two: liquid lightning
  d3:    [142.5, 152.5],   // three: the third eye in your knee (+ more water right now)
  e1:    [160.3, 182.0],   // the bridge, DNA/gills, supercharges your brain
  e2:    [195.0, 211.0],   // sandpaper, opens portals, fill yourself up and overflow
  f12:   [216.5, 226.2],   // thirst demons (f2's only complete take)
  f1b:   [234.8, 239.3],   // ghosts in your knees — her later, cleanly
                           // separated take. She read it once more at 261.5,
                           // but that one runs straight into the g section's
                           // words with no gap (whisper folds all its times
                           // onto one stamp) — the last CLEAN take wins.
  f3:    [230.4, 235.3],   // aura's reservoir (her second pass at it)
  g:     [260.5, 279.0],   // lubricates thoughts · confuses cells · secret rafts
  h:     [292.5, 311.0],   // washed clean · extra water · cells swim
  i:     [316.5, 340.0],   // regrets · rocket fuel · third eye inside · sponge
  z:     [427.6, 434.5],   // drink gallons, drink oceans — the closing line
};

// The one section she has no take of. Rendered by tts-fill.js into the same
// src/ folder; it is a source like any other from here on, so when she
// records it the only change is a SLICES entry and deleting this line.
const LAURA = 'b';

// ── the sheets ─────────────────────────────────────────────────────────────
const A = { img: '1787619512551-35kqb3.webp', pad: 'f1d3a5', dir: 'images' }; // the earnest one
const C = { img: '1787620392223-lfveov.webp', pad: 'eacfa1', dir: 'images' }; // funnel · fish · plants
const B = { img: '1787620306161-xsmta2.webp', pad: 'f2e2bd', dir: 'images' }; // ear greetings · liquid light · stomach boat  [LAURA]
const D = { img: '1787620455292-5g1ynr.webp', pad: 'eacda1', dir: 'images' }; // ghosts · lightning · knee
const E = { img: '1787620576755-6n0olq.webp', pad: 'f0deba', dir: 'montage' }; // DNA · brain · portals
const F = { img: '1787620578088-6fr3hh.webp', pad: 'ead0a2', dir: 'montage' }; // knees · demons · aura
const G = { img: '1787620603958-sioafz.webp', pad: 'e4caa0', dir: 'montage' }; // thoughts · cells · rafts
const Hs= { img: '1787620593195-1qure2.webp', pad: 'eecfa6', dir: 'montage' }; // duck · double · swim
const I = { img: '1787620659452-3i519q.webp', pad: 'ebd2aa', dir: 'montage' }; // regrets · rocket · sponge

// id, sheet, source, zoom, phrases. `full` = the whole page (a settling
// breath at 1.06 → 1.0); `push` = the gentle 1.0 → 1.08 for a row that
// already spans the page.
const SHOTS = [
  // a0's two lines come from DIFFERENT takes (order rides `extra`, which
  // keeps list order): the opener from intro1, the reasons line from intro.
  { id: 'a0', s: A, src: 'intro', full: true, phrases: [], extra: [
    { source: 'intro1', phrase: "Scientists did a study on water showing that it's good to drink more water" },
    { source: 'intro', phrase: "Here's three reasons why" },
  ] },
  { id: 'a1', s: A, src: 'intro', tx: 0.215, ty: 0.561, z: 3.35, phrases: ['One it hydrates your body'] },
  { id: 'a2', s: A, src: 'intro', tx: 0.503, ty: 0.561, z: 3.35, phrases: ['Two it supports your brain'] },
  { id: 'a3', s: A, src: 'intro', tx: 0.790, ty: 0.561, z: 3.35, phrases: ['Three it keeps you feeling good'] },
  // z/ty from the MEASURED panel band (y 0.413-0.830): at z 2.45 the window
  // opened at 0.431 and clipped the first text line — her screenshot, v10.
  { id: 'c1', s: C, src: 'c1a', tx: 0.188, ty: 0.622, z: 2.30, phrases: [], extra: [
    { source: 'c1a', phrase: 'Water lubricates your ideas so they can slip out faster and stranger' },
    { source: 'c1c', phrase: 'Than ever before' },
  ] },
  { id: 'c2', s: C, src: 'c', tx: 0.500, ty: 0.622, z: 2.30, phrases: ['Enough water can turn your sweat into miniature fish that will sing to you'] },
  { id: 'c3', s: C, src: 'c', tx: 0.810, ty: 0.622, z: 2.30, phrases: ['Your bones are secretly plants and water is what keeps them growing on the inside'] },

  { id: 'b1', s: B, src: 'b', tx: 0.185, ty: 0.600, z: 2.55, phrases: ['1 Water flushes out the tiny greetings that live in your ears'] },
  { id: 'b2', s: B, src: 'b', tx: 0.487, ty: 0.600, z: 2.55, phrases: ['2 Enough water turns your sweat into liquid light making you visible to good luck'] },
  { id: 'b3', s: B, src: 'b', tx: 0.790, ty: 0.600, z: 2.55, phrases: ["3 Water builds a boat inside your stomach so you can sail through life's soup"] },
  { id: 'b4', s: B, src: 'b', tx: 0.180, ty: 0.875, z: 2.60, phrases: ['Drink gallons Live legendary'] },

  // no "One": she said "One gallon of—" and restarted; the clean take starts
  // at "gallons" (measured — asking for the One would drag the flub back in)
  // wider and further left than v11: at z 2.20 the window's left edge landed on
  // 0.058 and the "1" badge sits at ~0.06, so the badge and the left of the
  // before/after spine were shaved (her note, 2026-08-25)
  { id: 'd1', s: D, src: 'd12', tx: 0.280, ty: 0.455, z: 2.00, phrases: ['gallons of water flush out the ghosts that live in your spine'] },
  { id: 'd2', s: D, src: 'd12', tx: 0.745, ty: 0.500, z: 2.20, phrases: ['Two it turns your sweat into liquid lightning'] },
  { id: 'd3', s: D, src: 'd3', tx: 0.580, ty: 0.720, z: 2.00, glide: { tx: 0.740, ty: 0.862, z: 2.10 },
    phrases: ['Three enough water unlocks the third eye in your knee allowing you to see into the future More water right now'] },

  // TWO phrases on purpose: she flubbed "You could grow will" before the good
  // "You could grow gills", and one long phrase matched straight through the
  // flub. Split spans let the flub fall between them.
  { id: 'e1', s: E, src: 'e1', pan: { z: 2.55, ty: 0.404, from: 0.26, to: 0.74 }, phrases: ['Water rewires your DNA Every sip adds another strand until you unlock secret fish memories hidden in your spine', 'You could grow gills You probably will'] },
  { id: 'e3', s: E, src: 'e2', pan: { z: 2.55, ty: 0.772, from: 0.26, to: 0.74 }, phrases: ['water opens portals Gallons of water a day opens doors to hidden realms where time is soft and your worries dissolve like old candy'] },
  { id: 'e4', s: E, src: 'e2', tx: 0.500, ty: 0.900, z: 1.60, phrases: ['Drink more water So much water Fill yourself up and overflow'] },

  // measured panel band y 0.41-0.79; at ty 0.476/z 2.30 the window stopped at
  // 0.694 and cut each picture in half, which is what read as "not zoomed into
  // that moment" — 0.60/2.60 is the panel edge to edge, number, words, picture
  { id: 'f1', s: F, src: 'f1b', tx: 0.190, ty: 0.600, z: 2.60, phrases: ['It flushes out the ghosts that live in your knees'] },
  { id: 'f2', s: F, src: 'f12', tx: 0.500, ty: 0.600, z: 2.60, phrases: ['It offends the major thirst demons so they leave you alone'] },
  { id: 'f3', s: F, src: 'f3',  tx: 0.810, ty: 0.600, z: 2.60, phrases: ['It fills your auras reservoir so you can fly and do backflips'] },

  { id: 'g1', s: G, src: 'g', pan: { z: 2.55, ty: 0.385, from: 0.26, to: 0.74 }, phrases: ['Water lubricates your thoughts so ideas slide around more freely'] },
  { id: 'g2', s: G, src: 'g', pan: { z: 2.55, ty: 0.512, from: 0.26, to: 0.74 }, phrases: ['Water confuses your cells in a good way making them forget to be old'] },
  // the rafting lake, travelled across — the shot she described
  { id: 'g3', s: G, src: 'g', pan: { z: 2.55, ty: 0.726, from: 0.24, to: 0.76 }, phrases: ['Water builds secret tiny rafts in your bloodstream that rescue you from sadness'] },

  { id: 'h1', s: Hs, src: 'h', tx: 0.198, ty: 0.476, z: 2.90, phrases: ['Your thoughts get washed super clean', 'Less worries more duck'] },
  { id: 'h2', s: Hs, src: 'h', tx: 0.487, ty: 0.476, z: 2.90, phrases: ['It adds extra water to your water Double water equals double good'] },
  { id: 'h3', s: Hs, src: 'h', tx: 0.815, ty: 0.477, z: 2.90, phrases: ['It teaches your cells how to swim', 'Strong cells better strokes'] },

  { id: 'i1', s: I, src: 'i', tx: 0.268, ty: 0.547, z: 2.01, phrases: ['Water flushes away the regrets lurking in your spine'] },
  { id: 'i2', s: I, src: 'i', tx: 0.717, ty: 0.537, z: 1.92, phrases: ['Enough water turns your pee into rocket fuel'] },
  { id: 'i3', s: I, src: 'i', tx: 0.278, ty: 0.767, z: 1.94, phrases: ['Proper hydration unlocks your third eye on the inside'] },
  { id: 'i4', s: I, src: 'i', tx: 0.722, ty: 0.767, z: 1.96, phrases: ['Your body is basically a sponge with anxiety Soak it drown it be limitless'] },

  { id: 'z1', s: D, src: 'z', tx: 0.740, ty: 0.862, z: 2.10, phrases: ['Drink gallons drink oceans become a water machine drink more water right now'] },
];

// ── 1. her takes, sliced ───────────────────────────────────────────────────
// Plain trims to PCM: exact seeking, and nothing is re-compressed. Her voice
// is never loudnormed and never filtered here.
const srcDir = path.join(WORK, 'src'); fs.mkdirSync(srcDir, { recursive: true });
for (const [name, [t0, t1]] of Object.entries(SLICES)) {
  const out = path.join(srcDir, `${name}.wav`);
  if (!fs.existsSync(out)) {
    run(['-v', 'error', '-y', '-ss', String(t0), '-to', String(t1), '-i', VO, '-c:a', 'pcm_s16le', out]);
    console.log(`slice ${name}: ${(t1 - t0).toFixed(1)}s`);
  }
}

if (!fs.existsSync(path.join(srcDir, `${LAURA}.wav`))) {
  console.error(`missing ${LAURA}.wav — render it first with scripts/water-reel/tts-fill.js`);
  process.exit(1);
}

// ── 2. one nominal zoom clip per shot ──────────────────────────────────────
// vo-film RETIMES a `video` shot to its own narration, so the length here is
// only nominal — the ease still lands in the first third of the shot.
const clipDir = path.join(WORK, 'clips'); fs.mkdirSync(clipDir, { recursive: true });
for (const s of SHOTS) {
  const out = path.join(clipDir, `${s.id}.mp4`);
  if (fs.existsSync(out)) continue;
  const d = Math.round(NOMINAL * FPS);
  const zf = Math.round(1.1 * FPS);
  const ease = `(1-pow(1-min(on/${zf},1),3))`;
  let z0, z1, txe, tye;
  if (s.full) { z0 = 1.06; z1 = 1.0; txe = '0.5'; tye = '0.5'; }
  else if (s.pan) {
    // A ROW THAT SPANS THE PAGE IS PANNED, NOT PUSHED (her ask, 2026-08-25:
    // "it doesn't zoom in. Could you make it like zoom in on the rafting lake
    // picture and go across it?"). The `push` shots were a compromise — a
    // full-width row cannot be cropped to without cutting her lettering, so
    // they barely moved and she read them as not zoomed at all. A pan zooms
    // in properly and travels left to right, so the whole row is still seen.
    z0 = s.pan.z; z1 = s.pan.z; tye = String(s.pan.ty);
    const g = `(on/${d})`;
    txe = `(${s.pan.from}+${(s.pan.to - s.pan.from).toFixed(4)}*${g})`;
  } else if (s.push) { z0 = 1.0; z1 = 1.08; txe = String(s.tx); tye = String(s.ty); }
  else { z0 = 1.0; z1 = s.z; txe = String(s.tx); tye = String(s.ty); }
  let zx = s.pan ? String(z0) : `${z0}+${(z1 - z0).toFixed(4)}*${ease}+0.03*on/${d}`;
  if (s.glide) { // the third-eye shot slides down onto the burst, one move
    const f1 = Math.round(0.45 * d), fg = Math.round(0.35 * d);
    const g = `(1-pow(1-min(max((on-${f1})/${fg},0),1),2))`;
    txe = `(${s.tx}+${(s.glide.tx - s.tx).toFixed(4)}*${g})`;
    tye = `(${s.ty}+${(s.glide.ty - s.ty).toFixed(4)}*${g})`;
    zx = `${z0}+${(s.z - z0).toFixed(4)}*${ease}+${(s.glide.z - s.z).toFixed(4)}*${g}`;
  }
  const x = `clip(${txe}*iw-(iw/zoom)/2,0,iw-iw/zoom)`;
  const y = `clip(${tye}*ih-(ih/zoom)/2,0,ih-ih/zoom)`;
  const src = path.join(s.s.dir === 'images' ? IMG : MON, s.s.img);
  run(['-y', '-i', src,
    '-vf', `scale=3072:4608,zoompan=z='${zx}':x='${x}':y='${y}':d=${d}:s=${W}x${H}:fps=${FPS},pad=${W}:${PADH}:(ow-iw)/2:(oh-ih)/2:color=0x${s.s.pad},format=yuv420p`,
    '-frames:v', String(d), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
  console.log(`clip ${s.id}`);
}

// ── 3. the spec vo-film reads ──────────────────────────────────────────────
// denoise:false on every source: these are phrase-bounded cuts of short
// slices, so the master-level energy detector has little room tone to measure
// and nothing between shots to remove — vo-film's per-shot WORD-TIMING clean
// (the one that finds pauses by the absence of words) does the work.
const SOURCES = [...Object.keys(SLICES), LAURA];
const spec = {
  title: 'MORE WATER, RIGHT NOW — in her voice',
  width: W, height: PADH, fps: FPS, bg: '#f1d3a5', out: 'water-reel-v13',
  // vo-film's default edge rule keeps up to 1.2s of lead-in/tail per shot,
  // which is right for a film of long shots and wrong for 34 short ones: the
  // two kept edges MEET at every joint and the verify pass reports the reel as
  // dead air. Tighter here, in the spec, so the default is untouched for
  // everyone else — and the rule is in the shot cut cache key, so changing
  // this number re-cuts rather than serving a stale cut.
  edge: { max: 0.45, keep: 0.22 },
  // not her voice — the mix may level these freely (see mix-sfx SYNTH_CAP)
  synthSources: [LAURA],
  // cut on a fresh per-span re-listen, never on the bulk chunk timings alone —
  // her v9 note: word beginnings and ends were clipped (vo-film's relistenSpan)
  relisten: true,
  sources: Object.fromEntries(SOURCES.map((k) => [k, { file: path.join(srcDir, `${k}.wav`), denoise: false }])),
  shots: SHOTS.map((s) => ({
    id: s.id, video: path.join(clipDir, `${s.id}.mp4`), source: s.src,
    phrases: s.phrases, ...(s.extra ? { extra: s.extra } : {}),
  })),
};
fs.writeFileSync(path.join(WORK, 'spec.json'), JSON.stringify(spec, null, 2));
console.log(`\nspec: ${path.join(WORK, 'spec.json')} — ${SHOTS.length} shots, ${SOURCES.length} sources`);
console.log(`next: node scripts/vo-film.js ${path.join(WORK, 'spec.json')} --dir ${path.join(WORK, 'film')} --final`);
