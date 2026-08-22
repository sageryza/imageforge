#!/usr/bin/env node
/**
 * backfill-movie-clips.js — file the clips Movies has ALREADY made into the
 * iOS "My Creations" gallery.
 *
 * WHY — movies.js files every finished video into the gallery from Aug 2026
 * onward (Sophie: "they just stay there … they dont appear in my creations"),
 * but everything made BEFORE that only ever lived inside the movie doc that
 * made it. This walks the history and files it, once.
 *
 * WHAT IT FILES, per movie in `forge-movies` (deckfactory) and per doc in
 * `forge-quick`:
 *   • every scene clip — current AND superseded re-rolls (clipHistory), since a
 *     re-roll is history she may still want and the tab is hers to prune
 *   • every dream bridge
 *   • every finished cut (as type 'film', so the grid's filter row separates
 *     the films from the clips they are made of)
 *   • every quick animation
 * Each carries a POSTER (the panel it was animated from, or the still a quick
 * animate started as): there is no frame the grid can decode out of an mp4, so
 * a video creation without one tiles as a blank white square.
 *
 * TIMESTAMPS are the real make-time wherever the doc records one (a cut's
 * `stitchedAt`, a quick clip's `createdAt`, else the movie's `updatedAt`), so a
 * backfill interleaves correctly with everything else in the gallery instead of
 * landing in a slab at the top. That is the whole reason this is not `now`.
 *
 * AUTH — needs BOTH service accounts, the standard two-key setup:
 *   FIREBASE_SERVICE_ACCOUNT       = Deck Factory (forge-movies lives there)
 *   STORY_FIREBASE_SERVICE_ACCOUNT = membry       (the creations gallery)
 * plus the target uid: GALLERY_UID, or auto-discovered the way server.js does
 * it (the membry user with the newest creation).
 *
 * USAGE
 *   node scripts/backfill-movie-clips.js                 # DRY RUN — prints what it would file
 *   node scripts/backfill-movie-clips.js --write
 *   node scripts/backfill-movie-clips.js --movie <id> --write
 *   node scripts/backfill-movie-clips.js --undo --write   # remove what IT filed
 *
 * WAIT FOR THE APP BUILD BEFORE RUNNING THIS FOR REAL. A build without video
 * support draws every creation by decoding its `url` as a picture, and there is
 * no picture inside an mp4 — so a clip filed early tiles as a blank white
 * square. It was run once on 2026-08-22 (166 videos, all with posters) and
 * undone the same minute for exactly that reason: the server files new clips
 * from here on, a trickle that self-corrects the moment the build lands, but
 * 166 blank tiles at the top of her gallery is not a trickle. `--undo` removes
 * only docs this script wrote (`source: 'movies-backfill'`).
 *
 * Idempotent: it skips any url already in the gallery, so running it twice
 * files nothing the second time.
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const WRITE = has('--write');
const ONLY_MOVIE = val('--movie');
const UNDO = has('--undo');

function parseKey(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const deckKey = parseKey(process.env.FIREBASE_SERVICE_ACCOUNT);
const membryKey = parseKey(process.env.STORY_FIREBASE_SERVICE_ACCOUNT) || deckKey;
if (!deckKey) { console.error('FIREBASE_SERVICE_ACCOUNT (Deck Factory) is required'); process.exit(1); }
if (!membryKey) { console.error('STORY_FIREBASE_SERVICE_ACCOUNT (membry) is required'); process.exit(1); }

const deckApp = admin.initializeApp({ credential: admin.credential.cert(deckKey) }, 'deck');
const membryApp = admin.initializeApp({ credential: admin.credential.cert(membryKey) }, 'membry');

const ms = (v) => {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (v.toMillis) return v.toMillis();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};
const hosted = (u) => typeof u === 'string' && /^https?:/.test(u);

/// The device uid, the same way server.js finds it: env, then the config doc,
/// then the membry user with the newest creation.
async function galleryUid() {
  if (process.env.GALLERY_UID) return process.env.GALLERY_UID;
  try {
    const doc = await deckApp.firestore().doc('config/gallery-uid').get();
    if (doc.exists && doc.data().uid) return doc.data().uid;
  } catch { /* fall through */ }
  const users = await membryApp.firestore().collection('users').listDocuments();
  let best = null, bestTs = 0;
  for (const u of users.slice(0, 40)) {
    try {
      const snap = await u.collection('creations').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.empty) continue;
      const t = ms(snap.docs[0].data().createdAt) || 0;
      if (t > bestTs) { bestTs = t; best = u.id; }
    } catch { /* user without creations */ }
  }
  if (!best) throw new Error('could not discover the gallery uid — set GALLERY_UID');
  return best;
}

