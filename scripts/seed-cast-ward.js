#!/usr/bin/env node
'use strict';
// seed-cast-ward.js — fill the footage CHARACTER LIBRARY's `ward` folder from
// the ward film's own files (2026-09-11).
//
// Nothing here is invented: every url comes out of
// `docs/mental-hospital/refs/cast.json` (her own list of who and what the ward
// film points at) or `docs/mental-hospital/belt/refs.json`, and every clip
// carries the LABEL the belt pages already give it. The LINES are her own,
// lifted verbatim off the belt cards and the job files wherever one exists —
// the `{1}`-style tokens are the only change, and they are what
// `cast-line.js` resolves back into real slots at attach time (a stored
// `[Video1]` would point at somebody else's clip the moment a second
// character rides along).
//
// A line marked `mine: true` below is one NO card had — the house shape, the
// name and the slot and nothing else — and is named as mine in the reply, per
// the rule about adding anything to a prompt of hers.
//
// DRY BY DEFAULT. `--go` writes. Re-running is safe: an entry is upserted by
// `<film>__<slug>` and a look by its key, so a re-seed repairs rather than
// duplicates — but it OVERWRITES a look she has since edited on the page, so
// `--only <slug>` is the way to repair one without touching the rest.
//
//   node scripts/seed-cast-ward.js                 # what it would write
//   node scripts/seed-cast-ward.js --go
//   node scripts/seed-cast-ward.js --go --only sophie
//   node scripts/seed-cast-ward.js --go --direct     # straight to Firestore
//   FORGE_BASE=http://localhost:3000 node scripts/seed-cast-ward.js --go

const fetch = require('node-fetch');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';
const GO = process.argv.includes('--go');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : ''; })();
const FILM = 'ward';

