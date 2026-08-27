// voicelab.js — the Voice Studio. Sophie's ElevenLabs voices on a page: pick a
// voice, type text, tap Render, get the audio — without leaving Deck Factory.
//
// Deliberately NO settings anywhere (Aug 2026, Sophie's rule for her clones):
// every render is stock ElevenLabs defaults on eleven_multilingual_v2 —
// stability 0.5, similarity 0.75, style 0, speaker boost — the exact
// configuration her approved clone comparison samples used. No whisper
// prefixes, no tempo, no loudnorm. What ElevenLabs returns is what she gets.
//
// Cost model (verified against ElevenLabs docs, Aug 2026): API renders draw
// from the SAME subscription credit pool as elevenlabs.io itself — no separate
// billing, 1 credit per character on multilingual_v2. /status reports the live
// quota so the page can show credits remaining.
//
// House rules honoured:
//   * render = fire-and-forget BACKGROUND JOB on a Firestore doc
//     (`forge-voicelab`, deckfactory) — POST returns an id in ~0.2s, the page
//     polls GET /render/:id and resumes after being closed (localStorage).
//   * audio goes to Firebase Storage (`voice-lab/<id>.mp3`, public) — permanent
//     URLs, never a temporary ElevenLabs response held in memory.
//   * STUDIO_TOKEN gate, only GET /status open. Page served via serveGated.
//
// Routes:
//   GET    /status       → { ok, firebase, elevenlabs, credits:{used,limit} }
//   GET    /voices       → the account's voices, Sophie's clones first
//   POST   /render       → { voiceId, text } → { id }
//   GET    /render/:id   → the job doc (status: rendering | done | failed)
//   POST   /change       → raw audio body, ?voiceId=&voiceName=&ext=&name=
//                          → { id }  (the VOICE CHANGER — speech to speech)
//   GET    /history?kind= → newest 30 renders ('tts' | 'sts' | omitted = both)
//   GET    /file/:id?src= → that take's audio as a same-origin ATTACHMENT
//   POST   /render/:id/recover → pull a KILLED render's audio back out of the
//                          ElevenLabs history (free — it was already paid for)
//   DELETE /render/:id   → remove a render (doc + audio)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pickHistoryItem } = require('./voicelab-recover');

const COL = 'forge-voicelab';
const STORAGE_FOLDER = 'voice-lab';
const MODEL_ID = 'eleven_multilingual_v2';
// The voice CHANGER (Aug 2026, Sophie: "a separate hairline tab… a place to
// record a voice or an option to upload a file or Voice Memo"). Speech to
// speech keeps the PERFORMANCE — timing, emphasis, where a laugh lands — and
// swaps only the voice, which is the whole reason it isn't just TTS.
// `eleven_multilingual_sts_v2` is the v2-family conversion model (verified
// live against /v1/models: can_do_voice_conversion, 29 languages). There is
// no v3 here and there must never be — same rule as her TTS.
const STS_MODEL = 'eleven_multilingual_sts_v2';
const SOURCE_FOLDER = 'voice-lab/sources';
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };
const MAX_CHARS = 5000;
const EL_BASE = 'https://api.elevenlabs.io/v1';
// Every finished render also saves itself into a chat's Assets tab (Sophie's
// request — the studio page is the workbench, Assets is where audio lives).
// The exact spoken text + settings ride along as the PROMPT split.
const ASSETS_CHAT = process.env.VOICELAB_ASSETS_CHAT || 'professional-voice-plan-review';
const STYLE_LINE = 'ElevenLabs professional voice clone · model eleven_multilingual_v2 · '
  + 'stability 0.5, similarity_boost 0.75, style 0, speaker boost on · output mp3_44100_192 · Voice Studio render';

