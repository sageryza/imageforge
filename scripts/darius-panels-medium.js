#!/usr/bin/env node
/**
 * Lift the chosen PANELS out of the 2x2 low-quality sheets and re-render each
 * one on its own at medium — the second half of Sophie's panel pipeline (draw
 * many at a quarter of a cent, then upscale the keepers).
 *
 * A panel inside a sheet is 512x768; a single render is the full 1024x1536, so
 * this is the difference between the film being soft and being sharp. The
 * re-render is a genuine REDRAW, not an upscale, so it can come back different
 * — that is why the panel PNGs are kept and any medium that lands worse is
 * simply not used.
 *
 *   node scripts/darius-heart-panels-medium.js         # write the jobs file
 *   node scripts/darius-heart-panels-medium.js --list  # just show the picks
 *
 * The scene text is EXTRACTED from the sheet's own prompt, never retyped: each
 * sheet names its four panels with "TOP LEFT panel:" etc, so the pick's
 * sentence comes out verbatim and the drawing keeps saying what the sheet said.
 * The grid wrapper and the panel label are dropped; the no-text suffix stays.
 */
const fs = require('fs');
const path = require('path');

const SHEETS = require('./nde-watercolor/darius-panels-01.json');
const SET = process.argv.find((a) => a === 'heart' || a === 'proof') || 'heart';
const OUT = path.join(__dirname, 'nde-watercolor', `darius-${SET}-medium.json`);

const SLOT = { a: 'TOP LEFT', b: 'TOP RIGHT', c: 'BOTTOM LEFT', d: 'BOTTOM RIGHT' };

/* Each film's picks: <sheet>-<slot>, and the shot it serves. The shot ids are
   the film's own SHOTS list in darius-film.js. */
const SETS = { heart: [
  ['dp-heart-spectrum-a', 's01'],
  ['dp-heart-spectrum-b', 's01'],
  ['dp-heart-mechanism-a', 's02'],
  ['dp-heart-mechanism-b', 's02'],
  ['dp-heart-paralysis-a', 's03'],
  ['dp-heart-paralysis-b', 's03'],
  ['dp-heart-paralysis-c', 's03'],
  ['dp-heart-mechanism-c', 's04'],
  ['dp-heart-paralysis-d', 's04'],
  ['dp-heart-soul-physical-a', 's05'],
  ['dp-heart-soul-physical-b', 's05'],
  ['dp-heart-soul-physical-c', 's05'],
  ['dp-heart-spectrum-c', 's06'],
  ['dp-heart-spectrum-d', 's06'],
  ['dp-heart-field-analogies-a', 's07'],
  ['dp-heart-field-analogies-b', 's08'],
  ['dp-heart-field-analogies-c', 's09'],
  ['dp-heart-field-analogies-d', 's10'],
  ['dp-heart-energy-c', 's11'],
  ['dp-heart-energy-d', 's11'],
  ['dp-heart-energy-a', 's11'],
], proof: [
  ['dp-proof-accounts-c', 's01'],        // the notebook of ticks and crosses
  ['dp-proof-whiteboard-a', 's02'],      // the number written in an empty room
  ['dp-proof-whiteboard-b', 's02'],      // out of the body, reading it
  ['dp-proof-whiteboard-c', 's02'],      // back in the body, saying it down the phone
  ['dp-proof-whiteboard-d', 's03'],      // five whiteboards, five days running
  ['dp-proof-accounts-d', 's04'],        // the crowd of witnesses
  ['dp-proof-accounts-a', 's05'],        // Kelly above the camp
  ['dp-proof-accounts-b', 's05'],        // Kelly on the phone, confirmed
  ['dp-pyramid-tunnels-a', 's07'],
  ['dp-pyramid-tunnels-b', 's07'],
  ['dp-pyramid-tunnels-c', 's07'],
  ['dp-pyramid-tunnels-d', 's07'],
] };

const PICKS = SETS[SET];

