// nde.js — Anthony Chene NDE-interview pipeline.
//
// A database of specific, illustratable moments extracted from Anthony Chene's
// near-death-experience YouTube interviews. For each interview:
//   1. discover it from the channel (YouTube Data API, YOUTUBE_API_KEY),
//   2. fetch the transcript (captions via YouTube's timedtext endpoint —
//      scraped from the watch page, no key),
//   3. read the whole transcript into an LLM (OpenAI gpt-4o-mini),
//   4. extract 3-5 UNIQUE, visually illustratable moments — deliberately
//      skipping the well-worn NDE tropes (tunnel, bright light, overwhelming
//      love) unless the experiencer added a specific twist.
//
// Later, an illustrated anthology gets built from those moments.
//
// Storage: Firestore collection `forge-nde-videos`, one doc per video keyed by
// videoId, holding the transcript + moments + status. Bulk processing is done
// by scripts/nde-batch.js which reuses the helpers exported here.
//
// Router (mounted at /api/nde by server.js, STUDIO_TOKEN gate — only /status
// open):
//   GET  /status                 — connectivity report
//   GET  /videos                 — list processed videos (newest first)
//   GET  /videos/:videoId        — full record (transcript + moments)
//   GET  /moments                — all extracted moments (across videos)
//   POST /videos                 — { videoIdOrUrl } — fetch + extract one
//   POST /videos/:videoId/extract — re-run extraction on an already-fetched video
//   POST /discover               — { handle?, channelId?, max? } — list Anthony
//                                  Chene videos WITHOUT fetching them
//
// STUDIO_TOKEN-gated like the rest of the pipeline (only GET /status is open).

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const COLLECTION = process.env.NDE_COLLECTION || 'forge-nde-videos';
// Anthony Chene's channel handle — configurable so a batch can target a
// different NDE channel later without a code change. The handle resolves to
// a channel ID via the YouTube Data API on first use (cached in memory).
const DEFAULT_CHANNEL_HANDLE = process.env.NDE_CHANNEL_HANDLE || 'anthonychene';

const memStore = new Map();

function firestore() { return admin.apps.length ? admin.firestore() : null; }
function plain(obj) { return JSON.parse(JSON.stringify(obj)); }

// ─── Firestore helpers ──────────────────────────────────────────────

async function saveVideo(video) {
  video.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(video.videoId).set(plain(video), { merge: true });
  else memStore.set(video.videoId, plain(video));
  return video;
}

async function getVideo(videoId) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(videoId).get();
    return snap.exists ? snap.data() : null;
  }
  return memStore.get(videoId) || null;
}

async function listVideos(limit = 200) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(limit).get();
    return snap.docs.map(d => d.data());
  }
  return [...memStore.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

// ─── YouTube discovery ──────────────────────────────────────────────

// Pull a videoId out of any YouTube URL shape, or accept a raw 11-char id.
function parseVideoId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function youtubeAPI(path, params) {
  if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not set');
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  url.searchParams.set('key', YOUTUBE_API_KEY);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  return data;
}

const _channelIdCache = new Map();
async function resolveChannelId(handleOrId) {
  const raw = String(handleOrId || '').trim().replace(/^@/, '');
  if (/^UC[A-Za-z0-9_-]{22}$/.test(raw)) return raw; // already a channel id
  if (_channelIdCache.has(raw)) return _channelIdCache.get(raw);
  const data = await youtubeAPI('channels', { part: 'id', forHandle: raw });
  const id = data.items?.[0]?.id;
  if (!id) throw new Error(`could not resolve channel handle "${handleOrId}"`);
  _channelIdCache.set(raw, id);
  return id;
}

// Resolve the channel's "uploads" playlist id — the only reliable way to
// enumerate ALL of a channel's videos with the Data API (search.list caps
// results and drops older videos).
async function resolveUploadsPlaylistId(channelId) {
  const data = await youtubeAPI('channels', { part: 'contentDetails', id: channelId });
  const id = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`channel ${channelId} has no uploads playlist`);
  return id;
}

