// ─── Dream app (/api/dreamapp, page at /dreams) — the shared dream feed ─────
//
// The real app behind the mockups: signed-in friends write dreams, draw them,
// choose what's public per piece, and read each other's — behind the
// share-to-see gate. Accounts are membry-df528 Firebase Auth, the SAME users
// as XI / the witch app (Google + email/password; the witch app already signs
// people in from this domain, so authorized domains are done).
//
// Every route is server-enforced: the client only ever talks to this API with
// an ID token — no direct Firestore reads — so the gate and per-piece
// visibility cannot be bypassed by a curious friend with devtools.
//
// Data (deckfactory Firestore):
//   forge-dreamapp        one doc per dream { id, uid, name, text, title,
//                         createdAt, publicOn (YYYY-MM-DD PT | null),
//                         audience ('everyone' | 'friends'; absent = everyone),
//                         wordsPublic, panels:[{i, url, captions, promptUsed,
//                         public}], drawJob, drawnAt, feltCount }
//   forge-dreamapp-felt   one doc per dream+uid (the heart)
//   forge-dreamapp-comments  one doc per comment { dreamId, uid, name, text, at }
//   forge-dreamapp-teams  one doc per dream team { id, name, code, createdBy,
//                         createdAt, memberUids:[uid], members:[{uid, name,
//                         joinedAt, friendsToo}] } — see THE DIAL below
//
// The AI names each dream (2-5 words, shown in fuchsia in the app) as a
// background job right after capture; drawing is ONE SQUARE PICTURE at medium
// quality (movies.js makeDreamImage — style ref, no character cards) as a
// background job on the doc, 5.3¢ a dream.
//
// It used to draw a comic of up to six portrait pages at low quality
// (makeDreamPagesV2). Sophie, Aug 2026: "the images shud default to square and
// medium quality and just one image … pick one strong image, and embellish it
// w the other details of the dream, rather than comic book style." The panels
// array stays an ARRAY — sharing, the cover and the lightbox are all per-panel
// and every dream drawn before this still has its pages.

const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { makeDreamImage, transcribeAudio } = require('./movies');

const router = express.Router();

// ── THE SHARE-TO-SEE GATE — currently OFF (Sophie, Aug 2026) ────────────────
// Flip this back to true to require sharing a dream before the feed opens.
// It is one constant on purpose: the whole mechanism (sealed response, the
// sharedToday check) stays built and tested underneath, so turning it back on
// is this line and nothing else.
// While it's OFF the feed also widens past today (FEED_DAYS) — a today-only
// feed with no gate reads as empty every morning.
const GATE_ON = false;
const FEED_DAYS = 14;

const DREAMS = 'forge-dreamapp';
const FELT = 'forge-dreamapp-felt';
const COMMENTS = 'forge-dreamapp-comments';
const TEAMS = 'forge-dreamapp-teams';
const QUALITIES = new Set(['low', 'medium']);
const TEXT_MIN = 10;
const TEXT_MAX = 8000;
const COMMENT_MAX = 800;

// Two dreams from the SAME person on the SAME day sit together in the feed, so
// the page needs to know which posts share an author — but dreams are shown
// unattributed (Sophie), so the uid itself must not travel. `by` is a stable
// one-way tag: enough to group, useless for identifying anyone.
const byTag = (uid) => crypto.createHash('sha1').update(String(uid)).digest('hex').slice(0, 12);

// ── THE DIAL: everyone ✳ · friends ☾ · just me ◦ (Sophie, Aug 2026) ─────────
// The middle audience and DREAM TEAMS, her design after the circles study
// (docs/dream-feed-circles.md): "let's just do everyone and then friends and
// then just me … and then we'll also have something called circles except I
// won't call it circles … when you post to everyone, it automatically shows
// up in your circle because it's public, and then when you join a group …
// you can configure it so that when you post to friends it also posts to
// that circle, or that it doesn't."
//
// So a TEAM is a DISTRIBUTION LIST, not a second feed: joined by invite link
// (the unguessable code IS the key — the fruit-poll pattern; nothing is
// discoverable without it), and every member carries their own `friendsToo`
// routing flag — "do MY friends-posts land here?" A post to everyone reaches
// teammates because it is public; a post to friends reaches exactly the
// people who share a team the AUTHOR routed friends-posts into. Dreams stay
// unattributed in the feed either way — the audience changes who can read a
// night, never whose name is on it.
//
// This rule is the whole feature, kept pure for its test: does the author's
// friends-audience post reach a viewer holding these teams? (The viewer's own
// membership is a given — `teams` is the list the viewer belongs to.)
function friendsReaches(authorUid, viewerTeams) {
  return (viewerTeams || []).some((t) => (t.members || [])
    .some((m) => m.uid === authorUid && m.friendsToo !== false));
}
// One dream doc, one viewer: readable in the feed? (Own dreams always are;
// legacy docs with no audience are everyone's.)
function canRead(doc, uid, viewerTeams) {
  if (doc.audience !== 'friends') return true;
  return doc.uid === uid || friendsReaches(doc.uid, viewerTeams);
}
const audienceOf = (body) => (body?.audience === 'friends' ? 'friends' : 'everyone');

