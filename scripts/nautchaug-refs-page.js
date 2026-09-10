#!/usr/bin/env node
/* THE NAUTCHAUG BOYFRIEND'S — every reference, as a grid Compare page.
 *
 *   node scripts/nautchaug-refs-page.js            # dry — prints the groups
 *   node scripts/nautchaug-refs-page.js --go       # posts it
 *   node scripts/nautchaug-refs-page.js --go --supersede <id>
 *
 * The data is docs/nautchaug/cast.json, so the page and the index cannot
 * disagree about who is in the script or which of them has a picture.
 *
 * LABELS NAME THE THING AND NOTHING ELSE (2026-09-10, Sophie: "less commentary
 * take the commentary out of the page itself"). A name, and a scene count where
 * the count is the only fact the tile has. What a reference IS lives in
 * cast.json; the page is for looking.
 *
 * THE SCRIPT REUSES THE WARD FILM'S REFERENCES — the same Sophie, the same
 * wardrobe, the same rooms — so those ride here rather than being re-shot.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'pajama-assets';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '')
  || '01Xz9f7vZGF8Nz4xsfThS2g8';
const TITLE = "The Nautchaug Boyfriend's — the cast (v1)";

const cast = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'nautchaug', 'cast.json'), 'utf8'));

const P = cast.people;
const S = cast.shared;
const groups = [];

const NAMES = {
  'dr-sugarman': 'Dr. Sugarman',
  'brenda-the-ot': 'Brenda the OT',
  'ro-sam': 'Ro / Sam',
};
const nameOf = (k) => NAMES[k] || k.replace(/(^|-)([a-z])/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase());

// ---- the people who have a picture -----------------------------------------
const have = Object.entries(P).filter(([, v]) => v.current);
groups.push({ label: 'Cast', items: have.map(([k, v]) => (
  { id: 'cast-' + k, label: nameOf(k), img: v.current }
)).concat([
  { id: 'cast-sophie-face', label: 'Sophie, her face', img: S['sophie-face-A'] },
]) });

// ---- the ward film's references, which this script uses too -----------------
groups.push({ label: 'Wardrobe and rooms', items: [
  { id: 'sh-opta', label: 'The pajamas', img: S['pj-optA-solo'] },
  { id: 'sh-optc', label: 'The pajama shirt', img: S['pj-optC-solo'] },
  { id: 'sh-room', label: 'Her room', img: S['her-room'] },
  { id: 'sh-dining', label: 'The dining room', img: S['the-dining-room'] },
] });

// ---- everyone still without one --------------------------------------------
const want = Object.entries(P).filter(([, v]) => !v.current);
groups.push({ label: 'No picture yet', items: want.map(([k, v]) => (
  { id: 'need-' + k, label: nameOf(k), text: v.scenes + (v.scenes === 1 ? ' scene' : ' scenes') }
)) });

// drop anything whose url never resolved rather than posting an empty tile
groups.forEach((g) => { g.items = g.items.filter((it) => it.img || it.video || it.text); });

// --json is what the PHOTO harness reads, so the picture she is shown is built
// from the same groups the post is
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ title: TITLE, chat: CHAT, groups }));
  process.exit(0);
}

if (!process.argv.includes('--go')) {
  groups.forEach((g) => {
    console.log(`\n${g.label} (${g.items.length})`);
    g.items.forEach((it) => console.log('  ' + it.label + (it.text ? '  — ' + it.text : '')));
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
