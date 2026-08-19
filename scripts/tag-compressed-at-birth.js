#!/usr/bin/env node
/**
 * tag-compressed-at-birth.js — mark the pictures that were COMPRESSED AT BIRTH
 * with ONE boolean field, so every surface can say so in its own words.
 *
 * WHY A FIELD AND NOT A TEXT TAG (Sophie's call, 2026-08-19). The first plan
 * was to prepend the literal string "[compressed]" into each record's caption
 * and into both halves of its filed prompt. That is string surgery on the one
 * field the house rules say must hold THE EXACT PROMPT, character for character
 * — it cannot be undone without guessing where the tag ended, it collides with
 * the 1500/6000-char caps, and it makes an image with a real prompt
 * indistinguishable from one whose prompt merely mentions the word. So the
 * damage is recorded as DATA — `compressedAtBirth: true` — and the bracket text
 * is drawn by the UI. Reversible (--undo), searchable, and the prompt Sophie
 * reads is still the prompt that was sent.
 *
 * WHAT GETS TAGGED. scripts/find-lossy-originals.js owns the measurement and
 * this script imports it — one copy of the bpp screen, never two. On top of it
 * sit three policy lists, each earned by a correction to the first pass
 * (verified by a second chat, 2026-08-19):
 *
 *   NEVER      — flagged and left alone anyway, because a full-quality original
 *                exists elsewhere: her own photographs and scans, deliberate
 *                display chrome, public-domain scans, and derived display
 *                copies whose original sits beside them. A phone photo was
 *                never "compressed at birth" by us — nobody typed a prompt and
 *                no model drew it.
 *   HOLD       — flagged by the screen, but NOT tagged until the code that
 *                writes that prefix has been read. Flat art defeats bits per
 *                pixel: a diagram of flat fills encodes small because it IS
 *                simple, not because it was thrown away. Currently empty —
 *                every held prefix has now been resolved by reading its writer.
 *   PROVEN     — tagged whatever the bpp says, because the writer is a known
 *                lossy call. THE RULE: provenance beats the screen — every file
 *                that writer made before the fix is damaged, including the ones
 *                that happen to encode above the cut.
 *
 * A HIT IS STILL A LIST TO CHECK, AND THAT IS NOT A FORMALITY. The screen is a
 * screen (read the header of find-lossy-originals.js): it separates the two
 * populations only WITHIN a comparable style. Measured 2026-08-19, reading the
 * writer of every flagged prefix moved **519 of 579** held-back membry pictures
 * out of the write — sagediagram/, story/ and storybook/marla/ are all fine —
 * and moved 60 (miracles/) in. Judging those by bits per pixel alone would have
 * put a false claim on 519 of her pictures.
 *
 * MATCHED BY URL **AND** BY MD5. A picture reaches Firestore by more than one
 * road — the object where it was generated, and the byte-identical
 * `claude-deliveries/<random>` copy the hook files when the same image is also
 * sent as a chat file. The filename can never join those two, so the tag is
 * carried across on the Storage object's own md5 (free from the listing, no
 * bytes downloaded), exactly as asset-union.js joins the tiles. A RE-ENCODED
 * copy (webp→png for chat preview) is different bytes and nothing joins it —
 * the known unfixable case, counted and named in the report rather than
 * guessed at.
 *
 * BOTH PROJECTS, IN ONE PASS. The flag is written on (a) the forge-chat-assets
 * doc in deckfactory-43176 and (b) the users/{uid}/creations doc in
 * membry-df528. A doc in either collection can point at an object in either
 * bucket, so both buckets are scanned into ONE index and every doc is judged
 * against it by the bucket its own url names — never by whichever app is handy.
 *
 * IDEMPOTENT. A doc already carrying the flag is counted and left alone, so
 * re-running costs reads and no writes.
 *
 *   node scripts/tag-compressed-at-birth.js                 # DRY — counts only
 *   node scripts/tag-compressed-at-birth.js --write         # do it
 *   node scripts/tag-compressed-at-birth.js --undo --write  # take it all back
 *   node scripts/tag-compressed-at-birth.js --json out.json # the full decision list
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (deckfactory-43176) and
 * STORY_FIREBASE_SERVICE_ACCOUNT (membry-df528).
 */
