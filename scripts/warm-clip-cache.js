// warm-clip-cache.js — pre-cut every snippet of every Episode Editor episode
// into the permanent clip cache, from wherever this runs (a chat session, a
// laptop) instead of inside the live server's fire-and-forget render job.
//
// Why this exists: the Render free instance restarts on every deploy from any
// chat, and an in-memory render job dies with it (the doc stays "running"
// forever). Warming locally is restart-proof; it runs the IDENTICAL editor.js
// cut (buildClip → clip cache), so afterwards every server Play/Render is a
// cache hit that finishes in seconds.
//
// Usage:
//   node scripts/warm-clip-cache.js                 # every episode, every snippet
//   node scripts/warm-clip-cache.js --only ep4dfe…  # episode ids or titles, comma-sep
//   node scripts/warm-clip-cache.js --base http://localhost:8099
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) + OPENAI_API_KEY (whisper
// fallback for snippets no alignment window covers) + ffmpeg. Idempotent:
// already-cached cuts are skipped (logged as "from clip-cache").

const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
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

const H = { 'content-type': 'application/json' };
if (process.env.STUDIO_TOKEN) H['x-studio-token'] = process.env.STUDIO_TOKEN;

async function api(p) {
  const res = await fetch(BASE + '/api/editor' + p, { headers: H });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

(async () => {
  const { episodes } = await api('/');
  const wanted = episodes.filter(e => !ONLY.length || ONLY.includes(e.id) || ONLY.includes(e.title));
  let cached = 0, cut = 0, failed = 0;

  for (const item of wanted) {
    const { episode: ep } = await api('/' + item.id);
    console.log(`\n== ${ep.title} (${ep.id}) — ${(ep.snippets || []).length} snippets`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warm-'));
    const ctx = { dir, downloads: new Map(), log: [] };
    try {
      for (const snippet of ep.snippets || []) {
        const source = editor.sourceFor(ep, snippet.videoId, snippet);
        if (!source) { console.log(`  SKIP "${snippet.name}" — no source for ${snippet.videoId}`); failed++; continue; }
        const before = ctx.log.length;
        try {
          await editor.buildClip(snippet, source, ctx);
          const note = ctx.log.slice(before).join(' · ');
          if (note.includes('from clip-cache')) { cached++; console.log(`  cache "${snippet.name}"`); }
          else { cut++; console.log(`  CUT   ${note}`); }
        } catch (err) {
          failed++;
          console.log(`  FAIL  "${snippet.name}" — ${err.message}`);
        }
      }
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
    }
  }
  console.log(`\ndone: ${cut} cut, ${cached} already cached, ${failed} failed`);
  process.exit(failed ? 2 : 0);
})().catch(err => { console.error(err.message); process.exit(1); });
