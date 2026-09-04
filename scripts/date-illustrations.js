#!/usr/bin/env node
/**
 * The date illustrations, gathered into ONE place she can download from.
 *
 * Sophie, 2026-09-04: "can i have my full size date illustrations to download
 * esp jon storch gabriel etc / or is there already a page to download from".
 * There was not. The pictures existed in two disconnected piles and neither
 * was reachable from her phone:
 *
 *   1. `google-drawings/dates/NN.(jpg|png)` in Storage — 50 portraits pulled
 *      out of the LEGAL SIZE DATE POSTER Google Drawing by
 *      scripts/gdrawing-extract.py. Every date is here, but they are NUMBERED,
 *      and the only thing that says who each one IS is her own naming pass on
 *      the `date-images` verdict sheet in the google-drawings-svg-export chat.
 *   2. docs/dating-book/reference/date-watercolors/*.{jpg,png} — 18 originals
 *      pulled straight from Drive with an OAuth token, so they escape both
 *      Google's 2500px upload resize and the drawing's re-encode. These are
 *      the BIGGEST copies that exist for those 18 people, and they lived only
 *      in the git repo: nothing on her phone could reach them.
 *
 * What this does: uploads pile 2 into Storage, then files BOTH piles into a
 * chat's Assets tab under her own names. Filing is the whole point — a filed
 * picture gets the shared lightbox's action row (public/asset-actions.js), and
 * **Save to Photos** in that row is the download she asked for. It also gets
 * the Assets tab's search box, so "jon" finds Jon.
 *
 * NO PROMPT AND NO MODEL · QUALITY CAPTION IS FILED, deliberately: nobody
 * typed words to make these and no model drew them — they are her paintings on
 * paper. That is the exact-prompt rule's own answer (file nothing rather than
 * a reconstruction), and `google-drawings/` is on asset-guard's
 * SOURCE_LIBRARY_PREFIXES so the caption sweep stops asking.
 *
 * The name is the label and the label is what she reviews and searches by, so
 * every name here is HERS — read live off the verdict sheet, never invented.
 * A number she never named is filed as "Date NN — unnamed" rather than
 * guessed at.
 *
 * Usage:
 *   node scripts/date-illustrations.js --chat <slug> [--session <id>]   (dry)
 *   node scripts/date-illustrations.js --chat <slug> --go               (writes)
 *   node scripts/date-illustrations.js --chat <slug> --go --page        (+ grid page)
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory). Re-running is safe: the
 * upload is content-addressed by path and `POST /api/gallery` dedupes by url.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const DRAWING_CHAT = 'google-drawings-svg-export';
const DRAWING_SHEET = 'date-images';
const SRC_PREFIX = 'google-drawings/dates/';
const DEST_PREFIX = 'dating-book/date-watercolors/';
const REPO_DIR = path.join(__dirname, '..', 'docs', 'dating-book', 'reference', 'date-watercolors');

// The 18 Drive-pulled originals, and who each one is. Read off that folder's
// own INDEX.md — the file names are the record, so nothing here is a guess.
const REPO_NAMES = {
  'michael.jpg': 'Michael',
  'michael-and-matt.jpg': 'Michael & Matt',
  'matt.jpg': 'Matt',
  'jason.jpg': 'Jason',
  'nate.jpg': 'Nate',
  'skylar.jpg': 'Skylar',
  'westley.jpg': 'Westley',
  'pavel.jpg': 'Pavel',
  'cody-lee-roberts.jpg': 'Cody Lee Roberts',
  'gwyn.jpg': 'Gwyn',
  'gwyn-alt.png': 'Gwyn (alt version)',
  'david-and-alex.png': 'David & Alex',
  'temescal.jpg': 'Temescal date',
  'sean-sebastian.png': 'Sean Sebastian',
  'sage-and-chris.png': 'Sage & Chris',
  'sage-and-blake.png': 'Sage & Blake',
  'josie.png': 'Josie',
  'josiah.png': 'Josiah',
  '_ALL-DATES-poster-roster.png': 'All ~40 dates — the whole poster',
};

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : dflt;
}
const has = (name) => process.argv.includes('--' + name);
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Her own naming pass, read live. Never a copy kept here. */
async function herNames() {
  const u = `${BASE}/api/chatfeed/verdict?chat=${DRAWING_CHAT}&sheet=${DRAWING_SHEET}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`verdict read failed: ${r.status}`);
  const d = await r.json();
  return { texts: d.texts || {}, hearts: d.items || {} };
}

async function main() {
  const chat = arg('chat');
  const session = arg('session', '');
  if (!chat) { console.error('--chat <slug> is required'); process.exit(1); }
  const go = has('go');

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!sa.project_id) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: sa.project_id + '.firebasestorage.app',
  });
  const bucket = admin.storage().bucket();
  // The shape saveToFirebase writes, and the ONE shape asset-hash's
  // storageRef parses back into a bucket + path — so the guard, the union and
  // the caption sweep all recognise these as Storage objects.
  const pub = (name) => `https://storage.googleapis.com/${bucket.name}/${name}`;

  const { texts, hearts } = await herNames();
  const items = [];

  // ── pile 2: the Drive-pulled originals, uploaded out of the repo ─────────
  for (const [file, name] of Object.entries(REPO_NAMES)) {
    const local = path.join(REPO_DIR, file);
    if (!fs.existsSync(local)) { console.log(`  (missing in repo) ${file}`); continue; }
    const dest = DEST_PREFIX + file;
    const obj = bucket.file(dest);
    const [exists] = await obj.exists();
    if (!exists) {
      console.log(`upload  ${dest}  ${(fs.statSync(local).size / 1048576).toFixed(1)}MB`);
      if (go) {
        await bucket.upload(local, { destination: dest, resumable: false });
        await obj.makePublic();
      }
    } else if (go) {
      await obj.makePublic().catch(() => {});
    }
    items.push({ url: pub(dest), label: `${name} — full-size scan`, group: 'Full-size scans', name });
  }

  // ── pile 1: the numbered poster extractions ──────────────────────────────
  const [files] = await bucket.getFiles({ prefix: SRC_PREFIX });
  const mains = files
    .filter((f) => !f.name.includes('/thumbs/') && !f.name.includes('contact-sheet'))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const f of mains) {
    const base = f.name.split('/').pop();
    const stem = base.replace(/\.[a-z]+$/i, '');
    const n = parseInt(stem, 10);
    const raw = texts[String(n)];
    let name = raw ? titleCase(raw.trim()) : null;
    // 43 is a PAIR she named "Blake and Louis", cut into its two figures. Which
    // figure is which is not on any record, so the label says the side rather
    // than picking a name and being wrong half the time.
    const side = /-left$/.test(stem) ? 'left figure' : /-right$/.test(stem) ? 'right figure' : '';
    if (side) name = name ? `${name} — ${side}` : null;
    const label = name
      ? `${name} — from the date poster${hearts[String(n)] ? ' ♥' : ''}`
      : `Date ${stem} — unnamed, from the date poster`;
    if (go) await f.makePublic().catch(() => {});
    items.push({ url: pub(f.name), label, group: 'From the date poster', name: name || `Date ${stem}` });
  }

  console.log(`\n${items.length} illustrations${go ? '' : '  (dry run — pass --go to write)'}`);
  for (const it of items) console.log('  ' + it.label);
  if (!go) return;

  // ── file them, so each one gets the lightbox's Save to Photos door ───────
  let ok = 0, bad = 0;
  for (const it of items) {
    const r = await fetch(`${BASE}/api/gallery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat, session, url: it.url, description: it.label }),
    });
    if (r.ok) ok++; else { bad++; console.log('  FILE FAILED ' + it.label + ' ' + r.status); }
  }
  console.log(`filed ${ok}, failed ${bad}`);

  if (has('page')) {
    const groups = ['Full-size scans', 'From the date poster'].map((g) => ({
      label: g,
      items: items.filter((x) => x.group === g)
        .map((x) => ({ id: x.url.split('/').pop().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase(), img: x.url, label: x.name })),
    })).filter((g) => g.items.length);
    const r = await fetch(`${BASE}/api/chatfeed/page`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat, session,
        title: 'Date illustrations — all of them, full size',
        template: 'grid',
        data: { groups },
      }),
    });
    const d = await r.json().catch(() => ({}));
    console.log('page:', JSON.stringify(d).slice(0, 400));
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