'use strict';

const admin = require('firebase-admin');
const finder = require('./find-lossy-originals');
const { storageRef } = require('../asset-hash');

const FIELD = 'compressedAtBirth';
const BATCH = 400;

/**
 * NEVER — flagged by the screen and left alone anyway, because the picture was
 * not compressed AT BIRTH. Two different reasons live here, and both end the
 * same way: a full-quality original of this picture exists somewhere else, so
 * marking it damaged would put a false claim in front of Sophie.
 *
 *   HER OWN — a photograph or a scan. Nobody typed a prompt and no model drew
 *   it; the original is the scan itself. Same spirit as asset-guard.js's
 *   SOURCE_LIBRARY_PREFIXES.
 *   DERIVED — a display copy that is SUPPOSED to be lossy, whose original is
 *   safe alongside it. That is the webp rule working, not the bug.
 *
 * Every writer named below was READ, not guessed (2026-08-19).
 */
const NEVER = [
  // — HER OWN —
  // Corrections 1-3, verified 2026-08-19:
  'refs-sheet/',                 // webp copies of her reference images; the full-quality
                                 // originals are committed in the repo's refs/ folder
  'ingest/hospital-pj-photos/',  // her own photographs
  'chat-feed/icons/',            // deliberate display chrome
  // Correction 6 — source libraries, her photographs, never tagged:
  'drops/',                      // the Dump
  'crystals/',                   // her mom's crystals, photographed
  'ingest/',                     // anything else she brought in herself
  // Correction 5 — public domain, not ours and not damaged by us:
  'witch-tarot/',                // Wikimedia's 1909 Rider-Waite scans
  // Correction 5, resolved by reading the writers (see THE HELD-BACK PREFIXES):
  'sagediagram/',                // 316 — HER OWN scanned drawings. memory-library-react's
                                 // public/sagediagram.html encodes the file SHE PICKS with
                                 // canvas toBlob('image/webp', 0.9) before upload, and the
                                 // Cloud Function persists those bytes as-is. A re-encode of
                                 // her own scan on its way into a captioner — the scan is the
                                 // original and it is not in this bucket.
  'story/',                      // 50 — HER OWN. scripts/sync-story.js uploads local files
                                 // verbatim (fs.readFileSync, no re-encode at all).
  // — DERIVED —
  'storybook/marla/',            // 153 — scripts/marla-storybook.js writes the composed page
                                 // as sharp().webp({quality: 92}) AND uploads the
                                 // full-quality art beside it as storybook/marla/art/*.png.
                                 // The page is the display copy; the original art is safe.
];

/**
 * HOLD — flagged by the screen, but the code that writes that prefix has not
 * been read, so the finding is REPORTED and not written. Flat art is the false
 * positive the bpp screen cannot rule out by itself, and a wrong tag is a
 * confident false claim that outlives the chat that made it.
 *
 * THE HELD-BACK PREFIXES ARE ALL RESOLVED (2026-08-19). The 579 that the first
 * membry pass could not judge were read one writer at a time and sorted: 519
 * into NEVER above, and `miracles/` into PROVEN below because its writer really
 * does throw the original away. Empty is the correct state — the list stays so
 * the next unreadable prefix has somewhere to wait.
 */
const HOLD = [];

/**
 * PROVEN — tagged whatever the bpp says, because the writer is a KNOWN lossy
 * call and provenance beats the screen (THE RULE in the header). An entry is a
 * prefix, so it names either one file or a whole prefix.
 *
 * Only ever applies to a file the screen could actually measure: a buffer that
 * was persisted untouched under a `.webp` name is still PNG bytes, has no webp
 * header, and is correctly never considered here.
 */
