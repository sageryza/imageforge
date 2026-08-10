// verify-clip-cache.js — machine-verify every banked clip: download each
// episode snippet's cache file, confirm the files are all DISTINCT (no two
// snippets sharing one cut), then re-transcribe each with whisper-1 and score
// the heard words against the snippet's expected text (the same difflib ratio
// the cutter matches with). The audio equivalent of nde-verify-cuts.py, run
// against the clip cache instead of a stitched montage.
//
// Usage: node scripts/verify-clip-cache.js [--only <ids/titles>] [--base <url>]
// Needs FIREBASE_SERVICE_ACCOUNT + OPENAI_API_KEY. ~1c per ~10 clips (whisper).
// Exit 0 = every clip distinct and ≥0.75 match; exit 2 = something to look at.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fetch = require('node-fetch');
const FormData = require('form-data');
const admin = require('firebase-admin');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
if (!sa) { console.error('FIREBASE_SERVICE_ACCOUNT is not set'); process.exit(1); }
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: `${sa.project_id}.firebasestorage.app`,
});

const editor = require('../editor.js');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const BASE = (arg('base', 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const ONLY = arg('only', '').split(',').map(s => s.trim()).filter(Boolean);
const MIN_RATIO = 0.75; // whisper mishears the odd word; below this = wrong clip

const H = { 'content-type': 'application/json' };
if (process.env.STUDIO_TOKEN) H['x-studio-token'] = process.env.STUDIO_TOKEN;

async function api(p) {
  const res = await fetch(BASE + '/api/editor' + p, { headers: H });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function whisper(file) {
  const form = new FormData();
  form.append('file', fs.createReadStream(file), { filename: 'clip.mp3' });
  form.append('model', 'whisper-1');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form, timeout: 180000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return String(data.text || '');
}

(async () => {
  const bucket = admin.storage().bucket();
  const { episodes } = await api('/');
  const wanted = episodes.filter(e => !ONLY.length || ONLY.includes(e.id) || ONLY.includes(e.title));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
  const byHash = new Map(); // file md5 → [where]
  const problems = [];
  let checked = 0;

  for (const item of wanted) {
    const { episode: ep } = await api('/' + item.id);
    console.log(`\n== ${ep.title} (${ep.id})`);
    for (const snippet of ep.snippets || []) {
      const source = editor.sourceFor(ep, snippet.videoId, snippet);
      if (!source) { problems.push(`${ep.title} / "${snippet.name}": no source`); continue; }
      const cachePath = editor.clipCachePath(snippet, source);
      const local = path.join(dir, crypto.randomBytes(6).toString('hex') + '.mp3');
      try {
        await bucket.file(cachePath).download({ destination: local });
      } catch {
        problems.push(`${ep.title} / "${snippet.name}": NOT IN CACHE`);
        console.log(`  MISSING "${snippet.name}"`);
        continue;
      }
      const md5 = crypto.createHash('md5').update(fs.readFileSync(local)).digest('hex');
      const where = `${ep.title} / "${snippet.name}"`;
      if (!byHash.has(md5)) byHash.set(md5, []);
      byHash.get(md5).push(where);

      let heard = '';
      try { heard = await whisper(local); }
      catch (err) { problems.push(`${where}: whisper failed — ${err.message}`); continue; }
      let r = editor.ratio(editor.normWords(snippet.text), editor.normWords(heard));
      checked++;
      if (r < MIN_RATIO) {
        // Whole-file whisper is a flawed judge: it silently drops repeated
        // phrases and garbles accented speech (see docs/nde-precise-cutting.md
        // — "full-file transcription is NOT a valid verifier"). Before flagging,
        // re-listen in overlapping ~5s pieces and re-score on the joined text;
        // a good clip recovers, a truly wrong one stays low.
        const pieces = [];
        const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', local]).toString()) || 0;
        for (let t = 0; t < dur; t += 4) {
          const piece = local + `.${t}.mp3`;
          execFileSync('ffmpeg', ['-y', '-ss', String(t), '-t', '5', '-i', local, '-c:a', 'libmp3lame', '-q:a', '4', piece], { stdio: 'pipe' });
          try { pieces.push(await whisper(piece)); } catch { /* piece optional */ }
          fs.unlinkSync(piece);
        }
        const joined = pieces.join(' ');
        const r2 = editor.ratio(editor.normWords(snippet.text), editor.normWords(joined));
        r = Math.max(r, r2);
        if (r2 >= MIN_RATIO) heard = joined;
      }
      if (r < MIN_RATIO) {
        problems.push(`${where}: match ${(r * 100).toFixed(0)}% — heard "${heard.slice(0, 90)}"`);
        console.log(`  BAD   "${snippet.name}" ${(r * 100).toFixed(0)}% — heard: ${heard.slice(0, 70)}`);
      } else {
        console.log(`  ok    "${snippet.name}" ${(r * 100).toFixed(0)}%`);
      }
      fs.unlinkSync(local);
    }
  }

  for (const [md5, wheres] of byHash) {
    if (wheres.length > 1) problems.push(`SAME FILE (${md5.slice(0, 8)}) used by: ${wheres.join(' AND ')}`);
  }

  console.log(`\nchecked ${checked} clips, ${byHash.size} distinct files`);
  if (problems.length) {
    console.log('\nPROBLEMS:');
    for (const p of problems) console.log(' - ' + p);
    process.exit(2);
  }
  console.log('all clips distinct and matching their expected words');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  process.exit(0);
})().catch(err => { console.error(err.message); process.exit(1); });