const S = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/';
const U = {
  // people — stills (cast.json `current`)
  sophieFaceA: S + 'drops/_/40c4297c5ad31247083c19fee84d8275.png',
  sophieFaceB: S + 'drops/_/a40594e3ae3e837ecd569b2549850205.png',
  sophieFaceC: S + 'drops/_/fe1416ac2bed79672468d5532aa747ca.png',
  sophieFaceD: S + 'drops/_/9d8e857abcf6969f45539ebcd46314bf.png',
  sophieJazzA: S + 'drops/_/bfce90db708632742f6183f3b8d8ce77.png',
  sophieJazzB: S + 'drops/_/53d7eef594ff757f26027e5b8edf283c.png',
  sophieJazzC: S + 'drops/_/e0a3d5c8a24893877433083e2e4f9912.png',
  doctor: S + 'drops/_/86064af3393b1ea3c4b8b6861cf21971.png',
  doctorChair: S + 'drops/_/de01cfce24b93207f44fb79cafae6880.png',
  doctorB: S + 'drops/_/c10792630f014457fc08d9713483b60d.png',
  assistant: S + 'drops/_/29b79fed3e5b81a9296535be1c13a775.png',
  assistantIntake: S + 'drops/_/2eeb52f27625e039f68ae73252cd650c.png',
  juanita: S + 'drops/_/f411e188b6d541c869edf368340a0c20.png',
  juanita829: S + 'drops/_/2a00213c7a9d25fc06950bcd77620dca.png',
  juanita846: S + 'drops/_/011d70298df55c4d1e388a2c7a41677e.png',
  juanita879: S + 'drops/_/cb2aa829aeaa6a18140ab5612915e486.png',
  juanita1158: S + 'drops/_/63bc7fe5f85f36e15361f73453dfc1c5.png',
  juanita1408: S + 'drops/_/9d0e9ea2c49538b91a5466fba7fbfe34.png',
  musicTeacher: S + 'drops/_/34b928828a45afae468eb264fe3fe29e.png',
  whiteCoatNurse: S + 'drops/_/0bebd32cdd733225fecb2c4970f4ff72.png',
  mayra: S + 'drops/_/8eab1f8fd9499e6940357110d55c32d1.png',
  parents: S + 'drops/_/61b685486a76cea75d8947fd8d3e7bcf.png',
  yolandaSheet: S + 'drops/_/aa3b74d4e2b2dbd590ca38051790d066.png',
  yolandaNurse: S + 'drops/_/0d883a189b965ef8e0a41ad8c966026a.png',
  yolandaMusic: S + 'drops/_/e68b5a575761431232b8b95b80aa78b2.png',
  yolandaDining: S + 'drops/_/6c39899052cc47d8f8159bfae816ff6b.png',
  rnStation: S + 'drops/_/bc375a01222171f4f6b810f1b05e8ff3.png',
  rnLeaving: S + 'drops/_/1fc18be6120777a658c97835b4015100.png',
  // people — clips, each with the label the belt pages give it
  // THE 4s JAZZ CLIP (Sophie, 2026-09-11: "it's on every sophie video in
  // footage"). It is, on 24 of the 83 footage jobs, as `jazz-best4s.mp4` —
  // the last 4.06s of the 15.1s original, MEASURED at 46-48 dB PSNR against
  // it (same 560x752 canvas, same 24fps, same H.264 High/L3.1, 2.15 Mb/s
  // against 2.22): a re-encode, and visually lossless, so there is nothing
  // to go back to the original chat for. The Dump copy and the ward-refs
  // copy are BYTE-IDENTICAL (md5 042e7aaa…), so this is one clip.
  jazz: S + 'ward-refs/jazz-best4s-1789011108116.mp4',                 // Sophie · 4.06s
  jazzLong: S + 'apiframe-video/1788736757836-f3j8qh.mp4',             // the original take · 15.1s
  edna: S + 'drops/_/f6138a818f436df0ce0cf4591c62f434.mp4',            // Nurse Edna · 4.0s
  ohara: S + 'drops/_/3c1e96d9f2034fc6a6a496b25926746a.mp4',           // Ms. O'Hara's audition · 4.0s
  docAssistOffice: S + 'drops/_/e9a630abb4fc88d8178d02e49389d727.mp4', // office, eye level · 4.0s
  docAssistHall: S + 'drops/_/2d26ca4e4f944ccdd43772e5b1184885.mp4',   // hall b-roll, head on · 4.0s
  parentsAud: S + 'drops/_/3fe2d4b0f9b185c2792886d7a3d26bb7.mp4',      // the parents' audition · 4.0s
  michael: S + 'drops/_/fa846543c4c57f8c4178a4d79a126156.mp4',         // Michael's reference clip · 4s
  scaleAud: S + 'drops/_/4dba2d7c7eae518339f4312d3f13d9ee.mp4',        // Mayra + the white-coat nurse
  artClass: S + 'drops/_/5d39cde4c324500a9da9aefdff9a3459.mp4',        // the art class, her origin · 25s
  norbert: S + 'drops/_/862ec4c5a9600d25100ced5a894d3a59.mp4',         // Mrs. Norbert
  norbertLong: S + 'drops/_/fd2deb6a2e9e0ab62465ab32528f7985.mp4',     // Mrs. Norbert, the long take
  juanitaCut: S + 'drops/_/d23ef7ce8c73ec2169dd37b2ccc8a385.mp4',      // Juanita, her scenes only
  // wardrobe
  pjHeadless: S + 'drops/_/d0470544456526eedcc911e5a03ff93b.png',
  pjPocket: S + 'drops/_/418f17e802ee8e01e0b55afedb0fc483.png',
  pjOptA: S + 'drops/_/52a036179b0e90785fc918e6f95520ec.png',
  pjOptC: S + 'drops/_/12c13654fcb9fb3fc3c30b463acdb562.png',
  pjWhole: S + 'drops/_/29b0531b15fa98895bd18fb9e16e90d3.png',
  socksOG: S + 'drops/_/6658c95fe5f66559c659f688e6371e7c.jpg',
  socksFrame: S + 'drops/_/929514d99e35b79a0b2bd67972695d08.png',
  // settings
  office: S + 'drops/_/7e4069ef6345be703f51b480f96edd90.png',
  herRoom: S + 'drops/_/a26b474c31334b9e2b32d1d10b6ec5bc.png',
  diningRoom: S + 'drops/_/1c9795c66026ee3374ab37bc6eb54b58.png',
};
const img = (url, name) => ({ url, kind: 'image', name });
const vid = (url, name) => ({ url, kind: 'video', name });

// HER LINE, VERBATIM off the belt cards and the job files. The sentence the
// ward film has opened on since 2026-09-08; the pajama slots are `{2} {3} {4}`
// because the look WEARS the three-still pajama set.
// ONE pajama still since 2026-09-11 (Sophie: "just the full body pajama, no
// tape pocket or second, and note that everywhere") — the line counted three
// ({2}, {3} and {4}) until then. The `sophie` wardrobe look below carries the
// one still, so {2} is the full-body pajama picture and nothing follows it.
const SOPHIE_PJ = 'sophie is the woman in {1}.  she wears the blue hospital pajamas in {2}, NOT the dress in {1}';

