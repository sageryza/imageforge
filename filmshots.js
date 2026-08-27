// filmshots.js — WHICH PICTURE IS ON SCREEN, AND THE PROMPT THAT DREW IT.
//
// Sophie's ask (2026-08-27): "in the play pause feedback pinned video tool,
// add a way to see image prompts. example: hate of the game."
//
// The pinned-film player already pauses on a tap and offers a note (see
// public/filmnote.js). What it could never answer is the question she asks
// while looking at the frame she just stopped on: *what were the words that
// drew this picture?* Everything needed for that answer already exists —
// the chat filed the picture with its label, its MODEL · QUALITY · SIZE
// caption and BOTH halves of its exact prompt (POST /api/gallery/assets/
// prompt) — and the one fact nobody had written down is which picture is on
// screen at which second.
//
// THAT is all this module stores: a SHOT MAP, `[{ at, url }]` per film, one
// doc per film url (id = sha1(url)) in `forge-film-shots`. The words are
// NEVER copied in here — they are resolved from the chat's own filed assets
// on every read, so a prompt corrected in the Assets tab is corrected in the
// player, and there is one copy of the text in the house (the *nothing
// stands between the source and the output* rule).
//
// TWO DOORS IN, and neither is a rebuild:
//   • A CHAT THAT MAKES A FILM knows its own shot list — it just cut it —
//     so it POSTs the map the same turn it pins the film. Exact, free.
//   • AN EXISTING FILM is measured: `scripts/film-shots-detect.js` finds the
//     cuts with ffmpeg and matches each shot's own frame against the chat's
//     filed pictures by perceptual hash. Measured on her example (Hate of
//     the Game — the reel v1, 5:42): 40 cuts found, 40 of 40 shots matched
//     to the right picture. Nothing has to be re-rendered to get a map.
//
// A film with NO map is silent — the player simply shows no Prompt button,
// exactly as the Assets tab hides PROMPT on a picture with nothing filed. A
// wrong answer here would be worse than none: she would read one picture's
// prompt believing it belongs to another.
//
// It costs nothing: no model call ever, one small doc read and one equality
// query per film, held 60s.
//
// Routes (STUDIO_TOKEN gate, GET /status open):
//   GET  /api/filmshots/status        → { ok, firebase }
//   GET  /api/filmshots?url=<film>    → { ok, found, chat, shots:[…] }
//        each shot: { at, end, url, label, caption, style, content }
//   POST /api/filmshots               → { chat, session?, url, shots:[{at,url,title?}],
//                                         seconds?, source? }
//   POST /api/filmshots/clear         → { url } — forget a map (a wrong one
//        must be removable; the film and its pictures are untouched)
//
// Player: public/filmnote.js (the Prompt door on the paused screen), which
// serves both hosts of the tap-to-note player — the Chats app's pinned film
// and compare.js's video lightbox.
// Tests: node scripts/test-filmshots.js · node scripts/test-film-prompt.js

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const assetUnion = require('./asset-union');

const router = express.Router();
const COLL = 'forge-film-shots';
const MAX_SHOTS = 600;          // a 6-minute reel is ~40; the cap is for a runaway

const db = () => admin.firestore();
const firebaseUp = () => admin.apps.length > 0;

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '256kb' }));

// ---- pure helpers (exported for the test) ----------------------------------

const idFor = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 24);

// A time may arrive as seconds (12.5) or as the m:ss a chat has in front of
// it in its own cut list ("1:04.5"). Both are the same second; refusing one
// spelling would only mean a chat files no map at all.
function secondsOf(v) {
  if (typeof v === 'number' && isFinite(v)) return Math.max(0, v);
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const m = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s);
  return isFinite(n) && n >= 0 ? n : null;
}

// The map as it is stored: sorted, one entry per moment, nothing else. A shot
// with no picture url is dropped rather than kept as a hole — the whole point
// of an entry is that it names the picture on screen.
function cleanShots(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw) continue;
    const at = secondsOf(raw.at != null ? raw.at : raw.t);
    const url = String(raw.url || '').trim();
    if (at == null || !/^https?:\/\//.test(url)) continue;
    const shot = { at: Math.round(at * 1000) / 1000, url };
    const title = String(raw.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (title) shot.title = title;
    out.push(shot);
  }
  out.sort((a, b) => a.at - b.at);
  // Two entries claiming the same second is a build slip, not two pictures:
  // the later one wins, because that is the one the map was corrected with.
  const dedup = [];
  for (const s of out) {
    if (dedup.length && Math.abs(dedup[dedup.length - 1].at - s.at) < 0.01) dedup[dedup.length - 1] = s;
    else dedup.push(s);
  }
  return dedup.slice(0, MAX_SHOTS);
}

// Each shot holds the screen until the next one starts (and the last one to
// the end of the film, when the film's length is known). `end` is what lets
// the player show a shot's span without doing the arithmetic itself.
function withEnds(shots, seconds) {
  return shots.map((s, i) => {
    const next = shots[i + 1] ? shots[i + 1].at : (typeof seconds === 'number' && seconds > s.at ? seconds : null);
    return next == null ? { ...s } : { ...s, end: Math.round(next * 1000) / 1000 };
  });
}

// The shot on screen at `t` — the LAST one that has started. Before the first
// entry's `at` there is nothing to answer with (a film that opens on a title
// card its map does not name), so this returns -1 rather than guessing shot 0.
function shotAt(shots, t) {
  let pick = -1;
  for (let i = 0; i < shots.length; i++) {
    if (shots[i].at <= t + 0.001) pick = i; else break;
  }
  return pick;
}

