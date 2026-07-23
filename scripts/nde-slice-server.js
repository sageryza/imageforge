#!/usr/bin/env node
/**
 * nde-slice-server.js — cut supercut clips ENTIRELY server-side, from the
 * full-quality audios banked in Firebase Storage (nde-audio/<videoId>.<ext>).
 * No laptop involved: run this from any Claude session (or Render shell) with
 * ffmpeg on PATH and the deckfactory service account.
 *
 *   FIREBASE_KEY_FILE=/path/sa.json node scripts/nde-slice-server.js \
 *     [--themes /path/nde-themes.json]  (default: pull beats from the file)
 *     [--theme colors,telepathy]        (only these theme keys; default all)
 *     [--run supercut-v1]               (output folder name in Storage)
 *     [--pre 1.5] [--maxdur 20]         (clip window tuning, seconds)
 *
 * For every theme hit whose video has a banked audioUrl: download the audio
 * once, ffmpeg-slice each clip (stream-copy quality, mp3 out), upload to
 * Storage nde-clips/<run>/<theme>/NN_person_mmss.mp3 (public), then write
 * INDEX.tsv and a single ZIP of everything and print the public links.
 *
 * Re-runnable; each --run name is its own folder. Env:
 * FIREBASE_SERVICE_ACCOUNT (json) or FIREBASE_KEY_FILE (path). ffmpeg on PATH.
 */
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const admin = require('firebase-admin');

function arg(n, d) { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const THEMES_PATH = arg('themes', '/home/user/nde-themes.json');
const ONLY = arg('theme', '').split(',').map(s => s.trim()).filter(Boolean);
const RUN = arg('run', 'supercut-' + new Date().toISOString().slice(0, 10));
const PRE = parseFloat(arg('pre', '1.5'));
const MAXDUR = parseFloat(arg('maxdur', '20'));
const SERVER = process.env.NDE_SERVER || 'https://imageforge-q125.onrender.com';

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_KEY_FILE, 'utf8');
const sa = JSON.parse(saJson);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });

function ffmpeg(args) { execFileSync('ffmpeg', ['-nostdin', '-y', ...args], { stdio: 'ignore' }); }
const sanitize = s => String(s || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
const wordCount = s => (String(s || '').trim().match(/\S+/g) || []).length;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

(async () => {
  const themes = JSON.parse(fs.readFileSync(THEMES_PATH, 'utf8')).themes
    .filter(t => !ONLY.length || ONLY.includes(t.key));
  const totalHits = themes.reduce((n, t) => n + t.hits.length, 0);
  console.log(`Run "${RUN}": ${themes.length} themes, ${totalHits} clips requested.`);

  // audioUrl map from the live server
  const list = await fetchJSON(`${SERVER}/api/nde/videos?limit=200`);
  const audioByVid = {};
  for (const v of list.videos || []) {
    const full = await fetchJSON(`${SERVER}/api/nde/videos/${v.videoId}`);
    if (full.audioUrl) audioByVid[v.videoId] = full.audioUrl;
  }
  console.log(`Banked audios available: ${Object.keys(audioByVid).length}`);

  const bucket = admin.storage().bucket();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ndeslice-'));
  const audioLocal = {};
  const index = [];
  let ok = 0, noAudio = 0, fail = 0;

  for (const t of themes) {
    let n = 0;
    for (const h of t.hits) {
      n++;
      const src = audioByVid[h.videoId];
      const start = Number.isFinite(+h.timeSec) ? +h.timeSec : null;
      if (!src || start == null) { noAudio++; continue; }
      try {
        if (!audioLocal[h.videoId]) {
          const ext = src.split('.').pop().split('?')[0];
          const lp = path.join(tmp, `${h.videoId}.${ext}`);
          process.stdout.write(`  downloading audio ${h.videoId}… `);
          await download(src, lp);
          console.log('✓');
          audioLocal[h.videoId] = lp;
        }
        const dur = Math.max(7, Math.min(MAXDUR, wordCount(h.quote) / 2.4 + 4.5));
        const inSec = Math.max(0, start - PRE);
        const mmss = `${String(Math.floor(start / 60)).padStart(2, '0')}${String(start % 60).padStart(2, '0')}`;
        const fname = `${String(n).padStart(2, '0')}_${sanitize(h.experiencer)}_${mmss}.mp3`;
        const local = path.join(tmp, `${t.key}_${fname}`);
        ffmpeg(['-ss', String(inSec), '-to', String(start + dur), '-i', audioLocal[h.videoId], '-vn', '-c:a', 'libmp3lame', '-q:a', '3', local]);
        const dest = `nde-clips/${RUN}/${t.key}/${fname}`;
        await bucket.upload(local, { destination: dest, metadata: { contentType: 'audio/mpeg' } });
        await bucket.file(dest).makePublic();
        index.push([`${t.key}/${fname}`, t.key, h.experiencer, `${Math.round(inSec)}-${Math.round(start + dur)}s`, `${h.videoUrl}&t=${Math.floor(inSec)}s`, (h.quote || '').replace(/\s+/g, ' ')].join('\t'));
        ok++;
      } catch (e) { fail++; console.error(`  ${t.key}/${n} FAILED: ${e.message}`); }
    }
    console.log(`${t.key}: done`);
  }

  // INDEX + ZIP
  const indexTxt = 'file\ttheme\texperiencer\twindow\tsource\tquote\n' + index.join('\n') + '\n';
  const idxDest = `nde-clips/${RUN}/INDEX.tsv`;
  await bucket.file(idxDest).save(indexTxt, { metadata: { contentType: 'text/tab-separated-values' } });
  await bucket.file(idxDest).makePublic();

  let zipUrl = null;
  try {
    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file('INDEX.tsv', indexTxt);
    for (const line of index) {
      const rel = line.split('\t')[0];
      const local = path.join(tmp, rel.replace('/', '_'));
      if (fs.existsSync(local)) zip.file(rel, fs.readFileSync(local));
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const zipDest = `nde-clips/${RUN}/${RUN}.zip`;
    await bucket.file(zipDest).save(buf, { metadata: { contentType: 'application/zip' } });
    await bucket.file(zipDest).makePublic();
    zipUrl = `https://storage.googleapis.com/${bucket.name}/${zipDest}`;
  } catch (e) { console.warn('zip skipped:', e.message); }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  console.log(`\nDone. ${ok} clips cut · ${noAudio} skipped (no banked audio/timestamp) · ${fail} failed`);
  console.log(`Index: https://storage.googleapis.com/${bucket.name}/${idxDest}`);
  if (zipUrl) console.log(`ZIP:   ${zipUrl}`);
})().catch(e => { console.error('FATAL', e.stack || e.message); process.exit(1); });
