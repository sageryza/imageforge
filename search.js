// search.js — Search: one search across BOTH transcript libraries, with the
// hand-offs that turn a hit into work.
//
// The problem it solves: there are two big bodies of transcribed speech in
// this app and nothing could search either of them. 77 interview transcripts
// in `forge-nde-videos` (~3.5M characters — the Anthony Chene NDE interviews
// plus Sophie's own ingested videos) and 1,100+ voice memos in the membry
// archive (~2.2M characters). The Cutting Room can only search inside ONE
// recording she has already opened; the Episode Editor shows a ±150s window
// around a snippet she already knows about. So finding "the part where Darius
// explains the heart mechanism" meant remembering which video it was in.
//
// Results are PASSAGES, not files. Every hit is a ~30-second window of
// transcript with its timestamp, whose recording it is, and audio — because a
// filename is not an answer to "where did he say that".
//
// THE HAND-OFFS ARE THE POINT. A search that only lists things is a worse
// version of scrolling. Each hit goes straight to the tool that owns that kind
// of audio:
//   interview hit → Episode Editor (editor.addExternalSnippet — the snippet
//                   card lands in an episode and the editor re-cuts it
//                   natively through its own validated cutter)
//   memo hit      → Cutting Room (POST /api/cutroom/open with the recording's
//                   url — she marks it on its own transcript from there)
// Nothing here cuts audio itself. Both hand-offs feed the ONE cutting
// implementation in editor.js, exactly like cuttingroom.js does.
//
// THE INDEX. Firestore holds the interview transcripts as ~97,000 segments
// across 77 docs; reading and chunking that on every query would make search
// unusable. So it is built once into a flat chunk list at Storage
// `search-index/index-v1.json` and cached in process. `POST /reindex` rebuilds
// it as a background job (house rule — nothing slow blocks a request), and a
// missing index builds itself on first use. A rebuild is free: it reads
// Firestore + the manifest and spends nothing on any paid API.
//
// KEYWORD SEARCH ONLY, ON PURPOSE (v1). Terms are ANDed, phrases can be
// quoted, and scoring favours proximity — instant, costs nothing, and it is
// what "search Darius" needs. MEANING search (ask for "the part about the
// heart mechanism" without knowing the words) is the planned phase 2: embed
// each chunk once with text-embedding-3-small (~5.7M chars ≈ 1.4M tokens ≈
// $0.03, then free forever) and store the vectors beside the chunks. The
// chunk list is deliberately shaped for that — every chunk already carries a
// stable `i`, so vectors can be a parallel array added later without
// reshaping anything or re-cutting a single clip.
//
// MEMO AUDIO IS PROXIED, AND THAT WIDENS AN EXISTING RESTRICTION. Storage
// `memo-audio/**` is readable only by a signed-in Firebase user, so memo audio
// can only reach a page through this server. `/api/memos/audio/:id`
// deliberately serves ONLY recordings categorised `dream`, to keep the other
// ~940 private ones locked down. Playing a hit is the core of a search result,
// so `GET /api/search/audio/:id` here serves ANY memo — behind the same
// STUDIO_TOKEN gate as every other route in this module. That is a real
// widening of what the server will hand out and it was flagged to Sophie, not
// slipped in.
//
// Routes (mounted at /api/search, STUDIO_TOKEN gate, only /status open):
//   GET  /status          → { ok, firebase, index:{built, chunks, …} }
//   GET  /?q=&limit=&kind=&offset=
//                         → { hits, total, took, terms, index }
//   GET  /sources         → what is searchable (per library counts)
//   POST /reindex         → rebuild the chunk index (background job)
//   GET  /reindex         → { job } — poll the rebuild
//   GET  /audio/:id       → stream one memo's audio (range-capable)
//   POST /to-editor       → { src, timeSec, text, episodeId?, episodeTitle? }
//                           → a snippet card in the Episode Editor
//   POST /to-cutroom      → { src } → { url } to open in the Cutting Room

const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');

const editor = require('./editor');
const memos = require('./memos');

