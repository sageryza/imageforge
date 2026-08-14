#!/usr/bin/env node
// harvest-clips.js — fill the Chunking library from the command line.
//
// The page has a "Rebuild the library" button that does exactly this as a
// background job, but the poster phase is bounded by a wall clock (Render's
// instance has other work to do), so a first build of a few hundred clips takes
// several presses. From here it can just run to the end.
//
//   node scripts/harvest-clips.js                # list, then draw every poster
//   node scripts/harvest-clips.js --list-only    # just file the clips (fast)
//   node scripts/harvest-clips.js --posters-only # only draw missing posters
//
// Needs FIREBASE_SERVICE_ACCOUNT (deckfactory-43176) and ffmpeg/ffprobe, which
// come from the repo's own npm packages. Costs nothing but bandwidth — every
// clip it files was already generated and paid for.

const admin = require('firebase-admin');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
const sa = JSON.parse(raw);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${sa.project_id}.firebasestorage.app`,
});

// The poster phase stops at a wall-clock budget so the server can never wedge;
// a command-line run has no such deadline, so lift it and let the job finish.
// BEFORE the require — clips.js reads this once, at load.
process.env.CLIPS_POSTER_BUDGET_MS = String(6 * 60 * 60 * 1000);

// Required AFTER admin is initialised — the module reads the default app.
const clips = require('../clips');

const args = process.argv.slice(2);
const listing = !args.includes('--posters-only');
const posters = !args.includes('--list-only');

let lastLabel = '';
const progress = async (done, total, label, extra = {}) => {
  const line = `${label}${total ? ` ${done}/${total}` : ''}`;
  if (line === lastLabel) return;
  lastLabel = line;
  const bits = Object.entries(extra).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  ${line}${bits ? `  (${bits})` : ''}`);
};

(async () => {
  const started = Date.now();
  await clips.harvest(progress, { listing, posters });
  const all = await clips.loadAll();
  const withPoster = all.filter((c) => c.poster).length;
  const failed = all.filter((c) => c.posterFailed).length;
  const hidden = all.filter((c) => c.hidden).length;
  console.log(`\n${all.length} clips in the library — ${withPoster} with a picture, `
    + `${failed} whose first frame could not be read, ${hidden} hidden.`);
  console.log(`took ${Math.round((Date.now() - started) / 1000)}s`);
  process.exit(0);
})().catch((err) => { console.error('harvest failed:', err.message); process.exit(1); });
