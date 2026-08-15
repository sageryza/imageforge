/* Two-panel animation gallery (Aug 2026) — media prep.
 * Uploads the clips this gallery shows (including the Darius shots cut out of
 * the two stitched films, which were never saved individually) plus a POSTER
 * for every clip — the clip's LAST frame, so the row shows where the motion
 * ended. Posters are webp: never serve a raw PNG to a page.
 * Idempotent: anything already in Storage is skipped.
 *   node scripts/two-panel-gallery/media.js [--force]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');

const SCRATCH = process.env.TPG_SCRATCH
  || '/tmp/claude-0/-home-user/cbc34ef8-0e83-56d4-bab6-6f7f2e7e7a49/scratchpad';
const FF = process.env.FFMPEG || execFileSync('python3',
  ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const PREFIX = 'two-panel-gallery/';
const FORCE = process.argv.includes('--force');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'deckfactory-43176.firebasestorage.app' });
const bucket = admin.storage().bucket();
const pub = (dest) => `https://storage.googleapis.com/${bucket.name}/${dest}`;

async function upload(local, dest, contentType) {
  const f = bucket.file(dest);
  if (!FORCE && (await f.exists())[0]) return pub(dest);
  await bucket.upload(local, { destination: dest, metadata: { contentType } });
  await f.makePublic();
  return pub(dest);
}

// last frame of a clip → webp. `-sseof -0.2` seeks from the END, which is the
// only reliable way to grab the final frame without decoding the whole file.
function poster(clip, out) {
  if (fs.existsSync(out) && !FORCE) return out;
  execFileSync(FF, ['-v', 'error', '-y', '-sseof', '-0.25', '-i', clip,
    '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '72', out]);
  return out;
}

(async () => {
  const jobs = [];
  for (const dir of ['clips', 'clips2', 'clips3']) {
    const d = path.join(SCRATCH, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.mp4'))) jobs.push(path.join(d, f));
  }
  const out = {};
  for (const clip of jobs) {
    const name = path.basename(clip, '.mp4');
    const p = poster(clip, path.join(SCRATCH, `${name}-poster.webp`));
    const clipUrl = await upload(clip, `${PREFIX}clips/${name}.mp4`, 'video/mp4');
    const posterUrl = await upload(p, `${PREFIX}posters/${name}.webp`, 'image/webp');
    out[name] = { clip: clipUrl, poster: posterUrl };
    console.log(name, '→ ok');
  }
  fs.writeFileSync(path.join(__dirname, 'media.json'), JSON.stringify(out, null, 1));
  console.log(`\n${Object.keys(out).length} clips uploaded → scripts/two-panel-gallery/media.json`);
})().catch((e) => { console.error(e); process.exit(1); });
