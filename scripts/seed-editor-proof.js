// seed-editor-proof.js — create the "PROOF" episode in the Episode Editor from
// the veridical-NDE candidate set, so the editor opens on a real, working
// episode instead of an empty page.
//
// Sources  = the 12 verified veridical moments (videoId + experiencer + timeSec
//            + the interview audio URL).
// Snippets = each of those 12 story quotes, named by experiencer, PLUS the
//            "Pajamas hook" (the 17-year-old walking out at 2am to check the
//            license plate) that opens the episode.
// Sequence = hook · title narration · the 12 stories in the v4 order, each with
//            its PROOF-v4 narration fill in front of it, Chene last.
//
// Usage:
//   node scripts/seed-editor-proof.js                       # against the live app
//   node scripts/seed-editor-proof.js --base http://localhost:8099
//   node scripts/seed-editor-proof.js --candidates ~/veridical-order.json
// Set STUDIO_TOKEN if the server is gated. Idempotent-ish: pass --replace to
// delete any existing episode with the same title first.

const fs = require('fs');
const fetch = require('node-fetch');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const BASE = (arg('base', 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');
const CANDIDATES = arg('candidates', `${process.env.HOME}/veridical-order.json`);
const TITLE = arg('title', 'PROOF');
const REPLACE = process.argv.includes('--replace');

const H = { 'content-type': 'application/json' };
if (process.env.STUDIO_TOKEN) H['x-studio-token'] = process.env.STUDIO_TOKEN;

async function api(path, opts = {}) {
  const res = await fetch(BASE + '/api/editor' + path, { headers: H, ...opts });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { throw new Error(`${res.status}: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Snippet names, in the candidate file's order (= the v4 running order).
const NAMES = [
  'License plate — the parked cars',
  'Penny — Kleenex story',
  'Darius — Moroccan tents',
  'Hensley — the little notebook',
  'Tricia — the candy bar',
  'Landon — the red pin',
  'Malcolm — word for word',
  'Nancy — cheap perfume',
  'Pegi — how else would I have known',
  'Peter — not your time',
  'Treadmill — dad and Stephen',
  'Chene — why he started',
];

// The narration fills from PROOF v4, keyed by the clip they introduce.
// Clips with no entry here (license plate, Malcolm, Peter) run with no fill.
const FILLS = {
  1: 'From inside her coma, Penny had been watching her family in the waiting room.',
  2: 'Darius had drifted into a friend’s house without his body.',
  3: 'The man who found her body came to her hospital room.',
  4: 'While surgeons revived her, Tricia drifted down the hall.',
  5: 'Landon flatlined in an ambulance, watching from above.',
  7: 'On the other side, Nancy noticed cheap perfume and cigarette smoke. Later, she asked her sister.',
  8: 'Pegi’s doctor said she was fine. Heaven disagreed.',
  10: 'His sister left her body too, and watched their dad on the treadmill.',
  11: 'And the man who filmed every one of these interviews. This is why he started.',
};

// The opening hook — wording taken verbatim from the yByEQfaD314 transcript.
const HOOK = {
  id: 'snhook',
  name: 'Pajamas hook',
  videoId: 'yByEQfaD314',
  timeSec: 588.9,
  text: 'then here you had the 17year-old in his pajamas walking at 2:00 a.m. in the morning, '
      + 'you know, to go verify, you know, the cars. And when I arrived, it was exactly the same '
      + 'cars and exactly the same license plate',
};
const OPENER = 'Everyone in this video came back from the edge of death. With proof.';

(async () => {
  const cands = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));
  if (!Array.isArray(cands) || cands.length !== 12) {
    console.warn(`note: expected 12 candidates, found ${cands.length}`);
  }

  if (REPLACE) {
    const { episodes } = await api('/');
    for (const e of episodes.filter(e => e.title === TITLE)) {
      await api('/' + e.id, { method: 'DELETE' });
      console.log(`deleted existing "${TITLE}" (${e.id})`);
    }
  }

  const sources = cands.map(c => ({
    videoId: c.videoId,
    experiencer: c.experiencer,
    timeSec: c.timeSec,
    audioUrl: c.audioUrl,
  }));

  const snippets = [HOOK, ...cands.map((c, i) => ({
    id: 'sn' + String(i).padStart(2, '0'),
    name: NAMES[i] || c.experiencer,
    videoId: c.videoId,
    timeSec: c.timeSec,
    text: c.quote,
  }))];

  const sequence = [
    { type: 'clip', snippetId: HOOK.id },
    { type: 'narration', text: OPENER },
  ];
  cands.forEach((c, i) => {
    if (FILLS[i]) sequence.push({ type: 'narration', text: FILLS[i] });
    sequence.push({ type: 'clip', snippetId: 'sn' + String(i).padStart(2, '0') });
  });

  const { episode } = await api('/', {
    method: 'POST',
    body: JSON.stringify({ title: TITLE, sources, snippets, sequence }),
  });
  console.log(`Created "${episode.title}" — ${episode.id}`);
  console.log(`  ${episode.sources.length} sources · ${episode.snippets.length} snippets · ${episode.sequence.length} cards`);
  console.log(`  ${BASE}/editor`);
})().catch(err => { console.error(err.message); process.exit(1); });
