#!/usr/bin/env node
/**
 * find-lossy-originals.js — find the pictures that were COMPRESSED AT BIRTH.
 *
 * WHY THIS EXISTS. Two parameters were quietly encoding every original lossily
 * before the bytes ever reached us — OpenAI's `output_compression` and
 * Replicate/Flux's `output_quality` (plus an argument-less sharp webp
 * encode, which quietly defaults to quality 80). All three are fixed, and
 * scripts/test-no-generation-compression.js greps the tree so they cannot come
 * back. But the guard is STATIC: it protects the code from here on and says
 * nothing about the ~21,000 pictures already in Storage, some made by one-off
 * chat scripts that no longer exist in the tree. This is the other half — it
 * asks the IMAGES, not the code.
 *
 * THE MEASUREMENT. Bits per pixel: file size × 8 ÷ (width × height). The two
 * populations do not overlap, measured 2026-08-19 across the whole bucket —
 * the dream feed happens to hold both sides of the fix an hour apart, same
 * generator, same style, same prompts:
 *
 *   before the fix (webp @ 80)   1.26 – 3.93 bpp   160 – 503 KB
 *   after  the fix (webp @ 100) 10.17 – 13.61 bpp  1,301 – 1,742 KB
 *
 * A lossless PNG original sits at 11–16 bpp.
 *
 * THE THRESHOLD IS A SCREEN, NOT A VERDICT — and this is the thing to know
 * before trusting a number out of here. Bits per pixel measures how hard the
 * picture was to encode as much as how badly it was encoded, so it only
 * separates the two populations WITHIN a comparable style. The dream-feed
 * numbers above are trustworthy because they are the same generator and the
 * same prompts an hour either side of the fix. Flat art is the false positive:
 * pastel and watercolour originals encoded at quality 100 land at 3.9–5.9 bpp
 * — below a naive 6.0 cut, and perfectly clean. A first pass at 6.0 flagged
 * 2,006 pictures and roughly half were fine.
 *
 * So the cut is 2.5, low enough that nothing clean was seen beneath it, and
 * what comes out is a LIST TO CHECK. The authority for "this one is damaged"
 * is the code path that made it — grep the writer of that Storage prefix and
 * read what it sent. Measured 2026-08-19: 809 pictures traced to a named
 * lossy call, 169 more surfaced here and traced afterwards.
 *
 * THE SECOND TEST IS DIMENSIONS, and it is what keeps this honest. A small
 * webp is only a problem when it is the ONLY copy. A derived display copy —
 * scripts/webp-assets.js, the `thumbs/` service, a 640px poster — is SUPPOSED
 * to be lossy and its original is safe elsewhere; those are correct and must
 * not be reported. They give themselves away by their size on screen, so
 * anything under FULL_PX on its long edge is left alone.
 *
 * READ-ONLY. It reads the first 64 BYTES of each webp — the RIFF header
 * carries the dimensions — and never writes anything. The picture itself is
 * never downloaded, so a whole-bucket pass costs kilobytes, not gigabytes.
 * (Decoding the header with sharp instead needs the frame, not just the
 * header, and failed on 5,440 of 5,490 objects when it was tried that way.)
 *
 *   node scripts/find-lossy-originals.js                  # every prefix
 *   node scripts/find-lossy-originals.js --prefix promptlab/
 *   node scripts/find-lossy-originals.js --json out.json
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (deckfactory-43176).
 */
'use strict';

const admin = require('firebase-admin');

const LOSSY_BPP = 2.5; // see THE THRESHOLD IS A SCREEN, NOT A VERDICT above
const FULL_PX = 1000;  // under this on the long edge it is a display copy
const CONCURRENCY = 16;
// Correctly-derived display copies — a lossy webp whose ORIGINAL is safe
// somewhere else. These are the rule working, not the bug, and reporting them
// buries the real findings: `webp-assets.js` writes a `webp/` sibling next to
// the full-quality file, and the rest are thumbnails, posters and cut cells.
const DERIVED = /(^|\/)(webp|thumbs|thumb|cards?|posters|_)\/|_thumb|^(thumbs|vector|drops|clips|clip-library|two-panel-gallery|google-drawings|lesson-icons|commercials|selfcare|opinions|compare)\//;

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--prefix');
const jsonOut = argOf('--json');

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
  const sa = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  return admin.storage().bucket();
}