const NDE_COLLECTION = process.env.NDE_COLLECTION || 'forge-nde-videos';
const INDEX_PATH = process.env.SEARCH_INDEX_PATH || 'search-index/index-v1.json';
// Where the playable copies of interview passages live (see /clip below).
const CLIP_PREFIX = process.env.SEARCH_CLIP_PREFIX || 'search-clips/';
// A chunk is about a spoken paragraph: long enough that a hit reads as a
// thought rather than a fragment, short enough that its timestamp still points
// at the right moment.
//
// Chunks OVERLAP by design. Terms are ANDed, so two words spoken in one breath
// but landing either side of a chunk boundary would find nothing at all —
// which really happened: "darius pyramids" missed the memo that says "Darius
// is like oh this is a whole thing and then he describes how the pyramids are
// like a chamber", because a 700-character cut fell between the two words.
// Each window therefore starts one STEP along but runs a full SPAN, so every
// pair of nearby words sits inside at least one window. `dedupe` below drops
// the near-duplicate hits that overlap necessarily creates.
const CHUNK_SEC = 30;          // step between window starts
const CHUNK_SPAN_SEC = 48;     // how much speech each window holds
const MEMO_CHUNK_CHARS = 700;
const MEMO_CHUNK_STEP = 460;
const MAX_HITS = 60;
// Re-read the index off Storage this often; a rebuild clears it immediately.
const CACHE_MS = 15 * 60 * 1000;

function db() { return admin.apps.length ? admin.firestore() : null; }
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  console.warn('search:', err.message);
  res.status(500).json({ error: err.message });
}

// ─── text ───────────────────────────────────────────────────────────
// One normalisation used by BOTH the index and the query, or a search for
// "Darius's" would miss "Darius". Apostrophes are dropped rather than split on
// (so "don't" is one token, matching how whisper writes it).
const normalize = (s) => String(s || '')
  .toLowerCase()
  .replace(/[‘’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Split a query into terms, keeping "quoted phrases" whole.
function parseQuery(q) {
  const terms = [];
  const phrases = [];
  const raw = String(q || '');
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(raw))) {
    if (m[1]) {
      const p = normalize(m[1]);
      if (p) { phrases.push(p); p.split(' ').forEach((t) => terms.push(t)); }
    } else {
      const t = normalize(m[2]);
      if (t) t.split(' ').forEach((x) => x && terms.push(x));
    }
  }
  // Duplicates would double-count a term's score for no reason.
  return { terms: [...new Set(terms)], phrases };
}

// ─── index ──────────────────────────────────────────────────────────
// The index is two flat arrays so the JSON stays compact over ~10k chunks:
//   sources: { [key]: { k, id, title, who, date, audioUrl, seconds } }
//   chunks:  [ { i, s:<source key>, t:<start seconds|null>, x:<text> } ]
// Chunk text is stored ONCE and never duplicated into per-source copies.
let cache = null;          // { at, index }
let building = null;       // in-flight build promise
let job = null;            // { status, label, at, error }

function ndeChunks(doc, sourceKey, out) {
  const segs = ((doc.transcript && doc.transcript.segments) || [])
    .filter((s) => String(s.text || '').trim());
  if (!segs.length) {
    // A doc with `full` but no timed segments (a few older records) is still
    // worth finding — it just can't offer a timestamp.
    const full = (doc.transcript && doc.transcript.full) || '';
    for (const x of splitChars(full)) out.push({ s: sourceKey, t: null, x });
    return;
  }
  // Sliding window: a new one starts every CHUNK_SEC, each holding
  // CHUNK_SPAN_SEC of speech, so consecutive windows overlap.
  let i = 0;
  let nextStart = Number(segs[0].start) || 0;
  while (i < segs.length) {
    const start = Number(segs[i].start) || 0;
    const parts = [];
    let j = i;
    while (j < segs.length && ((Number(segs[j].start) || 0) - start) < CHUNK_SPAN_SEC) {
      parts.push(String(segs[j].text || '').trim());
      j++;
    }
    out.push({ s: sourceKey, t: Math.round(start * 10) / 10, x: parts.join(' ') });
    if (j >= segs.length) break;
    // Advance to the first segment at or past the next step boundary.
    nextStart = start + CHUNK_SEC;
    let k = i + 1;
    while (k < segs.length && (Number(segs[k].start) || 0) < nextStart) k++;
    i = k;
  }
}

