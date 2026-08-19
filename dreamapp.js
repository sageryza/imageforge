// ─── Dream app (/api/dreamapp, page at /dreamfeed) — the shared dream feed ──
//
// The real app behind the mockups: signed-in friends write dreams, draw them,
// choose who sees them, and read each other's. Accounts are membry-df528
// Firebase Auth, the SAME users as XI / the witch app (Google + email/password;
// the witch app already signs people in from this domain, so authorized
// domains are done).
//
// Every route is server-enforced: the client only ever talks to this API with
// an ID token — no direct Firestore reads — so visibility cannot be bypassed
// by a curious friend with devtools.
//
// Data (deckfactory Firestore):
//   forge-dreamapp        one doc per dream { id, uid, name, text, title,
//                         createdAt, night (YYYY-MM-DD PT, stamped at capture),
//                         publicOn (YYYY-MM-DD PT | null),
//                         audience ('everyone'|'friends'|'private'),
//                         wordsPublic, panels:[{i, url, captions, promptUsed,
//                         public}], drawJob, drawnOn, drawnAt, feltCount }
//   forge-dreamapp-felt   one doc per dream+uid (the heart)
//   forge-dreamapp-comments  one doc per comment { dreamId, uid, name, text, at }
//   forge-dreamapp-teams  one doc per dream team { id, name, code, createdBy,
//                         createdAt, memberUids:[uid], members:[{uid, name,
//                         joinedAt, friendsToo}] } — see THE DIAL below
//   forge-dreamapp-friends  one doc per PAIR, content-addressed
//                         (friendPairId — both orders land on one doc):
//                         { id, uids:[a,b], names:{uid:name}, requestedBy,
//                         at, acceptedAt (null while pending) }
//   forge-dreamapp-profile  one doc per uid { uid, name, code } — the
//                         personal friend link's code, made lazily
//
// A DREAM IS THE ENTRY (Sophie, 2026-08-19). The app briefly grouped one
// person's dreams from one night into a single "night" entry, and she hit it
// in her own archive: "all my dreams got appended to the last dream. They
// should save as separate dreams." So every dream is its own entry — its own
// row in the archive, its own card in the feed, its own heart and comment
// thread (which is where hearts and comments always lived underneath).
//
// THREE A DAY, both doors (Sophie, same day): three dreams get their ink each
// night ("let's just let people illustrate three dreams a day, and we'll
// change it later" — paying past it comes later), and three can go to the
// feed. Both counted from the DATA, not the in-memory limiter — a server
// restart must not hand anyone a fresh allowance.
//
// The AI names each dream (2-5 words) as a background job right after capture;
// drawing is ONE SQUARE PICTURE at medium quality (movies.js makeDreamImage —
// style ref, no character cards) as a background job on the doc, 5.3¢ a dream.
//
// It used to draw a comic of up to six portrait pages at low quality
// (makeDreamPagesV2). Sophie, Aug 2026: "the images shud default to square and
// medium quality and just one image." The panels array stays an ARRAY — every
// dream drawn before this still has its pages, and the lightbox pages through
// them.

const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { makeDreamImage, transcribeAudio } = require('./movies');

const router = express.Router();

// ── THE SHARE-TO-SEE GATE — currently OFF (Sophie, Aug 2026) ────────────────
// Flip this back to true to require sharing a dream before the feed opens.
// While it's OFF the feed also widens past today (FEED_DAYS) — a today-only
// feed with no gate reads as empty every morning.
const GATE_ON = false;
const FEED_DAYS = 14;

const DREAMS = 'forge-dreamapp';
const FELT = 'forge-dreamapp-felt';
const COMMENTS = 'forge-dreamapp-comments';
const TEAMS = 'forge-dreamapp-teams';
const FRIENDS = 'forge-dreamapp-friends';
const PROFILE = 'forge-dreamapp-profile';
const QUALITIES = new Set(['low', 'medium']);
const TEXT_MIN = 10;
const TEXT_MAX = 8000;
const COMMENT_MAX = 800;
const MOOD_MAX = 24;

// Three a day, both doors. Sophie wants these revisited later (a paid lane
// past the ink limit), so they are constants, not folklore in the routes.
const DRAWS_PER_DAY = 3;
const SHARES_PER_DAY = 3;

// The dial's three stops. 'private' is publicOn null; the other two publish.
const AUDIENCES = new Set(['everyone', 'friends', 'private']);

