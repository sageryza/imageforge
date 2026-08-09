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
// TWO MODES, because they answer different questions. WORDS (default) is
// keyword: terms ANDed, "quoted phrases", proximity scoring — instant, free,
// exact, and what "darius" needs. MEANING is embeddings: ask for "the part
// where he explains how the heart holds the soul in" and find it without
// knowing a single word of how it was said. See the embeddings section below.
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
//   GET  /?q=&mode=words|meaning&limit=&kind=&offset=
//                         → { hits, total, took, mode, terms, index }
//   GET  /sources         → what is searchable (per library counts)
//   POST /reindex         → rebuild the chunk index (background job)
//   GET  /reindex         → { job } — poll the rebuild
//   POST /embed           → embed every passage for meaning search (~$0.05,
//                           background job); GET /embed reports state+staleness
//   GET  /clip-span?src=&t0=&t1=
//                         → cut an EXACT span to mp3, once, and bank it —
//                           what the shared cut picker's play buttons call
//   GET  /audio/:id       → stream one memo's audio (range-capable)
//   POST /to-editor       → { src, timeSec, text, episodeId?, episodeTitle? }
//                           → a snippet card in the Episode Editor
//   POST /to-cutroom      → { src } → { url } to open in the Cutting Room

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
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

// ─── meaning search ─────────────────────────────────────────────────
// Keyword search answers "who said this word". Meaning search answers "where
// is the part about the heart mechanism" — the question you actually have when
// you remember a thing but not its wording. Every chunk is embedded ONCE with
// text-embedding-3-small; after that, searching costs one tiny embedding call
// for the query (~$0.000002) and a dot product per chunk.
//
// SHORTENED + QUANTIZED, on purpose. 12,905 chunks at the model's native 1536
// dimensions in float32 is a 79MB file — absurd to ship to a 512MB instance on
// every cold start. `dimensions: 512` is the model's own Matryoshka trick
// (it is trained so a truncated vector still works), and quantizing the
// re-normalised floats to int8 divides by four again: 512 dims × 1 byte ×
// 12,905 = ~6.6MB, loaded as one Buffer with no JSON parsing at all. Recall
// loss from int8 on normalised vectors is negligible for ranking.
//
// THE VECTORS ARE KEYED TO THE INDEX BUILD. Chunk N in the vector file must be
// chunk N in the index, so `meta.builtAt` has to match the index's. A reindex
// that changes the chunking leaves the vectors stale, and meaning search says
// so instead of silently returning wrong passages.
const EMBED_MODEL = process.env.SEARCH_EMBED_MODEL || 'text-embedding-3-small';
const EMBED_DIMS = 512;
const EMBED_BATCH = 200;        // ~36k tokens a request, well under the cap
const EMBED_PARALLEL = 4;
const VECTORS_PATH = process.env.SEARCH_VECTORS_PATH || 'search-index/vectors-v1.bin';
const VECTORS_META = process.env.SEARCH_VECTORS_META || 'search-index/vectors-v1.json';

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

// ─── embeddings ─────────────────────────────────────────────────────
let vecCache = null;      // { at, meta, data:Int8Array }
let vecLoading = null;
let embedJob = null;      // { status, label, done, total, at, error }

