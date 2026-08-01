// seed-editor-montages.js — create one Episode Editor episode per finished
// montage, from the banked cut lists in scripts/nde-montages/*.json (the exact
// clip lists the delivered montage audios were cut from).
//
// Each episode gets the montage's clips as snippet cards in running order, so
// the montage opens in the editor ready to rearrange. Pass --render to also
// render each episode once, sequentially — that cuts every clip through the
// server's cutter and banks each one in the permanent clip cache, so every
// later Play / re-render is instant, and the finished montage audio lands in
// the episode's Renders list.
//
// Usage:
//   node scripts/seed-editor-montages.js                    # create missing episodes
//   node scripts/seed-editor-montages.js --render           # + warm every clip
//   node scripts/seed-editor-montages.js --only telepathy,grass
//   node scripts/seed-editor-montages.js --replace          # delete + recreate
//   node scripts/seed-editor-montages.js --base http://localhost:8099
// Set STUDIO_TOKEN if the server is gated. Idempotent: an episode whose title
// already exists is left alone (found episodes still render with --render).

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const MONTAGES = [
  { slug: 'realer', title: 'Realer Than Real' },
  { slug: 'telepathy', title: 'Telepathy' },
  { slug: 'not-my-body', title: 'Not My Body' },
  { slug: 'colors', title: 'The Colors' },
  { slug: 'universal-knowledge', title: 'Universal Knowledge' },
  { slug: 'music', title: 'The Music' },
  { slug: 'life-review', title: 'Life Review' },
  { slug: 'welcomed-home', title: 'Welcomed Home' },
  { slug: 'deceased', title: 'Deceased Loved Ones' },
  { slug: 'grass', title: 'The Grass' },
];

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const BASE = (arg('base', 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const ONLY = arg('only', '').split(',').map(s => s.trim()).filter(Boolean);
const REPLACE = process.argv.includes('--replace');
const RENDER = process.argv.includes('--render');

const H = { 'content-type': 'application/json' };
if (process.env.STUDIO_TOKEN) H['x-studio-token'] = process.env.STUDIO_TOKEN;

async function api(p, opts = {}) {
  const res = await fetch(BASE + '/api/editor' + p, { headers: H, ...opts });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { throw new Error(`${res.status}: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildEpisode(title, cands) {
  // One source per interview (the picker's transcript tabs); snippet anchors
  // carry each clip's own position, so cutting never depends on this timeSec.
  const seen = new Map();
  const sources = [];
  for (const c of cands) {
    if (seen.has(c.videoId)) continue;
    seen.set(c.videoId, true);
    sources.push({ videoId: c.videoId, experiencer: c.experiencer, timeSec: c.timeSec, audioUrl: c.audioUrl });
  }
  const nameCount = new Map();
  const snippets = cands.map((c, i) => {
    const n = (nameCount.get(c.experiencer) || 0) + 1;
    nameCount.set(c.experiencer, n);
    return {
      id: 'sn' + String(i).padStart(2, '0'),
      name: n > 1 ? `${c.experiencer} (${n})` : c.experiencer,
      videoId: c.videoId,
      timeSec: c.timeSec,
      text: c.quote,
    };
  });
  const sequence = snippets.map(s => ({ type: 'clip', snippetId: s.id }));
  return { title, sources, snippets, sequence };
}

async function renderAndWait(id, title) {
  await api(`/${id}/render`, { method: 'POST', body: JSON.stringify({}) });
  process.stdout.write(`  rendering "${title}" `);
  for (;;) {
    await sleep(6000);
    let data;
    try { data = await api(`/${id}/job`); } catch { process.stdout.write('~'); continue; }
    const j = data.job || {};
    if (j.status === 'running') { process.stdout.write('.'); continue; }
    if (j.status === 'error') { console.log(`\n  RENDER FAILED: ${j.error}`); return null; }
    const r = (data.renders || [])[0];
    if (r) {
      const notes = r.notes || [];
      const cached = notes.filter(n => n.includes('from clip-cache')).length;
      const whisper = notes.filter(n => n.includes('via whisper')).length;
      console.log(`\n  done — ${r.seconds}s, ${r.cards} cards (${cached} from cache, ${whisper} via whisper)`);
      return r;
    }
    console.log('\n  job finished but no render recorded');
    return null;
  }
}

(async () => {
  const wanted = MONTAGES.filter(m => !ONLY.length || ONLY.includes(m.slug));
  const { episodes } = await api('/');

  for (const m of wanted) {
    const file = path.join(__dirname, 'nde-montages', `${m.slug}.json`);
    const cands = JSON.parse(fs.readFileSync(file, 'utf8'));
    let existing = episodes.filter(e => e.title === m.title);

    if (REPLACE) {
      for (const e of existing) {
        await api('/' + e.id, { method: 'DELETE' });
        console.log(`deleted existing "${m.title}" (${e.id})`);
      }
      existing = [];
    }

    let id;
    if (existing.length) {
      id = existing[0].id;
      console.log(`"${m.title}" already exists (${id}) — ${existing[0].snippets} snippets`);
    } else {
      const { episode } = await api('/', { method: 'POST', body: JSON.stringify(buildEpisode(m.title, cands)) });
      id = episode.id;
      console.log(`created "${m.title}" (${id}) — ${episode.snippets.length} snippets, ${episode.sequence.length} cards`);
    }

    if (RENDER) await renderAndWait(id, m.title);
  }
  console.log(`\n${BASE}/editor`);
})().catch(err => { console.error(err.message); process.exit(1); });