/// Everything one movie doc has ever finished, as gallery rows.
function rowsForMovie(movie) {
  const out = [];
  const fallback = ms(movie.updatedAt) || ms(movie.createdAt) || Date.now();
  const sceneById = new Map((movie.scenes || []).map(s => [s.id, s]));
  for (const scene of movie.scenes || []) {
    const poster = scene.panel && scene.panel.url;
    const clips = [...(scene.clipHistory || []), scene.clip].filter(c => c && hosted(c.url));
    for (const clip of clips) {
      out.push({
        url: clip.url, poster, type: 'clip',
        prompt: clip.promptUsed || scene.motionPrompt || scene.title || '',
        model: clip.tier === 'draft' || !clip.tier ? 'wan-2.2-i2v-fast' : 'kling-v2.1',
        quality: clip.tier || null,
        createdMs: ms(clip.at) || fallback,
      });
    }
  }
  for (const bridge of movie.bridges || []) {
    if (!bridge.clip || !hosted(bridge.clip.url)) continue;
    const to = sceneById.get(bridge.toSceneId);
    out.push({
      url: bridge.clip.url, poster: to && to.panel && to.panel.url, type: 'clip',
      prompt: bridge.clip.promptUsed || bridge.prompt || 'dream bridge',
      model: 'wan-2.2-i2v-fast', quality: 'bridge',
      createdMs: fallback,
    });
  }
  for (const cut of movie.cuts || []) {
    if (!hosted(cut.url)) continue;
    const frame = (cut.frames || []).find(f => f.panelUrl);
    out.push({
      url: cut.url, poster: frame && frame.panelUrl, type: 'film',
      prompt: `${movie.title || 'movie'} — ${cut.name || 'cut'}`,
      createdMs: ms(cut.stitchedAt) || fallback,
    });
  }
  return out;
}

(async () => {
  const uid = await galleryUid();
  const col = membryApp.firestore().collection('users').doc(uid).collection('creations');

  if (UNDO) {
    // Only ever docs this script wrote. A clip filed live by movies.js carries
    // source:'movies' and is never touched.
    const snap = await col.where('source', '==', 'movies-backfill').get();
    console.log(`${snap.size} backfilled creation${snap.size === 1 ? '' : 's'}${WRITE ? '' : ' (DRY RUN)'}`);
    if (WRITE) {
      let done = 0;
      for (const d of snap.docs) { await d.ref.delete(); done++; }
      console.log(`removed ${done}`);
    } else {
      console.log('re-run with --write to remove them.');
    }
    process.exit(0);
  }

  const deckDb = deckApp.firestore();

  const rows = [];
  let movieQ = deckDb.collection(process.env.MOVIES_COLLECTION || 'forge-movies');
  if (ONLY_MOVIE) {
    const doc = await movieQ.doc(ONLY_MOVIE).get();
    if (doc.exists) rows.push(...rowsForMovie(doc.data()));
  } else {
    const snap = await movieQ.get();
    snap.docs.forEach(d => rows.push(...rowsForMovie(d.data())));
  }
  if (!ONLY_MOVIE) {
    const quick = await deckDb.collection(process.env.QUICK_COLLECTION || 'forge-quick').get();
    quick.docs.forEach(d => {
      const q = d.data();
      if (!hosted(q.clipUrl)) return;
      rows.push({
        url: q.clipUrl, poster: hosted(q.imageUrl) ? q.imageUrl : null, type: 'clip',
        prompt: q.prompt || 'quick animation',
        model: 'wan-2.2-i2v-fast', quality: q.tier || 'draft',
        createdMs: ms(q.createdAt) || Date.now(),
      });
    });
  }

  // One url can appear twice (a clip kept as history AND as current).
  const seen = new Set();
  const unique = rows.filter(r => (seen.has(r.url) ? false : seen.add(r.url)));

  console.log(`${unique.length} finished video${unique.length === 1 ? '' : 's'} on record${WRITE ? '' : ' (DRY RUN)'}`);
  let filed = 0, already = 0, noPoster = 0;
  for (const r of unique) {
    const dup = await col.where('url', '==', r.url).limit(1).get();
    if (!dup.empty) { already++; continue; }
    if (!r.poster) noPoster++;
    if (!WRITE) { console.log(`  would file  ${r.type}  ${r.url.slice(-46)}  ${r.poster ? '' : '(no poster)'}`); filed++; continue; }
    const doc = {
      type: r.type, url: r.url, prompt: String(r.prompt || '').slice(0, 500), stickers: null,
      createdAt: admin.firestore.Timestamp.fromMillis(r.createdMs),
      source: 'movies-backfill',
    };
    if (r.poster) doc.poster = r.poster;
    if (r.model) doc.model = r.model;
    if (r.quality) doc.quality = r.quality;
    await col.add(doc);
    filed++;
  }
  console.log(`\n${WRITE ? 'filed' : 'would file'} ${filed} · already in the gallery ${already} · without a poster ${noPoster}`);
  if (!WRITE) console.log('re-run with --write to file them.');
  process.exit(0);
})().catch(err => { console.error(err.message); process.exit(1); });