// Dreams are shown unattributed (Sophie), so the uid itself must not travel.
// `by` is a stable one-way tag: enough to group, useless for identifying.
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
// dream, never whose name is on it.
//
// AND FRIENDS ARE REAL, MUTUAL PEOPLE (Sophie, same day): "like following on
// Instagram except you can't follow someone, you have to let them accept you
// — a two-way Facebook model." There is no directory (nothing in this app is
// discoverable), so a friend arrives through your PERSONAL LINK (/f/<code>):
// opening it only ASKS; nothing happens until the owner says yes. Accepted =
// mutual: your ☾ friends dreams reach them and theirs reach you, past dreams
// included. On the yes, both sides get the holding-hands moment (her ask:
// "some kind of graphic showing holding hands because you just became
// friends"). A pair is ONE content-addressed doc, so asking twice, crossing
// requests and both orders of uids all land in the same place — and two
// crossed asks ARE mutual consent, accepted on the spot.
//
// This rule is the whole feature, kept pure for its test: does the author's
// friends-audience post reach a viewer holding these teams? (The viewer's own
// membership is a given — `teams` is the list the viewer belongs to.)
function friendsReaches(authorUid, viewerTeams) {
  return (viewerTeams || []).some((t) => (t.members || [])
    .some((m) => m.uid === authorUid && m.friendsToo !== false));
}
// One dream doc, one viewer: readable in the feed? (Own dreams always are;
// legacy docs with no audience are everyone's; a friends dream reaches the
// viewer's accepted friends and the author's routed teams.)
function canRead(doc, uid, viewerTeams, friendUids) {
  if (doc.audience !== 'friends') return true;
  return doc.uid === uid || (friendUids || []).indexOf(doc.uid) !== -1
    || friendsReaches(doc.uid, viewerTeams);
}
// Both orders land on the one pair doc — that is what makes a crossed
// request findable instead of a duplicate.
const friendPairId = (a, b) => [String(a), String(b)].sort().join('__');
// The accepted other-halves of these pairs, from this uid's side.
function friendUidsOf(pairs, uid) {
  return (pairs || []).filter((p) => p.acceptedAt)
    .map((p) => (p.uids || []).find((u) => u !== uid))
    .filter(Boolean);
}
async function friendPairsOf(uid) {
  const snap = await db().collection(FRIENDS).where('uids', 'array-contains', uid).get();
  return snap.docs.map((d) => d.data());
}

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

let deps = { membryAuth: null };
function init(d) { deps = { ...deps, ...d }; }

const db = () => (admin.apps.length ? admin.firestore() : null);

// The feed's day. US Pacific — the feed turns over with the morning.
const feedDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

// ── the day's allowances, counted from the docs (pure, tested) ──────────────
// A draw that FAILED does not count — retrying a broken drawing is free, only
// ink that landed (or is landing) spends one of the three.
const drawsToday = (docs, today) => docs.filter((d) =>
  d.drawnOn === today
  && ((d.panels || []).length > 0 || (d.drawJob && d.drawJob.status === 'drawing'))).length;
const sharesToday = (docs, today) => docs.filter((d) => d.publicOn === today).length;

// The compose footer's "night N of your streak": consecutive nights WRITTEN
// (not shared), counting back from today — or from yesterday, because a streak
// is not broken by a night you haven't written down yet this morning.
const nightOf = (doc) => doc.night || doc.publicOn || String(doc.createdAt || '').slice(0, 10);
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
// EVERY write in here is a merge on the job's own fields, never set(doc):
// sharing can land while the ink is working (a drawing takes minutes), and a
// full write from this stale snapshot would silently un-share the dream.
const LIVE = new Set();
async function draw(doc, quality) {
  const ref = db().collection(DREAMS).doc(doc.id);
  const dream = { id: doc.id, dreamText: doc.text, castApproved: [], driftCues: [] };
  const startedAt = doc.drawJob.startedAt;
  let lastSave = 0;
  const progress = async (done, total, label) => {
    if (Date.now() - lastSave > 1500) {
      lastSave = Date.now();
      await ref.set({ drawJob: { status: 'drawing', done, total, label, startedAt } }, { merge: true }).catch(() => {});
    }
  };
  try {
    await makeDreamImage(dream, quality, progress);
    // If she shared while it drew, the picture arrives already public.
    const cur = await ref.get().catch(() => null);
    const pub = !!(cur && cur.exists && cur.data().publicOn);
    await ref.set({
      panels: (dream.pages || []).map((p, i) => ({
        i, url: p.url, captions: p.captions || [], promptUsed: p.promptUsed || '', public: pub,
      })),
      drawnAt: new Date().toISOString(),
      drawJob: null,
    }, { merge: true });
  } catch (e) {
    await ref.set({ drawJob: { status: 'failed', error: e.message || 'the drawing failed' } }, { merge: true })
      .catch(() => {});
  } finally {
    LIVE.delete(doc.id);
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
    db().collection(DREAMS).doc(doc.id).set({ drawJob: doc.drawJob }, { merge: true }).catch(() => {});
  }
  return doc;
}