// Split a long untimed transcript into OVERLAPPING windows, cutting on
// sentence ends where possible and word boundaries otherwise, so a window
// never starts mid-word.
function splitChars(text, size = MEMO_CHUNK_CHARS, step = MEMO_CHUNK_STEP) {
  const s = String(text || '').trim();
  if (!s) return [];
  if (s.length <= size) return [s];
  const out = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + size, s.length);
    if (end < s.length) {
      const window = s.slice(i, end + 200);
      const sentence = window.lastIndexOf('. ');
      const space = window.lastIndexOf(' ');
      const cut = sentence > size * 0.5 ? sentence + 1 : (space > size * 0.5 ? space : -1);
      if (cut > 0) end = i + cut;
    }
    const piece = s.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end >= s.length) break;
    // Step forward less than a full window, and always land on a word start.
    let next = i + step;
    if (next <= i) next = end;
    const sp = s.indexOf(' ', next);
    i = sp > 0 && sp < end ? sp + 1 : end;
  }
  return out;
}

async function buildIndex(progress = () => {}) {
  const sources = {};
  const chunks = [];

  progress('reading the interviews');
  const d = db();
  if (d) {
    const snap = await d.collection(NDE_COLLECTION).get();
    snap.docs.forEach((s) => {
      const doc = s.data() || {};
      const key = `v:${s.id}`;
      const title = doc.title || doc.experiencerName || s.id;
      sources[key] = {
        k: 'nde',
        id: s.id,
        title,
        who: doc.experiencerName || doc.channelTitle || '',
        date: (doc.publishedAt || doc.createdAt || '').slice(0, 10) || null,
        audioUrl: doc.audioUrl || editor.defaultAudioUrl(s.id),
        url: doc.url || null,
      };
      ndeChunks(doc, key, chunks);
    });
  }

  progress('reading the voice memos');
  try {
    const { manifest } = await memos.readManifest();
    (manifest.memos || []).forEach((m) => {
      if (!m.transcript) return;
      const key = `m:${m.id}`;
      sources[key] = {
        k: 'memo',
        id: m.id,
        title: m.title || m.date || m.id,
        who: m.cat || '',
        date: m.date || null,
        seconds: m.dur || null,
        desc: m.desc || '',
        audioUrl: null, // proxied — memo bytes are not public (see header)
      };
      for (const x of splitChars(m.transcript, MEMO_CHUNK_CHARS)) chunks.push({ s: key, t: null, x });
    });
  } catch (err) {
    // The membry credential may be absent (local dev). Interviews still index.
    console.warn('search: memo archive unavailable —', err.message);
  }

  chunks.forEach((c, i) => { c.i = i; });
  const index = {
    version: 1,
    builtAt: new Date().toISOString(),
    counts: {
      chunks: chunks.length,
      sources: Object.keys(sources).length,
      nde: Object.values(sources).filter((s) => s.k === 'nde').length,
      memo: Object.values(sources).filter((s) => s.k === 'memo').length,
      chars: chunks.reduce((n, c) => n + c.x.length, 0),
    },
    sources,
    chunks,
  };

  progress('saving the index');
  const b = bucket();
  if (b) {
    await b.file(INDEX_PATH).save(JSON.stringify(index), {
      contentType: 'application/json',
      metadata: { cacheControl: 'no-cache' },
      resumable: false,
    });
  }
  cache = { at: Date.now(), index };
  return index;
}

async function loadIndex({ force = false } = {}) {
  if (!force && cache && (Date.now() - cache.at) < CACHE_MS) return cache.index;
  if (building) return building;
  building = (async () => {
    const b = bucket();
    if (b) {
      try {
        const [buf] = await b.file(INDEX_PATH).download();
        const index = JSON.parse(buf.toString());
        if (index && Array.isArray(index.chunks)) {
          cache = { at: Date.now(), index };
          return index;
        }
      } catch { /* not built yet — fall through and build it */ }
    }
    return buildIndex();
  })();
  try { return await building; } finally { building = null; }
}

