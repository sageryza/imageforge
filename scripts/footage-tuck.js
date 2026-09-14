#!/usr/bin/env node
/* FOOTAGE — TUCK A PROJECT AWAY, and file the pee wheel into one of its own
   (2026-09-13, Sophie: "can u hide the ward, the boyfriend one and the pee
   wheel ones if i'm not in those folders").

   A tucked film is left out of the Footage feed's ALL view and out of nothing
   else — picking it shows every clip in it, a search still reaches it, and
   its picker row says "· hidden". The flag is one field on the cast shelf's
   films doc (`tucked`), which is the same one vocabulary the picker is drawn
   from. Measured the morning this was written: ward alone is 220 of her 506
   clips, so All was mostly one film.

   THE PEE WHEEL HAD NO PROJECT AT ALL — nine clips of one scene (the dunce
   hat, the classroom, the hamster wheel) filed nowhere, which is why they sat
   on the front screen. They are named here by ID, never matched by a word, so
   nothing else can be swept in; `--go` files them and tucks the three.

   It writes through the Admin SDK (deckfactory) so it works before the code
   that reads the flag has deployed. Nothing is destroyed: a tuck is one
   boolean and a project is one field on a clip, both one tap from undone in
   the picker and the card's own move menu.

   Run: node scripts/footage-tuck.js            (dry — says what it would do)
        node scripts/footage-tuck.js --go       (writes) */
const admin = require('firebase-admin');

const GO = process.argv.includes('--go');
const CAST = 'forge-cast';
const FILMS_DOC = '__films';
const JOBS = 'forge-video-jobs';

// The three she named. `name` is only used when the film is not on the shelf
// yet — an existing one keeps whatever she called it.
const TUCK = [
  { slug: 'ward', name: 'The ward' },
  { slug: 'nautchaug', name: 'Nautchaug' },
  { slug: 'pee-wheel', name: 'The pee wheel' },
];

// THE PEE WHEEL, by id. Every one of these is the classroom scene — she asks
// the teacher to use the bathroom, the dunce hat, the wheel — and every one
// of them was filed under no project at all.
const PEE_WHEEL = [
  '856d95abab8f4829a69ed40dae64e4bc',
  'a19248574d214726b7b28f19a77c77b5',
  '4da0e096f8f04ee3abbcd0190ffed23c',
  '5ac7f0a4b03f45a190e3ab57803cf889',
  '7b7d60a3972f4755b60f5292b22a55f7',
  'df06401f1dac4cc6a83ec82bb0b5a312',
  'fc1077db0b2f4adaa219ecb4d3e6ddd1',
  '5a41e42f8fba41f59395b8e64abdfa97',
  'ea3fe5eb9068405c93cc38c5d3797281',
];
const PROJECT = 'pee-wheel';

function db() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT (Deck Factory) is not set');
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return admin.firestore();
}

(async () => {
  const d = db();
  const doc = d.collection(CAST).doc(FILMS_DOC);
  const cur = (await doc.get()).data() || {};
  const films = { ...(cur.films || {}) };

  TUCK.forEach((t) => {
    const was = films[t.slug] || {};
    // A PATCH TOUCHES ONLY WHAT IT NAMES: a film already on the shelf keeps
    // her name and her order, and only the flag moves.
    films[t.slug] = { name: String(was.name || t.name).slice(0, 60), order: Number(was.order) || 0, tucked: true };
    console.log((was.tucked ? 'already tucked' : 'tuck') + ': ' + t.slug + ' — ' + films[t.slug].name + (was.name ? '' : '  (new on the shelf)'));
  });

  // the clips — read each one back so nothing is written blind
  const moves = [];
  for (const id of PEE_WHEEL) {
    const s = await d.collection(JOBS).doc(id).get();
    if (!s.exists) { console.log('missing: ' + id); continue; }
    const j = s.data() || {};
    const now = String(j.project || '');
    const first = String(j.prompt || '').replace(/\s+/g, ' ').slice(0, 62);
    console.log((now ? 'LEAVE (already in ' + now + '): ' : 'file → ' + PROJECT + ': ') + id.slice(0, 8) + '  ' + first);
    // only ever fills a blank — a clip she has filed herself is left alone
    if (!now) moves.push(id);
  }

  if (!GO) { console.log('\n-- dry. ' + moves.length + ' clips would move, ' + TUCK.length + ' films tucked. --go to write.'); return; }
  await doc.set({ films }, { merge: true });
  for (const id of moves) await d.collection(JOBS).doc(id).set({ project: PROJECT, folder: '' }, { merge: true });
  console.log('\nwrote: ' + TUCK.length + ' tucked, ' + moves.length + ' clips filed under ' + PROJECT);
})().catch((e) => { console.error(e.message); process.exit(1); });