// List every uploaded video on a channel (newest first), up to `max`.
// Returns [{ videoId, title, publishedAt, description }, ...].
async function listChannelVideos({ handle, channelId, max = 200 } = {}) {
  const chan = channelId || await resolveChannelId(handle || DEFAULT_CHANNEL_HANDLE);
  const playlistId = await resolveUploadsPlaylistId(chan);
  const out = [];
  let pageToken;
  do {
    const data = await youtubeAPI('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
    });
    for (const item of data.items || []) {
      out.push({
        videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
        title: item.snippet?.title || '',
        publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || '',
        description: item.snippet?.description || '',
        channelId: chan,
        channelTitle: item.snippet?.channelTitle || '',
      });
      if (out.length >= max) break;
    }
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < max);
  return out;
}

// Look up a single video's metadata (title, publishedAt, channel, duration).
async function fetchVideoMeta(videoId) {
  const data = await youtubeAPI('videos', { part: 'snippet,contentDetails', id: videoId });
  const item = data.items?.[0];
  if (!item) throw new Error(`video ${videoId} not found`);
  return {
    videoId,
    title: item.snippet?.title || '',
    publishedAt: item.snippet?.publishedAt || '',
    description: item.snippet?.description || '',
    channelId: item.snippet?.channelId || '',
    channelTitle: item.snippet?.channelTitle || '',
    duration: item.contentDetails?.duration || '',
  };
}

// ─── Transcript fetching (no external dep) ──────────────────────────
//
// Scrapes the watch page for `ytInitialPlayerResponse`, walks its
// captions.playerCaptionsTracklistRenderer.captionTracks, and downloads the
// best track as JSON3. Prefers English, then auto-generated English, then
// any English variant, then whatever's first. Returns:
//   { source, language, segments: [{ start, dur, text }], full: string }
// or throws with a clear message when captions aren't available.