// ─── scoring ────────────────────────────────────────────────────────
// Count word-boundary occurrences of one term. A prefix match counts at a
// discount, so "explain" finds "explains" without the caller stemming
// anything by hand, and "art" still never hits inside "heart".
function countTerm(norm, term) {
  let count = 0;
  let at = -1;
  let from = 0;
  for (;;) {
    const i = norm.indexOf(term, from);
    if (i < 0) break;
    const before = i === 0 ? ' ' : norm[i - 1];
    const after = norm[i + term.length] === undefined ? ' ' : norm[i + term.length];
    if (before === ' ') {
      const whole = after === ' ';
      count += whole ? 1 : 0.4;
      if (at < 0) at = i;
    }
    from = i + term.length;
  }
  return { count, at };
}

// Every chunk is normalised once per query rather than per term, and the whole
// sweep is a linear scan over ~11k chunks — single-digit milliseconds, so
// there is no inverted index to keep in step with the data.
//
// `titleNorm` is the recording's own title/speaker, and a term is allowed to
// match THERE instead of in the words. Without it "darius pyramids" finds
// nothing in the one interview that is entirely about Darius, because
// YouTube's auto-caption mis-hears his name in the first sentence ("my name is
// sh right") and he is never named again. A title match scores well below a
// spoken one and is left out of the proximity test, so real speech always
// ranks first.
function scoreChunk(norm, titleNorm, terms, phrases) {
  let score = 0;
  const positions = [];
  for (const term of terms) {
    const { count, at } = countTerm(norm, term);
    if (!count) {
      if (!countTerm(titleNorm, term).count) return null; // every term must appear — AND, not OR
      score += 0.6;
      continue;
    }
    score += 1 + Math.log(count);
    positions.push(at);
  }
  // Proximity: terms sitting in one sentence beat the same terms scattered
  // across a whole paragraph.
  if (positions.length > 1) {
    const spread = Math.max(...positions) - Math.min(...positions);
    if (spread < 120) score += 2.5;
    else if (spread < 300) score += 1;
  }
  for (const p of phrases) if (norm.includes(p)) score += 4;
  return score;
}

function search(index, q, { limit = 25, offset = 0, kind = '' } = {}) {
  const { terms, phrases } = parseQuery(q);
  if (!terms.length) return { hits: [], total: 0, terms, phrases };

  // Normalised text is memoised onto the in-memory index (never into the
  // stored file, which would double its size): the first query pays for it,
  // every later one is a plain scan.
  const titleNorm = new Map();
  const scored = [];
  for (const c of index.chunks) {
    const src = index.sources[c.s];
    if (!src) continue;
    if (kind && src.k !== kind) continue;
    if (c._n === undefined) c._n = normalize(c.x);
    if (!titleNorm.has(c.s)) titleNorm.set(c.s, normalize(`${src.title} ${src.who || ''}`));
    const score = scoreChunk(c._n, titleNorm.get(c.s), terms, phrases);
    if (score === null) continue;
    scored.push({ c, src, score });
  }
  scored.sort((a, b) => b.score - a.score || (a.c.i - b.c.i));

  // Windows OVERLAP (see the chunk constants), so the same moment can score
  // twice. Highest score wins and its neighbour is dropped: an interview hit
  // by how close their timestamps are, a memo hit by chunk adjacency (it has
  // no clock). Without this every result would arrive as a near-identical
  // pair.
  const taken = new Map();
  const unique = [];
  for (const s of scored) {
    const list = taken.get(s.c.s) || [];
    const dup = list.some((prev) => (s.c.t !== null && prev.t !== null)
      ? Math.abs(s.c.t - prev.t) < CHUNK_SPAN_SEC * 0.75
      : Math.abs(s.c.i - prev.i) <= 1);
    if (dup) continue;
    list.push(s.c);
    taken.set(s.c.s, list);
    unique.push(s);
  }

  // One recording shouldn't fill the page with its every mention — keep its
  // best few and say how many more it has.
  const perSource = new Map();
  const kept = [];
  for (const s of unique) {
    const n = perSource.get(s.c.s) || 0;
    perSource.set(s.c.s, n + 1);
    if (n < 3) kept.push(s);
  }
  const total = kept.length;
  const page = kept.slice(offset, offset + Math.min(limit, MAX_HITS));

  const hits = page.map(({ c, src, score }) => ({
    id: c.i,
    kind: src.k,
    source: src.id,
    title: src.title,
    who: src.who || null,
    date: src.date || null,
    timeSec: c.t,
    text: c.x,
    score: Math.round(score * 100) / 100,
    more: Math.max(0, (perSource.get(c.s) || 1) - 3),
    // Where the audio comes from. A memo is m4a and streams straight through
    // this server. An interview is webm/opus, which iOS cannot play at all, so
    // its passage is transcoded on demand and cached — see /clip.
    audio: src.k === 'memo' ? `/api/search/audio/${encodeURIComponent(src.id)}` : null,
    clip: src.k === 'nde'
      ? `/api/search/clip?src=${encodeURIComponent(src.id)}&t=${Math.floor(c.t || 0)}`
      : null,
    watch: src.k === 'nde' && src.url
      ? `${src.url}${src.url.includes('?') ? '&' : '?'}t=${Math.max(0, Math.floor(c.t || 0))}`
      : null,
  }));
  return { hits, total, terms, phrases };
}