const PROVEN = [
  // Correction 4 — these four sit ABOVE the 2.5 cut (measured 2.77–3.48 bpp)
  // and are proven q80: the quality parameter is on the record. The screen
  // alone would have missed every one of them.
  'dream-feed/raw-text/halloween-raw-dream.webp',
  'dream-feed/raw-text/halloween-raw-sage.webp',
  'dream-feed/raw-text/mountain-raw-dream.webp',
  'dream-feed/raw-text/halloween-herline-sage.webp',
  // 60 — memory-library-react's trimToSubject ends `.webp({ quality: 82 })` on
  // the model's own output, and the full-quality PNG it encodes from is an
  // in-memory intermediate that is never persisted. So the stored webp is the
  // ONLY copy and it was lossy before it existed: compressed at birth, exactly.
  'miracles/',
];

const args = process.argv.slice(2);
const has = (f) => args.indexOf(f) >= 0;
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const WRITE = has('--write');
const UNDO = has('--undo');
const jsonOut = argOf('--json');

const startsAny = (name, list) => list.some((p) => name.indexOf(p) === 0);

function appFor(envName, label) {
  const raw = process.env[envName];
  if (!raw) { console.error(`${envName} is not set`); process.exit(1); }
  const sa = JSON.parse(raw);
  const app = admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  }, label);
  return { app, project: sa.project_id, bucket: app.storage().bucket() };
}

/**
 * ONE OBJECT → ONE VERDICT. Pure, so scripts/test-compressed-at-birth.js can
 * drive the whole decision table with no network.
 *
 *   'clean'    the screen did not flag it (or it is a display copy)
 *   'never'    flagged, but a full-quality original exists elsewhere
 *   'hold'     flagged, writer unread — report it, do not write it
 *   'damaged'  compressed at birth
 *
 * ORDER IS THE POLICY. NEVER is asked BEFORE the screen and before PROVEN,
 * because "her own scan" and "the original is safe beside it" are facts about
 * the picture that no measurement can overturn. PROVEN is asked next, so a
 * known-lossy writer beats a bpp that happens to land above the cut. Only then
 * does the screen get a say.
 */
function classify(it) {
  if (!it.bpp) return 'clean';                             // unreadable header
  if (startsAny(it.name, NEVER)) {
    const flagged = it.bpp < finder.LOSSY_BPP && Math.max(it.w, it.h) >= finder.FULL_PX;
    return flagged || startsAny(it.name, PROVEN) ? 'never' : 'clean';
  }
  const proven = startsAny(it.name, PROVEN);
  const flagged = it.bpp < finder.LOSSY_BPP && Math.max(it.w, it.h) >= finder.FULL_PX;
  if (!flagged && !proven) return 'clean';
  if (startsAny(it.name, HOLD)) return 'hold';
  return 'damaged';
}

/**
 * One bucket → the objects that are damaged, and the ones held back.
 *
 * The screen and every constant in it come from find-lossy-originals.js; this
 * only sorts its findings into the three policy piles above.
 */
async function scanBucket(bucket) {
  process.stderr.write(`  listing ${bucket.name}…\n`);
  const items = await finder.listWebp(bucket);
  process.stderr.write(`  ${items.length} webp objects — measuring headers…\n`);
  await finder.pool(items, (it) => finder.measure(bucket, it));

  const damaged = [];
  const held = [];
  const source = [];
  items.forEach((it) => {
    const verdict = classify(it);
    if (verdict === 'clean') return;
    const rec = {
      bucket: bucket.name, name: it.name, bpp: it.bpp, size: it.size, md5: it.md5,
      proven: startsAny(it.name, PROVEN),
    };
    if (verdict === 'never') { source.push(rec); return; }
    if (verdict === 'hold') { held.push(rec); return; }
    damaged.push(rec);
  });
  return { damaged, held, source, measured: items.filter((x) => x.bpp).length };
}

/** Every doc in a collection, as {ref, data}. */
async function readDocs(query) {
  const snap = await query.get();
  return snap.docs.map((d) => ({ ref: d.ref, data: d.data() || {} }));
}