/**
 * Every full-size webp in a bucket, with the fields the bpp screen needs.
 *
 * `md5` rides along because Storage hands it back in the SAME listing call that
 * gives the size — free, no extra request, no bytes downloaded — and it is what
 * lets a caller join an object to a renamed copy of itself (asset-hash.js /
 * asset-union.js). scripts/tag-compressed-at-birth.js is the caller that needs
 * it; nothing here uses it.
 */
async function listWebp(bucket, prefix) {
  const out = [];
  let token;
  do {
    const [files, q] = await bucket.getFiles({ autoPaginate: false, maxResults: 5000, pageToken: token, prefix: prefix || undefined });
    files.forEach((f) => {
      if (!/\.webp$/i.test(f.name)) return;                 // png/jpg cannot carry this bug
      if (DERIVED.test(f.name)) return;
      out.push({
        name: f.name,
        size: Number(f.metadata.size || 0),
        created: f.metadata.timeCreated,
        md5: f.metadata.md5Hash ? Buffer.from(String(f.metadata.md5Hash), 'base64').toString('hex') : '',
      });
    });
    token = q && q.pageToken;
  } while (token);
  return out;
}

// WebP dimensions straight out of the RIFF header. After 'RIFF'…'WEBP' comes
// one of three chunk tags, each storing the size differently.
function webpSize(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (tag === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
  if (tag === 'VP8X') { const rd = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16); return { w: rd(24) + 1, h: rd(27) + 1 }; }
  return null;
}

async function measure(bucket, it) {
  try {
    const [buf] = await bucket.file(it.name).download({ start: 0, end: 63 });
    const s = webpSize(buf);
    if (!s) { it.err = 'unrecognised webp header'; return it; }
    it.w = s.w; it.h = s.h;
    it.bpp = +((it.size * 8) / (s.w * s.h)).toFixed(2);
  } catch (err) {
    it.err = err.message.slice(0, 60);
  }
  return it;
}

async function pool(items, fn) {
  const q = items.slice();
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (q.length) {
      await fn(q.shift());
      if (++done % 1000 === 0) process.stderr.write(`  ${done}/${items.length}\n`);
    }
  }));
}

async function main() {
  const bucket = init();
  process.stderr.write('listing…\n');
  const items = await listWebp(bucket, only);
  process.stderr.write(`${items.length} webp objects — measuring headers…\n`);
  await pool(items, (it) => measure(bucket, it));

  const measured = items.filter((x) => x.bpp);
  const lossy = measured.filter((x) => x.bpp < LOSSY_BPP && Math.max(x.w, x.h) >= FULL_PX);
  const derived = measured.filter((x) => x.bpp < LOSSY_BPP && Math.max(x.w, x.h) < FULL_PX);

  const byPrefix = new Map();
  lossy.forEach((x) => {
    const p = x.name.split('/').slice(0, -1).join('/') + '/';
    if (!byPrefix.has(p)) byPrefix.set(p, []);
    byPrefix.get(p).push(x);
  });

  console.log(`\nCOMPRESSED AT BIRTH — ${lossy.length} pictures whose only copy is lossy\n`);
  [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([p, v]) => {
    const bpps = v.map((x) => x.bpp).sort((a, b) => a - b);
    const kb = v.map((x) => x.size).sort((a, b) => a - b);
    console.log(`  ${String(v.length).padStart(5)}  ${p}`);
    console.log(`         ${bpps[0]}–${bpps[bpps.length - 1]} bpp · ${Math.round(kb[0] / 1024)}–${Math.round(kb[kb.length - 1] / 1024)} KB`);
  });
  console.log(`\n  ${measured.length} measured · ${items.length - measured.length} unreadable`);
  console.log(`  ${derived.length} small lossy webp left alone (display copies — their original is elsewhere)`);
  console.log('  → a hit here is a LIST TO CHECK, not a verdict: confirm it against the code that writes that prefix.');
  console.log(`  ${measured.length - lossy.length - derived.length} already full quality\n`);

  if (jsonOut) {
    require('fs').writeFileSync(jsonOut, JSON.stringify({ lossy, derived }, null, 1));
    console.log(`wrote ${jsonOut}`);
  }
}

// THE MEASUREMENT IS EXPORTED, NOT COPIED. scripts/tag-compressed-at-birth.js
// tags the pictures this file finds, and a second copy of the bpp screen there
// would drift from this one — the same reason the audio rooms import the
// Cutting Room's pause detection instead of re-deriving it. Every constant
// above is a measured finding; read the header before changing one.
module.exports = { LOSSY_BPP, FULL_PX, DERIVED, webpSize, listWebp, measure, pool };

if (require.main === module) {
  main().catch((err) => { console.error('failed:', err.message); process.exit(1); });
}