// ─── router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    firebase: admin.apps.length > 0,
    index: cache ? { built: true, ...cache.index.counts, builtAt: cache.index.builtAt } : { built: false },
    job,
  });
});

router.get('/sources', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const index = await loadIndex();
    const list = Object.values(index.sources).map((s) => ({
      kind: s.k, id: s.id, title: s.title, who: s.who || null, date: s.date || null,
    }));
    res.json({ counts: index.counts, builtAt: index.builtAt, sources: list });
  } catch (err) { fail(res, err); }
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ hits: [], total: 0, terms: [] });
    const started = Date.now();
    const index = await loadIndex();
    const out = search(index, q, {
      limit: Math.min(Number(req.query.limit) || 25, MAX_HITS),
      offset: Math.max(0, Number(req.query.offset) || 0),
      kind: ['nde', 'memo'].includes(String(req.query.kind)) ? String(req.query.kind) : '',
    });
    res.json({ ...out, took: Date.now() - started, index: index.counts, builtAt: index.builtAt });
  } catch (err) { fail(res, err); }
});

router.post('/reindex', async (req, res) => {
  try {
    if (job && job.status === 'running') return res.json({ job });
    job = { status: 'running', label: 'starting', at: Date.now(), error: null };
    // Background job (house rule): answer now, rebuild behind it.
    (async () => {
      try {
        const index = await buildIndex((label) => { job = { ...job, label }; });
        job = { status: 'done', label: 'ready', at: Date.now(), counts: index.counts, error: null };
      } catch (err) {
        console.warn('search reindex failed:', err.message);
        job = { status: 'failed', label: 'failed', at: Date.now(), error: err.message };
      }
    })();
    res.json({ job });
  } catch (err) { fail(res, err); }
});

router.get('/reindex', (req, res) => res.json({ job }));

// ─── playable interview passages ────────────────────────────────────
// The banked interview audio is what yt-dlp downloaded: WEBM/OPUS, and a
// whole interview in one object (the Darius one is 62MB). A hit's Play button
// therefore does NOT point at it. It asks the server to cut that passage to
// mp3, once, through editor.extractWindow (ffmpeg seeking over HTTP — it never
// pulls the whole file), and banks the result the way the editor's clip cache
// does. Two reasons, one measured and one platform:
//   · SIZE — a 56s passage is ~800KB of mp3 against a 62MB source. On a phone
//     that is the difference between a tap that plays and a tap that doesn't.
//   · FORMAT — iOS Safari (which is the whole app) does not support WebM audio;
//     Opus only plays there inside CAF. mp3 plays everywhere.
// The format half is a known platform limitation, NOT something verified here:
// a chat's sandbox has no browser network access to Storage, so in-browser
// playback of either format is untestable from here. The size half alone
// justifies the transcode, so this is the safe design either way.
//
// Voice memos need none of this: they are m4a, which iOS plays natively, and
// they are minutes long rather than an hour — so they stream straight through
// /audio/:id below.
const clipJobs = new Map();   // storagePath → 'making' | { error }

const clipPath = (videoId, start) =>
  `${CLIP_PREFIX}${String(videoId).replace(/[^\w.-]/g, '_')}-${Math.floor(start)}.mp3`;