const YT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Fetch a YouTube URL with a browser UA and one retry on 429/5xx so a transient
// throttle doesn't kill a whole batch. YouTube 429s from shared IPs frequently.
async function ytFetch(url, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': YT_UA,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function fetchWatchPageJSON(videoId) {
  const res = await ytFetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`);
  if (!res.ok) throw new Error(`watch page HTTP ${res.status} (likely rate-limited)`);
  const html = await res.text();
  if (!html.includes('ytInitialPlayerResponse')) {
    throw new Error('watch page did not include ytInitialPlayerResponse (rate-limited, blocked, or removed)');
  }
  // ytInitialPlayerResponse is embedded as a JS assignment in the page.
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s)
        || html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (!m) throw new Error('ytInitialPlayerResponse marker present but could not be extracted');
  try { return JSON.parse(m[1]); }
  catch (e) { throw new Error('could not parse ytInitialPlayerResponse'); }
}

function pickCaptionTrack(tracks) {
  if (!tracks || !tracks.length) return null;
  const score = t => {
    const lang = (t.languageCode || '').toLowerCase();
    const kind = t.kind || ''; // 'asr' for auto-generated
    let s = 0;
    if (lang === 'en') s += 100;
    else if (lang.startsWith('en')) s += 60;
    if (!kind) s += 20;               // manual > auto
    if (t.isTranslatable) s += 1;
    return s;
  };
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

// Parse the XML fallback (timedtext returns srv1 XML when json3 is empty on
// some tracks). Very small, custom parser — the shape is <text start dur>…</text>.
function parseTimedtextXML(xml) {
  const out = [];
  const re = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  const decode = s => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = decode(m[3]);
    if (text) out.push({ start: +m[1], dur: m[2] ? +m[2] : 0, text });
  }
  return out;
}

async function fetchTranscript(videoId) {
  const payload = await fetchWatchPageJSON(videoId);
  const tracks = payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const track = pickCaptionTrack(tracks);
  if (!track) throw new Error('no captions available for this video');
  // Try json3 first (compact, easy parse); fall back to raw XML if it comes
  // back empty (some tracks reject json3 with a 200 + empty body).
  let segments = [];
  const jsonRes = await ytFetch(track.baseUrl + '&fmt=json3');
  if (jsonRes.ok) {
    const raw = await jsonRes.text();
    if (raw.trim()) {
      try {
        const data = JSON.parse(raw);
        for (const ev of data.events || []) {
          if (!ev.segs) continue;
          const start = (ev.tStartMs || 0) / 1000;
          const dur = (ev.dDurationMs || 0) / 1000;
          const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
          if (text) segments.push({ start, dur, text });
        }
      } catch { /* fall through to XML */ }
    }
  }
  if (!segments.length) {
    const xmlRes = await ytFetch(track.baseUrl); // default is srv1 XML
    if (!xmlRes.ok) throw new Error(`caption fetch HTTP ${xmlRes.status}`);
    const xml = await xmlRes.text();
    segments = parseTimedtextXML(xml);
  }
  if (!segments.length) throw new Error('caption track returned no text (json3 and XML both empty)');
  const full = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  return {
    source: 'youtube_timedtext',
    language: track.languageCode || 'en',
    autoGenerated: track.kind === 'asr',
    segments,
    full,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Moment extraction (LLM) ────────────────────────────────────────

async function openaiChatJSON(messages, { model = 'gpt-4o-mini', temperature = 0.4, retries = 2 } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Big transcripts fit into gpt-4o-mini (128k context) whole, but truncate very
// long ones defensively — a 4-hour interview transcript can still run past
// what's sensible for one call.
const MAX_TRANSCRIPT_CHARS = 120_000;

const EXTRACTION_SYSTEM = `You are cataloguing near-death experiences for an illustrated anthology.

From ONE interview transcript, pick the 3 to 5 MOST UNIQUE, MEMORABLE, and VISUALLY ILLUSTRATABLE moments from THIS experiencer's account. The goal is a database of distinctive, specific moments that belong to this person alone — not the generic NDE canon.

HARD RULES — SKIP these unless the experiencer gives them a specific, unusual twist:
- a tunnel
- a bright/white/golden light
- overwhelming love or peace (as a feeling alone, without a specific image)
- a life review (unless the specific scenes reviewed are described)
- floating above one's body watching doctors (unless something specific and named is witnessed)
- meeting "beings of light" (unless described concretely)
- being told "it's not your time"
- a border/river/fence they can't cross (unless the specific object is described)

PREFER moments with:
- a specific object, place, creature, person, or spatial arrangement that could be drawn
- a physical sensation with a concrete image (not just "warmth" — a specific texture, smell, sound)
- a detail unique to this experiencer's biography (a childhood room, a named pet, a workplace)
- an odd, funny, unsettling, or surprising specific — the kind of thing that makes this account not interchangeable with any other NDE

Ignore parts of the transcript that are NOT about the experience itself (the host's intro/outro, sponsor reads, biographical setup, discussion of the aftermath years later, unless a moment IS specific and illustratable).

Return STRICT JSON:
{
  "experiencerName": short — first name or "unknown",
  "summary": one sentence, plain — what happened to trigger the NDE (car crash, cardiac arrest, drowning, etc.),
  "moments": [
    {
      "title": 3-6 word label for the moment,
      "description": 2-4 sentences describing what the experiencer saw/felt, in their own terms — concrete and specific, no NDE clichés,
      "quote": one short verbatim line from the transcript that anchors this moment (as close to word-for-word as the transcript allows),
      "timeApprox": approximate transcript timestamp in seconds where this moment begins, integer,
      "visualPrompt": one sentence describing exactly what an illustrator would draw — the composition, subject, setting, mood — self-contained (name every element; no "the person from before"),
      "category": one of: encounter | environment | object | sensation | message | creature | place | body,
      "uniquenessNote": one short sentence — WHY this belongs in the database and isn't a generic NDE trope
    }
  ]
}

If nothing in the transcript rises above generic NDE tropes, return { "experiencerName": "...", "summary": "...", "moments": [] } — an empty list is better than filler.`;

// Build a numbered, time-stamped transcript for the LLM so it can cite
// approximate seconds. Segments are joined into ~10-second buckets so the
// context stays manageable on multi-hour interviews.
function transcriptForLLM(transcript) {
  if (!transcript?.segments?.length) return transcript?.full || '';
  const bucketed = [];
  let bucket = null;
  const bucketSecs = 10;
  for (const seg of transcript.segments) {
    const t = Math.floor(seg.start / bucketSecs) * bucketSecs;
    if (!bucket || bucket.t !== t) {
      if (bucket) bucketed.push(bucket);
      bucket = { t, text: '' };
    }
    bucket.text += (bucket.text ? ' ' : '') + seg.text;
  }
  if (bucket) bucketed.push(bucket);
  let out = bucketed.map(b => {
    const mm = String(Math.floor(b.t / 60)).padStart(2, '0');
    const ss = String(b.t % 60).padStart(2, '0');
    return `[${mm}:${ss}] ${b.text}`;
  }).join('\n');
  if (out.length > MAX_TRANSCRIPT_CHARS) out = out.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[... truncated for length ...]';
  return out;
}

async function extractMoments({ videoId, title, transcript }) {
  const text = transcriptForLLM(transcript);
  if (!text.trim()) throw new Error('empty transcript');
  const out = await openaiChatJSON([
    { role: 'system', content: EXTRACTION_SYSTEM },
    { role: 'user', content: `Interview title: ${title || '(untitled)'}\nVideo id: ${videoId}\n\nTRANSCRIPT (each line prefixed with mm:ss):\n\n${text}` },
  ], { temperature: 0.4 });
  const moments = (Array.isArray(out.moments) ? out.moments : [])
    .map((m, i) => ({
      id: `${videoId}_m${i + 1}`,
      title: String(m.title || '').trim(),
      description: String(m.description || '').trim(),
      quote: String(m.quote || '').trim(),
      timeApprox: Number.isFinite(+m.timeApprox) ? Math.max(0, Math.floor(+m.timeApprox)) : null,
      visualPrompt: String(m.visualPrompt || '').trim(),
      category: String(m.category || '').trim().toLowerCase(),
      uniquenessNote: String(m.uniquenessNote || '').trim(),
    }))
    .filter(m => m.description && m.visualPrompt);
  return {
    experiencerName: String(out.experiencerName || 'unknown').trim(),
    summary: String(out.summary || '').trim(),
    moments,
    extractedAt: new Date().toISOString(),
    model: 'gpt-4o-mini',
  };
}

// ─── End-to-end: one video ──────────────────────────────────────────
//
// Idempotent: if the video already has a fresh transcript we don't re-fetch it,
// and if it already has moments we don't re-extract unless `force` is set.
async function processVideo(videoIdOrUrl, opts = {}) {
  const videoId = parseVideoId(videoIdOrUrl);
  if (!videoId) throw new Error(`could not parse a videoId from "${videoIdOrUrl}"`);
  const existing = await getVideo(videoId);
  const record = existing || {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  // A caller-supplied title (e.g. from a client that already knows it) fills in
  // when we can't fetch metadata ourselves (no YouTube API key on the host).
  if (opts.title && !record.title) record.title = String(opts.title);

  // Metadata (only fetch when YouTube API key present and we don't have it).
  if (!record.title && YOUTUBE_API_KEY) {
    try {
      const meta = await fetchVideoMeta(videoId);
      Object.assign(record, meta);
    } catch (err) {
      record.metaError = err.message;
    }
  }

  // Transcript. A pre-fetched transcript can be supplied by the caller — this
  // is how the local fetch helper (scripts/nde-fetch-local.js) works around
  // YouTube's datacenter-IP block: it fetches captions from a residential IP
  // and hands the transcript here, so the server never has to touch YouTube.
  if (!record.transcript || opts.forceTranscript) {
    try {
      if (opts.transcript && Array.isArray(opts.transcript.segments) && opts.transcript.full) {
        record.transcript = opts.transcript;
      } else if (opts.transcript) {
        throw new Error('supplied transcript missing segments/full');
      } else {
        record.transcript = await fetchTranscript(videoId);
      }
      record.status = 'transcribed';
      delete record.error;
    } catch (err) {
      record.status = 'failed';
      record.error = `transcript: ${err.message}`;
      await saveVideo(record);
      return record;
    }
    await saveVideo(record);
  }

  // Moments.
  if (!record.moments || opts.forceExtract) {
    try {
      const extracted = await extractMoments({
        videoId,
        title: record.title,
        transcript: record.transcript,
      });
      Object.assign(record, extracted);
      record.status = 'extracted';
      delete record.error;
    } catch (err) {
      record.status = 'transcribed';
      record.error = `extract: ${err.message}`;
    }
    await saveVideo(record);
  }
  return record;
}

// ─── Router ─────────────────────────────────────────────────────────

const router = express.Router();

router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.use(express.json({ limit: '12mb' })); // transcripts ride in POST bodies

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    openai: Boolean(OPENAI_API_KEY),
    youtube: Boolean(YOUTUBE_API_KEY),
    firebase: Boolean(firestore()),
    collection: COLLECTION,
    channelHandle: DEFAULT_CHANNEL_HANDLE,
  });
});

router.get('/videos', async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const videos = await listVideos(limit);
    // Trim heavy transcript blobs off the list view; the detail route returns them.
    res.json({
      videos: videos.map(v => ({
        videoId: v.videoId,
        url: v.url,
        title: v.title,
        publishedAt: v.publishedAt,
        channelTitle: v.channelTitle,
        experiencerName: v.experiencerName,
        summary: v.summary,
        status: v.status,
        momentCount: (v.moments || []).length,
        transcriptChars: v.transcript?.full?.length || 0,
        updatedAt: v.updatedAt,
        error: v.error,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/videos/:videoId', async (req, res) => {
  try {
    const v = await getVideo(req.params.videoId);
    if (!v) return res.status(404).json({ error: 'not found' });
    res.json(v);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/moments', async (req, res) => {
  try {
    const videos = await listVideos(500);
    const moments = [];
    for (const v of videos) {
      for (const m of v.moments || []) {
        moments.push({
          ...m,
          videoId: v.videoId,
          videoTitle: v.title,
          videoUrl: v.url,
          experiencerName: v.experiencerName,
        });
      }
    }
    res.json({ count: moments.length, moments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/videos', async (req, res) => {
  try {
    const input = req.body?.videoIdOrUrl || req.body?.url || req.body?.videoId;
    if (!input) return res.status(400).json({ error: 'videoIdOrUrl required' });
    const record = await processVideo(String(input), {
      forceTranscript: !!req.body?.forceTranscript,
      forceExtract: !!req.body?.forceExtract,
      transcript: req.body?.transcript || null,
      title: req.body?.title || null,
    });
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/videos/:videoId/extract', async (req, res) => {
  try {
    const record = await processVideo(req.params.videoId, { forceExtract: true });
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/discover', async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) return res.status(400).json({ error: 'YOUTUBE_API_KEY not set — cannot discover' });
    const videos = await listChannelVideos({
      handle: req.body?.handle,
      channelId: req.body?.channelId,
      max: Math.min(500, Math.max(1, parseInt(req.body?.max, 10) || 100)),
    });
    res.json({ count: videos.length, videos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = {
  router,
  // exports for scripts/nde-batch.js
  parseVideoId,
  listChannelVideos,
  fetchVideoMeta,
  fetchTranscript,
  extractMoments,
  processVideo,
  getVideo,
  saveVideo,
  listVideos,
  DEFAULT_CHANNEL_HANDLE,
  COLLECTION,
};