/* Six panels open on a back-reference to the panel BESIDE them ("the same
   field", "the calm version instead") — true on a 2x2 sheet, adrift the moment
   the panel is drawn alone. Each replacement below restores the antecedent
   using the SIBLING PANEL'S OWN WORDS from the same sheet; nothing new is
   described. Keyed by the phrase being resolved so the edit is auditable. */
const RESOLVE = {
  'dp-heart-mechanism-b': [
    /^The same field/,
    'That man sitting upright with his eyes closed, and around his whole body a doughnut-shaped field drawn as fine concentric lines pouring up out of his chest, over his head, down around him and back in underneath — that field',
  ],
  'dp-heart-mechanism-c': [
    /^The field thinned out/,
    'That man sitting upright with his eyes closed, and the doughnut-shaped field of fine concentric lines around his whole body thinned out',
  ],
  'dp-heart-paralysis-b': [
    /^The same dark room/,
    'A dark bedroom seen from directly above, a person lying flat on their back wide awake and unable to move',
  ],
  'dp-heart-paralysis-c': [
    /^The wave line suddenly spiking/,
    'A dark bedroom seen from directly above, a person lying flat on their back on the bed, and the long slow rolling wave line travelling across the room at the level of their head suddenly spiking',
  ],
  'dp-heart-paralysis-d': [
    /^The calm version instead — the wave staying/,
    'A dark bedroom seen from directly above, a person lying flat on their back on the bed, and the long rolling wave line travelling across the room staying',
  ],
  'dp-heart-spectrum-d': [
    /^The exact same living room/,
    'An ordinary living room with a person seated in an armchair',
  ],
};

function split(id) {
  const slot = id.slice(-1);
  return { sheet: id.slice(0, -2), slot };
}

/* Pull one panel's sentence out of the sheet prompt. The label is dropped, so
   "TOP LEFT panel: a cat looking…" becomes "A cat looking…" — a standalone
   scene with the sheet's own words inside it.
   The no-text rule is taken from THAT SHEET's own last paragraph rather than
   hard-coded: dp-proof-whiteboard's reads "No words or lettering anywhere
   except those single handwritten numerals", and pasting the generic line over
   it would ban the very numeral the whole test is about. */
function panelScene(sheet, slot) {
  const label = SLOT[slot];
  const paras = String(sheet.scene).split(/\n\n+/).map((x) => x.trim()).filter(Boolean);
  const hit = paras.find((x) => x.toUpperCase().startsWith(label + ' PANEL:'));
  if (!hit) throw new Error(`no ${label} panel in ${sheet.id}`);
  const last = paras[paras.length - 1];
  if (!/^No\b/i.test(last)) throw new Error(`${sheet.id}: last paragraph is not a no-text rule`);
  let s = hit.slice(hit.indexOf(':') + 1).trim().replace(/\s+/g, ' ');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s + '\n\n' + last;
}

const jobs = PICKS.map(([id, shot]) => {
  const { sheet: sid, slot } = split(id);
  const sheet = SHEETS.find((x) => x.id === sid);
  if (!sheet) throw new Error('no such sheet: ' + sid);
  let scene = panelScene(sheet, slot);
  const fix = RESOLVE[id];
  if (fix) {
    if (!fix[0].test(scene)) throw new Error(`${id}: the phrase to resolve is not there anymore`);
    scene = scene.replace(fix[0], fix[1]);
  }
  const job = { id: id + '-m', shot, quality: 'medium', scene };
  if (sheet.refs && sheet.refs.length) { job.refs = sheet.refs; job.likeness = sheet.likeness; }
  return job;
});

if (process.argv.includes('--list')) {
  jobs.forEach((j) => console.log(j.shot, j.id, (j.refs || []).length + 'r', '·', j.scene.slice(0, 96)));
  console.log(`\n${SET}: ${jobs.length} panels · ~$${(jobs.length * 0.06).toFixed(2)} at medium`);
} else {
  fs.writeFileSync(OUT, JSON.stringify(jobs, null, 1) + '\n');
  console.log('wrote', path.relative(process.cwd(), OUT), '·', jobs.length, 'jobs');
}
