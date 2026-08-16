#!/usr/bin/env node
/* seed-story-timeline.js — move the ORIGINAL story out of the one-off Compare
 * page and into the Story Timeline tool, carrying everything Sophie did to it.
 *
 *   node scripts/seed-story-timeline.js --dry-run
 *   node scripts/seed-story-timeline.js
 *
 * The story lived in two halves before the tool existed: its words in
 * docs/story-timeline/beats.json, and everything she changed on the page in the
 * chat's verdict doc (`order`, `t:<id>` per edited or added moment, `gone` for
 * what she deleted). This reads both, applies HER version over the file's the
 * same way the page did, and writes one story into /api/timeline.
 *
 * It REUSES an empty story of the same name rather than making a second one, so
 * a retry after a failed write tops the same story up instead of littering her
 * shelf — which is exactly what the first two attempts did. --dry-run shows
 * what would be written and touches nothing.
 */
const fs = require('fs');
const path = require('path');
const { parseStory } = require('../timeline-parse');   // only for its shape docs

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';
const DRY = process.argv.includes('--dry-run');

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/story-timeline/beats.json'), 'utf8'));

// the file's own starting arrangement: a seq block is one unit
const moments = {};
const units = [];
src.blocks.forEach((b) => {
  const beats = b.kind === 'seq' ? b.beats : [b];
  beats.forEach((x) => {
    moments[x.id] = { text: x.text };
    if (x.label) moments[x.id].label = x.label;
    if (x.tag) moments[x.id].tag = x.tag;
  });
  units.push(beats.map((x) => x.id));
});

function headers() {
  return Object.assign({ 'Content-Type': 'application/json' },
    TOKEN ? { 'x-studio-token': TOKEN } : {});
}

(async function main() {
  // what she did on the page
  const url = BASE + '/api/chatfeed/verdict?chat=' + encodeURIComponent(src.chat)
    + '&sheet=' + encodeURIComponent(src.order);
  const saved = await fetch(url).then((r) => r.json()).catch(() => ({}));
  const texts = (saved && saved.texts) || {};

  const gone = {};
  (texts.gone || '').split(',').forEach((id) => { if (id) gone[id] = 1; });

  Object.keys(texts).forEach((k) => {                 // her words win over the file
    if (k.indexOf('t:') !== 0) return;
    const id = k.slice(2);
    if (gone[id]) return;
    moments[id] = Object.assign(moments[id] || {}, { text: texts[k] });
  });
  Object.keys(gone).forEach((id) => { delete moments[id]; });

  let arrangement = units;
  if (texts.order) {
    const groups = texts.order.indexOf('|') >= 0
      ? texts.order.split('|').map((g) => g.split(','))
      : texts.order.split(',').map((t) => {
        if (t.indexOf('s-') !== 0) return [t];
        const head = t.slice(2);
        const hit = units.find((g) => g[0] === head);
        return hit ? hit.slice() : [head];
      });
    const seen = {};
    arrangement = [];
    groups.forEach((g) => {
      const keep = g.filter((id) => moments[id] && !seen[id] && (seen[id] = 1));
      if (keep.length) arrangement.push(keep);
    });
    Object.keys(moments).forEach((id) => { if (!seen[id]) arrangement.push([id]); });
  }

  const count = arrangement.reduce((n, g) => n + g.length, 0);
  console.log(`${count} moments in ${arrangement.length} units`);
  console.log(texts.order ? 'using HER saved arrangement' : 'no saved arrangement — the file order');
  if (texts.gone) console.log('deleted by her: ' + texts.gone);
  Object.keys(texts).filter((k) => k.indexOf('t:') === 0)
    .forEach((k) => console.log('  her wording: ' + k.slice(2)));

  if (DRY) {
    arrangement.forEach((g, i) => console.log(`  ${i + 1}. `
      + g.map((id) => JSON.stringify((moments[id].text || '').slice(0, 40))).join(' + ')));
    return;
  }

  // reuse an EMPTY story of this name if one is sitting there — a failed write
  // leaves one behind, and a retry must not add to the pile
  const TITLE = 'The house';
  const shelf = await fetch(BASE + '/api/timeline/stories', { headers: headers() })
    .then((r) => r.json()).catch(() => ({}));
  const empty = ((shelf && shelf.stories) || [])
    .filter((x) => x.title === TITLE && !x.moments)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));

  let made = empty[0];
  if (made) console.log('reusing the empty story left by an earlier run');
  else {
    made = await fetch(BASE + '/api/timeline/stories', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: TITLE }),
    }).then((r) => r.json());
  }
  if (!made.id) throw new Error('could not make the story: ' + JSON.stringify(made));

  // and hide any other empty twins, so the shelf shows one story
  for (const x of empty.slice(1)) {
    await fetch(BASE + '/api/timeline/stories/' + x.id, { method: 'DELETE', headers: headers() })
      .catch(() => {});
  }

  const put = await fetch(BASE + '/api/timeline/stories/' + made.id, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify({ moments, units: arrangement }),
  }).then((r) => r.json());
  if (!put.ok) throw new Error('could not save it: ' + JSON.stringify(put));

  console.log('\nstory ' + made.id);
  console.log(BASE + '/timeline?story=' + made.id);
}()).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
