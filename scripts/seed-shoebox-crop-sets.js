#!/usr/bin/env node
// Seed the Squaring tool with the two set-theory Shoebox boards, so the crops
// already on those polaroids can be corrected by hand.
//
// The SOURCE of each item is the story pad's ORIGINAL picture, never the square
// already cut from it — cropping a crop only loses more. The starting position
// is the one this chat picked by eye on 2026-08-29, converted from "the crop's
// centre as a fraction of the height" to the tool's `pos` (the fraction along
// the slack): for a 2:3, pos = 3*cy - 1.
//
// `apply` points at the memory doc each polaroid already is, so saving a crop
// lands on the board she is looking at with nothing to re-pin.
//
//   node scripts/seed-shoebox-crop-sets.js            (dry)
//   node scripts/seed-shoebox-crop-sets.js --go
//   FORGE_BASE=… to point at another server

const crypto = require('crypto');

const DRY = !process.argv.includes('--go');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const UID = process.env.SHOEBOX_UID || 'ryUwOuU8viYu7ERBU0IQcYPdBcR2';
const BUCKET = 'deckfactory-43176.firebasestorage.app';

// cy = the crop centre this chat picked by eye, against what each beat is about.
const AIM = {
  MMIlu4KEGYUYeLvaK4Be: { title: 'shirt envelope', cy: {
    nAAKngk8HAH1Tq1QVhWB: 0.36, '7QByzarbuWXJk68G8EYb': 0.36, gh41oYaCS3kQopzkL4wz: 0.58,
    wrYdoV0kg9KN7JPH6JHs: 0.46, nehWfvrYMbiIsLsuWzF1: 0.45, PqpTlbElga1BzlQVqmWg: 0.45,
    '3sn0sYMbvSytPl3JB9zH': 0.37,
  } },
  IbGUaC9LCJgTYEzGcNdk: { title: 'manifesting on purpose', cy: {
    wciQI1iRyCerWPWg6ONN: 0.38, w9eidfR4xYtGkyt5RLzQ: 0.47, '83F8oVSXR8cBkTEKyq88': 0.44,
    '6RKgTl9PGo6nmKWZTmvT': 0.43, '3E9mAaKPfbHcUJeZlqEJ': 0.43,
  } },
};

// The memory each polaroid is: its doc id was hashed off the FIRST square's
// url, and has been kept ever since so the boards' pins never had to move.
const memoryId = (chunk, beat) => 'sb-' + crypto.createHash('sha1')
  .update('https://storage.googleapis.com/' + BUCKET + '/shoebox/square/' + chunk + '-' + beat + '.webp')
  .digest('hex').slice(0, 24);

const labelOf = (b) => (String(b.text || '').trim() || String((b.src && b.src.prompt) || '').trim()).slice(0, 200);

(async () => {
  const pad = await (await fetch(BASE + '/api/scratchpad/?pad=pad')).json();
  const beats = pad.beats || [];
  for (const [chunk, spec] of Object.entries(AIM)) {
    const items = beats.filter((b) => b.chunk === chunk && b.url).map((b) => {
      const cy = spec.cy[b.id];
      // pos from cy, for THIS picture's shape: cy is the centre as a fraction
      // of the height, pos is the fraction along the slack the square can move.
      const vis = 2 / 3;                       // every one of these is a 2:3
      const pos = cy == null ? 0.5 : Math.max(0, Math.min(1, (cy - vis / 2) / (1 - vis)));
      return { url: b.url, label: labelOf(b), pos,
        apply: { kind: 'memory', uid: UID, id: memoryId(chunk, b.id) } };
    });
    console.log('\n=== ' + spec.title + ' — ' + items.length + ' pictures');
    items.forEach((it) => console.log('  pos ' + it.pos.toFixed(2) + '  ' + it.label.slice(0, 54)));
    if (DRY) continue;
    const r = await fetch(BASE + '/api/crop/sets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: spec.title, items }),
    });
    const j = await r.json();
    if (!r.ok) { console.error('  FAILED: ' + (j.error || r.status)); continue; }
    console.log('  → ' + BASE + j.url);
  }
  if (DRY) console.log('\nDRY — rerun with --go');
})().catch((e) => { console.error(e); process.exit(1); });