// What the owner sees of their own dream.
function mine(doc) {
  return {
    id: doc.id, text: doc.text, title: doc.title || null,
    night: nightOf(doc),
    createdAt: doc.createdAt, publicOn: doc.publicOn || null,
    audience: doc.publicOn ? (doc.audience === 'friends' ? 'friends' : 'everyone') : 'private',
    wordsPublic: doc.wordsPublic !== false,
    panels: (doc.panels || []).map((p) => ({ i: p.i, url: p.url, captions: p.captions, public: !!p.public })),
    drawJob: doc.drawJob || null, drawnAt: doc.drawnAt || null,
    feltCount: doc.feltCount || 0,
    mood: doc.mood || null, lucid: !!doc.lucid, recurring: !!doc.recurring,
    elems: doc.elems || [],
  };
}

async function ownDocs(uid) {
  const snap = await db().collection(DREAMS).where('uid', '==', uid).get();
  return snap.docs.map((d) => d.data());
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
    const own = await ownDocs(req.user.uid);
    const today = feedDay();
    const streak = streakOf([...new Set(own.map(nightOf))], today);
    res.json({ name: req.user.name, sharedToday: shared, today, count: todays.size,
               streak, drawsLeft: Math.max(0, DRAWS_PER_DAY - drawsToday(own, today)) });
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
    // no later moment knows them. The mood can be HER OWN WORD (Sophie asked
    // for a fill-in beside the four presets), so it is a short free string.
    const mood = typeof req.body?.mood === 'string'
      ? req.body.mood.trim().slice(0, MOOD_MAX) || null : null;
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
      // The dreamer's own calendar day in PT, stamped at capture — the same
      // boundary the feed uses.
      night: feedDay(),
      publicOn: null, audience: 'private',
      wordsPublic: true, panels: [], drawJob: null, drawnOn: null, drawnAt: null, feltCount: 0,
    };
    await ref.set(doc);
    writeTitle(ref.id, text); // background — the client polls the dream
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dreams', async (req, res) => {
  try {
    const docs = (await ownDocs(req.user.uid)).map(repairJob)
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
    // Three a night, counted from the data. The dream itself is already SAVED
    // (capture and ink are separate doors on purpose) — only the drawing is
    // rationed, and the client says so in its pop-up.
    if (drawsToday(await ownDocs(req.user.uid), feedDay()) >= DRAWS_PER_DAY) {
      return res.status(429).json({ error: 'three dreams get their ink each night — come back tomorrow', limit: 'day' });
    }
    const quality = QUALITIES.has(req.body?.quality) ? req.body.quality : 'medium';
    doc.drawnOn = feedDay();
    doc.drawJob = { status: 'drawing', done: 0, total: 0, label: 'starting', startedAt: new Date().toISOString() };
    await db().collection(DREAMS).doc(doc.id)
      .set({ drawnOn: doc.drawnOn, drawJob: doc.drawJob }, { merge: true });
    LIVE.add(doc.id);
    draw(doc, quality); // deliberately not awaited
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── WHO SEES IT — one toggle, three stops (Sophie, 2026-08-19) ──────────────
// "Just have the sharing at the top and make it the toggle thing. And three
// options: public or everyone, and then, like, friends, and then yourself."
// Per-piece sharing is gone with it — one dream is one picture and one set of
// words, and the audience covers the whole thing. Who a ☾ friends dream
// reaches is THE DIAL's rule above (accepted friends + routed teams).
router.post('/dreams/:id/audience', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const doc = snap.data();
    const aud = String(req.body?.audience || '');
    if (!AUDIENCES.has(aud)) return res.status(400).json({ error: 'everyone, friends, or private' });
    const ref = db().collection(DREAMS).doc(doc.id);
    if (aud === 'private') {
      await ref.set({
        audience: 'private', publicOn: null,
        panels: (doc.panels || []).map((p) => ({ ...p, public: false })),
      }, { merge: true });
      return res.json({ ok: true, audience: 'private', publicOn: null });
    }
    // A dream not yet in the feed spends one of the day's three; flipping the
    // audience of one already out does not.
    if (!doc.publicOn && sharesToday(await ownDocs(req.user.uid), feedDay()) >= SHARES_PER_DAY) {
      return res.status(429).json({ error: 'three dreams a day can go out — tomorrow is another night', limit: 'day' });
    }
    const on = doc.publicOn || feedDay();
    await ref.set({
      audience: aud, publicOn: on, wordsPublic: true, name: req.user.name,
      panels: (doc.panels || []).map((p) => ({ ...p, public: true })),
    }, { merge: true });
    res.json({ ok: true, audience: aud, publicOn: on });
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
    const feltSnap = await db().collection(FELT).where('uid', '==', req.user.uid).get();
    const felt = new Set(feltSnap.docs.map((d) => d.data().dreamId));
    // One card per DREAM. A friends-audience dream reaches the author's
    // accepted friends and the people they routed it to (THE DIAL above) —
    // filtered here, server-side, like every other visibility rule.
    const [myTeams, myPairs] = await Promise.all([teamsOf(req.user.uid), friendPairsOf(req.user.uid)]);
    const myFriends = friendUidsOf(myPairs, req.user.uid);
    const dreams = snap.docs.map((d) => d.data())
      .filter((d) => canRead(d, req.user.uid, myTeams, myFriends))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((d) => {
        const panels = (d.panels || [])
          .filter((p) => p.public)
          .map((p) => ({ i: p.i, url: p.url, captions: p.captions }));
        return {
          id: d.id,
          title: d.title || 'A Dream',
          by: byTag(d.uid),
          mine: d.uid === req.user.uid,
          createdAt: d.createdAt,
          publicOn: d.publicOn,
          audience: d.audience === 'friends' ? 'friends' : 'everyone',
          words: d.wordsPublic !== false ? d.text : null,
          panels,
          cover: panels[0] || null,
          feltCount: d.feltCount || 0,
          felt: felt.has(d.id),
          commentCount: d.commentCount || 0,
        };
      });
    res.json({ sealed: false, today, dreams });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// A dream is readable where it is in the feed or when it is your own. A
// friends-audience dream is only readable where its feed card is.
async function readableDream(id, uid) {
  const snap = await db().collection(DREAMS).doc(id).get();
  if (!snap.exists) return null;
  const doc = snap.data();
  if (doc.uid === uid) return doc;
  if (!doc.publicOn) return null;
  if (doc.audience === 'friends') {
    const [teams, pairs] = await Promise.all([teamsOf(uid), friendPairsOf(uid)]);
    if (!canRead(doc, uid, teams, friendUidsOf(pairs, uid))) return null;
  }
  return doc;
}

// The heart — one per person per dream, toggled.
router.post('/dreams/:id/felt', async (req, res) => {
  try {
    const doc = await readableDream(req.params.id, req.user.uid);
    if (!doc) return res.status(404).json({ error: 'not found' });
    const mark = db().collection(FELT).doc(`${doc.id}_${req.user.uid}`);
    const ref = db().collection(DREAMS).doc(doc.id);
    const result = await db().runTransaction(async (tx) => {
      const [cur, held] = await Promise.all([tx.get(ref), tx.get(mark)]);
      const count = cur.exists ? cur.data().feltCount || 0 : 0;
      if (held.exists) {
        tx.delete(mark);
        tx.update(ref, { feltCount: Math.max(0, count - 1) });
        return { felt: false, feltCount: Math.max(0, count - 1) };
      }
      tx.set(mark, { dreamId: doc.id, uid: req.user.uid, at: new Date().toISOString() });
      tx.update(ref, { feltCount: count + 1 });
      return { felt: true, feltCount: count + 1 };
    });
    res.json(result);
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

// ── friends (see THE DIAL above) ────────────────────────────────────────────
// Your personal link asks; the owner's yes makes it mutual. One pair doc,
// content-addressed, so every path — ask, crossed ask, re-ask, accept —
// converges on the same record.
router.get('/friends', async (req, res) => {
  try {
    // The personal link's code, made the first time this screen asks for it;
    // the stored name keeps up with the token's (it is what the other side's
    // overlay says).
    const pref = db().collection(PROFILE).doc(req.user.uid);
    let prof = (await pref.get()).data();
    if (!prof || !prof.code) {
      prof = { uid: req.user.uid, name: req.user.name, code: crypto.randomBytes(9).toString('base64url') };
      await pref.set(prof, { merge: true });
    } else if (prof.name !== req.user.name) {
      await pref.set({ name: req.user.name }, { merge: true });
    }
    const pairs = await friendPairsOf(req.user.uid);
    const other = (p) => (p.uids || []).find((u) => u !== req.user.uid);
    const row = (p) => ({ id: p.id, name: (p.names || {})[other(p)] || 'a dreamer' });
    res.json({
      code: prof.code,
      friends: pairs.filter((p) => p.acceptedAt).map(row),
      asks: pairs.filter((p) => !p.acceptedAt && p.requestedBy !== req.user.uid).map(row),
      waiting: pairs.filter((p) => !p.acceptedAt && p.requestedBy === req.user.uid).map(row),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/friends/request', async (req, res) => {
  try {
    if (limited(`friendreq:${req.user.uid}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'slow down a moment' });
    }
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'no friend code' });
    const snap = await db().collection(PROFILE).where('code', '==', code).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'that link doesn’t open anything' });
    const owner = snap.docs[0].data();
    if (owner.uid === req.user.uid) return res.status(400).json({ error: 'that is your own link' });
    const id = friendPairId(owner.uid, req.user.uid);
    const ref = db().collection(FRIENDS).doc(id);
    const out = await db().runTransaction(async (tx) => {
      const cur = (await tx.get(ref)).data();
      if (cur && cur.acceptedAt) return { state: 'friends' };
      if (cur && cur.requestedBy === req.user.uid) return { state: 'waiting' };
      if (cur) {
        // they asked YOU first — opening their link is a yes from both sides
        tx.update(ref, { acceptedAt: new Date().toISOString() });
        return { state: 'friends' };
      }
      tx.set(ref, {
        id, uids: [owner.uid, req.user.uid].sort(),
        names: { [owner.uid]: owner.name || 'a dreamer', [req.user.uid]: req.user.name },
        requestedBy: req.user.uid, at: new Date().toISOString(), acceptedAt: null,
      });
      return { state: 'asked' };
    });
    res.json({ ...out, id, name: owner.name || 'a dreamer' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/friends/accept', async (req, res) => {
  try {
    const ref = db().collection(FRIENDS).doc(String(req.body?.id || ''));
    const name = await db().runTransaction(async (tx) => {
      const got = await tx.get(ref);
      if (!got.exists) throw new Error('not found');
      const cur = got.data();
      if (!(cur.uids || []).includes(req.user.uid)) throw new Error('not found');
      // Your own ask cannot be your own yes — that is the whole model.
      if (cur.requestedBy === req.user.uid && !cur.acceptedAt) {
        throw new Error('they have to say yes on their side');
      }
      if (!cur.acceptedAt) tx.update(ref, { acceptedAt: new Date().toISOString() });
      const other = (cur.uids || []).find((u) => u !== req.user.uid);
      return (cur.names || {})[other] || 'a dreamer';
    });
    res.json({ ok: true, name });
  } catch (e) { res.status(e.message === 'not found' ? 404 : 400).json({ error: e.message }); }
});

// One route for "not now" on an ask and for unfriending later — both just
// take the pair doc away; a fresh ask can always start over.
router.post('/friends/remove', async (req, res) => {
  try {
    const ref = db().collection(FRIENDS).doc(String(req.body?.id || ''));
    await db().runTransaction(async (tx) => {
      const got = await tx.get(ref);
      if (!got.exists) return;
      if (!((got.data().uids) || []).includes(req.user.uid)) throw new Error('not found');
      tx.delete(ref);
    });
    res.json({ ok: true });
  } catch (e) { res.status(e.message === 'not found' ? 404 : 500).json({ error: e.message }); }
});

// ── comments ────────────────────────────────────────────────────────────────
// Comments DO carry a name — an unsigned reply is useless — which is the one
// place this app names anybody.
router.get('/dreams/:id/comments', async (req, res) => {
  try {
    const dream = await readableDream(req.params.id, req.user.uid);
    if (!dream) return res.status(404).json({ error: 'not found' });
    const snap = await db().collection(COMMENTS).where('dreamId', '==', req.params.id).get();
    const comments = snap.docs.map((d) => d.data())
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
    res.json({ comment: { ...comment, mine: true }, commentCount: (dream.commentCount || 0) + 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// The allowance counters are exported for their test — pure, and load-bearing:
// they are what makes "three a day" survive a server restart.
// friendsReaches/canRead are the whole friends-audience rule, exported the
// same way (scripts/test-dreamapp-teams.js).
module.exports = { router, init, streakOf, drawsToday, sharesToday,
                   friendsReaches, canRead, friendPairId, friendUidsOf };
