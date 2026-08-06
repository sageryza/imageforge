#!/usr/bin/env node
/**
 * Guard for the webp switch: every school/quiz image witch.html asks for must
 * exist in witch-school/webp/ before the page is allowed to point there. A missing
 * one is a broken picture in a live lesson, and the page has no PNG fallback by
 * design (a fallback would re-download the megabyte we just removed).
 *
 *   node scripts/witch-school-webp-verify.js
 *
 * Exits non-zero if anything is missing. Needs FIREBASE_SERVICE_ACCOUNT.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const OUT_DIR = 'witch-school/webp/';
const SRC_DIR = 'witch-school/assets/';
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'witch.html'), 'utf8');

// Every id the page can put after SW_IMG: lesson card art (img:), course covers
// (cover:), Book-of-Shadows section covers, and the brew shelf's ing2-<key>.
const ids = new Set();
for (const m of page.matchAll(/\bimg:\s*'([a-z0-9][a-z0-9-]*)'/gi)) ids.add(m[1]);
for (const m of page.matchAll(/\bcover:\s*'([a-z0-9][a-z0-9-]*)'/gi)) ids.add(m[1]);
for (const m of page.matchAll(/\bk:\s*'([a-z0-9][a-z0-9-]*)'/gi)) ids.add('ing2-' + m[1]);
// The quiz cards (QZ_IMG) live in the SAME folder as the school art and are
// built as `QZ_IMG + 'qz-q1' + SW_EXT`, so they need their own sweep.
for (const m of page.matchAll(/QZ_IMG \+ '([a-z0-9][a-z0-9-]*)'/gi)) ids.add(m[1]);

(async () => {
  const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(cred), storageBucket: `${cred.project_id}.firebasestorage.app` });
  const bucket = admin.storage().bucket();
  const [webps] = await bucket.getFiles({ prefix: OUT_DIR });
  const have = new Set(webps.map(f => f.name.replace(OUT_DIR, '').replace(/\.webp$/, '')));
  const [pngs] = await bucket.getFiles({ prefix: SRC_DIR });
  const havePng = new Set(pngs.filter(f => f.name.endsWith('.png')).map(f => f.name.replace(SRC_DIR, '').replace(/\.png$/, '')));

  // An id the page references that has no PNG either was never a school image
  // (some other `img:`/`cover:` field in the file) — not our problem.
  const referenced = [...ids].filter(id => havePng.has(id)).sort();
  const missing = referenced.filter(id => !have.has(id));

  console.log(`${webps.length} webp copies · page references ${referenced.length} school images · ${missing.length} missing`);
  if (missing.length) {
    missing.forEach(id => console.log('  MISSING', id));
    process.exit(1);
  }
  console.log('OK — every image the page asks for has a webp copy.');
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
