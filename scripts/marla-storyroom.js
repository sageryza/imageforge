#!/usr/bin/env node
/**
 * marla-storyroom.js — put "Eyes as Wide as a Fishbowl" (Marla) into the
 * Story Room, one beat per page, with every picture she DIDN'T choose sitting
 * behind that beat's versions row.
 *
 * WHY THIS EXISTS
 *   Sophie, 2026-08-16: "are you keeping track of what I choose and don't
 *   choose". The answer then was no — every script took the NEWEST version of
 *   a page, which is right until she keeps an older one, and she had (p01-f,
 *   p18-s1, p31-s4). The chat built a real ledger out of her hearts that day
 *   (`chosen.json`), and this script is what finally puts both halves of it
 *   in front of her: the picture she picked ON the beat, and the candidates
 *   she passed over behind it.
 *
 * WHERE THE "NOT CHOSEN AREA" ALREADY IS — nothing new was built for it.
 *   A beat's popup already folds every generation that beat has had behind
 *   the stacked-squares button (`#arvers` / `#verrow` in gen-scratchpad.py),
 *   current one ringed, newest first, tap to open full size. It reads
 *   `beat.imageHistory`, and it only appears once there are 2+ versions — so
 *   the 10 pages that only ever had one drawing correctly show no button.
 *   ORDER MATTERS: the popup renders `[current] + imageHistory.reverse()`, so
 *   imageHistory is written OLDEST FIRST and comes out newest-first under the
 *   current picture.
 *
 * WHAT COUNTS AS A VERSION (117 pictures across the 36 pages, 81 unchosen)
 *   Every round the book actually went through, read from the banked
 *   `state.json` rather than guessed from filenames:
 *     pages(r1) · v2 · v3 · v3e · fishbowlTest(a–g) · s1 · s2 · s2diag ·
 *     extra (the page-3 splits, the page-32 diagrams, 23w, and the page-8 /
 *     page-13 description tests) · s4 · s5 · the three WTR image-to-image
 *     tests on pages 2, 11 and 26.
 *   Character sheets are deliberately NOT in any beat — Marla's ten sheets and
 *   the mother/father/Sardinia ones belong to the cast, not to a page, and
 *   filing them under a beat would say she rejected a picture of a page.
 *
 * PAGE 1 IS THE ONE SPECIAL CASE. `chosen.json` records her pick as the raw
 *   `fishbowl-test/p01-f.png`, but the finished cover is `p01-cover-painted`
 *   — that same picture with her shoulders masked in and every other pixel
 *   composited straight back from the original. So the beat carries the
 *   painted cover and p01-f sits at the top of its own versions row, which is
 *   what it is: the version immediately before it.
 *
 * HER WORDS NEVER TOUCH THIS REPO. The repo is public and the story is her
 *   unpublished fiction, so the plan is read at run time from membry Storage
 *   (`story-data/docs/marla/`), exactly where the storybook scripts bank it.
 *
 * IDEMPOTENT. Re-running finds the pad by title and reuses its beat ids, so
 *   frame colours, voice takes, chunk links and anything she has since typed
 *   survive. Only the picture, the words and the versions row are rewritten.
 *
 * USAGE
 *   node scripts/marla-storyroom.js --dry-run
 *   node scripts/marla-storyroom.js
 * Needs STORY_FIREBASE_SERVICE_ACCOUNT (membry — the plan) and
 * FIREBASE_SERVICE_ACCOUNT (deckfactory — `forge-scratchpad`).
 */
const admin = require('firebase-admin');

const TITLE = 'Eyes as Wide as a Fishbowl';
const COL = 'forge-scratchpad';
const PLAN = 'story-data/docs/marla/';
const DRY = process.argv.includes('--dry-run');

// The rounds, in the order they actually happened. A few records carry a
// sandbox clock (946684800000 = 2000-01-01) instead of a real time, so the
// round's own start stands in for those rather than sorting them to the
// beginning of the book's history.
const ROUNDS = [
  ['pages', 1786678231978], ['v2', 1786681856085], ['v3', 1786682828998],
  ['v3e', 1786750551325], ['fishbowlTest', 1786753974310], ['s1', 1786755772932],
  ['s2', 1786756736595], ['s2diag', 1786756850635], ['s4', 1786761116247],
  ['extra', 1786761862592], ['s5', 1786761970063],
];
const WTR_AT = 1786759000000;
const COVER_AT = 1786840000000;
const ART = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/storybook/marla/';
const PAINTED = `${ART}pages/p01-cover-painted.png`;