// The hook's own background catch writes "from <chat>" where a curated
// MODEL · QUALITY · SIZE caption goes. It says nothing about how a picture
// was made, so it is not shown as one.
const FROM_CAPTION = /^from\s+\S/i;

/**
 * Join the map to the chat's filed pictures. The words are the ASSETS' — the
 * label she reviews by, the caption, and both halves of the exact prompt —
 * so nothing about a prompt lives in this collection.
 *
 * The key is the url, then the FILENAME, because one picture reaches a chat's
 * Assets tab by more than one road (asset-union.js's whole subject) and the
 * map may name whichever copy the film was cut from.
 */
function joinPrompts(shots, assets) {
  const byUrl = new Map();
  const byFile = new Map();
  for (const a of assets || []) {
    if (!a || !a.url) continue;
    byUrl.set(String(a.url), a);
    const k = assetUnion.filenameKey(a.url);
    if (k && !byFile.has(k)) byFile.set(k, a);
    for (const alt of a.alts || []) {
      byUrl.set(String(alt), a);
      const ak = assetUnion.filenameKey(alt);
      if (ak && !byFile.has(ak)) byFile.set(ak, a);
    }
  }
  return shots.map((s) => {
    const a = byUrl.get(s.url) || byFile.get(assetUnion.filenameKey(s.url)) || null;
    const out = { at: s.at, url: s.url };
    if (s.end != null) out.end = s.end;
    const label = (a && a.description) || s.title || '';
    if (label) out.label = String(label).slice(0, 200);
    const caption = a && a.prompt && !FROM_CAPTION.test(a.prompt) ? String(a.prompt) : '';
    if (caption) out.caption = caption.slice(0, 120);
    if (a && a.promptStyle) out.style = String(a.promptStyle);
    if (a && a.promptContent) out.content = String(a.promptContent);
    return out;
  });
}

// ---- read/write -------------------------------------------------------------

const cache = new Map();        // film url → { at, payload }
const CACHE_MS = 60 * 1000;

async function chatAssets(chat) {
  if (!firebaseUp() || !chat) return [];
  // ONE equality filter, everything else in memory (house rule — no composite
  // index). `forge-chat-assets` is where a filed label, caption and prompt
  // live; a picture the hook merely caught carries none of the three and
  // simply resolves to a shot with no words, which shows no button.
  const snap = await db().collection('forge-chat-assets').where('chat', '==', chat).get();
  return snap.docs.map((d) => d.data());
}

async function readMap(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload;
  let payload = { ok: true, found: false, shots: [] };
  if (firebaseUp()) {
    const snap = await db().collection(COLL).doc(idFor(url)).get();
    if (snap.exists) {
      const doc = snap.data();
      const shots = withEnds(cleanShots(doc.shots), doc.seconds);
      const assets = await chatAssets(doc.chat);
      payload = {
        ok: true, found: true, chat: doc.chat, seconds: doc.seconds || null,
        source: doc.source || 'post', at: doc.at || null,
        shots: joinPrompts(shots, assets),
      };
    }
  }
  cache.set(url, { at: Date.now(), payload });
  return payload;
}

async function record(input) {
  if (!firebaseUp()) return { ok: false, error: 'no firebase' };
  const url = String((input && input.url) || '').trim();
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'url must be the film’s http(s) url' };
  const chat = String((input && input.chat) || '').slice(0, 60);
  if (!chat) return { ok: false, error: 'chat required' };
  const shots = cleanShots(input.shots);
  if (!shots.length) return { ok: false, error: 'shots required — [{ at, url }] per picture' };
  const doc = {
    url, chat, shots,
    seconds: secondsOf(input.seconds) || null,
    source: String(input.source || 'post').slice(0, 20),
    at: new Date().toISOString(),
  };
  // The map is written WHOLE, never merged: a re-post is a corrected shot
  // list, and merging arrays would leave the old one's tail behind.
  await db().collection(COLL).doc(idFor(url)).set(doc);
  cache.delete(url);
  return { ok: true, count: shots.length, id: idFor(url) };
}

// ---- routes ------------------------------------------------------------------

router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, firebase: firebaseUp() });
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const url = String(req.query.url || '').trim();
    if (!url) return res.status(400).json({ error: 'url required' });
    res.json(await readMap(url));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.chat) return res.status(400).json({ error: 'chat required' });
    // Session-first resolution, the same contract as every other chat-keyed
    // post: the map has to land on the chat whose Assets tab holds the
    // pictures, whatever slug the branch is called today.
    let slug = String(body.chat);
    try { slug = await require('./chatfeed').resolveChat(body.chat, body.session); }
    catch (e) { /* resolution down — file under the given slug */ }
    const out = await record({ ...body, chat: slug });
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/clear', async (req, res) => {
  try {
    if (!firebaseUp()) return res.status(503).json({ error: 'no firebase' });
    const url = String((req.body || {}).url || '').trim();
    if (!url) return res.status(400).json({ error: 'url required' });
    await db().collection(COLL).doc(idFor(url)).delete();
    cache.delete(url);
    res.json({ ok: true, cleared: url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = {
  router, record, readMap,
  _internals: { secondsOf, cleanShots, withEnds, shotAt, joinPrompts, idFor, chatAssets },
};
