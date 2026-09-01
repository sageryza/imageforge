#!/usr/bin/env node
/**
 * July Patterns — Google Drive zips → the Dump, in one command.
 *
 * WHY THIS EXISTS: the Google Drive connector can only hand a file's bytes
 * back as base64 inside a reply, so a 17MB zip is out of reach from a chat,
 * and its share_file tool only shares with a named EMAIL — there is no
 * "anyone with the link" it can flip. So the one thing a chat cannot do is
 * get the bytes; the moment Sophie flips link-sharing on in the Drive app,
 * this script does the rest with no further step from her.
 *
 *   node scripts/patterns-from-drive.js            # dry — checks reachability
 *   node scripts/patterns-from-drive.js --go       # download + upload
 *
 * Each zip is unzipped SERVER-SIDE by POST /api/drop/upload-zip (it dedupes
 * by content hash, so re-running is safe and costs nothing twice).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const GO = process.argv.includes('--go');
const BUNDLE = 'July Patterns';

// The eight zips as they sit in her My Drive root (uploaded 2026-08-31).
const FILES = [
  ['July_Patterns_Part_1_of_8.zip', '1xdz5OlYfxbFALNxX4ATtlnRG3Oh0kn7O'],
  ['July_Patterns_Part_2_of_8.zip', '1nP4sF7Wa3K6YkSWvZ8iU6jdA0TMQsoz6'],
  ['July_Patterns_Part_3_of_8.zip', '1EBZqw2rqm_Hlo9HTdz80WEdXsk_LM1S2'],
  ['July_Patterns_Part_4_of_8.zip', '11CdUUfNLZ8jjoVre2zhXqjOByPHAqndJ'],
  ['July_Patterns_Part_5_of_8.zip', '110Dn2qIqdhuOeYwqVQF4oMTur_-ZndpM'],
  ['July_Patterns_Part_6_of_8.zip', '1I1OnjZ2sDv_wWuUSqPcFCrIkwqHLRBWx'],
  ['July_Patterns_Part_7_of_8.zip', '1eSZW0bFtLcUc5YoK6RrQjcmzdTRy04bI'],
  ['July_Patterns_Part_8_of_8.zip', '1dV4R71h045Gm9wxHUqRuNH7AtkgPJAeN'],
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patterns-'));

async function grab(id, dest) {
  const r = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: 'follow' });
  const buf = Buffer.from(await r.arrayBuffer());
  // A private file answers 200 with Google's sign-in HTML, not an error — so
  // the only honest check is the zip's own magic number.
  if (buf.slice(0, 2).toString() !== 'PK') {
    const why = buf.slice(0, 400).includes('accounts.google.com') ? 'not link-shared' : 'not a zip';
    return { ok: false, why, bytes: buf.length };
  }
  if (dest) fs.writeFileSync(dest, buf);
  return { ok: true, buf, bytes: buf.length };
}

(async () => {
  let session = process.env.PATTERNS_SESSION || '';
  const urls = [];
  for (const [name, id] of FILES) {
    const got = await grab(id, GO ? path.join(dir, name) : null);
    if (!got.ok) { console.log(`${name}: ${got.why} (${got.bytes} bytes)`); continue; }
    console.log(`${name}: ok, ${(got.bytes / 1e6).toFixed(1)}MB`);
    if (!GO) continue;
    const q = new URLSearchParams({ bundle: BUNDLE });
    if (session) q.set('session', session);
    const r = await fetch(`${BASE}/api/drop/upload-zip?${q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: got.buf,
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { console.log(`  upload failed: ${j.error || r.status}`); continue; }
    session = session || j.session;
    (j.items || []).forEach((i) => urls.push({ url: i.url, name: i.filename }));
    console.log(`  filed ${j.count} (${j.skipped} already there) · session ${session}`);
  }
  if (GO) {
    const out = path.join(dir, 'patterns.json');
    fs.writeFileSync(out, JSON.stringify({ session, bundle: BUNDLE, files: urls }, null, 2));
    console.log(`\n${urls.length} pictures · ${out}`);
  } else {
    console.log('\ndry run — add --go to download and file them');
  }
})();