// Retries transient failures. This is not defensive boilerplate: the first
// real run died on a plain OpenAI 500 at 4,800 of 12,905 chunks and threw away
// every embedding already PAID FOR, because one bad response failed the whole
// job. A 429 or any 5xx is retried with backoff; a 4xx (bad key, bad request)
// is permanent and fails immediately rather than burning four more attempts.
async function embed(inputs, attempt = 1) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) throw new Error('OPENAI_API_KEY is not set — meaning search needs it');
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS }),
    });
  } catch (err) {
    if (attempt >= 5) throw new Error(`embeddings unreachable: ${err.message}`);
    await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
    return embed(inputs, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const transient = res.status === 429 || res.status >= 500;
    if (transient && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
      return embed(inputs, attempt + 1);
    }
    throw new Error(`embeddings ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  // The API may return them out of order; `index` is authoritative.
  const out = new Array(inputs.length);
  for (const d of json.data) out[d.index] = d.embedding;
  return out;
}

// Unit-normalise (a shortened embedding is no longer normalised) then scale to
// int8. Ranking only needs direction, so this is lossless enough and 4x smaller.
function quantize(vec, target, offset) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) {
    const v = Math.round((vec[i] / norm) * 127);
    target[offset + i] = v > 127 ? 127 : v < -127 ? -127 : v;
  }
}

async function buildVectors(progress = () => {}) {
  const index = await loadIndex();
  const n = index.chunks.length;
  const data = new Int8Array(n * EMBED_DIMS);

  // Batches run a few at a time: sequential would take ~10 minutes for 65
  // requests, and flooding them risks a rate limit for no real gain.
  const batches = [];
  for (let i = 0; i < n; i += EMBED_BATCH) batches.push(i);
  let done = 0;
  for (let b = 0; b < batches.length; b += EMBED_PARALLEL) {
    const slice = batches.slice(b, b + EMBED_PARALLEL);
    await Promise.all(slice.map(async (start) => {
      const chunk = index.chunks.slice(start, start + EMBED_BATCH);
      // An empty string is rejected by the API; a space embeds harmlessly.
      const vecs = await embed(chunk.map((c) => c.x.slice(0, 8000) || ' '));
      vecs.forEach((v, k) => quantize(v, data, (start + k) * EMBED_DIMS));
      done += chunk.length;
    }));
    progress(`embedding ${done} of ${n}`);
  }

  const meta = {
    version: 1, model: EMBED_MODEL, dims: EMBED_DIMS, chunks: n,
    builtAt: index.builtAt,               // ties these vectors to that chunking
    embeddedAt: new Date().toISOString(),
  };
  const b = bucket();
  if (b) {
    await b.file(VECTORS_PATH).save(Buffer.from(data.buffer), {
      contentType: 'application/octet-stream',
      metadata: { cacheControl: 'no-cache' }, resumable: false,
    });
    await b.file(VECTORS_META).save(JSON.stringify(meta), {
      contentType: 'application/json',
      metadata: { cacheControl: 'no-cache' }, resumable: false,
    });
  }
  vecCache = { at: Date.now(), meta, data };
  return meta;
}

async function loadVectors() {
  if (vecCache && (Date.now() - vecCache.at) < CACHE_MS) return vecCache;
  if (vecLoading) return vecLoading;
  vecLoading = (async () => {
    const b = bucket();
    if (!b) return null;
    try {
      const [metaBuf] = await b.file(VECTORS_META).download();
      const meta = JSON.parse(metaBuf.toString());
      const [buf] = await b.file(VECTORS_PATH).download();
      const data = new Int8Array(buf.buffer, buf.byteOffset, buf.length);
      vecCache = { at: Date.now(), meta, data };
      return vecCache;
    } catch { return null; }
  })();
  try { return await vecLoading; } finally { vecLoading = null; }
}

// Rank every chunk by cosine similarity to the query. A linear pass over
// ~13k × 512 int8 dot products is a few milliseconds — no ANN index to
// maintain, and no approximation to explain away.
async function searchMeaning(index, q, { limit = 25, offset = 0, kind = '' } = {}) {
  const vectors = await loadVectors();
  if (!vectors) {
    const err = new Error('meaning search needs the passages embedded first');
    err.code = 'no-vectors';
    throw err;
  }
  if (vectors.meta.builtAt !== index.builtAt || vectors.meta.chunks !== index.chunks.length) {
    const err = new Error('the index was rebuilt since these passages were embedded — re-embed to use meaning search');
    err.code = 'stale-vectors';
    throw err;
  }

  const [raw] = await embed([q]);
  const qv = new Float32Array(EMBED_DIMS);
  let norm = 0;
  for (let i = 0; i < EMBED_DIMS; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBED_DIMS; i++) qv[i] = raw[i] / norm;

  const { data } = vectors;
  const scored = [];
  for (let c = 0; c < index.chunks.length; c++) {
    const chunk = index.chunks[c];
    const src = index.sources[chunk.s];
    if (!src) continue;
    if (kind && src.k !== kind) continue;
    let dot = 0;
    const base = c * EMBED_DIMS;
    for (let i = 0; i < EMBED_DIMS; i++) dot += qv[i] * data[base + i];
    scored.push({ c: chunk, src, score: dot / 127 });
  }
  scored.sort((a, b) => b.score - a.score);

  // Similarity is a RANKING, not a set: every chunk gets a score, so without a
  // cut-off "the heart holds the soul" honestly reported 1,080 passages and
  // nonsense still reported 23. Two floors, both measured against real runs on
  // this library (a good query tops out ~0.54 and decays slowly; a nonsense
  // query tops out ~0.31):
  //   · ABSOLUTE — below this nothing is really about the question, so a
  //     nonsense query correctly returns nothing at all.
  //   · RELATIVE — keep only what is close to the best hit, so a strong query
  //     answers with its handful and a vague one doesn't pad itself out.
  const top = scored.length ? scored[0].score : 0;
  const floor = Math.max(0.38, top * 0.85);
  const relevant = scored.filter((s) => s.score >= floor).slice(0, MAX_HITS * 2);
  return finish(relevant, { limit, offset });
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
  return { ...finish(scored, { limit, offset }), terms, phrases };
}

// Turn a scored list into the page of hits both modes return. Shared so
// keyword and meaning results dedupe, cap and describe themselves identically
// — the mode should change what ranks, never what a result IS.
function finish(scored, { limit = 25, offset = 0 } = {}) {
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
    // this server. An interview is webm/opus and one object per whole
    // interview, so its passage is transcoded on demand and cached — see /clip.
    audio: src.k === 'memo' ? `/api/search/audio/${encodeURIComponent(src.id)}` : null,
    clip: src.k === 'nde'
      ? `/api/search/clip?src=${encodeURIComponent(src.id)}&t=${Math.floor(c.t || 0)}`
      : null,
    watch: src.k === 'nde' && src.url
      ? `${src.url}${src.url.includes('?') ? '&' : '?'}t=${Math.max(0, Math.floor(c.t || 0))}`
      : null,
  }));
  return { hits, total };
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
    const opts = {
      limit: Math.min(Number(req.query.limit) || 25, MAX_HITS),
      offset: Math.max(0, Number(req.query.offset) || 0),
      kind: ['nde', 'memo'].includes(String(req.query.kind)) ? String(req.query.kind) : '',
    };
    const mode = String(req.query.mode || 'words') === 'meaning' ? 'meaning' : 'words';
    let out;
    if (mode === 'meaning') {
      try {
        out = await searchMeaning(index, q, opts);
      } catch (err) {
        // A missing or stale vector file is a state the page can act on (offer
        // to embed), not a server error — say which it is.
        if (err.code) return res.status(409).json({ error: err.message, code: err.code });
        throw err;
      }
    } else {
      out = search(index, q, opts);
    }
    res.json({ ...out, mode, took: Date.now() - started, index: index.counts, builtAt: index.builtAt });
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

// Embed every passage so meaning search works. Paid, but once: ~2.3M tokens of
// text-embedding-3-small ≈ $0.05 for the whole library, then every search is
// one tiny query embedding. Background job like everything else slow.
router.post('/embed', async (req, res) => {
  try {
    if (embedJob && embedJob.status === 'running') return res.json({ job: embedJob });
    embedJob = { status: 'running', label: 'starting', at: Date.now(), error: null };
    (async () => {
      try {
        const meta = await buildVectors((label) => { embedJob = { ...embedJob, label }; });
        embedJob = { status: 'done', label: 'ready', at: Date.now(), meta, error: null };
      } catch (err) {
        console.warn('search embed failed:', err.message);
        embedJob = { status: 'failed', label: 'failed', at: Date.now(), error: err.message };
      }
    })();
    res.json({ job: embedJob });
  } catch (err) { fail(res, err); }
});

router.get('/embed', async (req, res) => {
  try {
    const v = await loadVectors();
    const index = cache ? cache.index : null;
    res.json({
      job: embedJob,
      embedded: !!v,
      meta: v ? v.meta : null,
      // Stale = the index was rebuilt after these vectors were made, so chunk
      // N no longer means the same passage.
      stale: !!(v && index && (v.meta.builtAt !== index.builtAt || v.meta.chunks !== index.chunks.length)),
    });
  } catch (err) { fail(res, err); }
});

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

// ─── exact spans, for the shared cut picker ─────────────────────────
// GET /clip-span?src=&t0=&t1= — cut EXACTLY [t0, t1] of a source to mp3,
// once, and bank it. This is what makes a pick on a Compare-page cut picker
// (public/picker.js) playable the moment she makes it, instead of waiting for
// a chat to wake up and render — the whole pain the four cutting chats shared
// (Aug 2026). Same background-job + immutable-cache pattern as /clip above;
// same transcoder (editor.extractWindow) underneath.
//
// `src` is either an indexed interview id (resolved through the search index,
// like /clip) or a full https URL — but URLs are restricted to this app's own
// Storage hosts. This route runs ffmpeg against whatever it is handed, so an
// open "fetch any URL" would let anyone burn the instance's CPU on arbitrary
// files; every audio source a picker legitimately plays already lives in
// Storage.
const SPAN_MAX_SEC = 180;      // a pick is a passage, not a download service
const spanOkUrl = (u) => {
  try {
    const p = new URL(u);
    return p.protocol === 'https:' &&
      (p.hostname === 'storage.googleapis.com' ||
       p.hostname === 'firebasestorage.googleapis.com' ||
       p.hostname.endsWith('.firebasestorage.app'));
  } catch (_) { return false; }
};

router.get('/clip-span', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const src = String(req.query.src || '');
    // hundredth-of-a-second grid so equal asks share one cache object
    const t0 = Math.max(0, Math.round((Number(req.query.t0) || 0) * 100) / 100);
    const t1 = Math.round((Number(req.query.t1) || 0) * 100) / 100;
    if (!src) return res.status(400).json({ error: 'src required' });
    if (!(t1 > t0)) return res.status(400).json({ error: 't1 must be after t0' });
    if (t1 - t0 > SPAN_MAX_SEC) return res.status(400).json({ error: `span is capped at ${SPAN_MAX_SEC}s` });

    let url = src;
    if (!/^https?:\/\//.test(src)) {
      const index = await loadIndex();
      const source = index.sources[`v:${src}`];
      if (!source) return res.status(404).json({ error: 'that recording is not in the index' });
      url = source.audioUrl;
    } else if (!spanOkUrl(src)) {
      return res.status(400).json({ error: 'src must be a Storage url or an indexed recording id' });
    }

    const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
    const dest = `${CLIP_PREFIX}span-${key}-${Math.round(t0 * 100)}-${Math.round(t1 * 100)}.mp3`;
    const b = bucket();
    if (!b) return res.status(503).json({ error: 'Storage unavailable' });
    const [exists] = await b.file(dest).exists();
    if (exists) return res.json({ status: 'ready', url: publicUrl(dest) });

    const state = clipJobs.get(dest);
    if (state && state.error) { clipJobs.delete(dest); return res.json({ status: 'failed', error: state.error }); }
    if (state) return res.json({ status: 'making' });

    clipJobs.set(dest, 'making');
    (async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'span-clip-'));
      const out = path.join(dir, 'clip.mp3');
      try {
        await editor.extractWindow(url, t0, t1 - t0, out, { log: [], dir, downloads: new Map() });
        await editor.uploadPublic(out, dest, 'audio/mpeg', 'public, max-age=31536000, immutable');
        clipJobs.delete(dest);
      } catch (err) {
        console.warn('span clip failed:', err.message);
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
module.exports = {
  router, loadIndex, buildIndex, search, parseQuery, normalize, splitChars,
  // meaning search — exported so a script can embed the library offline
  buildVectors, loadVectors, searchMeaning,
};