const publicUrl = (p) => {
  const b = bucket();
  return `https://storage.googleapis.com/${b ? b.name : 'deckfactory-43176.firebasestorage.app'}/${p}`;
};

router.get('/clip', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const src = String(req.query.src || '');
    const t = Math.max(0, Math.floor(Number(req.query.t) || 0));
    const index = await loadIndex();
    const source = index.sources[`v:${src}`];
    if (!source) return res.status(404).json({ error: 'that interview is not in the index' });

    const dest = clipPath(src, t);
    const b = bucket();
    if (!b) return res.status(503).json({ error: 'Storage unavailable' });
    const [exists] = await b.file(dest).exists();
    if (exists) return res.json({ status: 'ready', url: publicUrl(dest) });

    const state = clipJobs.get(dest);
    if (state && state.error) { clipJobs.delete(dest); return res.json({ status: 'failed', error: state.error }); }
    if (state) return res.json({ status: 'making' });

    clipJobs.set(dest, 'making');
    // Background job (house rule): answer now, cut behind it, page polls.
    (async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-clip-'));
      const out = path.join(dir, 'clip.mp3');
      try {
        // Start a beat early so the passage's first word isn't clipped, and
        // run a little past the window so it doesn't end mid-sentence.
        const start = Math.max(0, t - 2);
        // extractWindow seeks over HTTP first and falls back to downloading
        // the source — that fallback needs a real ctx (`dir` + a `downloads`
        // Map), not just a log array, or it dies on `ctx.downloads.has`.
        await editor.extractWindow(source.audioUrl, start, CHUNK_SPAN_SEC + 8, out,
          { log: [], dir, downloads: new Map() });
        await editor.uploadPublic(out, dest, 'audio/mpeg', 'public, max-age=31536000, immutable');
        clipJobs.delete(dest);
      } catch (err) {
        console.warn('search clip failed:', err.message);
        clipJobs.set(dest, { error: err.message });
      } finally {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      }
    })();
    res.json({ status: 'making' });
  } catch (err) { fail(res, err); }
});

// One memo's audio. See the header — this serves ANY category, unlike
// /api/memos/audio/:id which is dream-only; both sit behind the studio gate.
router.get('/audio/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^[\w.\-:]{4,140}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    await memos.streamMemoAudio(id, req, res);
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message });
  }
});

// An interview passage → a snippet card in the Episode Editor. The editor
// re-cuts it natively (its own word-timestamp pipeline + clip cache), so no
// audio is cut here.
router.post('/to-editor', async (req, res) => {
  try {
    const src = String(req.body.src || '');
    const text = String(req.body.text || '').trim();
    if (!src || !text) return res.status(400).json({ error: 'src and text are required' });
    const index = await loadIndex();
    const source = index.sources[`v:${src}`];
    if (!source) return res.status(404).json({ error: 'that interview is not in the index' });
    const out = await editor.addExternalSnippet({
      episodeId: req.body.episodeId || null,
      episodeTitle: req.body.episodeTitle || 'From Search',
      name: String(req.body.name || '').trim() || undefined,
      videoId: src,
      audioUrl: source.audioUrl,
      text,
      timeSec: Number(req.body.timeSec) || 0,
      experiencer: source.who || source.title,
    });
    res.json({ ok: true, ...out });
  } catch (err) { fail(res, err); }
});

// A memo → the Cutting Room. It opens a recording BY URL, and memo bytes are
// not public, so the url handed back is this module's own gated proxy.
router.post('/to-cutroom', async (req, res) => {
  try {
    const src = String(req.body.src || '');
    const index = await loadIndex();
    const source = index.sources[`m:${src}`];
    if (!source) return res.status(404).json({ error: 'that recording is not in the index' });
    const base = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '')
      || `${req.protocol}://${req.get('host')}`;
    const token = process.env.STUDIO_TOKEN || '';
    const url = `${base}/api/search/audio/${encodeURIComponent(src)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    res.json({ ok: true, url, name: source.title });
  } catch (err) { fail(res, err); }
});

// Exported so a chat (or a script) can search the libraries without the HTTP
// hop, and so tests can build an index from fixtures.
module.exports = { router, loadIndex, buildIndex, search, parseQuery, normalize, splitChars };
