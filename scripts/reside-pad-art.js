#!/usr/bin/env node
/* reside-pad-art.js — move a Story Room beat's art from one SIDE to another,
 * in place (2026-08-26, Sophie: "the dance one went into the watercolor one,
 * but it should be dreamy").
 *
 * For art a chat placed on the wrong side before sideFromEvidence existed
 * (scratchpad.js): the whole slot — url, src, gen, imageHistory, and a clip's
 * own fields — moves between sides on the SAME beat, so nothing is deleted,
 * no trash entry is written and no `off` mark is left behind (the /image +
 * /remove dance would leave both). The beat's shared fields (words, color,
 * voice takes, chunk) are never touched — they belong to every side.
 *
 * DRY BY DEFAULT (the /wrapup/trim pattern). Refuses a move onto a side that
 * already holds anything, beat by beat — a wrong merge loses real art.
 *
 *   FIREBASE_SERVICE_ACCOUNT='<deckfactory json>' \
 *   node scripts/reside-pad-art.js <padId> --from watercolor --to dreamy \
 *        [--beats id,id,…] [--show] [--go]
 *
 *   --beats  only these beat ids (default: every beat with art on --from)
 *   --show   also set the pad's toggle to --to, so the story opens on its art
 *   --go     write (default: print what would move and stop)
 */
'use strict';
const admin = require('firebase-admin');

const STYLES = ['watercolor', 'dreamy', 'pastel'];
// scratchpad.js's SLOT_KEYS — every field that belongs to ONE side.
const SLOT_KEYS = ['url', 'src', 'gen', 'imageHistory', 'kind', 'poster', 'seconds', 'title', 'clipId'];

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  else admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : dflt;
}

async function main() {
  const padId = process.argv[2];
  const from = arg('from', 'watercolor');
  const to = arg('to', null);
  const only = (arg('beats', '') || '').split(',').filter(Boolean);
  const go = process.argv.includes('--go');
  const show = process.argv.includes('--show');
  if (!padId || padId.startsWith('--') || !STYLES.includes(from) || !STYLES.includes(to) || from === to) {
    console.error('usage: node scripts/reside-pad-art.js <padId> --from <side> --to <side> [--beats id,…] [--show] [--go]');
    process.exit(2);
  }
  init();
  const ref = admin.firestore().collection('forge-scratchpad').doc(padId);
  const snap = await ref.get();
  if (!snap.exists) { console.error('no such pad: ' + padId); process.exit(1); }
  const v = snap.data() || {};
  const beats = Array.isArray(v.beats) ? v.beats : [];
  const slot = (b, side, make) => {
    if (side === 'watercolor') return b;
    if (make) { b.alt = b.alt || {}; b.alt[side] = b.alt[side] || {}; }
    return (b.alt && b.alt[side]) || {};
  };

  let moved = 0; let refused = 0;
  for (const b of beats) {
    if (only.length && !only.includes(b.id)) continue;
    const src = slot(b, from, false);
    if (!src.url) continue;
    const dst = slot(b, to, false);
    if (SLOT_KEYS.some((k) => dst[k] !== undefined)) {
      console.log(`REFUSED ${b.id} — the ${to} side already holds something`);
      refused++; continue;
    }
    console.log(`${go ? 'MOVE' : 'would move'} ${b.id}  ${from} → ${to}  ${String(src.url).slice(-48)}`);
    if (go) {
      const d = slot(b, to, true);
      SLOT_KEYS.forEach((k) => { if (src[k] !== undefined) d[k] = src[k]; });
      SLOT_KEYS.forEach((k) => { delete src[k]; });
      delete src.off; delete d.off;   // art here again un-deletes the side
    }
    moved++;
  }
  console.log(`${moved} to move, ${refused} refused${show ? `, toggle → ${to}` : ''}${go ? '' : '  (dry — add --go to write)'}`);
  if (go && (moved || show)) {
    const patch = { beats, updatedAt: Date.now() };
    if (show) patch.style = to;
    await ref.set(patch, { merge: true });
    console.log('written.');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