async function teamsOf(uid) {
  const snap = await db().collection(TEAMS).where('memberUids', 'array-contains', uid).get();
  return snap.docs.map((d) => d.data());
}
function teamView(t, uid) {
  const me = (t.members || []).find((m) => m.uid === uid);
  return {
    id: t.id, name: t.name, code: t.code,
    members: (t.members || []).map((m) => m.name),
    friendsToo: me ? me.friendsToo !== false : true,
    mine: t.createdBy === uid,
  };
}

// ── A NIGHT IS THE ENTRY, not a dream (Sophie, Aug 2026) ────────────────────
// "Generally people only have one dream per night, or the ones they had are
// basically one dream. They shouldn't be separate entries." So one person's
// dreams from one night are ONE post: one cover photo, one heart, one comment
// thread. The pieces are still separate DOCS underneath — each was captured,
// drawn and shared on its own — and that stays true, because sharing is
// per-dream and per-panel and merging the storage would throw that away.
//
// The night's SPINE is its chronologically first dream, and it carries the
// night: its id is the night's id, its title titles the entry, its doc holds
// the featured cover, and new hearts/comments land on it. That choice needs no
// migration and no second collection — hearts and comments already on a later
// dream are still counted and still read, they simply stop being separately
// addressable, which is the whole point of the change.
const spineOf = (dreams) => dreams[0];
// Which night a dream belongs to. `night` is stamped at capture; every dream
// written before that field existed falls back to the day it was published and
// then to the day it was written, so old entries group exactly as they did.
const nightOf = (doc) => doc.night || doc.publicOn || String(doc.createdAt || '').slice(0, 10);
function nightKey(doc) { return `${doc.uid}|${nightOf(doc)}`; }

// Chronological — oldest first. The default cover is "the one that's
// chronologically first", so this order IS the rule, not a display preference.
function nightsFrom(docs) {
  const by = new Map();
  for (const d of docs) {
    const k = nightKey(d);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(d);
  }
  const out = [];
  for (const group of by.values()) {
    out.push(group.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
  }
  // Newest night first, judged by its LATEST dream — a night that gained a
  // second dream this morning is fresher than one that didn't.
  return out.sort((a, b) => (a[a.length - 1].createdAt < b[b.length - 1].createdAt ? 1 : -1));
}

// The public panels of a night, in order, each tagged with the dream it came
// from — so a cover can name one and the client can open the right dream.
function nightPanels(dreams) {
  const out = [];
  for (const d of dreams) {
    for (const p of (d.panels || [])) {
      if (p.public) out.push({ dreamId: d.id, i: p.i, url: p.url, captions: p.captions });
    }
  }
  return out;
}

// Default cover = the first public panel of the night. She can feature another
// (`coverPanel` on the spine); a featured panel that has since been made
// private falls back rather than showing a hole.
function coverOf(dreams, panels) {
  const want = spineOf(dreams).coverPanel;
  if (want) {
    const hit = panels.find((p) => p.dreamId === want.dreamId && p.i === Number(want.i));
    if (hit) return hit;
  }
  return panels[0] || null;
}

let deps = { membryAuth: null };
function init(d) { deps = { ...deps, ...d }; }

const db = () => (admin.apps.length ? admin.firestore() : null);

// The feed's day. US Pacific — the feed turns over with the morning.
const feedDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

// The compose footer's "night N of your streak": consecutive nights WRITTEN
// (not shared), counting back from today — or from yesterday, because a streak
// is not broken by a night you haven't written down yet this morning.
function streakOf(nightDays, today) {
  const has = new Set(nightDays);
  const day = (iso, back) => {
    const p = String(iso).split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] - back));
    return d.toISOString().slice(0, 10);
  };
  let start = has.has(today) ? today : (has.has(day(today, 1)) ? day(today, 1) : null);
  if (!start) return 0;
  let n = 0;
  while (has.has(day(start, n))) n++;
  return n;
}

