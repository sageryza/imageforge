#!/usr/bin/env node
/* THE WARD FILM — EVERY REFERENCE, as a grid Compare page.
 *
 *   node scripts/ward-refs-page.js            # dry — prints the groups
 *   node scripts/ward-refs-page.js --go       # posts it
 *   node scripts/ward-refs-page.js --go --supersede <id>
 *
 * The data is docs/mental-hospital/refs/cast.json plus belt/refs.json, so the
 * page and the index cannot disagree about what a reference is.
 *
 * LABELS NAME THE THING AND NOTHING ELSE (2026-09-10, Sophie: "less commentary
 * take the commentary out of the page itself"). No "the best", no "clip frame,
 * no OG on file", no group heading that argues for one pile over another. What
 * a reference IS lives in cast.json; the page is for looking.
 *
 * A CLIP PLAYS ON THE PAGE (same message: "make the page take movies also") —
 * the stock grid template takes `video` on an item since 2026-09-10.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'pajama-assets';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '')
  || '01Xz9f7vZGF8Nz4xsfThS2g8';
const TITLE = 'The ward film — every reference (v4)';

const D = path.join(__dirname, '..', 'docs', 'mental-hospital');
const cast = JSON.parse(fs.readFileSync(path.join(D, 'refs', 'cast.json'), 'utf8'));
const refs = JSON.parse(fs.readFileSync(path.join(D, 'belt', 'refs.json'), 'utf8'));
const clip = (k) => (refs[k] || {}).url;

const P = cast.people;
const groups = [];

// ---- people, the real photographs -----------------------------------------
groups.push({ label: 'People — photographs', items: [
  { id: 'og-yolanda-sheet', label: 'Yolanda', img: cast.ogHop['yolanda-sheet'] },
  { id: 'og-yolanda-nurse', label: 'Yolanda and the nurse', img: cast.ogHop['yolanda-nurse'] },
  { id: 'og-yolanda-music', label: 'Yolanda in music class', img: cast.ogHop['yolanda-music'] },
  { id: 'og-yolanda-dining', label: 'Yolanda in the dining room', img: cast.ogHop['yolanda-dining'] },
  { id: 'og-rn-station', label: 'The RN at the station', img: cast.ogHop['rn-station'] },
  { id: 'og-rn-leaving', label: 'The RN in her coat', img: cast.ogHop['rn-leaving'] },
  { id: 'og-grey-sweater', label: 'Grey sweater', img: cast.ogHop['unnamed-grey-sweater'] },
  { id: 'og-blonde-studio', label: 'Blonde, studio', img: cast.ogHop['unnamed-blonde-studio'] },
  { id: 'og-blazer-portrait', label: 'Blazer, portrait', img: cast.ogHop['unnamed-blazer-portrait'] },
  { id: 'og-blazer-full', label: 'Blazer, full length', img: cast.ogHop['unnamed-blazer-full'] },
] });

// ---- people, off the clips -------------------------------------------------
groups.push({ label: 'People — from the footage', items: [
  { id: 'cast-doctor', label: 'The doctor', img: P['the-doctor'].current },
  { id: 'cast-doctor-b', label: 'The doctor, second still', img: P['the-doctor'].also['doctor-B'] },
  { id: 'cast-doctor-chair', label: 'The doctor in the chair', img: P['the-doctor'].also['still2-doctor-chair'] },
  { id: 'cast-assistant', label: 'The assistant', img: P['the-assistant'].current },
  { id: 'cast-assistant-a', label: 'The assistant, intake', img: P['the-assistant'].also['assistant-A (barred intake frame)'] },
  { id: 'cast-music-teacher', label: 'The music teacher', img: P['the-music-teacher'].current },
  { id: 'cast-white-coat', label: 'The white-coat nurse', img: P['the-white-coat-nurse'].current },
  { id: 'cast-mayra', label: 'Mayra', img: P.mayra.current },
  { id: 'cast-parents', label: 'The parents', img: P['the-parents'].current },
] });

// ---- Sophie ----------------------------------------------------------------
groups.push({ label: 'Sophie', items: Object.entries(P.sophie.candidates).map(([k, u]) => (
  { id: 'sophie-' + k.replace(/^sophie-/, ''), label: k.replace(/^sophie-/, '').replace(/-/g, ' '), img: u }
)) });

// ---- wardrobe --------------------------------------------------------------
const W = cast.wardrobe;
groups.push({ label: 'Wardrobe', items: [
  { id: 'w-socks-og', label: 'The socks', img: W['still-socks-OG'] },
  { id: 'w-socks-frame', label: 'The socks on her feet', img: W['still-socks'] },
  { id: 'w-whole', label: 'The whole outfit', img: W.wholeOutfit },
  { id: 'w-opta', label: 'The pajamas', img: W['pj-optA-solo'] },
  { id: 'w-optc', label: 'The pajama shirt', img: W['pj-optC-solo'] },
  { id: 'w-pocket', label: 'The pocket with the tape', img: W['still-pj-pocket'] },
  { id: 'w-headless', label: 'The pajamas, no face', img: W.headless },
] });

// ---- settings --------------------------------------------------------------
groups.push({ label: 'Settings', items: [
  { id: 'set-office', label: 'The office', img: cast.settings['the-office'] },
  { id: 'set-room', label: 'Her room', img: cast.settings['her-room'] },
  { id: 'set-dining', label: 'The dining room', img: cast.settings['the-dining-room'] },
] });

// ---- clips ------------------------------------------------------------------
// The people who exist only as footage, and the two Juanita takes.
groups.push({ label: 'Juanita', items: [
  { id: 'clip-juanita-cut',
    label: 'Juanita, her scenes only',
    video: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/d23ef7ce8c73ec2169dd37b2ccc8a385.mp4',
    poster: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/d23ef7ce8c73ec2169dd37b2ccc8a385-poster.jpg' },
  { id: 'clip-juanita-take1',
    label: 'Esta es basura — the first take',
    video: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/apiframe-video/1788850139906-b0hjl2.mp4' },
  { id: 'clip-juanita-redo',
    label: 'Esta es basura — the redo',
    video: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/apiframe-video/1788852282218-kjg7h1.mp4' },
] });

groups.push({ label: 'People with no still', items: [
  { id: 'clip-michael', label: 'Michael', video: clip('michaelAud2') },
  { id: 'clip-norbert', label: 'Mrs. Norbert', video: clip('art-ref') },
  { id: 'clip-norbert-long', label: 'Mrs. Norbert, the long take', video: clip('art-ref-long') },
  { id: 'clip-mayra-nurse', label: 'Mayra and the nurse', video: clip('scaleAud3') },
  { id: 'clip-parents', label: 'The parents arriving', video: clip('parentsAud') },
] });

// drop anything whose url never resolved rather than posting an empty tile
groups.forEach((g) => { g.items = g.items.filter((it) => it.img || it.video); });

if (!process.argv.includes('--go')) {
  groups.forEach((g) => {
    console.log(`\n${g.label} (${g.items.length})`);
    g.items.forEach((it) => console.log('  ' + it.label + (it.video ? '  [clip]' : '')));
  });
  console.log('\ndry — pass --go to post');
  process.exit(0);
}

(async () => {
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, title: TITLE, template: 'grid', data: { groups } }),
  });
  const j = await r.json();
  console.log(JSON.stringify(j, null, 1));
  if (!j.ok) process.exit(1);

  const i = process.argv.indexOf('--supersede');
  if (i > 0 && process.argv[i + 1]) {
    const s = await fetch(`${BASE}/api/chatfeed/page/${process.argv[i + 1]}/supersede`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, session: SESSION, superseded: true }),
    });
    console.log('supersede:', await s.text());
  }
})();