const router = express.Router();
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
router.use((req, res, next) => {
  if (req.path === '/status' && req.method === 'GET') return next();
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

const elKey = () => process.env.ELEVENLABS_API_KEY || '';

async function elFetch(pathname, opts = {}) {
  const res = await fetch(`${EL_BASE}${pathname}`, {
    ...opts,
    headers: { 'xi-api-key': elKey(), ...(opts.headers || {}) },
    timeout: opts.timeout || 60000,
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

router.get('/status', async (req, res) => {
  const out = { ok: true, firebase: Boolean(admin.apps.length), elevenlabs: Boolean(elKey()), model: MODEL_ID };
  // Live quota so the page can say what a render costs against what's left —
  // best-effort: a quota hiccup must not report the whole studio down.
  try {
    if (elKey()) {
      const sub = await (await elFetch('/user/subscription')).json();
      out.credits = { used: sub.character_count, limit: sub.character_limit, tier: sub.tier };
    }
  } catch (e) { /* credits line just stays blank */ }
  res.json(out);
});

// Only the voices Sophie wants offered right now. Her own clone leads (rank()
// sorts any /sophie/i name first), then the people she cloned from voicemails
// and recordings in Aug 2026.
//
// Deliberately an explicit ALLOWLIST, not an empty array: empty means "every
// non-premade account voice", which sweeps in the dozen Voice Library
// professionals (Jack John, Thorne, Reva…) and the generated ones. Those are
// noise on a picker whose whole point is HER people. Cloning someone new =
// add the id here; deleting a voice just drops it from the list on its own,
// since the account query no longer returns it.
//
// CULLED Aug 18 2026 at Sophie's ask — Richard, Richard v2, Richard v3, Miriam,
// Gilad, Alpha and "Sophie — doctor" came off the picker. The voices still exist
// on the ElevenLabs account and nothing was deleted there: dropping an id here
// is the whole undo, so putting one back is one line.
//
// PINNED_VOICE_IDS sits above the allowlist: the two announcers she picked for
// the PWC reels ride at the TOP of the picker, in the order she named them
// (Aug 26 2026, Sophie: "find max and clyde voices from yesterdays chat, add to
// voice studio and changer. put at top"). They are ElevenLabs Voice Library
// professionals ADDED to the account, not clones — Clyde was already on it
// (the reels render straight from the TTS endpoint by id), Max was added the
// day this shipped. Order here IS the order on the picker, and it beats rank(),
// which would otherwise file them under `professional` and sort them
// alphabetically among voices she never asked for.
const PINNED_VOICE_IDS = [
  'dqbqOZM4uhsyx1WtTAgT', // Max — 1940s RP British newsreel announcer
  'QMJTqaMXmGnG8TCm8WQG', // Clyde — vintage male radio announcer (the PWC narrator)
];
const OFFERED_VOICE_IDS = [
  ...PINNED_VOICE_IDS,
  'UTkHGl2ImiT6gwtAFCql', // Sophie — morning (her professional clone)
  '15zm3wIS3FnEV3LX1Aa5', // Jonathan (annoyed)
  'XnL2M6RBESG5keWHuX0d', // Michael White
  'Ai0X93qaXBDloK1HAn87', // Steve Herrington
  'abAxVEBvVZF5ZLCb4HTw', // Sean (mad)
  'esVJEBbgfINGxR9bUuYQ', // Doug
  'EYB97SPMtZYwRMBdkH7a', // Sophie — doctor v2 (separated by transcript)
  'ZOw6P0YnswJ6JNjpj9wF', // Steve Ryza (her dad — NOT Steve Herrington, a different person)
  't5WywHVtMw3aenhWkKCz', // Sophie — instant (Aug 14), from one 3½-min memo with its long pauses cut
  '7Se81wBB6ZL5kXV2XKu5', // Sophie — instant v2 (Aug 14, stories), 12 min of her narrating, conditioned
  'Aqp0rbLX5c0qpiPc83tG', // Snake Boy (instant), from a single voice message, Aug 17 2026
];
// One flat pastel per person, so the picker is a row of coloured squares she
// reads by colour rather than by scrolling a list of names (Sophie, Aug 2026:
// Jonathan blue, Sean yellow, Michael purple, the rest my pick). Flat only —
// no gradients, ever. A voice with no entry falls through to PALETTE by
// position, so a new clone still gets a colour without an edit here.
const VOICE_COLORS = {
  UTkHGl2ImiT6gwtAFCql: '#e0a8c0', // Sophie — morning — pink, and first in line
  '15zm3wIS3FnEV3LX1Aa5': '#9fbcd8', // Jonathan (annoyed) — blue
  abAxVEBvVZF5ZLCb4HTw: '#e0c97a', // Sean (mad) — yellow
  XnL2M6RBESG5keWHuX0d: '#b9a4d4', // Michael White — violet
  Ai0X93qaXBDloK1HAn87: '#e6a877', // Steve Herrington — orange
  // Sophie picked the ones above by name; the rest are mine for now
  // ("pick your own colours for now"), kept clear of every one of hers.
  esVJEBbgfINGxR9bUuYQ: '#c98f86', // Doug — terracotta
  EYB97SPMtZYwRMBdkH7a: '#e3b3bd', // Sophie — doctor v2
  t5WywHVtMw3aenhWkKCz: '#d6b0c4', // Sophie — instant (Aug 14) — a third pink, beside her other two
  '7Se81wBB6ZL5kXV2XKu5': '#cfa2b8', // Sophie — instant v2 (stories) — the same pink a shade deeper than v1
  ZOw6P0YnswJ6JNjpj9wF: '#6f8fa8', // Steve Ryza — steel blue. Deliberately NOT in the orange
  // family: orange is Steve Herrington, a different man, and pairing the two colours was
  // the visual version of the mistake that put them in one comparison (Aug 2026).
  Aqp0rbLX5c0qpiPc83tG: '#b7a98f', // Snake Boy (instant) — sand
  dqbqOZM4uhsyx1WtTAgT: '#8a9a7b', // Max — newsreel olive
  QMJTqaMXmGnG8TCm8WQG: '#b58863', // Clyde — walnut, the wood of a radio cabinet.
  // Both kept clear of every one of hers, and of each other: two announcers
  // sitting side by side at the top of the picker have to read apart at a glance.
};
const PALETTE = ['#9fbcd8', '#e0c97a', '#b9a4d4', '#a7c4a0', '#e2b48c', '#9cc4c2', '#d4a58c', '#d9a7a7'];

// Cached 10 minutes — the list changes when she trains a clone, not per load.
let voicesCache = { at: 0, list: null };
router.get('/voices', async (req, res) => {
  try {
    if (!voicesCache.list || Date.now() - voicesCache.at > 10 * 60 * 1000) {
      const data = await (await elFetch('/voices?show_legacy=true')).json();
      // A pinned voice ranks BELOW zero so it leads the picker, and ties are
      // broken by its position in PINNED_VOICE_IDS rather than by name — the
      // list is the order she asked for, so alphabetising it would undo the ask.
      // NB: rank() runs AFTER the .map() below, so the field is voiceId, not voice_id.
      const pin = (v) => PINNED_VOICE_IDS.indexOf(v.voiceId);
      const rank = (v) => {
        if (pin(v) >= 0) return -1;
        if (/sophie/i.test(v.name || '')) return 0;
        if (v.category === 'cloned' || v.category === 'generated') return 1;
        if (v.category === 'professional') return 2;
        return 3;
      };
      voicesCache = {
        at: Date.now(),
        list: (data.voices || [])
          .filter((v) => v.category !== 'premade')
          .filter((v) => !OFFERED_VOICE_IDS.length || OFFERED_VOICE_IDS.includes(v.voice_id))
          .map((v) => ({ voiceId: v.voice_id, name: v.name, category: v.category, description: v.description || '' }))
          .sort((a, b) => rank(a) - rank(b)
            || (PINNED_VOICE_IDS.indexOf(a.voiceId) >= 0
                ? PINNED_VOICE_IDS.indexOf(a.voiceId) - PINNED_VOICE_IDS.indexOf(b.voiceId)
                : a.name.localeCompare(b.name)))
          .map((v, i) => ({ ...v, color: VOICE_COLORS[v.voiceId] || PALETTE[i % PALETTE.length] })),
      };
    }
    res.json({ voices: voicesCache.list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The tail every finished take shares — the audio in hand, saved and marked
// done. Pulled out of renderJob so the RECOVERY below finishes a killed render
// exactly the way the render itself would have, rather than a lookalike copy
// of it that drifts the first time one of them changes.
async function saveTake(id, audio, extra = {}) {
  if (!audio || !audio.length) throw new Error('ElevenLabs returned empty audio');
  const tmp = path.join(os.tmpdir(), `${id}.mp3`);
  fs.writeFileSync(tmp, audio);
  const bucket = admin.storage().bucket();
  const dest = `${STORAGE_FOLDER}/${id}.mp3`;
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'audio/mpeg' } });
  await bucket.file(dest).makePublic();
  fs.unlink(tmp, () => {});
  const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
  await admin.firestore().collection(COL).doc(id)
    .update({ status: 'done', url, doneAt: new Date().toISOString(), ...extra });
  return url;
}

// Save it into the Assets tab: label = her words, PROMPT = the exact text and
// settings. Best-effort — a filing hiccup must not fail a done render.
async function fileTakeToAssets(url, voiceId, voiceName, text) {
  try {
    const label = text.length > 90 ? `${text.slice(0, 90).trim()}…` : text;
    await admin.firestore().collection('forge-chat-assets').add({
      chat: ASSETS_CHAT, url, urlKey: url, kind: 'audio',
      prompt: 'elevenlabs · eleven_multilingual_v2 · voice studio',
      description: label,
      promptStyle: `${STYLE_LINE} · voice "${voiceName}" (${voiceId})`,
      promptContent: text.slice(0, 6000),
      created: new Date().toISOString(), wip: true,
    });
  } catch (e) { /* the render itself is safe either way */ }
}

// The ElevenLabs request id, stamped the moment the response HEADERS arrive —
// before the body is buffered and before the upload, i.e. before nearly every
// place a restart can kill this. It is the one key that identifies a killed
// render's generation with no guessing at all. Unawaited on purpose: a slow
// Firestore write must not sit in front of her audio.
function stampRequestId(id, res) {
  try {
    const rid = res && res.headers && res.headers.get('request-id');
    if (rid) admin.firestore().collection(COL).doc(id).update({ requestId: rid }).catch(() => {});
  } catch (e) { /* the render does not depend on this */ }
}

// The ids this process is really working on right now. The sweep below skips
// them, so however slow a render is, the job that is actually running it can
// never be declared dead underneath itself. It only ever has to catch a job
// whose process is GONE — which is the only case there is.
const LIVE = new Set();

async function renderJob(id, voiceId, voiceName, text) {
  const doc = admin.firestore().collection(COL).doc(id);
  LIVE.add(id);
  try {
    const res = await elFetch(`/text-to-speech/${voiceId}?output_format=mp3_44100_192`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
      timeout: 180000,
    });
    stampRequestId(id, res);
    const url = await saveTake(id, await res.buffer());
    await fileTakeToAssets(url, voiceId, voiceName, text);
  } catch (err) {
    await doc.update({ status: 'failed', error: String(err.message || err).slice(0, 400) }).catch(() => {});
  } finally {
    LIVE.delete(id);
  }
}

// ── the voice changer ───────────────────────────────────────────────
// Her recording in, the same performance in someone else's voice out.
//
// The SOURCE is kept, on purpose (Sophie: "the recorded voice will also save
// to firebase") — it goes to Storage before the conversion is even attempted,
// so a failed or refused conversion still leaves her the take she recorded.
async function changeJob(id, voiceId, voiceName, tmp, ext) {
  const doc = admin.firestore().collection(COL).doc(id);
  const bucket = admin.storage().bucket();
  const srcDest = `${SOURCE_FOLDER}/${id}.${ext}`;
  LIVE.add(id);
  try {
    await bucket.upload(tmp, { destination: srcDest, metadata: { contentType: mimeFor(ext) } });
    await bucket.file(srcDest).makePublic();
    const sourceUrl = `https://storage.googleapis.com/${bucket.name}/${srcDest}`;
    await doc.update({ sourceUrl });

    // `form-data` (not the WHATWG FormData) because node-fetch v2 only knows
    // how to set the multipart boundary for that one; and a STREAM, so a
    // 25MB memo is never read into memory a second time.
    const body = new FormData();
    body.append('model_id', STS_MODEL);
    body.append('voice_settings', JSON.stringify(VOICE_SETTINGS));
    body.append('audio', fs.createReadStream(tmp), { filename: `source.${ext}`, contentType: mimeFor(ext) });
    const res = await elFetch(`/speech-to-speech/${voiceId}?output_format=mp3_44100_192`, {
      method: 'POST', headers: { accept: 'audio/mpeg' }, body, timeout: 300000,
    });
    stampRequestId(id, res);
    await saveTake(id, await res.buffer());
  } catch (err) {
    await doc.update({ status: 'failed', error: String(err.message || err).slice(0, 400) }).catch(() => {});
  } finally {
    LIVE.delete(id);
    fs.unlink(tmp, () => {});
  }
}

function mimeFor(ext) {
  return { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', wav: 'audio/wav',
    webm: 'audio/webm', ogg: 'audio/ogg', caf: 'audio/x-caf', aac: 'audio/aac' }[ext] || 'audio/mpeg';
}

// ── a killed render is RECOVERED, never re-rendered ──────────────────
// Both jobs above are fire-and-forget in this process, so a deploy that swaps
// the instance out mid-render kills them between "ElevenLabs finished" and
// "we saved it": the doc sits on `rendering` forever and the page — which
// polls every 2s while a take says that — spins on it until she gives up.
// THE EXAMPLE THIS WAS BUILT ON TURNED OUT NOT TO BE ONE — worth knowing,
// because it is the same wrong guess twice over. Sophie's 4,842-character Max
// take (2026-08-27T03:16Z) started four minutes after a deploy merged and was
// read by two chats as killed by it. It was not: it finished on its own at
// 03:28:45, `done`, with a url — it had simply taken 735 seconds. Nothing was
// orphaned and no credits were lost.
//
// The mechanism below is still real and still worth having (a fire-and-forget
// job in a process that goes away leaves nobody to write 'failed'). But what
// she was actually looking at was a working render with no clock on its
// spinner, which is why the PAGE now counts the minutes — see spinLabel in
// public/voice.html. A slow render and a dead one used to look identical.
//
// The audio is NOT lost. ElevenLabs keeps every generation in its own history
// and hands the mp3 back for FREE, so the fix is to go and fetch what she
// already paid for rather than charge her a second time — the same call the
// Playground's banked-sheet recovery makes. Which item is hers is
// `voicelab-recover.js`, the one place that can get this wrong.
// THE CUTOFF IS A MEASUREMENT, AND THE OBVIOUS NUMBER IS WRONG (2026-08-27).
// This line read `10 * 60 * 1000`, on the reasoning that "no legitimate render
// outlives its 5-minute API timeout". Both halves are false, and the render
// that disproves them is the very take this recovery was built for: Sophie's
// 4,842-character science take ran **735 seconds** — 12m15s — and finished
// perfectly well, `done`, with a url and no error. (The identical text re-sent
// twelve minutes later came back in 75 seconds, so ElevenLabs' own latency
// swings 10x on the same input.)
//
// The timeout does not cap it either: node-fetch's `timeout` is socket
// INACTIVITY, not total duration, and a slow steady stream never idles. Do not
// "fix" that into a hard cap — it would abort exactly the 12-minute render
// this note is about.
//
// So at ten minutes the sweep would have gone looking for her real take in the
// ElevenLabs history while it was still being made. 25 minutes is twice the
// slowest render on record, and `LIVE` above means the cutoff only ever has to
// judge a job whose process is already gone.
const STUCK_AFTER_MS = 25 * 60 * 1000;
const HISTORY_PAGE = 60;

async function elHistory(pageSize = HISTORY_PAGE) {
  const data = await (await elFetch(`/history?page_size=${pageSize}`)).json();
  return data.history || [];
}

// Every render doc we can see, so the matcher knows which takes are already
// spoken for — a stuck doc must never claim the generation a doc that finished
// normally already used.
async function recentRenders(limit = 120) {
  const snap = await admin.firestore().collection(COL).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data());
}

async function recoverRender(id, opts = {}) {
  if (!admin.apps.length) throw new Error('firestore unavailable');
  if (!elKey()) throw new Error('ELEVENLABS_API_KEY is not set');
  const ref = admin.firestore().collection(COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, why: 'not found' };
  const rec = snap.data() || {};
  if (rec.status === 'done' && !opts.force) return { ok: false, why: 'already done' };

  const all = opts.all || await recentRenders();
  const items = opts.items || await elHistory();
  const claimed = all.map((r) => r.historyItemId).filter(Boolean).filter((h) => h !== rec.historyItemId);
  const { item, by, why } = pickHistoryItem(rec, items, { others: all, claimed });
  if (!item) return { ok: false, why: why || 'no generation matches this take' };
  if (opts.dry) return { ok: true, dry: true, by, historyItemId: item.history_item_id, chars: (item.text || '').length };

  const audio = await (await elFetch(`/history/${item.history_item_id}/audio`, { timeout: 180000 })).buffer();
  const url = await saveTake(id, audio, {
    historyItemId: item.history_item_id,
    recovered: 'the render was killed mid-flight — this is the generation ElevenLabs had already made',
    recoveredAt: new Date().toISOString(),
    error: admin.firestore.FieldValue.delete(),
  });
  if ((rec.kind || 'tts') !== 'sts') await fileTakeToAssets(url, rec.voiceId, rec.voiceName || '', rec.text || '');
  return { ok: true, by, url, historyItemId: item.history_item_id, bytes: audio.length };
}

// The decision on its own, so it can be tested without a Firestore or a clock.
//
// The date is read STRICTLY, for one reason a test caught before it shipped:
// `Date.parse(x || 0)` — the obvious spelling — hands `Date.parse` the NUMBER
// 0, which it coerces to the STRING "0" and parses as the year 2000, so every
// undated doc reads as twenty-six years old. Parsing only a real string leaves
// anything else NaN, and every comparison against NaN is false — a doc we
// cannot date is one we cannot claim is dead.
function isStuck(r, now, live) {
  if (!r || !r.id || r.status !== 'rendering') return false;
  if (live && live.has(r.id)) return false;
  const at = typeof r.createdAt === 'string' ? Date.parse(r.createdAt) : NaN;
  return now - at > STUCK_AFTER_MS;
}

async function sweepStuckRenders() {
  try {
    if (!admin.apps.length || !elKey()) return;
    const all = await recentRenders();
    const stuck = all.filter((r) => isStuck(r, Date.now(), LIVE));
    if (!stuck.length) return;
    let items = [];
    try { items = await elHistory(); } catch (e) { console.warn('voicelab sweep: history —', e.message); }
    for (const r of stuck) {
      let done = false;
      try {
        const out = await recoverRender(r.id, { all, items });
        done = out.ok;
        if (done) console.log(`voicelab sweep: recovered killed render ${r.id} from ElevenLabs history (${out.by})`);
      } catch (e) { console.warn(`voicelab sweep: recovery of ${r.id} —`, e.message); }
      if (done) continue;
      await admin.firestore().collection(COL).doc(r.id).update({
        status: 'failed',
        error: 'interrupted by a server restart — the audio could not be found in the ElevenLabs history either',
      }).catch(() => {});
      console.log(`voicelab sweep: marked stuck render ${r.id} failed`);
    }
  } catch (e) { console.warn('voicelab sweep:', e.message); }
}
// `.unref()` on both, or merely REQUIRING this module holds a process open
// forever — which is what a test or a one-shot script does. The server has its
// own HTTP listener keeping the loop alive, so nothing changes in production;
// without it, `node scripts/test-voicelab-stuck.js` simply never exits.
setTimeout(sweepStuckRenders, 90 * 1000).unref();
setInterval(sweepStuckRenders, 10 * 60 * 1000).unref();

// Raw body, not base64 in JSON — a voice memo is megabytes and base64 inflates
// it by a third for no reason (the `audio.js` /upload-file precedent), and XHR
// can report real progress on a phone this way.
router.post('/change', express.raw({ type: '*/*', limit: '26mb' }), async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    if (!elKey()) return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set' });
    const voiceId = String(req.query.voiceId || '').trim();
    const voiceName = String(req.query.voiceName || '').slice(0, 120);
    const name = String(req.query.name || '').slice(0, 200);
    const ext = String(req.query.ext || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp3';
    if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return res.status(400).json({ error: 'voiceId required' });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'send the audio as the request body' });
    if (buf.length > MAX_SOURCE_BYTES) {
      return res.status(413).json({ error: `that recording is ${(buf.length / 1048576).toFixed(1)}MB — the cap is 25MB` });
    }
    const id = `vl${crypto.randomBytes(6).toString('hex')}`;
    // Written to disk BEFORE the response, so the background job never holds
    // the whole recording in memory alongside the next request's.
    const tmp = path.join(os.tmpdir(), `${id}.${ext}`);
    fs.writeFileSync(tmp, buf);
    await admin.firestore().collection(COL).doc(id).set({
      id, kind: 'sts', voiceId, voiceName,
      text: name || 'a recording',
      sourceName: name, sourceExt: ext, bytes: buf.length,
      model: STS_MODEL,
      status: 'rendering',
      createdAt: new Date().toISOString(),
    });
    changeJob(id, voiceId, voiceName, tmp, ext); // fire and forget — the doc is the state
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/render', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    if (!elKey()) return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set' });
    const voiceId = String((req.body || {}).voiceId || '').trim();
    const voiceName = String((req.body || {}).voiceName || '').slice(0, 120);
    const text = String((req.body || {}).text || '').trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return res.status(400).json({ error: 'voiceId required' });
    if (!text) return res.status(400).json({ error: 'text required' });
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ error: `text is ${text.length} chars — the cap is ${MAX_CHARS}` });
    }
    const id = `vl${crypto.randomBytes(6).toString('hex')}`;
    await admin.firestore().collection(COL).doc(id).set({
      id, voiceId, voiceName, text,
      chars: text.length,
      model: MODEL_ID,
      status: 'rendering',
      createdAt: new Date().toISOString(),
    });
    renderJob(id, voiceId, voiceName, text); // fire and forget — the doc is the state
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/render/:id', async (req, res) => {
  try {
    const snap = await admin.firestore().collection(COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    res.json(snap.data());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Render that take AGAIN — same voice, same words, nothing retyped.
//
// This is the LAST resort, after /recover: recovery fetches audio she has
// already paid for and this spends credits a second time, so the page only
// ever offers it on a take that is already `failed` — i.e. one the sweep
// could not find in the ElevenLabs history either. What it buys is that a
// failed take stops being a dead end; her words are right there on the doc,
// and the alternative was pasting 4,842 characters into the box again.
//
// A NEW id on purpose: a re-render is a fresh take, and overwriting the failed
// one would erase the record of what happened to it. A voice-changer take
// re-runs from its SOURCE audio, which is kept for exactly this.
router.post('/render/:id/again', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    if (!elKey()) return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set' });
    const old = String(req.params.id || '');
    if (!/^vl[a-f0-9]{12}$/.test(old)) return res.status(400).json({ error: 'bad id' });
    const snap = await admin.firestore().collection(COL).doc(old).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    const r = snap.data() || {};
    if (r.status === 'rendering' && LIVE.has(old)) {
      return res.status(409).json({ error: 'that one is still rendering' });
    }
    const id = `vl${crypto.randomBytes(6).toString('hex')}`;
    const base = {
      id, voiceId: r.voiceId, voiceName: r.voiceName || '',
      model: (r.kind || 'tts') === 'sts' ? STS_MODEL : MODEL_ID,
      status: 'rendering', createdAt: new Date().toISOString(), againOf: old,
    };

    if ((r.kind || 'tts') === 'sts') {
      if (!r.sourceUrl) return res.status(409).json({ error: 'that take has no recording to run again' });
      const ext = String(r.sourceExt || 'mp3').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp3';
      const tmp = path.join(os.tmpdir(), `${id}-again.${ext}`);
      const src = await fetch(r.sourceUrl, { timeout: 120000 });
      if (!src.ok) return res.status(502).json({ error: 'could not read that recording back' });
      fs.writeFileSync(tmp, await src.buffer());
      await admin.firestore().collection(COL).doc(id).set({
        ...base, kind: 'sts', text: r.text || 'a recording', sourceExt: ext,
      });
      changeJob(id, r.voiceId, base.voiceName, tmp, ext);
    } else {
      if (!r.text) return res.status(409).json({ error: 'that take has no text to say again' });
      await admin.firestore().collection(COL).doc(id).set({
        ...base, text: r.text, chars: r.text.length,
      });
      renderJob(id, r.voiceId, base.voiceName, r.text);
    }
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    // Filtered in MEMORY, not in the query: `kind` only exists on docs written
    // since the changer shipped, so a where() would silently hide every render
    // she made before it. Absent means 'tts' — that is what they all were.
    const kind = String(req.query.kind || '').trim();
    const snap = await admin.firestore().collection(COL)
      .orderBy('createdAt', 'desc').limit(kind ? 90 : 30).get();
    let rows = snap.docs.map((d) => d.data());
    if (kind) rows = rows.filter((r) => (r.kind || 'tts') === kind).slice(0, 30);
    res.json({ renders: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A take as a DOWNLOAD. The Storage url alone only plays inline — a phone
// needs a same-origin `Content-Disposition: attachment` to put the file in
// Files (the `cuttingroom` /:id/file precedent). `?src=1` is the voice
// changer's SOURCE — what she recorded, before the conversion — which is kept
// on purpose and had no way out of the page at all.
router.get('/file/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^vl[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    const snap = await admin.firestore().collection(COL).doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    const r = snap.data() || {};
    const wantSrc = String(req.query.src || '') === '1';
    if (wantSrc && !r.sourceUrl) return res.status(404).json({ error: 'no source on this take' });
    if (!wantSrc && r.status !== 'done') return res.status(409).json({ error: 'not finished yet' });
    // The extension is the SOURCE's own (m4a, webm, wav…) — a recording renamed
    // .mp3 is a file her phone opens wrong.
    const ext = wantSrc ? String(r.sourceExt || 'mp3').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp3' : 'mp3';
    const objPath = wantSrc ? `${SOURCE_FOLDER}/${id}.${ext}` : `${STORAGE_FOLDER}/${id}.mp3`;
    const clean = (s) => String(s || '').replace(/[^a-zA-Z0-9 \-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const name = (clean(`${r.voiceName || 'voice'} ${clean(r.text).slice(0, 50)}`) || 'voice take').slice(0, 80)
      + (wantSrc ? ' (source)' : '');
    res.set('Content-Type', wantSrc ? mimeFor(ext) : 'audio/mpeg');
    res.set('Content-Disposition', `attachment; filename="${name}.${ext}"`);
    admin.storage().bucket().file(objPath).createReadStream()
      .on('error', (e) => {
        console.warn('voicelab: download stream —', e.message);
        if (!res.headersSent) res.status(404).json({ error: 'that audio is gone' });
        else { try { res.destroy(); } catch { /* closed */ } }
      })
      .pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pull a killed render's audio back out of the ElevenLabs history. The sweep
// does this by itself ten minutes after the kill; this is the door for a take
// that was swept to `failed` before the recovery existed, and for a chat that
// wants to see the match first (`dry:true` costs nothing and writes nothing).
router.post('/render/:id/recover', express.json({ limit: '8kb' }), async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^vl[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    const body = req.body || {};
    const out = await recoverRender(id, { dry: body.dry === true, force: body.force === true });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/render/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!/^vl[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    await admin.storage().bucket().file(`${STORAGE_FOLDER}/${id}.mp3`).delete({ ignoreNotFound: true });
    await admin.firestore().collection(COL).doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, recoverRender, sweepStuckRenders, isStuck, STUCK_AFTER_MS };