// ── auth: every route below /status requires a membry ID token ─────────────
async function identify(req) {
  const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok || !deps.membryAuth) return null;
  try {
    const auth = await deps.membryAuth();
    if (!auth) return null;
    const dec = await auth.verifyIdToken(tok);
    const name = (dec.name || '').split(' ')[0] || (dec.email || '').split('@')[0] || 'dreamer';
    return { uid: dec.uid, name };
  } catch { return null; }
}
async function requireUser(req, res, next) {
  const user = await identify(req);
  if (!user) return res.status(401).json({ error: 'sign in first' });
  req.user = user;
  next();
}

// ── light per-uid rate limits (identity beats IP here) ──────────────────────
const stamps = new Map(); // key -> [ms, ...]
function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (stamps.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { stamps.set(key, list); return true; }
  list.push(now);
  stamps.set(key, list);
  return false;
}

// ── the AI name (background, right after capture) ───────────────────────────
async function writeTitle(id, text) {
  const ref = db().collection(DREAMS).doc(id);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [
          { role: 'system', content: 'Name this dream in 2-5 words, Title Case, built from the dream\'s own concrete images and words. No quotes, no period, no interpretation — a name, not a summary.' },
          { role: 'user', content: text.slice(0, 2000) },
        ],
      }),
    });
    const j = await r.json();
    const title = (j.choices?.[0]?.message?.content || '').trim().replace(/^["']|["'.]$/g, '').slice(0, 60);
    await ref.set({ title: title || 'A Dream' }, { merge: true });
  } catch {
    await ref.set({ title: 'A Dream' }, { merge: true }).catch(() => {});
  }
}

// ── drawing (background job on the doc, movies.js engine) ───────────────────
const LIVE = new Set();
async function draw(doc, quality) {
  const ref = db().collection(DREAMS).doc(doc.id);
  const dream = { id: doc.id, dreamText: doc.text, castApproved: [], driftCues: [] };
  let lastSave = 0;
  const progress = async (done, total, label) => {
    doc.drawJob = { status: 'drawing', done, total, label, startedAt: doc.drawJob.startedAt };
    if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await ref.set(doc).catch(() => {}); }
  };
  try {
    await makeDreamImage(dream, quality, progress);
    doc.panels = (dream.pages || []).map((p, i) => ({
      i, url: p.url, captions: p.captions || [], promptUsed: p.promptUsed || '', public: false,
    }));
    doc.drawnAt = new Date().toISOString();
    doc.drawJob = null;
  } catch (e) {
    doc.drawJob = { status: 'failed', error: e.message || 'the drawing failed' };
  } finally {
    LIVE.delete(doc.id);
    await ref.set(doc).catch(() => {});
  }
}

// A doc can claim "drawing" after a restart with nobody drawing it.
function jobDied(doc) {
  const j = doc.drawJob;
  return !!(j && j.status === 'drawing' && !LIVE.has(doc.id)
    && Date.now() - new Date(j.startedAt || 0).getTime() > 2 * 60 * 1000);
}
function repairJob(doc) {
  if (jobDied(doc)) {
    doc.drawJob = { status: 'failed', error: 'the drawing was interrupted — draw it again' };
    db().collection(DREAMS).doc(doc.id).set(doc).catch(() => {});
  }
  return doc;
}

// What the owner sees of their own dream.
function mine(doc) {
  return {
    id: doc.id, text: doc.text, title: doc.title || null,
    // The night it belongs to — "my dreams" lists one row per night, because
    // you post once a day (Sophie).
    night: nightOf(doc),
    createdAt: doc.createdAt, publicOn: doc.publicOn || null,
    audience: doc.audience === 'friends' ? 'friends' : 'everyone',
    wordsPublic: doc.wordsPublic !== false,
    panels: (doc.panels || []).map((p) => ({ i: p.i, url: p.url, captions: p.captions, public: !!p.public })),
    drawJob: doc.drawJob || null, drawnAt: doc.drawnAt || null,
    feltCount: doc.feltCount || 0,
    mood: doc.mood || null, lucid: !!doc.lucid, recurring: !!doc.recurring,
    elems: doc.elems || [],
  };
}