/**
 * Judge one Firestore doc against the index. Returns {tag, why}.
 *
 * The url is asked first because it is exact; the md5 is what carries the tag
 * onto a copy filed under a random name.
 */
function judge(data, index) {
  const url = data.url;
  const ref = storageRef(url);
  if (ref) {
    const hit = index.byPath.get(ref.bucket + '/' + ref.path);
    if (hit) return { tag: true, why: hit.proven ? 'path (proven q80)' : 'path' };
  }
  const md5 = String(data.md5 || '').trim().toLowerCase();
  if (md5 && index.byMd5.has(md5)) return { tag: true, why: 'md5 (a renamed copy of a damaged original)' };
  if (!ref) return { tag: false, why: 'not a Storage url' };
  if (index.heldPaths.has(ref.bucket + '/' + ref.path)) return { tag: false, why: 'HOLD — writer unread' };
  if (index.sourcePaths.has(ref.bucket + '/' + ref.path)) return { tag: false, why: 'NEVER — original is safe elsewhere' };
  return { tag: false, why: 'full quality' };
}

/** Apply one pile of writes, in batches. Returns how many docs were touched. */
async function commit(app, targets) {
  if (!WRITE || !targets.length) return 0;
  const db = app.firestore();
  const value = UNDO ? admin.firestore.FieldValue.delete() : true;
  let done = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = db.batch();
    targets.slice(i, i + BATCH).forEach((t) => batch.set(t.ref, { [FIELD]: value }, { merge: true }));
    await batch.commit();
    done += Math.min(BATCH, targets.length - i);
    process.stderr.write(`  wrote ${done}/${targets.length}\n`);
  }
  return done;
}

/**
 * One collection → what would change. `already` is what makes a re-run free.
 */
function plan(docs, index) {
  const out = { tag: [], already: 0, clear: [], skip: new Map() };
  docs.forEach((d) => {
    const flagged = d.data[FIELD] === true;
    if (UNDO) {
      if (flagged) out.clear.push(d);
      return;
    }
    const v = judge(d.data, index);
    if (!v.tag) {
      out.skip.set(v.why, (out.skip.get(v.why) || 0) + 1);
      return;
    }
    if (flagged) { out.already += 1; return; }
    out.tag.push({ ref: d.ref, url: d.data.url, why: v.why });
  });
  return out;
}

const report = (label, p) => {
  if (UNDO) { console.log(`  ${label}: ${p.clear.length} to clear`); return; }
  console.log(`  ${label}: ${p.tag.length} to tag · ${p.already} already tagged`);
  [...p.skip.entries()].sort((a, b) => b[1] - a[1]).forEach(([why, n]) => {
    console.log(`      ${String(n).padStart(6)}  left alone — ${why}`);
  });
};