const ENTRIES = [
  // ── the people ───────────────────────────────────────────────────────
  { slug: 'sophie', name: 'Sophie', kind: 'person', order: 1, looks: [
    { key: 'pajamas', name: 'the blue pajamas', refs: [vid(U.jazz, 'the jazz (4s)')], wear: ['blue-pajamas:sophie'], line: SOPHIE_PJ },
    { key: 'pink-nightdress', name: "the pink nightdress", refs: [vid(U.jazz, 'the jazz (4s)')],
      line: "sophie is the woman in {1}.  she wears a pink nightdress (her grandmother's), NOT the dress in {1}" },
    { key: 'boots', name: 'the pajamas with boots', refs: [vid(U.jazz, 'the jazz (4s)')], wear: ['blue-pajamas:sophie'],
      line: 'sophie is the woman in {1}.  she still wears the blue hospital pajamas, with boots, NOT the dress in {1}' },
    { key: 'street', name: 'street clothes', refs: [vid(U.jazz, 'the jazz (4s)')], line: 'sophie is the woman in {1}.',
      note: 'the outfit she is already wearing in the clip — no pajama clause' },
    { key: 'face', name: 'the face still only', refs: [img(U.sophieFaceA, 'sophie-face-A')], line: 'sophie is the woman in {1}.',
      note: 'the biggest face in the library (640px), head-on' },
    { key: 'faces', name: 'all four faces', refs: [img(U.sophieFaceA, 'face A'), img(U.sophieFaceB, 'face B'), img(U.sophieFaceC, 'face C'), img(U.sophieFaceD, 'face D')], mine: true,
      line: 'sophie is the woman in {1}.', note: "the four off the ward references page" },
    { key: 'jazz-stills', name: 'the jazz, as stills', refs: [img(U.sophieJazzA, 'jazz A'), img(U.sophieJazzB, 'jazz B'), img(U.sophieJazzC, 'jazz C')], mine: true,
      line: 'sophie is the woman in {1}.', note: 'frames off the jazz take — for a door that refuses a person VIDEO' },
    { key: 'jazz-long', name: 'the jazz, the whole take', refs: [vid(U.jazzLong, 'the jazz (the original, 15.1s)')], mine: true,
      line: 'sophie is the woman in {1}.',
      note: 'the 15.1s original the 4s is cut from — 15.2s is the whole reference-video budget, so it leaves room for nothing else' },
  ] },
  { slug: 'the-doctor', name: 'Dr. Grayson', kind: 'person', order: 2, looks: [
    { key: 'office', name: 'the office', refs: [vid(U.docAssistOffice, 'the doctor and the assistant (office, eye level, 4s)'), img(U.doctor, 'the doctor')],
      line: 'Dr. Grayson: the doctor in {1}.' },
    { key: 'hall', name: 'the hall b-roll', refs: [vid(U.docAssistHall, 'the doctor and the assistant (hall b-roll, head on)')],
      line: 'Dr. Grayson: the doctor in {1}.' },
    { key: 'with-the-assistant', name: 'with the assistant', refs: [vid(U.docAssistOffice, 'the doctor and the assistant (office, eye level, 4s)')],
      line: 'Dr. Grayson: the doctor in {1}. the assistant: the woman with the clipboard in {1}.' },
    { key: 'still', name: 'the still only', refs: [img(U.doctor, 'the doctor'), img(U.doctorB, 'the doctor, second still'), img(U.doctorChair, 'the doctor in his chair')],
      line: 'Dr. Grayson: the doctor in {1}.' },
  ] },
  { slug: 'the-assistant', name: 'the assistant', kind: 'person', order: 3, looks: [
    { key: 'office', name: 'the office', refs: [vid(U.docAssistOffice, 'the doctor and the assistant (office, eye level, 4s)'), img(U.assistant, 'the assistant')],
      line: 'the assistant: the woman with the clipboard in {1}.' },
    { key: 'still', name: 'the still only', refs: [img(U.assistant, 'the assistant'), img(U.assistantIntake, 'the assistant, intake')],
      line: 'the assistant: the woman with the clipboard in {1}.' },
  ] },
  { slug: 'nurse-edna', name: 'Nurse Edna', kind: 'person', order: 4, looks: [
    { key: 'meds', name: 'the meds clip', refs: [vid(U.edna, 'Nurse Edna — the Meds clip (the morning meds nurse)')],
      line: 'Nurse Edna: the nurse in {1}.', note: 'already 4s' },
  ] },
  { slug: 'ms-ohara', name: "Ms. O'Hara", kind: 'person', order: 5, looks: [
    { key: 'stretcher', name: 'the stretcher', refs: [vid(U.ohara, "Ms. O'Hara's audition")],
      line: "Ms. O'Hara: the woman on the stretcher in {1}. the two nurses: the nurses in {1}. sophie is NOT a nurse.",
      note: 'no still — she exists only inside this clip' },
  ] },
  { slug: 'the-parents', name: 'her parents', kind: 'person', order: 6, looks: [
    { key: 'audition', name: 'the audition', refs: [vid(U.parentsAud, "the parents' audition (4s)"), img(U.parents, 'the parents')],
      line: 'her parents: the two people in {1}.' },
  ] },
  { slug: 'mayra', name: 'Mayra', kind: 'person', order: 7, looks: [
    { key: 'default', name: 'the scale', refs: [vid(U.scaleAud, 'the scale audition (Mayra + the white-coat nurse)'), img(U.mayra, 'Mayra')],
      line: 'Mayra: the woman with the long dark waves in {1}.' },
    { key: 'pajamas', name: 'the blue pajamas', refs: [img(U.mayra, 'Mayra')], wear: ['blue-pajamas'], mine: true,
      line: 'Mayra: the woman with the long dark waves in {1}. she wears the blue hospital pajamas in {2} and {3}.' },
  ] },
  { slug: 'the-white-coat-nurse', name: 'the white-coat nurse', kind: 'person', order: 8, looks: [
    { key: 'scale', name: 'the scale', refs: [vid(U.scaleAud, 'the scale audition (Mayra + the white-coat nurse)'), img(U.whiteCoatNurse, 'the white-coat nurse')],
      line: 'the nurse: the woman in the long white coat in {1}.' },
  ] },
  { slug: 'yolanda', name: 'Yolanda', kind: 'person', order: 9, looks: [
    { key: 'sheet', name: 'the character sheet', refs: [img(U.yolandaSheet, 'yolanda — character sheet')],
      line: 'Yolanda: the woman in {1}.' },
    { key: 'around-the-ward', name: 'around the ward', refs: [img(U.yolandaSheet, 'character sheet'), img(U.yolandaNurse, 'talking with the nurse'), img(U.yolandaMusic, 'music class'), img(U.yolandaDining, 'dining room')],
      line: 'Yolanda: the woman in {1}.' },
    { key: 'pajamas', name: 'the blue pajamas', refs: [img(U.yolandaSheet, 'character sheet')], wear: ['blue-pajamas'], mine: true,
      line: 'Yolanda: the woman in {1}. she wears the blue hospital pajamas in {2} and {3}.' },
  ] },
  { slug: 'michael', name: 'Michael', kind: 'person', order: 10, looks: [
    { key: 'reference', name: 'the reference clip', refs: [vid(U.michael, "Michael's reference clip (4s)")],
      line: 'Michael: the boy in {1}.', note: 'no still — barred crops from the table clip only' },
  ] },
  { slug: 'mrs-norbert', name: 'Mrs. Norbert (art)', kind: 'person', order: 11, looks: [
    { key: 'default', name: 'her clip', refs: [vid(U.norbert, 'Mrs. Norbert')], mine: true,
      line: 'Mrs. Norbert: the art teacher in {1}.', note: 'no still — only video references' },
    { key: 'long-take', name: 'the long take', refs: [vid(U.norbertLong, 'Mrs. Norbert, the long take')], mine: true,
      line: 'Mrs. Norbert: the art teacher in {1}.' },
    { key: 'art-class', name: 'the art class', refs: [vid(U.artClass, 'the art class (her origin, 25s)')], mine: true,
      line: 'Mrs. Norbert: the art teacher in {1}.', note: 'her origin clip — 25s, over the 15.2s budget on its own' },
  ] },
  { slug: 'the-music-teacher', name: 'the music teacher', kind: 'person', order: 12, looks: [
    { key: 'still', name: 'the still', refs: [img(U.musicTeacher, 'the music teacher')], mine: true,
      line: 'the music teacher: the woman in {1}.', note: 'the still Sophie sent 2026-09-10' },
  ] },
  { slug: 'the-rn', name: 'the RN', kind: 'person', order: 13, looks: [
    { key: 'station', name: 'the nurses station', refs: [img(U.rnStation, 'rn — the station'), img(U.rnLeaving, 'leaving in her coat')], mine: true,
      line: 'the nurse: the woman in {1}.', note: 'OG, hop album. Possibly Nurse Mary — unconfirmed' },
  ] },
  { slug: 'juanita', name: 'Juanita', kind: 'person', order: 14, looks: [
    { key: 'still', name: 'her still', refs: [img(U.juanita, 'Juanita')], mine: true,
      line: 'Juanita: the woman in {1}.' },
    { key: 'scenes', name: 'her scenes only', refs: [vid(U.juanitaCut, 'Juanita, her scenes only')], mine: true,
      line: 'Juanita: the woman in {1}.' },
    { key: 'frames', name: 'her six frames', refs: [img(U.juanita, 'Juanita'), img(U.juanita829, '8.29s — at the cart, eyes open'), img(U.juanita846, '8.46s — clean profile, sharp'), img(U.juanita879, '8.79s — her biggest face'), img(U.juanita1158, '11.58s — leaning on the mop'), img(U.juanita1408, '14.08s — the last clean look')], mine: true,
      line: 'Juanita: the woman in {1}.',
      note: 'the frames the pajama-assets chat pulled off her take' },
  ] },
  { slug: 'anastasia', name: 'Anastasia', kind: 'person', order: 15,
    note: 'waiting on the dance photo — Sophie has it', looks: [
    { key: 'pajamas', name: 'the blue pajamas', refs: [], wear: ['blue-pajamas'], mine: true,
      // NO REFERENCE OF HER OWN YET, so the line may not claim one — {1} here is
      // the headless pajama still, and naming it as her is the slot lying about
      // who is in the picture. It names the PAJAMAS only until her dance photo
      // lands; add that photo as the FIRST ref and change the line to
      // 'Anastasia: the woman in {1}. she wears the blue hospital pajamas in {2} and {3}.'
      line: 'she wears the blue hospital pajamas in {1} and {2}.',
      note: 'waiting on her dance photo — Sophie has it. The line names only the pajamas until then' },
  ] },

  // ── the wardrobe, which floats across every patient ───────────────────
  { slug: 'blue-pajamas', name: 'the blue hospital pajamas', kind: 'wardrobe', order: 1,
    note: "head off by default — these float with any patient (Sophie, 2026-09-11). For SOPHIE it is ONE full-body still — no tape pocket, no second still (Sophie, 2026-09-11: 'just the full body pajama, no tape pocket or second, and note that everywhere')", looks: [
    { key: 'headless', name: 'head off', refs: [img(U.pjHeadless, 'the pajamas, no head'), img(U.pjPocket, 'the tape pocket')], mine: true,
      line: 'she wears the blue hospital pajamas in {1} and {2}.' },
    // WAS "Sophie's three" — A, C (teacher cropped out) and the tape pocket, the
    // three the ward line named on every Sophie clip through 2026-09-11. Her
    // call that day, on the first Wan job: the full-body still ALONE. C
    // (pjOptC) and the tape pocket are off this look and off her line.
    { key: 'sophie', name: "Sophie's full-body still", refs: [img(U.pjOptA, 'A — Sophie alone, full body')],
      line: 'she wears the blue hospital pajamas in {1}.',
      note: "ONE still since 2026-09-11 (Sophie: 'just the full body pajama, no tape pocket or second, and note that everywhere') — C (teacher cropped out) and the tape pocket are OFF" },
    { key: 'whole', name: 'the whole outfit', refs: [img(U.pjWhole, 'the whole outfit')], mine: true,
      line: 'she wears the blue hospital pajamas in {1}.' },
  ] },
  { slug: 'socks', name: 'the hospital socks', kind: 'wardrobe', order: 2, looks: [
    { key: 'og', name: 'the product photo', refs: [img(U.socksOG, 'the socks (Medline product photo)')], mine: true,
      line: 'the socks in {1}.', note: 'the OG photo — no people in it' },
    { key: 'on-her-feet', name: 'on her feet', refs: [img(U.socksFrame, 'the socks on her feet')], mine: true,
      line: 'the socks in {1}.' },
  ] },

  // ── the places ────────────────────────────────────────────────────────
  { slug: 'her-room', name: 'her room', kind: 'setting', order: 1, looks: [
    { key: 'default', name: 'her room', refs: [img(U.herRoom, 'her room')],
      line: 'setting: mental hospital. her room in {1}.' },
    { key: 'fluorescent', name: 'under the fluorescents', refs: [img(U.herRoom, 'her room')],
      line: 'setting: mental hospital. her room in {1}, but lit by fluorescent lights from above, not the lamp.' },
  ] },
  { slug: 'the-office', name: "the doctor's office", kind: 'setting', order: 2, looks: [
    { key: 'default', name: 'the office', refs: [img(U.office, 'the office')], mine: true,
      line: 'setting: mental hospital. the office in {1}.' },
  ] },
  { slug: 'the-dining-room', name: 'the dining room', kind: 'setting', order: 3, looks: [
    { key: 'default', name: 'the dining room', refs: [img(U.diningRoom, 'the dining room')], mine: true,
      line: 'setting: mental hospital. the dining room in {1}.' },
  ] },
];

