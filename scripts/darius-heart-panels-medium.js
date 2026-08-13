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
const OUT = path.join(__dirname, 'nde-watercolor', 'darius-heart-medium.json');

const SLOT = { a: 'TOP LEFT', b: 'TOP RIGHT', c: 'BOTTOM LEFT', d: 'BOTTOM RIGHT' };

/* The film's running order. Each entry is <sheet>-<slot>, and the shot it
   serves — the shot ids are the SHOTS list in darius-heart-film.js. */
const PICKS = [
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
];

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
   scene with the sheet's own words inside it. */
function panelScene(sheet, slot) {
  const label = SLOT[slot];
  const re = new RegExp(`${label} panel:\\s*([\\s\\S]*?)(?=\\n\\n(?:TOP|BOTTOM) |\\n\\nNo text)`, 'i');
  const m = String(sheet.scene).match(re);
  if (!m) throw new Error(`no ${label} panel in ${sheet.id}`);
  let s = m[1].trim().replace(/\s+/g, ' ');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s + '\n\nNo text or lettering anywhere.';
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
  console.log(`\n${jobs.length} panels · ~$${(jobs.length * 0.06).toFixed(2)} at medium`);
} else {
  fs.writeFileSync(OUT, JSON.stringify(jobs, null, 1) + '\n');
  console.log('wrote', path.relative(process.cwd(), OUT), '·', jobs.length, 'jobs');
}