async function main() {
  const deck = appFor('FIREBASE_SERVICE_ACCOUNT', 'deck');
  const membry = appFor('STORY_FIREBASE_SERVICE_ACCOUNT', 'membry');
  console.log(`\n${UNDO ? 'UNDO' : 'TAG'} ${FIELD} — ${WRITE ? 'WRITING' : 'DRY RUN (nothing is written)'}\n`);

  const index = { byPath: new Map(), byMd5: new Set(), heldPaths: new Set(), sourcePaths: new Set() };
  let scans = [];
  if (!UNDO) {
    // BOTH buckets into ONE index: a doc in either collection can point at an
    // object in either project, and the url is what decides which.
    console.log('scanning both buckets (read-only — headers only, never the bytes)…');
    scans = [await scanBucket(deck.bucket), await scanBucket(membry.bucket)];
    scans.forEach((s) => {
      s.damaged.forEach((r) => {
        index.byPath.set(r.bucket + '/' + r.name, r);
        if (r.md5) index.byMd5.add(r.md5);
      });
      s.held.forEach((r) => index.heldPaths.add(r.bucket + '/' + r.name));
      s.source.forEach((r) => index.sourcePaths.add(r.bucket + '/' + r.name));
    });
    console.log(`\nSTORAGE — ${index.byPath.size} damaged objects (${index.byMd5.size} distinct md5)`);
    scans.forEach((s, i) => {
      const who = i === 0 ? deck.project : membry.project;
      console.log(`  ${who}: ${s.damaged.length} damaged · ${s.held.length} HELD (writer unread) · `
        + `${s.source.length} NEVER (original safe elsewhere) · ${s.measured} measured`);
    });
    const holdBy = new Map();
    scans.forEach((s) => s.held.forEach((r) => {
      const p = HOLD.find((h) => r.name.indexOf(h) === 0);
      holdBy.set(p, (holdBy.get(p) || 0) + 1);
    }));
    if (holdBy.size) {
      console.log('\n  HELD BACK — flagged by the screen, writer not yet read:');
      [...holdBy.entries()].sort((a, b) => b[1] - a[1])
        .forEach(([p, n]) => console.log(`      ${String(n).padStart(6)}  ${p}`));
    }
  }

  console.log('\nreading the records…');
  const assetDocs = await readDocs(deck.app.firestore().collection('forge-chat-assets'));
  // collectionGroup reaches every uid at once — the device's anonymous id
  // changes on reinstall, so there is more than one and none is in the repo.
  const creationDocs = await readDocs(membry.app.firestore().collectionGroup('creations'));

  const aPlan = plan(assetDocs, index);
  const cPlan = plan(creationDocs, index);

  console.log(`\nRECORDS — ${assetDocs.length} forge-chat-assets · ${creationDocs.length} creations\n`);
  report(`forge-chat-assets (${deck.project})`, aPlan);
  report(`creations (${membry.project})`, cPlan);

  if (!UNDO) {
    const byWhy = new Map();
    aPlan.tag.concat(cPlan.tag).forEach((t) => byWhy.set(t.why, (byWhy.get(t.why) || 0) + 1));
    console.log('\n  matched by:');
    [...byWhy.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([why, n]) => console.log(`      ${String(n).padStart(6)}  ${why}`));
    // The honest gap: a damaged object nothing points at has no record to carry
    // the flag, and a RE-ENCODED copy is different bytes that no hash can join.
    const tagged = new Set(aPlan.tag.concat(cPlan.tag).map((t) => t.url));
    console.log(`\n  ${index.byPath.size} damaged objects → ${tagged.size} distinct urls tagged.`);
    console.log('  A damaged object with no record has nothing to carry the flag, and a');
    console.log('  RE-ENCODED copy is different bytes that no hash can join — both are');
    console.log('  outside what this can reach, by design rather than by omission.');
  }

  if (WRITE) {
    console.log('\nwriting…');
    const a = await commit(deck.app, UNDO ? aPlan.clear : aPlan.tag);
    const c = await commit(membry.app, UNDO ? cPlan.clear : cPlan.tag);
    console.log(`\ndone — ${a} forge-chat-assets, ${c} creations ${UNDO ? 'cleared' : 'tagged'}`);
  } else {
    console.log('\nDRY RUN — nothing was written. Re-run with --write to apply.');
  }

  if (jsonOut) {
    require('fs').writeFileSync(jsonOut, JSON.stringify({
      write: WRITE, undo: UNDO,
      storage: scans.map((s) => ({ damaged: s.damaged, held: s.held, source: s.source })),
      assets: UNDO ? aPlan.clear.map((d) => d.data && d.data.url) : aPlan.tag,
      creations: UNDO ? cPlan.clear.map((d) => d.data && d.data.url) : cPlan.tag,
    }, null, 1));
    console.log(`wrote ${jsonOut}`);
  }
}

module.exports = { FIELD, NEVER, HOLD, PROVEN, classify, judge, plan };

if (require.main === module) {
  main().catch((err) => { console.error('failed:', err.stack || err.message); process.exit(1); });
}