// TWO DOORS, ONE WRITE. `--direct` goes straight to Firestore with the Deck
// Factory service account — which is what lets a chat fill the shelf BEFORE
// the route it feeds is deployed, and is immune to a deploy restart. Without
// it the write goes through the live route, which is the only door a machine
// without the key has. Either way it is `cast.js`'s own `upsertEntry`, so the
// shapes and the caps cannot differ between them.
const DIRECT = process.argv.includes('--direct');
function hdr() { const h = { 'Content-Type': 'application/json' }; if (TOKEN) h['x-studio-token'] = TOKEN; return h; }
let castMod = null;
function direct() {
  if (castMod) return castMod;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!key) throw new Error('--direct needs FIREBASE_SERVICE_ACCOUNT (the Deck Factory service account)');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) });
  }
  castMod = require('../cast');
  return castMod;
}
async function post(path, body) {
  if (DIRECT) {
    const C = direct();
    if (path === '/entry') {
      const r = await C.upsertEntry(body);
      if (r.error) throw new Error(r.error);
      return r;
    }
    if (path === '/films') {
      const admin = require('firebase-admin');
      const doc = admin.firestore().collection(C.COLL).doc(C.FILMS_DOC);
      const cur = (await doc.get()).data() || {};
      const films = { ...(cur.films || {}) };
      films[body.slug] = { name: body.name, order: body.order || 0 };
      await doc.set({ films }, { merge: true });
      C.bust();
      return { ok: true };
    }
    throw new Error('no direct door for ' + path);
  }
  const r = await fetch(BASE + '/api/cast' + path, { method: 'POST', headers: hdr(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

(async () => {
  const list = ONLY ? ENTRIES.filter((e) => e.slug === ONLY) : ENTRIES;
  if (!list.length) { console.log('nothing matches --only ' + ONLY); return; }
  let mine = 0, refs = 0;
  for (const e of list) {
    const looks = e.looks.map((l) => {
      if (l.mine) mine += 1;
      refs += (l.refs || []).length;
      const { mine: _drop, ...rest } = l;
      return rest;
    });
    console.log(`${GO ? 'writing' : 'would write'}  ${e.kind.padEnd(8)} ${e.slug.padEnd(22)} ${looks.length} look${looks.length === 1 ? '' : 's'}` +
      looks.map((l) => `\n      · ${l.key.padEnd(18)} ${(l.refs || []).length} ref${(l.refs || []).length === 1 ? '' : 's'}` +
        ((l.wear || []).length ? ` + wears ${l.wear.join(', ')}` : '') + `\n        ${l.line}`).join(''));
    if (GO) await post('/entry', { film: FILM, slug: e.slug, name: e.name, kind: e.kind, order: e.order, note: e.note || '', looks });
  }
  if (GO) await post('/films', { slug: FILM, name: 'The ward', order: 1 });
  console.log(`\n${list.length} entries, ${refs} references. ${mine} line${mine === 1 ? '' : 's'} written by me (the rest are hers, verbatim).`);
  if (!GO) console.log('Nothing written — add --go.');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