async function sharedToday(uid) {
  const snap = await db().collection(DREAMS)
    .where('uid', '==', uid).where('publicOn', '==', feedDay()).limit(1).get();
  return !snap.empty;
}

// ── routes ──────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: !!admin.apps.length, openai: !!process.env.OPENAI_API_KEY });
});

router.use(express.json({ limit: '256kb' }));
router.use(requireUser);

router.get('/me', async (req, res) => {
  try {
    const shared = await sharedToday(req.user.uid);
    const todays = await db().collection(DREAMS).where('publicOn', '==', feedDay()).get();
    // The compose footer: streak + the newest night before today, by title.
    const own = (await db().collection(DREAMS).where('uid', '==', req.user.uid).get())
      .docs.map((d) => d.data());
    const today = feedDay();
    const streak = streakOf([...new Set(own.map(nightOf))], today);
    const last = own.filter((d) => nightOf(d) < today)
      .sort((a, b) => (nightOf(a) < nightOf(b) ? 1 : -1))[0] || null;
    res.json({ name: req.user.name, sharedToday: shared, today, count: todays.size,
               streak, lastNight: last ? (last.title || 'a dream') : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Voice → words, for the compose sheet's mic and upload-a-recording buttons.
// Raw audio bytes in (the JSON body parser above ignores non-JSON types), the
// transcript out; the dream still goes through POST /dreams as typed text, so
// speaking is the same pipeline as writing. ~$0.006/min, once per recording.
router.post('/transcribe', express.raw({ type: () => true, limit: '30mb' }), async (req, res) => {
  try {
    if (limited(`transcribe:${req.user.uid}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'that is a lot of recordings — try again in a bit' });
    }
    const buf = req.body;
    if (!buf || !buf.length) return res.status(400).json({ error: 'empty recording' });
    const mime = String(req.headers['content-type'] || 'audio/mp4').split(';')[0];
    const ext = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
                  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/aac': 'aac',
                  'video/mp4': 'mp4' }[mime] || 'm4a';
    const t = await transcribeAudio(buf, 'dream.' + ext);
    const text = String(t.text || '').trim();
    if (!text) return res.status(422).json({ error: "couldn't make out any words in that recording" });
    res.json({ text, duration: t.duration });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.post('/dreams', async (req, res) => {
  try {
    if (limited(`dreams:${req.user.uid}`, 20, 24 * 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'that is a lot of dreams for one day — try tomorrow' });
    }
    const text = String(req.body?.text || '').trim();
    if (text.length < TEXT_MIN) return res.status(400).json({ error: 'write the dream down first' });
    if (text.length > TEXT_MAX) return res.status(400).json({ error: `keep it under ${TEXT_MAX} characters` });
    // The compose sheet's marks — captured when the dream is written, because
    // no later moment knows them. Stored, not yet shown anywhere.
    const MOODS = new Set(['soft', 'anxious', 'tender', 'strange']);
    const mood = MOODS.has(req.body?.mood) ? req.body.mood : null;
    const lucid = req.body?.lucid === true;
    const recurring = req.body?.recurring === true;
    const elems = Array.isArray(req.body?.elems)
      ? req.body.elems.slice(0, 3).map((e) => String(e || '').trim().slice(0, 80)).filter(Boolean)
      : [];
    const ref = db().collection(DREAMS).doc();
    const doc = {
      id: ref.id, uid: req.user.uid, name: req.user.name, text,
      mood, lucid, recurring, elems,
      title: null, createdAt: new Date().toISOString(),
      // THE NIGHT IS STAMPED WHEN THE DREAM IS WRITTEN, not when it is shared.
      // `publicOn` is a publication date and always was; using it to group the
      // feed meant a night did not EXIST until it was published — so nothing
      // could be offered "share the whole night", and two dreams from one night
      // shared on different days landed as two separate entries. `night` is the
      // dreamer's own calendar day in PT, the same boundary the feed uses.
      night: feedDay(),
      publicOn: null, wordsPublic: true, panels: [], drawJob: null, drawnAt: null, feltCount: 0,
    };
    await ref.set(doc);
    writeTitle(ref.id, text); // background — the client polls the dream
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dreams', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).where('uid', '==', req.user.uid).get();
    const docs = snap.docs.map((d) => repairJob(d.data()))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
    res.json({ dreams: docs.map(mine) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dreams/:id', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    res.json(mine(repairJob(snap.data())));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams/:id/draw', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const doc = repairJob(snap.data());
    if (doc.drawJob && doc.drawJob.status === 'drawing') return res.status(409).json({ error: 'already drawing' });
    if ((doc.panels || []).length) return res.status(409).json({ error: 'already drawn' });
    if (limited(`draw:${req.user.uid}`, 6, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'too many drawings for now — try again later' });
    }
    const quality = QUALITIES.has(req.body?.quality) ? req.body.quality : 'medium';
    doc.drawJob = { status: 'drawing', done: 0, total: 0, label: 'starting', startedAt: new Date().toISOString() };
    await db().collection(DREAMS).doc(doc.id).set(doc);
    LIVE.add(doc.id);
    draw(doc, quality); // deliberately not awaited
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ONE POST A DAY (Sophie, Aug 2026) ───────────────────────────────────────
// "Someone can only really post once per day, so that's why it counts as one
// dream. Sometimes I give a long recording and the model breaks it up into
// different dreams so it can figure out the chronology, but that's just a step
// towards illustrating it — it all counts as one. You can just add to your
// single post later."
//
// So the SPLIT INTO DREAMS IS MACHINERY, not something the reader ever sees,
// and sharing is a decision about the night. `POST /nights/:id/share` publishes
// the whole night in one go: her words are one choice, and each picture across
// the night is its own. Adding to the day later re-shares the same night.
async function ownNight(uid, nightDate) {
  const snap = await db().collection(DREAMS).where('uid', '==', uid).get();
  return snap.docs.map((d) => d.data())
    .filter((d) => nightOf(d) === nightDate)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

// The night that holds this dream, as its OWNER sees it — published or not.
router.get('/nights/:id', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const group = await ownNight(req.user.uid, nightOf(snap.data()));
    const spine = spineOf(group);
    res.json({
      id: spine.id,
      night: nightOf(spine),
      title: spine.title || null,
      shared: !!spine.publicOn,
      audience: spine.audience === 'friends' ? 'friends' : 'everyone',
      createdAt: spine.createdAt,
      wordsPublic: spine.wordsPublic !== false,
      dreams: group.map((d) => ({
        id: d.id, title: d.title || null, text: d.text, createdAt: d.createdAt,
        drawJob: d.drawJob || null,
        panels: (d.panels || []).map((p) => ({ i: p.i, url: p.url, public: !!p.public })),
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/nights/:id/share', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const group = await ownNight(req.user.uid, nightOf(snap.data()));
    const words = req.body?.words !== false;
    // Panels are named across the whole night, so a picture is identified by
    // which dream drew it as well as its index.
    const want = new Set((Array.isArray(req.body?.panels) ? req.body.panels : [])
      .map((p) => `${p.dreamId}|${Number(p.i)}`));
    const anyPanel = group.some((d) => (d.panels || []).some((p) => want.has(`${d.id}|${p.i}`)));
    if (!words && !anyPanel) return res.status(400).json({ error: 'switch at least one thing public first' });
    const on = feedDay();
    const audience = audienceOf(req.body);
    const batch = db().batch();
    for (const d of group) {
      batch.update(db().collection(DREAMS).doc(d.id), {
        wordsPublic: words,
        panels: (d.panels || []).map((p) => ({ ...p, public: want.has(`${d.id}|${p.i}`) })),
        publicOn: on,
        audience,
        name: req.user.name,
      });
    }
    await batch.commit();
    res.json({ ok: true, night: nightOf(spineOf(group)), publicOn: on, dreams: group.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams/:id/share', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const doc = snap.data();
    const words = req.body?.words !== false;
    const publicIdx = new Set(Array.isArray(req.body?.panels) ? req.body.panels.map(Number) : []);
    doc.wordsPublic = words;
    doc.panels = (doc.panels || []).map((p) => ({ ...p, public: publicIdx.has(p.i) }));
    if (!words && !doc.panels.some((p) => p.public)) {
      return res.status(400).json({ error: 'switch at least one thing public first' });
    }
    doc.publicOn = feedDay();
    doc.audience = audienceOf(req.body);
    doc.name = req.user.name;
    await db().collection(DREAMS).doc(doc.id).set(doc);
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/feed', async (req, res) => {
  try {
    const today = feedDay();
    // Gated: strictly today's dreams. Open: the last FEED_DAYS, so the feed
    // still reads as a feed on a quiet morning.
    const since = new Date(Date.now() - FEED_DAYS * 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const snap = GATE_ON
      ? await db().collection(DREAMS).where('publicOn', '==', today).get()
      : await db().collection(DREAMS).where('publicOn', '>=', since).get();
    if (GATE_ON && !(await sharedToday(req.user.uid))) {
      return res.json({ sealed: true, count: snap.size, today });
    }
    // Friends-audience dreams reach only the people the author routed them to
    // (see THE DIAL above). Filtered server-side like everything else here —
    // the count on the sealed card above deliberately still counts them: a
    // dream you can't read yet is still a dream from last night.
    const myTeams = await teamsOf(req.user.uid);
    const readable = snap.docs.map((d) => d.data())
      .filter((d) => canRead(d, req.user.uid, myTeams));
    const feltSnap = await db().collection(FELT).where('uid', '==', req.user.uid).get();
    const felt = new Set(feltSnap.docs.map((d) => d.data().dreamId));
    // One entry per person per night. The counts SUM across the night's dreams
    // rather than reading the spine's alone, so hearts and comments left before
    // this change still show — they just belong to the night now.
    const nights = nightsFrom(readable).map((group) => {
      const spine = spineOf(group);
      const panels = nightPanels(group);
      return {
        id: spine.id,
        title: spine.title || 'A Dream',
        // `name` still rides along for a later reader; the feed does not show
        // it — nights are grouped under their DAY, unattributed (Sophie).
        name: spine.name,
        by: byTag(spine.uid),
        mine: spine.uid === req.user.uid,
        createdAt: group[group.length - 1].createdAt,
        publicOn: spine.publicOn,
        audience: spine.audience === 'friends' ? 'friends' : 'everyone',
        dreams: group.map((doc) => ({
          id: doc.id,
          title: doc.title || 'A Dream',
          words: doc.wordsPublic !== false ? doc.text : null,
        })),
        panels,
        cover: coverOf(group, panels),
        feltCount: group.reduce((n, d) => n + (d.feltCount || 0), 0),
        felt: group.some((d) => felt.has(d.id)),
        commentCount: group.reduce((n, d) => n + (d.commentCount || 0), 0),
      };
    });
    res.json({ sealed: false, today, nights });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Every dream of the night the given dream belongs to, oldest first. A dream
// that was never shared is a night of one.
async function nightDreams(id) {
  const snap = await db().collection(DREAMS).doc(id).get();
  if (!snap.exists) return null;
  const doc = snap.data();
  if (!doc.publicOn) return [doc];
  // Queried by UID and grouped in memory, not by a `where('night')` — dreams
  // written before that field existed do not carry it, and a query on it would
  // silently drop exactly those from their own night. One person's dreams are
  // few (20/day, capped), so this costs nothing.
  const sibs = await db().collection(DREAMS).where('uid', '==', doc.uid).get();
  const group = sibs.docs.map((d) => d.data())
    .filter((d) => d.publicOn && nightOf(d) === nightOf(doc))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  return group.length ? group : [doc];
}

// The heart belongs to the NIGHT (Sophie). A mark left on any dream of the
// night counts as felt, so un-hearting clears every one of them — otherwise a
// heart left on the second dream before this change could never be taken back.
router.post('/dreams/:id/felt', async (req, res) => {
  try {
    const group = await nightDreams(req.params.id);
    if (!group) return res.status(404).json({ error: 'not found' });
    const spine = spineOf(group);
    const marks = group.map((d) => db().collection(FELT).doc(`${d.id}_${req.user.uid}`));
    const result = await db().runTransaction(async (tx) => {
      const docs = await Promise.all(group.map((d) => tx.get(db().collection(DREAMS).doc(d.id))));
      const held = await Promise.all(marks.map((m) => tx.get(m)));
      const counts = docs.map((d) => (d.exists ? d.data().feltCount || 0 : 0));
      const any = held.some((m) => m.exists);
      if (any) {
        held.forEach((m, i) => {
          if (!m.exists) return;
          tx.delete(marks[i]);
          tx.update(db().collection(DREAMS).doc(group[i].id), { feltCount: Math.max(0, counts[i] - 1) });
          counts[i] = Math.max(0, counts[i] - 1);
        });
        return { felt: false, feltCount: counts.reduce((a, b) => a + b, 0) };
      }
      const si = group.findIndex((d) => d.id === spine.id);
      tx.set(marks[si], { dreamId: spine.id, uid: req.user.uid, at: new Date().toISOString() });
      tx.update(db().collection(DREAMS).doc(spine.id), { feltCount: counts[si] + 1 });
      counts[si] += 1;
      return { felt: true, feltCount: counts.reduce((a, b) => a + b, 0) };
    });
    res.json(result);
  } catch (e) { res.status(e.message === 'not found' ? 404 : 500).json({ error: e.message }); }
});

// Feature a different photo for the night. Owner only, and it names a PANEL of
// one of the night's own dreams — stored on the spine, which is where the
// night's own facts live.
router.post('/nights/:id/cover', async (req, res) => {
  try {
    const group = await nightDreams(req.params.id);
    if (!group) return res.status(404).json({ error: 'not found' });
    const spine = spineOf(group);
    if (spine.uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const dreamId = String(req.body?.dreamId || '');
    const i = Number(req.body?.i);
    const owner = group.find((d) => d.id === dreamId);
    const panel = (owner?.panels || []).find((p) => p.i === i && p.public);
    if (!panel) return res.status(400).json({ error: 'pick one of this night’s shared pictures' });
    await db().collection(DREAMS).doc(spine.id).update({ coverPanel: { dreamId, i } });
    res.json({ ok: true, cover: { dreamId, i, url: panel.url, captions: panel.captions } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── dream teams (see THE DIAL above) ────────────────────────────────────────
// A team is joined by its link (`/t/<code>` serves the app; the client joins
// after sign-in). Every write to the roster is a transaction — two friends
// tapping the same invite at once must both land.
router.get('/teams', async (req, res) => {
  try {
    const teams = await teamsOf(req.user.uid);
    teams.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    res.json({ teams: teams.map((t) => teamView(t, req.user.uid)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/teams', async (req, res) => {
  try {
    if (limited(`teams:${req.user.uid}`, 10, 24 * 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'that is a lot of teams for one day' });
    }
    const name = String(req.body?.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'name it first' });
    const ref = db().collection(TEAMS).doc();
    const team = {
      id: ref.id, name, code: crypto.randomBytes(9).toString('base64url'),
      createdBy: req.user.uid, createdAt: new Date().toISOString(),
      memberUids: [req.user.uid],
      members: [{ uid: req.user.uid, name: req.user.name, joinedAt: new Date().toISOString(), friendsToo: true }],
    };
    await ref.set(team);
    res.json(teamView(team, req.user.uid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/teams/join', async (req, res) => {
  try {
    if (limited(`teamjoin:${req.user.uid}`, 20, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'slow down a moment' });
    }
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'no invite code' });
    const snap = await db().collection(TEAMS).where('code', '==', code).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'that invite doesn’t open anything' });
    const ref = snap.docs[0].ref;
    const team = await db().runTransaction(async (tx) => {
      const cur = (await tx.get(ref)).data();
      if (!(cur.memberUids || []).includes(req.user.uid)) {
        cur.memberUids = [...(cur.memberUids || []), req.user.uid];
        cur.members = [...(cur.members || []),
          { uid: req.user.uid, name: req.user.name, joinedAt: new Date().toISOString(), friendsToo: true }];
        tx.update(ref, { memberUids: cur.memberUids, members: cur.members });
      }
      return cur;
    });
    res.json(teamView(team, req.user.uid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// My routing flag on one team: do my friends-posts land here?
router.post('/teams/:id/route', async (req, res) => {
  try {
    const ref = db().collection(TEAMS).doc(req.params.id);
    const team = await db().runTransaction(async (tx) => {
      const got = await tx.get(ref);
      if (!got.exists) throw new Error('not found');
      const cur = got.data();
      const me = (cur.members || []).find((m) => m.uid === req.user.uid);
      if (!me) throw new Error('not found');
      me.friendsToo = req.body?.friendsToo !== false;
      tx.update(ref, { members: cur.members });
      return cur;
    });
    res.json(teamView(team, req.user.uid));
  } catch (e) { res.status(e.message === 'not found' ? 404 : 500).json({ error: e.message }); }
});

router.post('/teams/:id/leave', async (req, res) => {
  try {
    const ref = db().collection(TEAMS).doc(req.params.id);
    await db().runTransaction(async (tx) => {
      const got = await tx.get(ref);
      if (!got.exists) throw new Error('not found');
      const cur = got.data();
      tx.update(ref, {
        memberUids: (cur.memberUids || []).filter((u) => u !== req.user.uid),
        members: (cur.members || []).filter((m) => m.uid !== req.user.uid),
      });
    });
    res.json({ ok: true });
  } catch (e) { res.status(e.message === 'not found' ? 404 : 500).json({ error: e.message }); }
});

// ── comments ────────────────────────────────────────────────────────────────
// A comment is only readable where the dream itself is: it must be in the feed
// (publicOn set) or be your own. Comments DO carry a name — an unsigned reply
// is useless — which is the one place this app names anybody.
async function readableDream(id, uid) {
  const snap = await db().collection(DREAMS).doc(id).get();
  if (!snap.exists) return null;
  const doc = snap.data();
  if (!doc.publicOn && doc.uid !== uid) return null;
  // A friends-audience dream is only readable where its feed card is.
  if (doc.publicOn && !canRead(doc, uid, await teamsOf(uid))) return null;
  return doc;
}

router.get('/dreams/:id/comments', async (req, res) => {
  try {
    const dream = await readableDream(req.params.id, req.user.uid);
    if (!dream) return res.status(404).json({ error: 'not found' });
    // ONE thread per night (Sophie): every comment left on any dream of the
    // night, so replies written before the change are still in the thread.
    const group = await nightDreams(req.params.id);
    const ids = (group || [dream]).map((d) => d.id);
    const snaps = await Promise.all(ids.map((id) => db().collection(COMMENTS).where('dreamId', '==', id).get()));
    const comments = snaps.flatMap((s) => s.docs.map((d) => d.data()))
      .sort((a, b) => (a.at < b.at ? -1 : 1)) // oldest first — a thread reads down
      .map((c) => ({ id: c.id, name: c.name, text: c.text, at: c.at, mine: c.uid === req.user.uid }));
    res.json({ comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams/:id/comments', async (req, res) => {
  try {
    if (limited(`comment:${req.user.uid}`, 40, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'slow down a moment' });
    }
    const dream = await readableDream(req.params.id, req.user.uid);
    if (!dream) return res.status(404).json({ error: 'not found' });
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'write something first' });
    if (text.length > COMMENT_MAX) return res.status(400).json({ error: `keep it under ${COMMENT_MAX} characters` });
    const ref = db().collection(COMMENTS).doc();
    const comment = {
      id: ref.id, dreamId: req.params.id, uid: req.user.uid,
      name: req.user.name, text, at: new Date().toISOString(),
    };
    await ref.set(comment);
    // The count rides on the dream so the feed needs no second query per post.
    const dreamRef = db().collection(DREAMS).doc(req.params.id);
    await db().runTransaction(async (tx) => {
      const cur = await tx.get(dreamRef);
      if (cur.exists) tx.update(dreamRef, { commentCount: (cur.data().commentCount || 0) + 1 });
    }).catch(() => {});
    // The count the client shows is the NIGHT's, so it has to sum the group —
    // the spine's own count would read low wherever an older comment sits on a
    // later dream of the same night.
    // Read AFTER the increment transaction above, so the new comment is already
    // in the stored counts — adding one here as well would double it.
    const group = (await nightDreams(req.params.id)) || [dream];
    const total = group.reduce((n, d) => n + (d.commentCount || 0), 0);
    res.json({ comment: { ...comment, mine: true }, commentCount: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// The night rules are exported for their test — they are pure, and they are
// the load-bearing half of "one night is one entry". friendsReaches/canRead
// are the whole friends-audience rule, exported the same way.
module.exports = { router, init, nightsFrom, nightPanels, coverOf, spineOf, streakOf,
                   friendsReaches, canRead };