// THE PAD IS DRAWN FROM THE DERIVED COPIES, NEVER THE ORIGINALS. Marla's art
// is 2.7-3.9MB a picture and the cover's versions row alone is fourteen of
// them; `scripts/marla-room-webp.js` bakes a 1100px webp of every one into
// `storybook/marla/room/` (~200KB, about 14x lighter) and the full-size PNGs
// stay untouched and remain what the book and the Assets tab read. The name
// is the source path with its slashes folded, so two files called p01-f.png
// in different folders cannot collide. `roomOf` is the twin of `nameFor`
// there — change one and change the other.
const roomOf = (url) => ART + 'room/' + url.split('/storybook/marla/')[1]
  .replace(/\//g, '__').replace(/\.(png|webp|jpe?g)$/i, '') + '.webp';

// A round is keyed by page number; `fishbowlTest` is seven draws of page 1,
// and `extra` keys lead with their page ("3a", "32e", "13t-full", "23w").
function pageOf(round, key) {
  if (round === 'fishbowlTest') return 1;
  const m = /^(\d+)/.exec(key);
  return m ? Number(m[1]) : null;
}

function app(name, envVar) {
  const raw = process.env[envVar];
  if (!raw) throw new Error(`${envVar} is not set`);
  const sa = JSON.parse(raw);
  return admin.initializeApp(
    { credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` },
    name,
  );
}

async function readPlan(storyApp) {
  const bucket = storyApp.storage().bucket();
  const out = {};
  for (const n of ['pages', 'chosen', 'state', 'wtr-tests', 'wtr-tests-bare']) {
    const [buf] = await bucket.file(`${PLAN}${n}.json`).download();
    out[n] = JSON.parse(buf.toString('utf8'));
  }
  return out;
}

// Every picture ever drawn for a page, oldest first.
function versionsByPage(plan) {
  const by = {};
  for (let n = 1; n <= 36; n++) by[n] = [];
  for (const [round, roundAt] of ROUNDS) {
    const entries = plan.state[round] || {};
    for (const [key, v] of Object.entries(entries)) {
      if (!v || typeof v !== 'object') continue;
      const art = v.artUrl || v.url;
      if (!art) continue;
      const n = pageOf(round, key);
      if (!n || !by[n]) continue;
      // A real millisecond time or the round's own start — never the
      // 2000-01-01 sandbox clock, which would sort a late variant first.
      const at = (typeof v.at === 'number' && v.at > 1.7e12) ? v.at : roundAt;
      by[n].push({ round, key, art, at, label: v.label || '' });
    }
  }
  for (const [file, tag] of [['wtr-tests', 'wtr'], ['wtr-tests-bare', 'wtr-bare']]) {
    for (const v of plan[file] || []) {
      if (!by[v.n]) continue;
      by[v.n].push({ round: tag, key: String(v.strength), art: v.url, at: WTR_AT, label: `WTR image-to-image, strength ${v.strength}` });
    }
  }
  by[1].push({ round: 'cover', key: 'painted', art: PAINTED, at: COVER_AT, label: 'the painted cover' });
  for (const n of Object.keys(by)) by[n].sort((a, b) => a.at - b.at);
  return by;
}

function buildBeats(plan, existing) {
  const versions = versionsByPage(plan);
  const prior = new Map((existing || []).map((b, i) => [b.n ?? i + 1, b]));
  return plan.pages.pages.map((page) => {
    const n = page.n;
    // Page 1 shows the finished cover; every other page shows her ledger's pick.
    const chosen = n === 1 ? PAINTED : plan.chosen[String(n)].art;
    const all = versions[n] || [];
    const unchosen = all.filter((v) => v.art !== chosen);
    const keep = prior.get(n) || {};
    const beat = {
      ...keep,
      id: keep.id || newId(),
      n,
      url: roomOf(chosen),
      text: page.words,
      addedAt: keep.addedAt || Date.now(),
    };
    // The drawing prompt this page was actually made with, so the beat's draw
    // box opens on the real thing rather than on the caption.
    const state = plan.state.pages[String(n)];
    if (state && state.prompt) beat.prompt = state.prompt;
    if (unchosen.length) beat.imageHistory = unchosen.map((v) => ({ url: roomOf(v.art), at: v.at }));
    else delete beat.imageHistory;
    if (!beat.color) delete beat.color;
    if (!beat.src) delete beat.src;
    return beat;
  });
}

let db;
const newId = () => db.collection(COL).doc().id;

async function main() {
  const storyApp = app('marla-story', 'STORY_FIREBASE_SERVICE_ACCOUNT');
  const forgeApp = app('marla-forge', 'FIREBASE_SERVICE_ACCOUNT');
  db = forgeApp.firestore();

  const plan = await readPlan(storyApp);
  const snap = await db.collection(COL).get();
  const found = snap.docs.find((d) => (d.data() || {}).title === TITLE);
  const beats = buildBeats(plan, found ? (found.data().beats || []) : []);

  const withRow = beats.filter((b) => (b.imageHistory || []).length).length;
  const total = beats.reduce((s, b) => s + (b.imageHistory || []).length, 0);
  console.log(`${TITLE} — ${beats.length} beats, ${withRow} carrying a versions row, ${total} unchosen pictures`);
  for (const b of beats) {
    const k = (b.imageHistory || []).length;
    console.log(`  p${String(b.n).padStart(2, '0')}  ${b.url.split('/').pop().padEnd(24)} ${k ? `+${k} not chosen` : '—'}`);
  }
  if (DRY) { console.log('\n[dry run] nothing written'); return; }

  const ref = found ? found.ref : db.collection(COL).doc();
  await ref.set({ title: TITLE, beats, cover: roomOf(PAINTED), updatedAt: Date.now() }, { merge: true });
  console.log(`\nwrote pad ${ref.id}`);
  console.log('https://imageforge-q125.onrender.com/storyroom');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
