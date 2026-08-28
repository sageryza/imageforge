// Chat feed — "the Chat app": every project chat drops a copy of its replies
// here (standing CLAUDE.md rule), and Sophie reads/listens in one place in
// DeckFactory with a picture icon per chat. Content is live (Firestore);
// replies she leaves land as notes chats pick up on their hourly checks.
//
// Routes (x-studio-token gated like the rest):
//   GET  /api/chatfeed           → { chats:{name:{icon}}, messages:[...] } (newest first)
//   GET  /api/chatfeed?since=ISO → delta: only messages newer than ISO, for
//                                  polling (0-2 reads instead of 1500)
//   POST /api/chatfeed           → { chat, title?, text, audio? (url or data URL), tldr?,
//                                  turn?, working? } — turn = stable per-turn key:
//                                  the post UPSERTS that turn's one message (live
//                                  drafts; working:true = still being written)
//   POST /api/chatfeed/icon      → { chat, image (data URL) } — set a chat's picture
//   POST /api/chatfeed/reply     → { chat, text } — Sophie's reply (chats check hourly)
//   POST /api/chatfeed/status    → { chat, session, need?, doing? } — the chat's
//                                  living status card, shown under its name on
//                                  the home list ("" clears a field)
//   POST /api/chatfeed/pin      → { chat, session, url, title, kind? } — THE
//                                  PINNED LINK at the top of the thread: the
//                                  page this chat is building or the film it
//                                  keeps re-cutting. Re-POST it whenever you
//                                  update what's behind it — that lights the
//                                  "current" tag. Empty url clears it.
//   GET  /api/chatfeed/status?chat=&session= → the card + Sophie's pinned note
//                                  + whatever this chat has pinned
//   POST /api/chatfeed/chatnote  → { chat, note } — her pinned note (hers alone;
//                                  chats read it, only the app writes it)
//   GET  /api/chatfeed/search?q= → search across every message (in-memory
//                                  index): { results:[{chat,id,snippet,created,url}] }.
//                                  Bare words AND (both in the SAME message),
//                                  `OR`, `-word` excludes, "quoted" = adjacent
//   POST /api/chatfeed/answered  → { chat, answered } — mark a chat answered
//                                  (grayed until a newer message arrives)
//   POST /api/chatfeed/app-account → { account } — which Claude account is
//                                  signed into the iOS app right now (the
//                                  home-screen App/Web toggle)
//   GET  /api/chatfeed/go?u=     → 302 to a claude.ai URL — Open-in-browser
//                                  hop for chats on the web-signed-in account
//   POST /api/chatfeed/polish    → { id } — render the message in the polished
//                                  onyx-British neural voice (~1¢), cached forever
//   POST /api/chatfeed/page      → { chat, title, html } — publish a Compare page
//                                  (self-contained HTML shown in the chat's Compare tab)
//   GET  /api/chatfeed/pages?chat=name → list a chat's Compare pages
//   GET  /api/chatfeed/pages-recent?limit= → newest pages across EVERY chat
//                                  (the Status view's "new pages" strip)
//   GET  /api/chatfeed/page/:id  → serve one (DELETE removes it)
//   POST /api/chatfeed/notif-seen → { chat, seen } — "I've checked this one",
//                                  the ✓ on a card in the NEW tab. A self-
//                                  clearing stamp: anything newer brings the
//                                  card back on its own.
//   POST /api/chatfeed/news-queue → { chats:[…], queue:'later'|'soon'|'never'
//                                  |'' } — the boxes on the Update screen:
//                                  "later", "in a minute", "maybe never".
//                                  One field per chat.
//   GET  /api/chatfeed/questions?chat= → her questions in that chat, each with
//                                  the answer that came back. DERIVED from the
//                                  thread (questions.js), never filed by a chat.
//   GET  /api/chatfeed/todos     → her running to-do list (open items first).
//                                  ANY chat may read it and act on an item.
//   POST /api/chatfeed/todo      → { text } — add one
//   PATCH/DELETE /api/chatfeed/todo/:id → { done?, text? } / remove

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const { buildQuestions, answeredOnly, isCompacted } = require('./questions');
const { parseQuery } = require('./search-grammar');
const { shouldPushReply, chatNotifies, pushBody } = require('./push-gate');
const chatSort = require('./chat-sort');
const pageTemplates = require('./page-templates');
const assetUnion = require('./asset-union');

const router = express.Router();
const MSGS = 'forge-chat-feed';
const REG = 'forge-chat-registry';

function gate(req, res, next) {
  const token = process.env.STUDIO_TOKEN || '';
  // ?token= accepted too — iframes/anchors (the Compare page viewer) can't
  // send custom headers.
  if (token && req.get('x-studio-token') !== token && req.query.token !== token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
router.use(gate);
router.use(express.json({ limit: '10mb' }));

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}
function fail(res, err) {
  res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
}

// ---- Registry cache -------------------------------------------------------
// The registry (one small doc per chat: icon, display name, lastSeen) is read
// on EVERY feed poll but changes only when a chat is renamed / given an icon /
// marked answered. Re-reading ~40 docs every few seconds is most of what a
// cheap delta poll would otherwise cost, so it's held in memory and dropped
// the moment anything writes to it (regRef below is the only write path).
// Render free runs a single instance, so there's no second process to stale.
let regCache = null;
let regCacheAt = 0;
const REG_TTL_MS = 5 * 60 * 1000;   // backstop only; writes invalidate directly
// Feed-wide settings (not a chat) live in ONE reserved registry doc so they
// ride the same cached read as the icons. Currently: { appAccount } — which
// Claude account ("1"/"2") is signed into the iOS app right now. The
// home-screen App/Web toggle writes it; the Open buttons route off it.
const SETTINGS_DOC = '__settings';

// ---- Which build of the page is live -------------------------------------
// A WKWebView keeps the page it loaded — for DAYS, since the app is rarely
// killed. Polling refreshes the DATA but never the CODE, so a shipped page
// change silently doesn't reach her phone until something reloads the screen.
// That is not theoretical: a whole afternoon of UI changes landed on Render
// while her app kept running the morning's JavaScript, and the feature she was
// testing "didn't work" because the code implementing it wasn't there.
// So every feed response carries a stamp of the page file. The client keeps
// the first one it sees (that IS the build it is running) and reloads when the
// stamp changes. Computed once — the file cannot change without a restart.
let pageBuildStamp = null;
function pageBuild() {
  if (pageBuildStamp === null) {
    try {
      const buf = fs.readFileSync(path.join(__dirname, 'public', 'chats.html'));
      pageBuildStamp = crypto.createHash('md5').update(buf).digest('hex').slice(0, 12);
    } catch (e) { pageBuildStamp = ''; }
  }
  return pageBuildStamp;
}

async function registry() {
  if (regCache && Date.now() - regCacheAt < REG_TTL_MS) return regCache;
  const snap = await db().collection(REG).get();
  const chats = {};
  let settings = {};
  snap.docs.forEach((d) => {
    if (d.id === SETTINGS_DOC) { settings = d.data(); return; }
    chats[d.id] = d.data();
  });
  regCache = { chats, settings };
  regCacheAt = Date.now();
  return regCache;
}
// Every registry WRITE goes through this, so the cache can never go stale.
function regRef(chat) {
  regCache = null;
  return db().collection(REG).doc(String(chat).slice(0, 60));
}

// ---- One chat per SESSION (Aug 2026) ---------------------------------------
// A chat's real identity is the Claude SESSION behind it, not the branch-derived
// slug: branch names get reused, naming conventions change, and slugs collide —
// each of those merged or split threads for real (the chat Sophie renamed
// "Imprint" lost its session to a fork when its slug was claimed by a
// placeholder). So resolution is SESSION-FIRST: a session that already owns a
// chat posts there forever, whatever its branch says today. The slug only
// matters the first time a session posts — it keeps the pretty name if it's
// free, otherwise forks to `<slug>-<sid6>`. Renaming (displayName) stays
// cosmetic and never re-keys anything.
function sidTail(session) {
  return String(session).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
}
// A session id arrives in three spellings — bare (`011kWP…`, what the hook
// sends), the url's `session_011kWP…`, and the env var's `cse_011kWP…` — and
// they are ONE session. Treating them as different ids is what minted the
// phantom `<slug>-sessio` chats (found live 2026-08-26: 17 registry docs with
// a `session_`-prefixed sessionId, 12 of them forks of a real chat whose bare
// id owned the pretty slug — sidTail("session_…") is literally "sessio").
// Every comparison and every write below goes through this, so a chat posting
// its status card with the url spelling lands on the same thread as its hook.
function bareSid(session) {
  return String(session || '').replace(/^(session_|cse_)/, '').slice(0, 120);
}
// …AND A SESSION KEY HAS TO BE AN IDENTIFIER AT ALL (2026-08-26). Two of the
// 486 ids on file are not: the literal `none`, and an unexpanded `$SID` — which
// resolveChat happily treated as a session, forking a ghost chat named
// `instant-voice-clone-sid` (sidTail('$SID') is 'sid') beside the real
// `instant-voice-clone`. Deliberately WIDE: a LOCAL transcript uuid is a
// legitimate identity here (the hook falls back to it when
// CLAUDE_CODE_REMOTE_SESSION_ID is unset), so this rejects only what could
// never be an id — too short, or carrying a shell sigil. A rejected key means
// "no session", i.e. plain slug resolution, never a fork.
function usableSid(sid) {
  return sid.length >= 16 && /^[A-Za-z0-9_-]+$/.test(sid);
}
// A merged/repaired chat leaves a tombstone doc behind ({ movedTo }) so posts
// still addressed to the old slug — stale hook caches, the app's reply box on
// an old thread — land in the surviving chat instead of resurrecting the tile.
async function followMoves(chat) {
  let cur = String(chat || '').slice(0, 60);
  if (!cur) return cur;
  const reg = await registry();
  const seen = new Set();
  while (reg.chats[cur] && reg.chats[cur].movedTo && !seen.has(cur)) {
    seen.add(cur);
    cur = String(reg.chats[cur].movedTo).slice(0, 60);
  }
  return cur;
}
async function resolveChat(base, session) {
  const chat = await followMoves(base);
  const sid = bareSid(session);
  if (!chat || !sid || !usableSid(sid)) return chat;
  // 1) Session-first: this session already has a home → everything it posts
  //    goes there, no matter what slug it arrived under. This is what makes a
  //    chat's identity survive branch renames and naming-convention changes.
  //    Both sides are normalized (bareSid): a doc that stored the prefixed
  //    spelling still matches its own session, and is healed to the bare id
  //    on the way past so the stored shape converges.
  const reg = await registry();
  const mine = Object.keys(reg.chats)
    .filter((s) => bareSid(reg.chats[s].sessionId) === sid && !reg.chats[s].movedTo);
  if (mine.length) {
    // duplicates only happen after registry surgery — pick deterministically
    mine.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    const pick = mine.includes(chat) ? chat : mine[0];
    if ((reg.chats[pick].sessionId || '') !== sid) {
      await regRef(pick).set({ sessionId: sid }, { merge: true });
    }
    return pick;
  }
  // 2) First post from a new session: take the pretty name if it's unclaimed…
  const owner = bareSid((reg.chats[chat] || {}).sessionId);
  if (!owner) {
    await regRef(chat).set({ sessionId: sid }, { merge: true });
    return chat;
  }
  if (owner === sid) return chat;
  // 3) …else fork to a chat of its own. If even the fork slug is taken by yet
  //    another session (two ids sharing 6 leading chars), widen the tail.
  let tail = sidTail(sid) || 'x';
  let fork = (chat + '-' + tail).slice(0, 60);
  const fowner = bareSid((reg.chats[fork] || {}).sessionId);
  if (fowner && fowner !== sid) {
    tail = String(sid).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || tail;
    fork = (chat + '-' + tail).slice(0, 60);
  }
  await regRef(fork).set({ sessionId: sid }, { merge: true });
  return fork;
}
// The hook calls this ONCE per session (cached in a state file) and then
// posts feed + gallery + user messages under the returned slug, so everything
// a session makes stays together on one chat.
router.get('/resolve', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const out = await resolveChat(chat, String(req.query.session || ''));
    res.json({ chat: out });
  } catch (err) { fail(res, err); }
});
// Admin: bind a chat to its owning session (or clear the binding) — the
// untangle tool for an already-collided chat. Pass the REAL session id of the
// conversation the thread belongs to; resolution is session-first, so a
// placeholder id ORPHANS the thread (that is exactly what froze "Imprint" —
// its slug was claimed by "imprint-legacy", which no live session could ever
// match, so even its own session forked away). Binding also clears the same
// session id off every OTHER registry doc, so a session has exactly one home.
// Optional { movedTo } sets/clears the tombstone redirect for a merged chat.
router.post('/session', async (req, res) => {
  try {
    const { chat, sessionId, movedTo } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const val = bareSid(sessionId);
    const chatId = String(chat).slice(0, 60);
    if (val) {
      // The registry stores bare ids, but 17 docs were found (2026-08-26)
      // carrying the `session_` spelling — clear those dupes too, or binding a
      // chat leaves its phantom twin still claiming the same session.
      const [d1, d2] = await Promise.all([
        db().collection(REG).where('sessionId', '==', val).get(),
        db().collection(REG).where('sessionId', '==', 'session_' + val).get(),
      ]);
      const dupes = { docs: [...d1.docs, ...d2.docs] };
      for (const d of dupes.docs) {
        if (d.id !== chatId) {
          await regRef(d.id).set({ sessionId: admin.firestore.FieldValue.delete() }, { merge: true });
        }
      }
    }
    const patch = { sessionId: val || admin.firestore.FieldValue.delete() };
    if (movedTo !== undefined) {
      patch.movedTo = movedTo ? String(movedTo).slice(0, 60) : admin.firestore.FieldValue.delete();
    }
    await regRef(chatId).set(patch, { merge: true });
    res.json({ ok: true, chat: chatId, sessionId: val || null });
  } catch (err) { fail(res, err); }
});

// Untangle a collided/forked thread: re-key every message from one slug to
// another so two halves of the same conversation become one. Needed because a
// session-first fork (a session whose messages landed under a suffixed slug
// while the pretty slug it belongs to held the other half) can only be joined
// by moving the messages — /thread filters on the exact `chat` field, so a
// registry tombstone alone won't merge them. `postedAt` is refreshed so open
// clients pick the moved messages up on their next delta poll. `?dry` counts
// without writing. Tombstones the source registry doc (movedTo → to) so its
// tile redirects. Gated like the rest of the module.
router.post('/reassign', async (req, res) => {
  try {
    const from = String((req.body || {}).from || '').slice(0, 60);
    const to = String((req.body || {}).to || '').slice(0, 60);
    const dry = Boolean((req.body || {}).dry);
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    if (from === to) return res.status(400).json({ error: 'from and to are the same' });
    const snap = await db().collection(MSGS).where('chat', '==', from).get();
    if (dry) return res.json({ ok: true, dry: true, wouldMove: snap.size, from, to });
    const now = new Date().toISOString();
    let moved = 0;
    // Firestore batches cap at 500 writes; chunk to stay under it.
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db().batch();
      for (const d of snap.docs.slice(i, i + 400)) {
        batch.set(d.ref, { chat: to, postedAt: now }, { merge: true });
        moved++;
      }
      await batch.commit();
    }
    await regRef(from).set({ movedTo: to }, { merge: true });
    res.json({ ok: true, moved, from, to });
  } catch (err) { fail(res, err); }
});

router.get('/', async (req, res) => {
  try {
    // Without this the app's webview heuristically caches the feed (no
    // Cache-Control + ETag = cache it "for a while"), so the Refresh button
    // appeared to do nothing until minutes later. The feed must always be live.
    res.set('Cache-Control', 'no-store');
    // NOTE: nothing is ever deleted — every message stays in Firestore. This
    // only controls how many we hand the app at once, and that matters: the
    // feed is append-only across ~38 chats, so an unbounded payload grows
    // forever and every app launch pays for it (it had reached ~490KB / 364
    // messages, several seconds on a phone).
    //
    // The shape Sophie asked for: the chats she's actually been in get a real
    // scroll-back tail, everything older gets just its latest message (which is
    // all the home screen shows anyway). Opening a chat pulls its FULL history
    // from /thread, so nothing is unreachable — this only trims the first load.
    // Overridable via ?deep= / ?deepchats= / ?tail= / ?scan=.
    const DEEP = Math.min(50, Math.max(1, parseInt(req.query.deep, 10) || 10));
    const DEEPCHATS = Math.min(100, Math.max(1, parseInt(req.query.deepchats, 10) || 15));
    const TAIL = Math.min(50, Math.max(1, parseInt(req.query.tail, 10) || 1));
    const SCAN = Math.min(5000, Math.max(200, parseInt(req.query.scan, 10) || 1500));

    // ---- Delta poll (?since=<ISO of the newest message the client holds) ----
    // The full load above reads SCAN (1500) documents EVERY time, which is what
    // a page left open was paying once a minute — ~90k reads/hour, blowing the
    // 50k/day free tier in half an hour, for a handful of new messages. A poll
    // asks only "what arrived after X", which is normally ZERO documents and
    // never more than a few. That's what makes polling frequently free.
    //
    // `created` is an ISO-8601 string set server-side on write, so string
    // ordering IS chronological ordering and a range filter on the same field
    // we sort by needs no composite index.
    const since = String(req.query.since || '').slice(0, 40);
    if (since) {
      // Two queries, unioned. `created` is when a message was SENT, and Sophie's
      // own messages carry her real send time — which is EARLIER than the reply
      // they prompted. So a client whose newest message is that reply asks for
      // "anything after <reply time>" and would never be handed her message: it
      // is older than the cutoff the moment it exists. `postedAt` is when the
      // doc was WRITTEN (monotonic, set below on every write), so the second
      // query catches exactly those. Deduped by id; both are range+orderBy on a
      // single field, so neither needs a composite index.
      const [csnap, psnap, reg] = await Promise.all([
        db().collection(MSGS)
          .where('created', '>', since)
          .orderBy('created', 'desc')
          .limit(200)              // a burst backstop; a normal poll returns 0-2
          .get(),
        db().collection(MSGS)
          .where('postedAt', '>', since)
          .orderBy('postedAt', 'desc')
          .limit(200)
          .get(),
        registry(),
      ]);
      const byId = new Map();
      csnap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
      psnap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
      const messages = Array.from(byId.values());
      // `delta:true` tells the client to MERGE rather than replace — it still
      // holds the trimmed tail and any full threads it has already pulled.
      return res.json({ chats: reg.chats, settings: reg.settings, messages, truncated: [], delta: true, build: pageBuild() });
    }

    const [msnap, reg] = await Promise.all([
      db().collection(MSGS).orderBy('created', 'desc').limit(SCAN).get(),
      registry(),
    ]);
    // msnap is newest-first, so the order in which a chat is FIRST seen is its
    // recency rank: the first DEEPCHATS distinct chats are the ones Sophie
    // touched most recently and get DEEP messages; the rest get TAIL.
    const perChat = {};
    const rank = {};
    const messages = [];
    msnap.docs.forEach((d) => {
      const m = d.data();
      const c = m.chat || '';
      if (!(c in rank)) rank[c] = Object.keys(rank).length;
      const n = (perChat[c] = (perChat[c] || 0) + 1);
      const cap = rank[c] < DEEPCHATS ? DEEP : TAIL;
      if (n <= cap) messages.push({ id: d.id, ...m });
    });
    // `truncated` lists chats whose history was cut, so the client knows to
    // pull the full thread when one is opened instead of guessing.
    //
    // A CHAT WITH NO MESSAGE IN THE SCAN MUST BE LISTED TOO (Aug 2026 — this
    // was the hole, and it was silent). `perChat` only counts what the SCAN
    // saw, and the scan is the newest SCAN messages across every chat, which
    // at ~125 posts a day reaches back about four days. A chat quieter than
    // that appears in no scanned doc, so it was in neither `messages` nor
    // `truncated` — and chats.html's `ensureFullThread` early-returns unless
    // the chat is marked, so opening it showed an EMPTY thread that never
    // repaired itself. Measured live 2026-08-10 before the fix: 201 chats in
    // the registry, 183 messages delivered, 125 chats given nothing — and 118
    // of those really had history, 2,762 messages that the app could not
    // reach by browsing (search could: focusMessage pulls the thread on a
    // miss, which is why this read as "browsing is empty but search works").
    // Sophie reported it as "I don't see a lot of messages for older chats".
    //
    // Marking them costs the FIRST LOAD nothing — no extra message ships, the
    // payload is unchanged. It only means opening one of those chats fetches
    // its thread, exactly as opening a trimmed recent chat already does, once
    // per session (`fullLoaded`). The 7 registry entries that genuinely have
    // no messages just fetch an empty list once and settle.
    const truncated = Object.keys(perChat)
      .filter((c) => perChat[c] > (rank[c] < DEEPCHATS ? DEEP : TAIL));
    // …plus every registry chat the scan never reached. A tombstone (`movedTo`)
    // is skipped: its messages were re-keyed to the chat it points at, so
    // fetching that slug can only ever come back empty.
    Object.keys(reg.chats).forEach((c) => {
      if (!(c in perChat) && !(reg.chats[c] || {}).movedTo) truncated.push(c);
    });
    res.json({ chats: reg.chats, settings: reg.settings, messages, truncated, build: pageBuild() });
  } catch (err) { fail(res, err); }
});

// ---- Search ---------------------------------------------------------------
// Firestore has no full-text search, so we keep a lightweight in-memory index
// of every message and substring-filter it. The feed is append-only, so the
// index loads once and then only tops up with newer docs — searches stay fast
// as history grows (Sophie posts ~125/day). Throttled so a burst of keystrokes
// doesn't re-query Firestore each time; the Render process losing the cache on
// spin-down just means one full reload on the next search.
let searchIndex = [];        // [{chat, id, text, tldr, created, url, from}]
const searchSeen = new Set(); // doc ids already in the index
// Sized in every memwatch snapshot — the index holds every message's full
// text forever, so if it is the heap leak the count and MB will say so.
require('./memwatch').gauge('chatSearchIndex', () => searchIndex.length);
require('./memwatch').gauge('chatSearchMB', () => Math.round(searchIndex.reduce((a, m) => a + (m.text || '').length + (m.tldr || '').length, 0) * 2 / 1048576));

let indexMaxCreated = '';
let indexInit = false;
let indexRefreshedAt = 0;
let indexRefreshing = null;
function refreshSearchIndex(force) {
  const now = Date.now();
  if (!force && indexInit && now - indexRefreshedAt < 15000) return Promise.resolve();
  if (indexRefreshing) return indexRefreshing;
  indexRefreshing = (async () => {
    let q = db().collection(MSGS);
    // `>=` (not `>`) + id de-dupe catches multiple docs sharing a created ms.
    if (indexInit && indexMaxCreated) q = q.where('created', '>=', indexMaxCreated);
    const snap = await q.get();
    snap.docs.forEach((d) => {
      if (searchSeen.has(d.id)) return;
      searchSeen.add(d.id);
      const m = d.data();
      searchIndex.push({ chat: m.chat || '', id: d.id, text: m.text || '', tldr: m.tldr || '', created: m.created || '', url: m.url || '', from: m.from || '' });
      if ((m.created || '') > indexMaxCreated) indexMaxCreated = m.created || '';
    });
    indexInit = true;
    indexRefreshedAt = Date.now();
  })().finally(() => { indexRefreshing = null; });
  return indexRefreshing;
}

// ---- Matching -------------------------------------------------------------
// The box speaks the house grammar (`search-grammar.js`): bare words AND, `OR`
// between them, `-word` to exclude, "quoted phrases" for adjacency. Sophie's
// case is the AND — two words she knows shared one message, where one of them
// appears in hundreds of others.
//
// Terms keep their punctuation (only case and whitespace runs are flattened),
// because `gpt-image-2` and `/api/gallery` are things she searches for, and a
// normaliser that strips them would make those unfindable.
const searchNorm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One term → a regex anchored at a word START, which is the one behaviour
// worth preserving from the old single-phrase search: "aries" must not match
// inside "boundaries", while the prefix "bound" still finds "boundaries". A
// quoted phrase keeps its words adjacent but tolerates any whitespace between
// them, since a reply wraps mid-phrase all the time.
function termRegex(term) {
  const body = term.value.split(' ').map(escRe).join('\\s+');
  const lead = /^[a-z0-9]/i.test(term.value) ? '\\b' : '';
  try { return new RegExp(lead + body, 'i'); } catch (e) { return null; }
}
// Compile once per request, then drop any group whose terms are all unusable.
function compileQuery(q) {
  const groups = parseQuery(q, { normalize: searchNorm });
  groups.forEach((g) => { g.terms.forEach((t) => { t.re = termRegex(t); }); });
  return groups.filter((g) => g.terms.some((t) => t.re));
}
function queryMatches(s, groups) {
  for (const g of groups) {
    const hit = g.terms.some((t) => t.re && t.re.test(s));
    if (g.neg ? hit : !hit) return false;
  }
  return true;
}
// Where to centre the snippet. With two words the RARE one is what found this
// message — the common one is everywhere and shows her nothing — so the
// snippet opens on the term with the fewest hits in that message.
//
// …EXCEPT THAT THE PHRASE WINS THE WINDOW WHEN THE MESSAGE HAS IT (Aug 2026,
// found by reading the live answer to her own `maybe never` search). The top
// row was there BECAUSE her two words sit adjacent in it, and the snippet was
// opening on a different, scattered occurrence further up the same message —
// so the one result the ranking is proudest of read as though it did not
// answer the search that put it first. A rank and a snippet that disagree are
// worse than either alone: she judges a row by the words she can see.
function snippetAnchor(src, groups, phraseRe) {
  if (phraseRe) {
    const hit = src.match(phraseRe);
    if (hit) return { i: src.search(phraseRe), len: hit[0].length, n: 0, whole: true };
  }
  let best = null;
  for (const g of groups) {
    if (g.neg) continue;
    for (const t of g.terms) {
      if (!t.re) continue;
      const all = new RegExp(t.re.source, 'gi');
      let m; let n = 0; let pick = null;
      while ((m = all.exec(src)) && n < 60) {
        n++;
        // A hit is WHOLE when the word ends where the term does — `dress` in
        // "dress", not `red` in "redraw". Terms are anchored at a word START
        // only, so the prefix hit is a real match and still counts for
        // matching; it is only a poor thing to open the window on.
        const whole = !/[a-z0-9]/i.test(src.charAt(m.index + m[0].length) || '');
        if (!pick || (whole && !pick.whole)) pick = { i: m.index, len: m[0].length, whole };
        if (all.lastIndex === m.index) all.lastIndex++;
      }
      if (!pick) continue;
      const cand = { i: pick.i, len: pick.len, n, whole: pick.whole };
      if (!best || (cand.whole !== best.whole ? cand.whole : cand.n < best.n)) best = cand;
    }
  }
  return best;
}

// ---- THE PHRASE COMES FIRST, AND NOTHING ELSE JUMPS THE QUEUE ------------
// Sophie, 2026-08-19: "also i noticed typing: maybe never finds / The chats
// were those words appear in the same order as typed should appear at the top
// and the ones where they appear anywhere should appear underneath."
//
// TWO tiers, which is what that sentence says. It shipped as THREE (2026-08-21)
// because the build read "in the same order as typed" as a rung of its own,
// separate from the phrase — so a message with her words in order but with
// other words in between ("maybe you'll never") was lifted above a plain
// recent one. She retired that middle rung on 2026-08-24: "you mentioned if
// it's there but there are words between it vs. different order. that's
// stupid … only if no words moves it up." Scattered-in-order is not a
// meaningful kind of match, and lifting it only pushed newer, better answers
// down.
//
//   0. THE PHRASE — the words adjacent and in her order, exactly what quoting
//      them would have found. This tier is why she does not have to quote.
//   1. EVERYTHING ELSE — newest first, the old sort, untouched.
//
// A query with one positive group has nothing to rank and skips all of this.
// So does one carrying a field term (`tag:`), where "adjacent" is meaningless.
const rankGroups = (groups) => groups.filter((g) => !g.neg && g.terms.some((t) => t.re));
// The whole query as one adjacency regex, OR groups included as alternations.
// Built as its own pass and NOT as a left-to-right walk: a walk takes the
// EARLIEST match of each word and would miss the adjacent pair further along
// ("maybe … never … maybe never" is the phrase).
function phraseRegex(pos) {
  if (pos.some((g) => g.terms.some((t) => t.field))) return null;
  const parts = pos.map((g) => {
    const alts = g.terms.filter((t) => t.re)
      .map((t) => t.value.split(' ').map(escRe).join('\\s+'));
    return alts.length === 1 ? alts[0] : `(?:${alts.join('|')})`;
  });
  const lead = /^[a-z0-9]/i.test(pos[0].terms[0].value) ? '\\b' : '';
  try { return new RegExp(lead + parts.join('\\s+'), 'i'); } catch (e) { return null; }
}
// Rank one message: 0 the phrase, 1 everything else. Lower sorts first.
const phraseRank = (src, phraseRe) => (phraseRe && phraseRe.test(src) ? 0 : 1);

// ---- ONE ROW PER CHAT (Aug 2026, Sophie: "if the same word is found in the
// same chat, only show the most recent result") -----------------------------
// A chat that has said her word twenty times used to fill the whole first
// screen with twenty rows of itself, so every OTHER chat that said it once was
// pushed off the answer — and the twenty rows are the same finding twenty
// times over. One row each, and the results list becomes a list of chats that
// know about this rather than a list of times it was mentioned.
//
// WHICH row: the best-ranked, and the NEWEST among equals. With two tiers most
// results tie, so in almost every search this is exactly "the most recent" as
// she asked. It differs only when a chat holds the exact phrase in an older
// message and a loose scatter in a newer one — and there, showing the newer
// one would open the chat on something that is not what she searched for.
function bestPerChat(ranked) {
  const best = new Map();
  for (const r of ranked) {
    const cur = best.get(r.m.chat);
    if (!cur || r.rank < cur.rank
      || (r.rank === cur.rank && (r.m.created || '') > (cur.m.created || ''))) {
      best.set(r.m.chat, r);
    }
  }
  return Array.from(best.values());
}

// ---- WHO SAID IT — the search's first filter -------------------------------
// Aug 2026, Sophie: "I'd like to add some filters to the search in the chats
// thing … one would be a filter allowing me to search through my messages
// versus Claude's messages." Her own words and a chat's answers are two
// different haystacks and she hunts in them for different reasons: what SHE
// asked for once ("that thing about how to make images") versus what a chat
// told her. A search across both buries the shorter half — she posts ~40
// messages to every 220 of theirs, measured on one live feed read — so the
// one word she remembers saying loses to the twelve replies that quoted it
// back at her.
//
// HERS IS `from === 'sophie'` EXACTLY, AND EVERYTHING ELSE IS CLAUDE'S. That
// asymmetry is deliberate and is the same rule the app already uses in three
// places. A reply is stamped `from:'claude'` today but older docs carry an
// empty `from`, and those are replies — her messages have only ever reached
// the feed through `POST /reply` and the hook's her_words path, both of which
// stamp `sophie`. So an unstamped record has to land on Claude's side, and a
// `from` value nobody has seen must never be counted as hers: silence is the
// safe direction for the smaller pile.
const SEARCH_WHO = ['all', 'me', 'claude'];
const whoOf = (from) => (from === 'sophie' ? 'me' : 'claude');
// ONE reader for every search filter, because they all fail the same way: an
// unknown value must be `all`, never an empty result. A filter she cannot see
// — an old cached page sending nothing, or a word this server has not learned
// yet — has to WIDEN the answer rather than silently delete results. `all` is
// index 0 of every list, so anything that does not land past it is `all`.
const pickOne = (v, list) => {
  const w = String(v || '').toLowerCase().trim();
  return list.indexOf(w) > 0 ? w : 'all';
};
const whoParam = (v) => pickOne(v, SEARCH_WHO);
const whoMatches = (who, from) => who === 'all' || whoOf(from) === who;

// ---- THE ARCHIVE — the second filter (Aug 2026, Sophie: "another filter to
// add can be archived as in does it search the archive or not or just the
// archive") ------------------------------------------------------------------
// Three options, which is why it is a three-way toggle and not a checkbox: the
// two useful narrowings are opposites, and neither is the default. Search has
// always covered EVERYTHING, so `all` stays what it always was and the two new
// answers are hers to reach for.
//   all  — everywhere, the old behaviour and what an older page still sends
//   live — skip the archive: what she is still working on
//   only — the archive alone: an old chat she remembers but has put away
// It filters by CHAT, not by message: `archived` is a flag on the registry
// doc, so the set of archived slugs is one read of the cache the route already
// takes for the name rows.
const SEARCH_ARCH = ['all', 'live', 'only'];
const archParam = (v) => pickOne(v, SEARCH_ARCH);
const archMatches = (arch, isArchived) => arch === 'all'
  || (arch === 'only' ? !!isArchived : !isArchived);

// ONLY THE FIRST THREE NAME ROWS (Aug 2026, Sophie: "right now, the name
// instances in the name are pinned to the top just pin the first three
// instances and then show content results"). A common word matches a dozen
// chat NAMES, and ten of those pinned above the fold pushed the message she
// was actually looking for off the first screen — the name rows are a
// shortcut to the obvious answer, not a second list to read through.
// Newest-seen first, so the three she gets are the three she is most likely to
// have meant.
const NAME_ROWS = 3;
function pickNameRows(reg, groups, arch) {
  if (!reg || !reg.chats) return [];
  return Object.keys(reg.chats)
    // The ARCHIVE filter is about the chat, so a name row obeys it like any
    // hit. (The WHO filter is not: a name was said by nobody, which is why the
    // caller drops these rows entirely while a side is picked.)
    .filter((slug) => archMatches(arch, reg.chats[slug].archived))
    .map((slug) => ({
      chat: slug,
      name: reg.chats[slug].displayName || slug,
      lastSeen: reg.chats[slug].lastSeen || '',
    }))
    .filter((c) => queryMatches(`${c.name}\n${c.chat}`, groups))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, NAME_ROWS)
    .map((c) => ({ chat: c.chat, name: c.name }));
}

router.get('/search', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const q = String(req.query.q || '').trim();
    const who = whoParam(req.query.from);
    const arch = archParam(req.query.arch);
    if (q.length < 2) return res.json({ results: [], chatMatches: [], indexed: searchIndex.length });
    await refreshSearchIndex();
    const groups = compileQuery(q);
    if (!groups.length) return res.json({ results: [], chatMatches: [], indexed: searchIndex.length });
    // The registry is read for the name rows AND for the archive filter, so it
    // is taken once, up front. `registry()` is the feed's own 5-minute cache —
    // never open a second one.
    let reg = null;
    try { reg = await registry(); }
    catch (e) { /* the message search still answers without it */ }
    const archivedChat = (slug) => !!((reg && reg.chats && reg.chats[slug]) || {}).archived;
    // Chats whose NAME matches the query — Sophie's display name first, the
    // slug as fallback — returned separately so the client can pin them at
    // the top of the results (her rule: searching a chat's name should find
    // the chat itself before any message-content hits).
    // A chat's NAME was said by nobody, so it is not an answer to "show me my
    // messages" — the name rows come off while a side is picked rather than
    // sitting above results that all share one voice. The ARCHIVE filter is
    // different: it is about the chat, so a name row obeys it like any hit.
    const chatMatches = who === 'all' ? pickNameRows(reg, groups, arch) : [];
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 80);
    // Every word she typed has to land in the SAME message — that is the whole
    // point — so the haystack is the one message, name and TLDR included.
    const hits = searchIndex.filter((m) => whoMatches(who, m.from)
      && archMatches(arch, archivedChat(m.chat))
      && queryMatches(m.chat + '\n' + m.tldr + '\n' + m.text, groups));
    // Her order first, then newest — see IN THE ORDER SHE TYPED THEM above.
    // Ranked into a parallel array rather than stamped onto the index rows:
    // those objects are the shared, long-lived search index and a leftover
    // score from the previous query would sort the next one.
    const pos = rankGroups(groups);
    const phraseRe = pos.length > 1 ? phraseRegex(pos) : null;
    const ranked = hits.map((m) => ({
      m,
      rank: phraseRe ? phraseRank(m.chat + '\n' + m.tldr + '\n' + m.text, phraseRe) : 0,
    }));
    // One row per chat, BEFORE the cap — deduping after it would answer with
    // fewer rows than she asked for and hide whole chats behind a chat that
    // happened to repeat itself.
    const rows = bestPerChat(ranked);
    rows.sort((a, b) => a.rank - b.rank
      || (a.m.created < b.m.created ? 1 : a.m.created > b.m.created ? -1 : 0));
    const results = rows.slice(0, limit).map(({ m }) => {
      // Snippet centred on the match — prefer the body, else the tldr/chat name.
      const inBody = m.text ? snippetAnchor(m.text, groups, phraseRe) : null;
      const src = inBody ? m.text : (m.tldr && snippetAnchor(m.tldr, groups, phraseRe) ? m.tldr : (m.text || m.tldr || ''));
      const at = inBody || snippetAnchor(src, groups, phraseRe);
      let snip = src;
      if (at && at.i > -1) {
        const s = Math.max(0, at.i - 45);
        const end = at.i + at.len + 70;
        snip = (s > 0 ? '…' : '') + src.slice(s, end).replace(/\s+/g, ' ')
          + (end < src.length ? '…' : '');
      }
      return { chat: m.chat, id: m.id, snippet: snip.slice(0, 200).trim(), created: m.created, url: m.url || '' };
    });
    res.json({ results, chatMatches, indexed: searchIndex.length });
  } catch (err) { fail(res, err); }
});

// A single chat's FULL history, oldest→newest. The main feed only loads each
// chat's recent tail, so opening a search hit that's hundreds of messages back
// needs the whole thread pulled in to actually read it. Equality-only query
// (no orderBy) needs no composite index; we sort in memory.
router.get('/thread', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const snap = await db().collection(MSGS).where('chat', '==', chat).get();
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
    res.json({ messages });
  } catch (err) { fail(res, err); }
});

// ---- Questions ------------------------------------------------------------
// Her questions in this chat, each with the answer that came back — the thing
// the Questions button under the thread header opens (Aug 2026: "it's hard to
// find the answer cause it's buried under other stuff").
//
// DERIVED, never filed. See the header of questions.js for why that is the
// whole design: nothing has to be remembered by any chat, and the list is
// complete over the entire history from the moment it ships. Costs one
// equality query (the same one /thread makes) and only when she taps.
router.get('/questions', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const limit = Math.min(300, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const snap = await db().collection(MSGS).where('chat', '==', chat).get();
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // An unanswered question is not listed — see `answeredOnly` in questions.js
    // for why. `?open=1` asks for them back.
    const all = buildQuestions(messages);
    const out = String(req.query.open || '') === '1' ? all : answeredOnly(all);
    res.json({ chat, questions: out.slice(0, limit), total: out.length });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const { chat, title, text, audio, tldr, url, account, session, explicit, turn, working,
            head, tail, created } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    // `created` = when the reply was actually written. Normally the server
    // stamps NOW, which is right for a live post — but a BACKFILL of an old
    // conversation has to keep its real times or the thread reads wrong: the
    // app sorts by `created`, so every backfilled reply would pile up at the
    // top above the messages it was answering. Same guard as /reply (hers has
    // accepted this since July 2026): honoured only when it parses and isn't
    // in the future, so a bad clock can't push a message to the top forever.
    // `postedAt` below is untouched — the delta poll ranges over that, and it
    // must stay monotonic or a backfilled message is never delivered.
    let madeAt = new Date().toISOString();
    if (created) {
      const t = new Date(created).getTime();
      if (!isNaN(t) && t <= Date.now() + 60000) madeAt = new Date(t).toISOString();
    }
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title || '').slice(0, 120),
      text: String(text).slice(0, 20000),
      tldr: String(tldr || '').slice(0, 1000),
      from: 'claude',
      created: madeAt,
      // Same monotonic write stamp as /reply — it's what the delta poll ranges
      // over, so nothing can be skipped for having an older `created`.
      postedAt: new Date().toISOString(),
    };
    // "Open in Claude" deep link for this chat (claude.ai/code/session_…)
    if (url && /^https?:\/\//.test(url)) doc.url = String(url).slice(0, 400);
    // The server is the authority on where a post files. The hook sends its
    // session id explicitly; older hooks carry it inside the deep link. Either
    // way the post goes through session-first resolution, so a stale hook-side
    // slug cache (or a reused branch name) can never file into the wrong
    // thread. `explicit` marks a deliberate FORGE_CHAT name shared across
    // sessions on purpose — those are never re-keyed (tombstones still apply).
    const sm = doc.url && doc.url.match(/session_([A-Za-z0-9_-]{6,})/);
    const skey = String(session || (sm ? sm[1] : '')).slice(0, 120);
    doc.chat = explicit
      ? await followMoves(doc.chat)
      : await resolveChat(doc.chat, skey);
    if (audio && /^https?:\/\//.test(audio)) doc.audioUrl = String(audio);
    else if (audio && /^data:audio\//.test(audio)) {
      const m = audio.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
      if (m && admin.apps.length) {
        const ext = m[1].includes('mpeg') ? 'mp3' : m[1].split('/')[1].split(';')[0];
        const bucket = admin.storage().bucket();
        const file = bucket.file(`chat-feed/${Date.now()}.${ext}`);
        await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
        await file.makePublic();
        doc.audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      }
    }
    // Live drafts (Aug 2026): a post carrying `turn` — a stable per-turn key
    // from the hook (the transcript uuid of the user message that started the
    // turn) — UPSERTS one message per turn instead of appending a new doc.
    // That's what lets the hook post the prose a chat writes BEFORE it starts
    // coding (working:true, the app shows "still writing…"), grow it as more
    // text lands between tool calls, and have the normal end-of-turn post
    // finalize the SAME message (working cleared, TLDR set) — one message in
    // the thread, never a duplicate. The doc id is deterministic from
    // session|turn (falling back to chat|turn), NOT from the chat slug alone,
    // so a mid-turn slug re-resolution or a renamed chat can never fork a
    // draft; the final post simply re-patches `chat` to the current
    // resolution. postedAt bumps on every write, which is what re-delivers
    // the updated doc through the app's delta poll.
    // THE WORKING FOLD's two boundaries (Aug 2026) — character offsets into
    // `text`: `head` = where the FIRST tool call of the turn fell, `tail` =
    // where the LAST one did. So text[0,head) is what the chat said before it
    // started working, text[tail,…) is the closing rundown, and the middle is
    // narration between tool calls. The Chats app folds that middle. This
    // replaced a vocabulary classifier that guessed from wording and got it
    // wrong (see foldBody in chats.html for the measurement).
    // A hook new enough to send them is exact and always wins.
    const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0
      ? Math.min(Math.round(Number(v)), 100000) : null);
    const hd = num(head), tl = num(tail);
    if (hd !== null && tl !== null && tl >= hd) { doc.head = hd; doc.tail = tl; }
    let msgId;
    // When this turn's text FIRST landed — `doc.created` normally, but the
    // draft's own stamp when this post is finalizing one (the patch below
    // keeps it, so the doc's `created` is the truth and the final post's is
    // just "now"). The push gate compares it against her newest message, and
    // a turn that was already running when she sent must lose that comparison
    // — so it has to be the turn's start, never the moment it was posted.
    let bornAt = doc.created;
    const turnKey = String(turn || '').slice(0, 120);
    if (turnKey) {
      msgId = 't' + crypto.createHash('sha1')
        .update((skey || doc.chat) + '|' + turnKey).digest('hex').slice(0, 28);
      const ref = db().collection(MSGS).doc(msgId);
      if (working) doc.working = true;
      // …and DERIVED from the drafts themselves for a hook that doesn't send
      // them, which costs nothing and needs no re-paste: a draft posts at a
      // tool call carrying the turn's text SO FAR, so the first draft's length
      // IS `head` and the newest draft's length is `tail`. Approximate only in
      // that the draft pass skips turns under 60 chars and posts only when the
      // prose grew — both of which err toward folding less, never more.
      if (working && doc.head === undefined) { doc.head = doc.text.length; doc.tail = doc.text.length; }
      const prev = await ref.get();
      if (prev.exists) {
        // keep the first write's `created` (it's what the unread dot keys on —
        // a draft pings once when it appears, never again as it grows/finishes)
        bornAt = prev.get('created') || bornAt;
        const patch = {
          chat: doc.chat, text: doc.text, tldr: doc.tldr, postedAt: doc.postedAt,
          working: working ? true : admin.firestore.FieldValue.delete(),
        };
        if (doc.url) patch.url = doc.url;
        if (doc.audioUrl) patch.audioUrl = doc.audioUrl;
        // The FINAL post must never overwrite the boundaries the drafts left
        // behind — its own text is the whole turn, so deriving from it would
        // mark the entire reply as pre-work and fold nothing.
        if (doc.head !== undefined && (working || hd !== null)) {
          if (hd !== null) patch.head = doc.head;
          else if (prev.get('head') === undefined) patch.head = doc.head;
          patch.tail = doc.tail;
        }
        await ref.update(patch);
      } else {
        await ref.set(doc);
      }
    } else {
      const ref = await db().collection(MSGS).add(doc);
      msgId = ref.id;
    }
    const reg = { lastSeen: doc.created };
    if (doc.url) reg.url = doc.url; // keep the chat's deep link on its registry tile
    // Which Claude account this chat's sessions run under (the hook posts the
    // environment's FORGE_ACCOUNT). Open buttons route app-vs-browser off it.
    if (account) reg.account = String(account).slice(0, 20);
    // The chat's own registry doc, read BEFORE the write below (regRef() drops
    // the cache, so reading after would force a fresh collection read every
    // reply). Used for the pin's turn count and for the push title; a pin
    // written earlier in this turn already invalidated the cache, so what comes
    // back here is current.
    let mine = {};
    try { mine = (await registry()).chats[doc.chat] || {}; } catch (e) { /* best effort */ }
    // A FINAL reply ends the turn: clear the turn-start mark the hook stamped
    // at UserPromptSubmit (see POST /working), so the app's pink tint drops
    // the moment the reply lands. A growing draft is still mid-turn.
    // It also ages the pinned link by one turn (see pinBump) — that is what
    // takes the "current" tag off a pin the chat stopped updating.
    if (!working) {
      reg.workingAt = admin.firestore.FieldValue.delete();
      const bumped = pinBump(mine.pinned);
      if (bumped) reg.pinned = bumped;
    }
    // …and it MIGHT be the moment worth a buzz: a FINISHED reply that is
    // actually ANSWERING HER (Aug 2026 — see push-gate.js for the three shapes
    // that used to buzz her at the wrong moment, the loudest being a catch-up
    // post landing the instant she hits send). The gate is pure and reads only
    // fields already on the registry doc, so it costs no extra read.
    // …and only if she has TURNED THE BELL ON for this chat (Aug 2026). The
    // bell is the coarser question — "do I want this chat on my lock screen at
    // all" — so it is asked before the timing one, and it is a whitelist: a
    // chat she has never belled stays silent.
    const gate = chatNotifies(mine)
      ? shouldPushReply({
        working,
        replyCreated: bornAt,
        lastHerAt: mine.lastHerAt,
        pushedAt: mine.pushedAt,
      })
      : { push: false, why: 'bell-off' };
    // Stamped in the SAME registry write the reply already makes — and stamped
    // before the send, not after: the push is fire-and-forget, so waiting on it
    // would leave a window where a second reply could push again.
    if (gate.push) reg.pushedAt = doc.postedAt;
    await regRef(doc.chat).set(reg, { merge: true });
    // Fire-and-forget by contract; notifyChat can never fail this route. The
    // title is the name SHE gave the chat, when there is one. `debounce:false`
    // because her message is the gate now — a time window on top of it would
    // swallow the answer to a follow-up she sent four minutes later.
    if (gate.push) {
      try {
        require('./push').notifyChat(doc.chat, mine.displayName || doc.chat,
          pushBody(doc.text, doc.tldr).slice(0, 240), { debounce: false });
      } catch (e) { /* push must never fail a post */ }
    }
    // END OF TURN: the chat files itself (Aug 2026 — "that could be a start of
    // turn or end of turn activity"). END, not start: at the start of a turn
    // the newest thing in the thread is her message and the turn's work hasn't
    // happened yet, so the sorter would be judging a chat by what it was
    // BEFORE the thing she just asked for. A finished reply is the moment the
    // chat is most itself.
    //
    // Fire-and-forget by contract, exactly like the push above: it runs after
    // the response, and nothing it does — a model outage, a missing key, a
    // Firestore error — can fail a chat's reply. A draft is mid-turn and never
    // triggers it.
    res.json({ ok: true, id: msgId });
    if (!working) {
      sortChat(doc.chat).catch(() => { /* sorting must never fail a post */ });
      // A finished reply is the true "the wake was delivered" signal — clear
      // any pending wake-queue entry for this chat, even if the switchboard
      // never got to its wake-done (chat-wake.js has the design).
      require('./chat-wake').noteReply(db, doc.chat);
    }
  } catch (err) { fail(res, err); }
});

router.post('/icon', async (req, res) => {
  try {
    const { chat, image } = req.body || {};
    const m = String(image || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!chat || !m) return res.status(400).json({ error: 'chat and image (data URL) required' });
    const ext = m[1].split('/')[1].split(';')[0].replace('jpeg', 'jpg');
    const bucket = admin.storage().bucket();
    const file = bucket.file(`chat-feed/icons/${String(chat).replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`);
    await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
    await file.makePublic();
    const icon = `https://storage.googleapis.com/${bucket.name}/${file.name}?v=${Date.now()}`;
    await regRef(chat).set({ icon }, { merge: true });
    res.json({ ok: true, icon });
  } catch (err) { fail(res, err); }
});

// NOTE: the Assets tab the app actually renders is GET /api/gallery/assets in
// server.js — that one is paged and dedupes a picture that lives at two storage
// paths. This route predates it and nothing calls it; fix the server.js one.
// Per-chat image gallery (the "Assets" tab inside a chat). Built from the union
// of: image URLs already present in that chat's message text (so existing chats
// show their art with no back-fill) + forge-chat-assets docs (uploaded-file
// images the gallery hook tags with the chat). De-duped by URL, newest first.
const ASSETS = 'forge-chat-assets';
const IMG_URL_RE = /https:\/\/(?:storage|firebasestorage)\.googleapis\.com\/[^\s)\]"'<>]+?\.(?:png|jpe?g|webp|gif)/gi;
router.get('/assets', async (req, res) => {
  try {
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 300);
    const [msnap, asnap] = await Promise.all([
      db().collection(MSGS).where('chat', '==', chat).get(),
      db().collection(ASSETS).where('chat', '==', chat).get(),
    ]);
    const seen = new Map(); // url -> { url, created, prompt }
    const add = (url, created, prompt) => {
      if (!url || seen.has(url)) return;
      seen.set(url, { url, created: created || '', prompt: prompt || '' });
    };
    msnap.docs.forEach((d) => {
      const m = d.data();
      const found = String(m.text || '').match(IMG_URL_RE) || [];
      found.forEach((u) => add(u, m.created, m.tldr || ''));
    });
    asnap.docs.forEach((d) => { const a = d.data(); add(a.url, a.created, a.prompt); });
    const assets = Array.from(seen.values())
      .sort((a, b) => (a.created < b.created ? 1 : -1))
      .slice(0, limit);
    res.json({ chat, assets });
  } catch (err) { fail(res, err); }
});

// Mark a chat "answered" (or clear it). Stores answeredAt = now; the client
// treats a chat as done (grayed) while answeredAt >= its latest message, so
// any new message — from Sophie or the chat — un-grays it automatically.
router.post('/answered', async (req, res) => {
  try {
    const { chat, answered } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const stamp = new Date().toISOString();
    const del = admin.firestore.FieldValue.delete();
    // Answered and flagged are exclusive — marking one clears the other.
    const patch = answered
      ? { answeredAt: stamp, flaggedAt: del }
      : { answeredAt: del };
    await regRef(chat).set(patch, { merge: true });
    res.json({ ok: true, answeredAt: answered ? stamp : null });
  } catch (err) { fail(res, err); }
});

// Flag a chat "come back to this later" (or clear it). Like answeredAt it grays
// the tile and auto-clears once a newer message arrives; it's exclusive with
// answered, so setting one removes the other.
router.post('/flag', async (req, res) => {
  try {
    const { chat, flagged } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const stamp = new Date().toISOString();
    const del = admin.firestore.FieldValue.delete();
    const patch = flagged
      ? { flaggedAt: stamp, answeredAt: del }
      : { flaggedAt: del };
    await regRef(chat).set(patch, { merge: true });
    res.json({ ok: true, flaggedAt: flagged ? stamp : null });
  } catch (err) { fail(res, err); }
});

// Manually tag which Claude account a chat belongs to ("1"/"2") — the same
// registry field the hook stamps automatically on each post. This covers
// existing chats that haven't posted since FORGE_ACCOUNT was added to the
// environments (Sophie taps it in the thread). Empty account clears the tag.
router.post('/account', async (req, res) => {
  try {
    const { chat, account } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const val = String(account || '').slice(0, 20);
    await regRef(chat)
      .set({ account: val || admin.firestore.FieldValue.delete() }, { merge: true });
    res.json({ ok: true, account: val || null });
  } catch (err) { fail(res, err); }
});

// Which Claude account is signed into the Claude iOS app right now ("1" or
// "2"). Sophie flips this from the home-screen App/Web toggle whenever she
// swaps sign-ins; every chat's Open button routes off it (app vs browser).
router.post('/app-account', async (req, res) => {
  try {
    const account = String((req.body || {}).account || '').slice(0, 20);
    if (!account) return res.status(400).json({ error: 'account required' });
    await regRef(SETTINGS_DOC).set({ appAccount: account }, { merge: true });
    res.json({ ok: true, appAccount: account });
  } catch (err) { fail(res, err); }
});

// Open a claude.ai session in the BROWSER instead of the Claude app.
// LEGACY hop — kept only for cached copies of /chats; the page now appends
// #no_universal_links to the claude.ai URL itself and links it directly.
// claude.ai's apple-app-site-association EXCLUDES any URL carrying that
// fragment (their first match rule, checked July 2026), so iOS never hands
// it to the Claude app. The two redirect tricks this route tried before it
// both failed live: a 302 bounced into the app (2026-07-27), and the
// self-navigating page (location.replace + meta-refresh) bounced too
// (2026-07-31) — automatic redirects don't defeat the universal link on
// current iOS, the AASA exclusion does. So this now just 302s to the
// fragment-tagged URL.
router.get('/go', (req, res) => {
  const u = String(req.query.u || '').slice(0, 400);
  if (!/^https:\/\/claude\.ai\//.test(u)) return res.status(400).send('bad url');
  res.set('Cache-Control', 'no-store');
  res.redirect(302, u + (u.includes('#') ? '' : '#no_universal_links'));
});

// Archive / unarchive a chat — Sophie taps this herself in the app. Archived
// chats move to a collapsed "Archived" section on the home views.
// THE ARCHIVE WRAP-UP (Aug 2026, Sophie: "whenever I'm about to archive a chat
// the last message of the chat is them explaining what the chat was about and
// what went down … and that could go into the note at the top").
//
// Measured the day she asked: **73 of her 88 archived chats showed nothing but
// a name**, so the archive was a list she could not read.
//
// The obstacle is that a chat is ASLEEP by the time she archives it — it cannot
// be asked to summarise itself at that moment. So the wrap-up is written ahead
// of time and frozen on the way past:
//   1. a chat writes its own with POST /wrapup (the good one — it was there);
//   2. failing that, archiving FREEZES the chat's Update card into one, free
//      and instant, because `updAsked`/`updDid` already say what she asked for
//      and what happened — the same question in different words;
//   3. failing both, POST /wrapup/write reads the thread and writes one with
//      Claude, which is the only path that can rescue a chat that already died.
//
// THE SUMMARIZE BUTTON on the archive sheet is (3), on demand (Aug 2026,
// Sophie: "a button on there that automatically asks the chat to give me like a
// quick summary of what we accomplished in that chat, and if there were still
// any questions that were open"). It cannot literally ask the chat — the
// session is gone — so the SERVER reads the thread the app already stores and
// writes the summary itself. From her side the difference is invisible: one tap
// inside the pop-up she is already standing in, no going back to Claude, no
// copying text between apps. `wrapOpen` is the loose-ends half of her ask.
//
// TWO FIELDS, because she asked for both shapes: `wrapLine` is the ONE line the
// row shows (the archive stays scannable) and `wrapUp` is the full thing behind
// a tap. Her own `sophieNote` still wins the row — a chat must never overwrite
// a line she wrote, which is why this is not stored in `sophieNote` at all.
//
// THE SUMMARY IS THE UPDATE CARD'S THREE QUESTIONS (Aug 2026, Sophie: "I think
// what I really wanted was the what you asked, what I did, and next steps.
// Since chat already answered those three questions could you just switch the
// summary for that"). The prose summary was a fourth shape saying the same
// thing in a form she had not asked for, so it is the three labelled lines now
// — `wrapAsked` / `wrapDid` / `wrapNext`, exactly the Update card's fields, one
// renderer for both. **ONE SENTENCE EACH** (same message: "each of the three
// sections is about two sentences that's six sentences in total. I'd prefer to
// be about three sentences") — so `WRAP_PART_MAX` is a hard character cap, not
// a target, the same lesson the old short summary learned the hard way.
//
// `wrapUp` is still written, as the three joined into plain prose: her phone
// keeps a cached page for days and 312 chats already carry a wrap-up written in
// that shape, so the old field stays the fallback every reader can already draw.
const wrapLineOf = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200);
const wrapTextOf = (s) => String(s || '').replace(/[ \t]+/g, ' ').trim().slice(0, 2000);
const WRAP_PART_MAX = 200;
// ONE SENTENCE, CUT IN CODE — a length in a prompt is a hope (Aug 2026, Sophie,
// reading a summary whose middle answer ran to two: "I thought that each of the
// questions was supposed to be just one sentence but the middle question is
// longer" → "ok hard cap it"). WRAP_SYS has asked for one sentence since the
// shape was hers, and the model still returns two, exactly the way it returned
// 223 characters when asked for under 180 — so the rule lives here now and the
// prompt is only the hint.
//
// A sentence ends at .!? followed by a space and a CAPITAL: that leaves "e.g."
// and "12x18." alone, and it errs toward keeping MORE rather than cutting a
// thought in half. The character cap behind it is the hard stop, and it cuts at
// a word boundary — a summary that ends mid-word reads worse than a long one.
function wrapPartOf(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = /([.!?]["')\]]?)\s+(?=[A-Z“"'(\[])/.exec(t);
  const one = m ? t.slice(0, m.index + m[1].length) : t;
  if (one.length <= WRAP_PART_MAX) return one;
  const cut = one.slice(0, WRAP_PART_MAX);
  const sp = cut.lastIndexOf(' ');
  return (sp > WRAP_PART_MAX * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\-\s]+$/, '') + '…';
}
// WHAT SHE ASKED IS HER OWN SENTENCE, NEVER A PARAPHRASE (2026-08-24, Sophie:
// "right now the what I did — I mean what I asked — sentence is paraphrased.
// can you make it my exact sentence and just truncate it if it gets too long,
// so basically just the beginning of my last message").
//
// The other two answers are the chat's account of its own work, so they have to
// be written. Hers is the one line nobody needs to write: she already said it,
// and a model retelling it in its own words can only move it further from what
// she meant — the house rule that her words reach the model verbatim, applied
// to the summary she reads months later. So the server lifts the OPENING of her
// last message off the thread it already stores and files that.
//
// TRUNCATED, NOT SUMMARISED, and deliberately NOT cut at the first sentence the
// way `wrapPartOf` cuts a written answer: she dictates, so her punctuation is
// unreliable and "I have a question." would be the whole line. It is the first
// HER_ASK_MAX characters, at a word boundary, with an ellipsis — the beginning
// of her message, exactly as she said it.
const HER_ASK_MAX = 200;
function herAskOf(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= HER_ASK_MAX) return t;
  const cut = t.slice(0, HER_ASK_MAX);
  const sp = cut.lastIndexOf(' ');
  return (sp > HER_ASK_MAX * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\-\s]+$/, '') + '…';
}
// Her newest message in a loaded thread. A CONTEXT-COMPACTION SUMMARY is not
// her message — the harness hands it to the model as a user turn and the hook
// lifts it exactly like something she typed, so it would file 7,000 characters
// of recited rules as what she asked for. One copy of that rule, in questions.js.
//
// `before` (an ISO string) caps it at a moment — the BACKFILL's case. A summary
// written on the 20th is her question of the 20th paired with what the chat did
// by the 20th; taking her newest message instead would file a question she
// asked afterwards over answers that predate it.
// A SLASH COMMAND IS NOT AN ASK. She types `/concise`, `/loop 5m …` and the
// harness hands it over as an ordinary user turn, so the hook lifts it exactly
// like something she said. Filing it as what she asked for puts a control she
// pressed where her question should be (found 2026-08-27 on
// instagram-video-crop, whose run opened on a bare `/concise`). Only a message
// that is NOTHING BUT a command is skipped — a message that merely mentions one
// is hers.
const SLASH_ONLY = /^\/[A-Za-z][\w:-]*(\s+\S.*)?$/;
const isAskable = (t) => !!t && !isCompacted(t) && !SLASH_ONLY.test(t);

// WHEN SHE SENDS SEVERAL IN A ROW, THE ASK IS THE FIRST OF THEM (2026-08-27,
// Sophie: "recurring issue - multiple messages only log the last one in chats
// app" / "first shud be under what i asked").
//
// She talks the way she talks: the request, then the qualifications — "and the
// same for the glove ones", "notify when done", "j". Reading her LAST message
// files the afterthought instead, so the one line she reads months later to
// remember what a chat was is the throwaway. Measured over her 215
// stored wrap-ups the hour this landed: 14 change, and they change from "pills"
// to "we made a couple panels yesterday and I think they never got cut", from
// "view" to "pressing the playground button on images made by panels should
// copy the prompt", from "j" to "dreamt style".
//
// A RUN is her consecutive messages with NO reply between them — the chat never
// got a word in, so all of it is one ask. The moment a reply lands the run ends,
// so an ordinary back-and-forth is untouched and this can only ever reach back
// over messages nothing has answered. Deliberately NOT time-bounded: a stretch
// the chat worked through without replying is still one ask, and a clock here
// would be a rule she never asked for.
function herAskText(msgs, before) {
  const list = msgs || [];
  let found = '';
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i] || {};
    if (before && String(m.created || '') > String(before)) continue;
    const t = String(m.text || '').trim();
    if (m.from === 'sophie') {
      if (isAskable(t)) { found = t; continue; }
      // A compaction summary or a bare slash command is machinery wearing her
      // name: it is neither the ask nor a boundary, so step over it.
      continue;
    }
    if (found) break;    // the reply that ended the run — stop here
  }
  return found;
}
// The same thing for a caller that has not loaded the thread. One equality
// filter, sorted in memory — the house rule in this file, so Firestore needs no
// composite index. Best-effort: a wrap-up must never fail because a read did.
async function herAskFor(chat) {
  try {
    const snap = await db().collection(MSGS).where('chat', '==', chat).get();
    const msgs = snap.docs.map((d) => d.data())
      .sort((a, b) => (String(a.created || '') < String(b.created || '') ? -1 : 1));
    return herAskOf(herAskText(msgs));
  } catch (_) { return ''; }
}

// The prose mirror for an older reader — unlabelled, because the labels are the
// renderer's ("What you asked" / "What I did" / "What's next") and a reader
// that cannot draw the three lines is better served by three plain sentences.
const wrapProse = (asked, did, next) =>
  wrapTextOf([asked, did, next].map((s) => String(s || '').trim()).filter(Boolean).join(' '));

// THE SHORT SUMMARY IS THREE LINES ON HER PHONE, AND THE MODEL CANNOT BE ASKED
// TO COUNT (Sophie: "a short summary like three lines at most"). Measured over
// her real summaries, twice: asking for "UNDER 180 CHARACTERS" came back at a
// median of 223, and re-asking with the instruction tightened to two sentences
// still left 169 of 317 over the cap — the worst at 526 characters, eight lines
// in the expander. A length is not a thing to hope for, so it is enforced here
// on the way in.
//
// WHOLE SENTENCES ONLY: it keeps sentences until the next one would break the
// cap, and a first sentence already over the cap stands ALONE rather than being
// cut mid-thought (6 of 317, and a sentence that stops mid-word reads worse
// than a long one). The detail it drops is not lost — the long version behind
// `more` is where detail belongs, which is what makes trimming safe here.
const SHORT_CAP = 180;
function capShort(s, cap = SHORT_CAP) {
  const t = String(s || '').trim();
  if (t.length <= cap) return t;
  const parts = t.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const p of parts) {
    if (!out) { out = p; continue; }
    if (out.length + 1 + p.length > cap) break;
    out += ' ' + p;
  }
  return out;
}

// Freeze whatever the chat already said about itself into a wrap-up. Returns
// the patch to merge, or null when there is nothing to freeze — never invents.
// The Update card IS the summary's shape now, so this is a straight copy rather
// than a translation into prose.
function frozenWrapUp(r, herAsk) {
  if (!r || r.wrapUp || r.wrapLine) return null;          // already has one
  // HER OWN SENTENCE WINS THE ASKED LINE (2026-08-24) — the Update card's
  // `updAsked` is the chat's paraphrase of it, and it is only the fallback now,
  // for a chat she never posted a message into.
  const asked = herAsk || wrapPartOf(r.updAsked);
  const did = wrapPartOf(r.updDid);
  const next = wrapPartOf(r.updNext);
  const doing = wrapPartOf(r.statusDoing);
  if (!asked && !did && !doing && !next) return null;
  const line = wrapLineOf(did || doing || asked);
  // No Update card at all, only a live status line: it says what the chat was
  // in the middle of, which is the "what I did" half and nothing else.
  const didPart = did || (!asked && !next ? doing : '');
  return {
    wrapLine: line,
    wrapAsked: asked || admin.firestore.FieldValue.delete(),
    wrapAskedHers: herAsk ? true : admin.firestore.FieldValue.delete(),
    wrapDid: didPart || admin.firestore.FieldValue.delete(),
    wrapNext: next || admin.firestore.FieldValue.delete(),
    wrapUp: wrapProse(asked, didPart, next),
    wrapUpAt: new Date().toISOString(),
    wrapFrom: 'update-card',
  };
}

// The archive itself, so the button in her thread and a card's verdict on an
// archive-review deck take the SAME path — including the wrap-up freeze. Two
// copies would mean a chat archived from a deck quietly losing its summary.
async function setArchived(chat, on) {
  const ref = regRef(chat);
  const patch = { archived: on };
  // Only on the way IN. Taking a chat back out must not re-freeze anything,
  // and un-archiving is a gesture that should cost nothing.
  let froze = false;
  if (on) {
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : null;
    // Only read the thread when there is actually a wrap-up to freeze — an
    // archive tap on a chat that already has one must not cost a read.
    const herAsk = (cur && !cur.wrapUp && !cur.wrapLine) ? await herAskFor(chat) : '';
    const add = frozenWrapUp(cur, herAsk);
    if (add) { Object.assign(patch, add); froze = true; }
  }
  await ref.set(patch, { merge: true });
  return froze;
}

router.post('/archive', async (req, res) => {
  try {
    const { chat, archived } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = archived !== false;
    const froze = await setArchived(chat, on);
    res.json({ ok: true, archived: on, wrapUp: froze });
  } catch (err) { fail(res, err); }
});

// A chat writes its OWN wrap-up — the good one, because it was there. Do this
// when work wraps up, not every turn: it is what Sophie reads months later to
// remember what a chat was. `line` is the one row line, `text` the full story.
// Sending only `text` derives the line from its first sentence.
router.post('/wrapup', async (req, res) => {
  try {
    const { chat, session, line, text, long, open } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const resolved = await resolveChat(chat, String(session || '').slice(0, 120));
    // THE THREE QUESTIONS — what she asked, what it did, what is next; one
    // sentence each. `next` doubles as the loose-ends half, so a chat that used
    // to send `open` has its answer land where she now reads for it.
    // WHAT SHE ASKED IS HERS, VERBATIM (2026-08-24) — whatever the chat sends
    // as `asked` is its retelling of a sentence she already wrote, so the
    // server lifts the opening of her last message instead. Its own `asked` is
    // the fallback for a chat she has never posted into (a backfill, a chat
    // that only ever talked to itself).
    const hers = await herAskFor(resolved);
    const asked = hers || wrapPartOf(req.body && req.body.asked);
    const did = wrapPartOf(req.body && req.body.did);
    const next = wrapPartOf((req.body && req.body.next) || open);
    const three = asked || did || next;
    // The prose half stays writable for anything already sending it, and is
    // DERIVED from the three when they are what came in.
    //
    // `capShort` guards the FREE-TEXT path ONLY. The derived prose must keep
    // all three answers — cutting it to three lines would silently drop
    // "what's next", which is the half she reads for loose ends — while a chat
    // sending one long paragraph is exactly the case the cap was built for.
    const full = three ? wrapProse(asked, did, next) : capShort(wrapTextOf(text));
    const one = wrapLineOf(line || (full.split(/(?<=[.!?])\s/)[0] || full));
    const fuller = wrapTextOf(long);
    const still = wrapLineOf(open);
    if (!one && !full) return res.status(400).json({ error: 'line or text required' });
    const del = admin.firestore.FieldValue.delete();
    await regRef(resolved).set({
      wrapLine: one || del,
      wrapAsked: asked || del,
      // Her words, so the page truncates rather than cutting at a sentence.
      wrapAskedHers: hers ? true : del,
      wrapDid: did || del,
      wrapNext: next || del,
      wrapUp: full || del,
      // The fuller account, behind a second tap. Same three-depth shape the
      // Summarize button writes: `text` is the three-line answer, this is the
      // rest for when she wants it.
      wrapLong: (fuller && fuller !== full) ? fuller : del,
      // What was still open when it stopped. The three-question shape carries
      // that in `next`, so this is only written when nothing else does — two
      // fields answering the same question would show her the same loose end
      // twice under different words.
      wrapOpen: (!three && still) ? still : del,
      wrapUpAt: new Date().toISOString(),
      wrapFrom: 'chat',
    }, { merge: true });
    res.json({ ok: true, chat: resolved, wrapLine: one, wrapUp: full,
      wrapAsked: asked, wrapAskedHers: !!hers, wrapDid: did, wrapNext: next,
      wrapLong: fuller, wrapOpen: three ? '' : still });
  } catch (err) { fail(res, err); }
});

// RESCUE a chat archived before wrap-ups existed — the only path that can reach
// one whose session is long dead (Aug 2026: 73 of her 88 archived chats showed
// nothing but a name, and nothing had ever been written for them).
//
// It SPENDS MONEY, so: one chat per request, never triggered by opening a page,
// and it refuses a chat that already has a wrap-up unless forced. Reader-facing
// words — she is the reader — so it runs on CLAUDE, never gpt-4o-mini.
const WRAP_SYS = `You are writing the note a chat leaves behind when it is archived, for Sophie to read months later to remember what it was.

Return JSON: {"line": "...", "asked": "...", "did": "...", "next": "...", "long": "..."}

THE SUMMARY IS THREE ANSWERS TO THREE QUESTIONS — what she asked for, what you did about it, and what is next. ONE SENTENCE EACH, three sentences in total for the whole summary. That is a hard limit, not a target: two sentences in a field is already twice what she asked for. It is CUT IN CODE on the way in, so a second sentence is not shortened — it is thrown away. Put what matters in the first one.

"line": ONE line, under 120 characters, no trailing period. What this chat WAS — concrete and specific, naming the actual thing worked on. It is the only line she sees on the archive row.
"asked": ONE SENTENCE, under 140 characters. What Sophie wanted, in her terms — the thing she came here for, not a list of every request in the thread.
"did": ONE SENTENCE, under 140 characters. What actually happened about it: what was built, decided, changed or found. Say plainly if it was abandoned, went nowhere or was superseded — an honest dead end is more useful to her than a flattering summary.
"next": ONE SENTENCE, under 140 characters. What is next, or what was still unfinished or unanswered when it stopped — a question of hers nobody answered, a decision nobody made, work left half-done. EMPTY STRING when the chat genuinely ended settled and nothing is waiting; a made-up loose end sends her back into a chat that had nothing left in it.
"long": AN ARRAY OF SHORT POINTS — ["...", "..."] — for when those three sentences leave her wanting the rest. Usually 3 to 6 of them, one sentence or two each, under 800 characters all together. One point per distinct thing that happened: what was tried, what was decided and why, what it cost, what broke. SPLIT ONLY WHERE THE WORK ACTUALLY SPLIT: a chat that did one continuous thing gets one or two points, not a single thought chopped into fragments to fill a list. Never pad to reach a length; when a chat was genuinely small, return an empty array and let the three sentences be the whole answer.

Plain past tense, no preamble, no markdown, no headings. Do not repeat the question inside its own answer ("You asked for…" / "What I did was…") — the three questions are already the labels she reads them under. Never invent a detail that is not in the transcript; if the material is thin, write less. Do not use the phrases "this chat", "we discussed", or "explored".`;

// Rescue a JSON object that got CUT OFF mid-answer. Deliberately local rather
// than folded into anthropic.parseJSON: half an object is exactly what other
// callers must never be handed silently (a truncated Etsy listing, a half
// storyboard), whereas here the fields are independent strings and a summary
// missing its tail is still worth infinitely more to her than an error.
//
// Closes what the model left open — the string it was mid-way through, then
// every container — and if that still won't parse, drops back to the last
// COMPLETE key/value pair and closes there. Returns null when there is nothing
// to rescue, so the caller can report the real error.
function salvageJson(raw) {
  const s = String(raw || '');
  const a = s.indexOf('{');
  if (a < 0) return null;
  let inStr = false, esc = false;
  const stack = [];
  let lastPairEnd = -1;                      // end of the last comma at depth 1
  for (let i = a; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') stack.pop();
    else if (c === ',' && stack.length === 1) lastPairEnd = i;
  }
  const shut = (body, open) => body + (inStr ? '"' : '')
    + open.slice().reverse().join('');
  const tries = [shut(s.slice(a), stack)];
  if (lastPairEnd > a) tries.push(s.slice(a, lastPairEnd) + '}');
  for (const t of tries) {
    try {
      const v = JSON.parse(t);
      if (v && typeof v === 'object') return v;
    } catch (_) { /* next */ }
  }
  return null;
}

// TRIM THE SUMMARIES ALREADY ON FILE — free, and deliberately not a model call
// (Aug 2026). `capShort` above governs new writes; 169 summaries were already
// stored over the cap, written before it existed. Re-asking Claude for those
// would spend real money to fix a length problem that is pure text surgery, and
// would also rewrite summaries she may have already read. This only shortens
// what is there — it never asks for new words, never touches `wrapLong`,
// `wrapOpen` or `wrapLine`, and never lengthens anything.
//
// DRY BY DEFAULT, like every other bulk operation in this repo: it answers with
// what it WOULD change until called with `{dry:false}`.
router.post('/wrapup/trim', async (req, res) => {
  try {
    const dry = !(req.body && req.body.dry === false);
    const cap = Math.max(60, Number((req.body || {}).cap) || SHORT_CAP);
    const snap = await db().collection(REG).get();
    const hits = [];
    snap.docs.forEach((d) => {
      if (d.id === SETTINGS_DOC) return;
      const r = d.data() || {};
      // NEVER touch a chat already on the THREE-ANSWER shape (Aug 2026): its
      // `wrapUp` is the three sentences joined for older readers, and cutting
      // that to three lines would drop "what's next" — the half she reads for
      // loose ends. This only shortens the one-paragraph summaries written
      // before that shape existed.
      if (r.wrapAsked || r.wrapDid || r.wrapNext) return;
      const cur = String(r.wrapUp || '');
      if (cur.length <= cap) return;
      const next = capShort(cur, cap);
      if (!next || next === cur) return;
      hits.push({ chat: d.id, was: cur.length, now: next.length, text: next });
    });
    if (!dry) {
      for (const h of hits) {
        await regRef(h.chat).set({ wrapUp: h.text }, { merge: true });
      }
    }
    res.json({ ok: true, dry, cap, checked: snap.size, trimmed: hits.length,
      // The ones a trim cannot fix: a single sentence longer than the cap is
      // kept whole, so it is still over. Named rather than silently counted.
      stillOver: hits.filter((h) => h.now > cap).map((h) => h.chat),
      sample: hits.slice(0, 5).map((h) => ({ chat: h.chat, was: h.was, now: h.now })) });
  } catch (err) { fail(res, err); }
});

// PUT HER OWN WORDS BACK ON THE SUMMARIES ALREADY ON FILE, FREE (2026-08-24,
// Sophie a day after the fix shipped: "what I asked, which is the default note
// at the top of every chat, is paraphrased … make it not paraphrase, just my
// actual words truncated").
//
// She was right and the code was right — #1631 lifts her opening on all three
// writing paths, but a wrap-up is STORED, not derived on read, so every summary
// written before it kept its model paraphrase forever. Measured that day: 9
// chats carried her words, 70 carried a paraphrase. Nothing re-writes a
// wrap-up on its own, so the repair is its own pass — the `/wrapup/trim`
// pattern: pure text surgery, no model call, dry by default.
//
// Three rules, and each one is about not overreaching:
//   1. It only ever touches `wrapAsked` (plus the `wrapUp` mirror when that
//      mirror is provably the three answers joined). `wrapDid`, `wrapNext`,
//      `wrapLine` and `wrapLong` are the chat's own account of its work and
//      are never reworded.
//   2. HER MESSAGE AS OF WHEN THE SUMMARY WAS WRITTEN (`wrapUpAt`), not her
//      newest — see `herAskText`'s `before`. A summary is a moment, and
//      pairing today's question with last week's answers reads as nonsense.
//   3. A chat she never posted into is LEFT ALONE. There is nothing of hers to
//      lift, and the chat's `asked` is the honest fallback exactly as it is on
//      the live paths.
router.post('/wrapup/rehers', async (req, res) => {
  try {
    const dry = !(req.body && req.body.dry === false);
    const redo = !!(req.body && req.body.redo);
    const only = String((req.body || {}).chat || '').trim();
    const snap = await db().collection(REG).get();
    const todo = [];
    snap.docs.forEach((d) => {
      if (d.id === SETTINGS_DOC) return;
      if (only && d.id !== only) return;
      const r = d.data() || {};
      // ALREADY HERS is normally the stopping rule — this pass exists to
      // replace a PARAPHRASE. `redo:true` reopens them, which is what the
      // first-of-the-run change (2026-08-27) needed: a record already carrying
      // her words carries the LAST of a run, and her rule is the first.
      if (r.wrapAskedHers === true && !redo) return;
      if (!String(r.wrapAsked || '').trim()) return;    // nothing to replace
      todo.push({ chat: d.id, r });
    });
    const changed = [];
    const noMessage = [];
    for (const t of todo) {
      // One equality filter, sorted in memory — the house rule in this file.
      let msgs = [];
      try {
        const ms = await db().collection(MSGS).where('chat', '==', t.chat).get();
        msgs = ms.docs.map((x) => x.data())
          .sort((a, b) => (String(a.created || '') < String(b.created || '') ? -1 : 1));
      } catch (_) { /* best-effort, exactly like herAskFor */ }
      const hers = herAskOf(herAskText(msgs, t.r.wrapUpAt));
      if (!hers) { noMessage.push(t.chat); continue; }
      if (hers === t.r.wrapAsked) continue;             // identical already
      // NOTHING IS DESTROYED — the paraphrase moves aside rather than being
      // overwritten. Measured over the 62 this pass rewrites: ~56 are plainly
      // better and about SIX come out worse, because her last message before
      // that summary was a sign-off ("ok build is here now. anything else to
      // do?") or a machine-authored prompt the hook lifted as hers (a
      // routine's deploy check-in, a handoff brief). Those really are the
      // words that were sent as her turn, and her rule is her rule, so the
      // pass applies it everywhere rather than inventing a quality bar over
      // her messages — the detector-over-her-words mistake this repo has
      // already made twice (see *Answering a question*). Keeping the old line
      // is what makes that the cheap, reversible call instead of a permanent
      // one.
      // `wrapAskedWas` is the ORIGINAL paraphrase and is written once — a
      // re-pointing pass (`redo`) must not overwrite it with the sentence of
      // hers this pass is replacing, or the undo stops being an undo.
      const patch = { wrapAsked: hers, wrapAskedHers: true };
      if (!String(t.r.wrapAskedWas || '').trim()) patch.wrapAskedWas = t.r.wrapAsked;
      // The prose mirror is rebuilt ONLY when it is provably the three answers
      // joined — anything else is a summary written as a paragraph, and
      // splicing her sentence into someone's prose would leave a broken one.
      const mirror = wrapProse(t.r.wrapAsked, t.r.wrapDid, t.r.wrapNext);
      if (mirror && String(t.r.wrapUp || '').trim() === mirror) {
        patch.wrapUp = wrapProse(hers, t.r.wrapDid, t.r.wrapNext);
      }
      changed.push({ chat: t.chat, was: t.r.wrapAsked, now: hers, mirror: !!patch.wrapUp });
      if (!dry) await regRef(t.chat).set(patch, { merge: true });
    }
    res.json({ ok: true, dry, redo, checked: todo.length, rewrote: changed.length,
      // Named rather than silently skipped: a chat she never posted into keeps
      // its chat-written answer, which is the same fallback the live paths use.
      noMessageOfHers: noMessage,
      sample: changed.slice(0, 8) });
  } catch (err) { fail(res, err); }
});

router.post('/wrapup/write', async (req, res) => {
  try {
    const { chat, force } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const anthropic = require('./anthropic');
    if (!anthropic.available()) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });
    }
    const target = await followMoves(chat);
    const reg = await regRef(target).get();
    const cur = reg.exists ? reg.data() : {};
    if (!force && (cur.wrapUp || cur.wrapLine)) {
      return res.json({ ok: true, skipped: 'already has one', chat: target });
    }
    // One equality filter, sorted in memory — the house rule everywhere in this
    // file, so Firestore needs no composite index.
    const snap = await db().collection(MSGS).where('chat', '==', target).get();
    const msgs = snap.docs.map((d) => d.data())
      .sort((a, b) => (String(a.created || '') < String(b.created || '') ? -1 : 1));
    if (!msgs.length) return res.status(400).json({ error: 'no messages to read' });
    // The OPENING says what she wanted and the CLOSING says how it ended, which
    // is the whole question. The long middle is the work — it costs tokens
    // without changing the answer, so a 300-message thread bills like a short
    // one and the price of the backfill stays predictable.
    const cut = (m) => (m.from === 'sophie' ? 'Sophie: ' : 'Chat: ')
      + String(m.text || '').replace(/\s+/g, ' ').slice(0, 700);
    const head = msgs.slice(0, 3).map(cut);
    const tail = msgs.length > 3 ? msgs.slice(-6).map(cut) : [];
    const digest = (head.join('\n\n') + (tail.length ? '\n\n[…]\n\n' + tail.join('\n\n') : ''))
      .slice(0, 9000);
    // WHAT WAS STILL OPEN (Aug 2026, Sophie: "a quick summary of what we
    // accomplished in that chat, and if there were still any questions that
    // were open"). Her unanswered questions are DERIVED, not read out of the
    // digest — `buildQuestions` already pairs every question she asked with the
    // reply that followed it, over the WHOLE thread, so this reaches the long
    // middle the digest deliberately drops. Handing them over as facts is also
    // what keeps the `open` line honest: the model is naming questions that
    // provably went unanswered instead of inventing plausible loose ends.
    const unanswered = buildQuestions(msgs).filter((q) => !q.answer)
      .slice(0, 5).map((q) => '- ' + String(q.question).replace(/\s+/g, ' ').slice(0, 200));
    // RUN THE CALL RAW, so a truncated answer can still be rescued (found live
    // 2026-08-15 on clips-chunking-library: the sheet showed "Claude did not
    // return parseable JSON (got: {"line":"Built the Chunking clip-library
    // tool…","text":"Sophie wanted a li)". Nothing was wrong with the summary —
    // 600 max_tokens simply cut the JSON off mid-string, and an unclosed brace
    // fails BOTH of parseJSON's attempts, so a perfectly good line was thrown
    // away with it. Two fixes, because either alone still loses work: a cap
    // with real headroom, and a salvage for the day something runs past it.
    const rawOut = await anthropic.chat({
      system: WRAP_SYS + '\n\nReply with STRICT JSON only — no prose, no code fences.',
      user: 'Chat name: ' + (cur.displayName || target) + '\nMessages: ' + msgs.length
        + (unanswered.length
          ? '\n\nQuestions Sophie asked that nobody ever answered:\n' + unanswered.join('\n')
          : '\n\nEvery question she asked in here got a reply.')
        + '\n\n' + digest,
      // Three summary fields now instead of one, so the cap grew with them.
      maxTokens: 1500,
    });
    let out, salvaged = false;
    try { out = anthropic.parseJSON(rawOut); }
    catch (err) {
      out = salvageJson(rawOut);
      if (!out) throw err;                       // genuinely unusable — say so
      salvaged = true;
      // A rescued answer ends mid-sentence, so cut back to the last one that
      // finished. Better a summary that stops early than one that stops "wanted
      // a li" — and the LINE, which is written first and is what her archive row
      // shows, almost always survived whole.
      // The fields are written in order, so a truncation loses the LAST ones —
      // trim whichever one it stopped inside, and the shorter fields before it
      // survive whole. That ordering is why the three one-sentence answers are
      // asked for before `long`: the summary she actually reads is the one
      // least likely to be cut.
      const backToSentence = (v) => {
        const t = String(v || '');
        const stop = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'));
        return stop > 40 ? t.slice(0, stop + 1) : '';
      };
      out.text = backToSentence(out.text);
      // Each answer is one sentence, so a half-written one has nothing to trim
      // back TO — an answer that never reached a full stop is dropped whole
      // rather than shown to her ending mid-word.
      ['asked', 'did', 'next'].forEach((k) => {
        if (out[k] !== undefined && !/[.!?]["')\]]?\s*$/.test(String(out[k] || '').trim())) {
          out[k] = '';
        }
      });
      // A rescued array has a half-written last point — drop it rather than
      // showing her a bullet that stops mid-word. The earlier points are whole.
      out.long = Array.isArray(out.long)
        ? out.long.filter((x) => /[.!?]\s*$/.test(String(x || '').trim()))
        : backToSentence(out.long);
    }
    const full = capShort(wrapTextOf(out && out.text));
    // THE LONG ONE (Aug 2026, Sophie: "ideally would be a short summary like
    // three lines at most, and then a longer summary behind an arrow"). Same
    // story at a second depth, not a continuation — she stops at whichever
    // length answers her. A chat too small to have a longer version leaves it
    // empty and the short one is the whole answer.
    // ONE POINT PER LINE (Aug 2026, Sophie: "I would like bullet points
    // especially for the long summary … the long summary is one block of text
    // would be great to see them separate"). The model returns an array; it is
    // stored newline-joined so the field stays a plain string — the one already
    // written as a paragraph keeps rendering as one, and the page splits on the
    // newlines to draw bullets. An array is what makes the split reliable: a
    // paragraph would have to be re-split on punctuation, which breaks on every
    // abbreviation and file name.
    const long = wrapTextOf(Array.isArray(out && out.long)
      ? out.long.map((x) => String(x || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean).slice(0, 8).join('\n')
      : (out && out.long));
    // THE THREE ANSWERS (Aug 2026, Sophie: "what I really wanted was the what
    // you asked, what I did, and next steps … could you just switch the summary
    // for that"). `next` carries the loose ends the old `open` field held, so a
    // rewrite CLEARS that field rather than leaving her the same unfinished
    // business twice under two different headings.
    // HER OWN SENTENCE, LIFTED OFF THE THREAD (2026-08-24, Sophie: "can you
    // make it my exact sentence and just truncate it if it gets too long, so
    // basically just the beginning of my last message"). The model still
    // ANSWERS `asked` — it costs nothing extra and it is the fallback for a
    // chat with no message of hers in it — but her words win when they exist.
    const hers = herAskOf(herAskText(msgs));
    const asked = hers || wrapPartOf(out && out.asked);
    const did = wrapPartOf(out && out.did);
    const next = wrapPartOf(out && (out.next !== undefined ? out.next : out.open));
    const three = asked || did || next;
    // `wrapUp` is still written — an older cached page on her phone reads it,
    // and it is the fallback for every chat summarised before this shape.
    const prose = three ? wrapProse(asked, did, next) : full;
    const one = wrapLineOf(out && out.line) || wrapLineOf(prose.split(/(?<=[.!?])\s/)[0]);
    if (!one && !three && !prose) return res.status(502).json({ error: 'no summary came back' });
    const del = admin.firestore.FieldValue.delete();
    await regRef(target).set({
      wrapLine: one,
      wrapAsked: asked || del,
      wrapAskedHers: hers ? true : del,
      wrapDid: did || del,
      wrapNext: next || del,
      wrapUp: prose,
      // Cleared rather than left behind: a rewrite that finds nothing open (or
      // nothing more to say) must not leave the last run's leftovers under the
      // new summary.
      wrapLong: (long && long !== prose) ? long : del,
      wrapOpen: del,
      wrapUpAt: new Date().toISOString(),
      wrapFrom: 'claude',
    }, { merge: true });
    res.json({ ok: true, chat: target, wrapLine: one, wrapUp: prose,
      wrapAsked: asked, wrapAskedHers: !!hers, wrapDid: did, wrapNext: next, wrapLong: long,
      wrapOpen: '', messages: msgs.length, unanswered: unanswered.length });
  } catch (err) { fail(res, err); }
});

// DELETE a chat — the second option beside Archive (Aug 2026, Sophie: "I'd
// like there to be a delete button as a second option to archive so I can
// delete this chat so it doesn't keep confusing things ... and I'd like
// deleted chats to go to a trash that I can empty").
//
// TWO STAGES, deliberately. `deletedAt` on the registry doc takes the chat off
// every list and nothing is destroyed; only emptying the trash removes data.
// So a mis-tap costs one tap to undo, and the irreversible step is its own
// explicit act rather than a consequence of the first one.
//
// It is NOT a self-clearing stamp (the `hiddenAt` pattern) and it is NOT
// cleared by /reply the way `archived` is: a deleted chat must never resurrect
// itself because something posted into it. Presence of the field is the whole
// test — `deletedAt` also records WHEN, which is what the trash sorts by.
router.post('/delete', async (req, res) => {
  try {
    const { chat, deleted } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const gone = deleted !== false;
    await regRef(chat).set({
      deletedAt: gone ? new Date().toISOString() : admin.firestore.FieldValue.delete(),
    }, { merge: true });
    res.json({ ok: true, deleted: gone });
  } catch (err) { fail(res, err); }
});

// Firestore caps a batch at 500 writes, and a long-running chat can hold
// thousands of messages — so delete in chunks rather than one doomed batch.
async function deleteAll(snap) {
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db().batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

// EMPTY THE TRASH — the irreversible half. For every chat carrying
// `deletedAt`: its messages, its Compare pages, its asset records and its
// registry doc all go.
//
// What this deliberately does NOT touch is the image BYTES in Storage. The
// same picture is in her iOS gallery and can be referenced by another chat, so
// clearing a chat's records must never reach through and destroy the pictures
// themselves. Asset VOTES are left too — they're keyed by sha1(chat|url), so
// they can't be queried by chat, and an orphaned vote doc is a few bytes that
// nothing reads.
//
// `chat` in the body empties just that one; without it, the whole trash.
router.post('/trash/empty', async (req, res) => {
  try {
    const only = req.body && req.body.chat ? String(req.body.chat).slice(0, 60) : null;
    const reg = await db().collection(REG).get();
    const names = reg.docs
      .filter((d) => d.id !== SETTINGS_DOC && d.get('deletedAt'))
      .map((d) => d.id)
      .filter((n) => !only || n === only);
    if (!names.length) return res.json({ ok: true, chats: 0, messages: 0, pages: 0, assets: 0 });

    let messages = 0; let pages = 0; let assets = 0;
    for (const chat of names) {
      const [m, p, a] = await Promise.all([
        db().collection(MSGS).where('chat', '==', chat).get(),
        db().collection(PAGES).where('chat', '==', chat).get(),
        db().collection(ASSETS).where('chat', '==', chat).get(),
      ]);
      messages += await deleteAll(m);
      pages += await deleteAll(p);
      assets += await deleteAll(a);
      // The registry doc goes LAST — while it exists the chat is still listed
      // in the trash, so a failure partway through leaves something she can
      // see and re-empty rather than a half-erased chat that has vanished.
      await regRef(chat).delete();
    }
    res.json({ ok: true, chats: names.length, messages, pages, assets });
  } catch (err) { fail(res, err); }
});

// Hide / unhide a chat (Aug 2026, Sophie) — the red HIDDEN bar at the top of
// the chat list. A hidden chat leaves the list so she can see the rest, and
// waits behind the bar.
//
// It is a STAMP (`hiddenAt`), the same shape as answeredAt: a chat stays
// hidden only while nothing newer has arrived, so **the moment it answers her
// it pops back out into the list** (Sophie's call, Aug 2026 — v1 shipped this
// as a permanent boolean and she asked for the opposite). Hiding is "not now",
// not "away for good"; that's what Archive is for.
//
// `hidden:true` is the retired v1 boolean. Reads still honour it (a chat she
// hid that day must not silently reappear), writes always clear it.
router.post('/hide', async (req, res) => {
  try {
    const { chat, hidden } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = hidden !== false;
    const del = admin.firestore.FieldValue.delete();
    const stamp = new Date().toISOString();
    await regRef(chat)
      .set({ hiddenAt: on ? stamp : del, hidden: del }, { merge: true });
    res.json({ ok: true, hiddenAt: on ? stamp : null });
  } catch (err) { fail(res, err); }
});

// "I've CHECKED this one" — the ✓ on a card in the NEW tab (Aug 2026, Sophie:
// "a daily notifications thing … and I can get rid of them if I've already
// checked them").
//
// A STAMP (`notifSeenAt`), the same shape as hiddenAt / answeredAt, and the
// example she gave is exactly why it can't be a boolean: the chat that "keeps
// delivering different versions of this artifact". Checking off v3 must not
// silence v4 — so the card is gone only while nothing newer has landed, and
// anything newer (a reply, a Compare page, an image) brings it back by itself.
// Nothing has to un-check anything.
//
// It is deliberately SEPARATE from `seen` (which the app writes to
// localStorage when she opens a chat) and from `answeredAt`: checking a
// notification off says "I know about this", not "I have read the thread" and
// not "this chat is done".
//
// Since Aug 2026 it is the only thing SHE TAPS that takes a card off the
// Update tab — she asked for cards to stay put until she checks them, which
// retired the pin that used to opt one card out of auto-clearing. So the app
// must write this stamp on the ✓ and on nothing else: opening a chat used to
// POST here too, purely so the widget's count matched, and that would now
// silently clear cards she never checked.
//
// The one other thing that writes the same stamp is HER REPLY (POST /reply
// stamps it inline — see the note there): answering a chat is dealing with its
// news, and she asked for that after living with ✓-only. Opening is still not
// clearing. Nothing else may write it.
// ---- …AND IT IS WHERE THE REVIEW HOLD IS WRITTEN (Aug 2026, Sophie: the `to
// be reviewed` cards "get hidden from the account 1 or 2 area until i review or
// respond IF i dismiss manually from update tab") ----------------------------
// The condition is the whole rule: dismissing here is not the same as ignoring
// a card, it is her saying the thing is waiting in the QUEUE now. So the same
// tap writes a second stamp, `reviewHoldAt`, and `chatBack` in chats.html stops
// popping the chat back onto her list when it delivers again.
//
// THE SERVER DECIDES WHETHER A CHAT IS HELD, by re-reading its labels — never
// the page. Her phone can be running a build days old, and a hold applied by a
// page that no longer agrees with the tag on the chat would be a chat missing
// from her list for a reason nothing on screen could explain.
//
// It ends three ways, all of them hers, and none of them is a timer: POST
// /reply clears it (she responded), `labelPatch` clears it with the tag (she
// took the word off), and POST /page/:id/review clears it (she marked the deck
// done or skipped in the queue — she reviewed it).
router.post('/notif-seen', async (req, res) => {
  try {
    const { chat, seen } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = seen !== false;
    const stamp = new Date().toISOString();
    const del = admin.firestore.FieldValue.delete();
    const ref = regRef(chat);
    const held = on && labelsOf((await ref.get()).data()).indexOf(REVIEW_LABEL) > -1;
    await ref.set(
      { notifSeenAt: on ? stamp : del, reviewHoldAt: held ? stamp : del },
      { merge: true },
    );
    res.json({ ok: true, notifSeenAt: on ? stamp : null, reviewHoldAt: held ? stamp : null });
  } catch (err) { fail(res, err); }
});

// (POST /news-pin lived here — the Update card's pin, a `newsPinned` boolean
// on the registry. Removed Aug 2026: an Update card is now kept until the ✓
// whatever happens, so the pin had nothing left to opt out of. Stale
// `newsPinned:true` fields may still sit on old registry docs; nothing reads
// them. Note for whoever adds the next route here — `pinned` and POST /pin
// are TAKEN by the pinned DELIVERABLE, the film at the top of a thread, which
// stores an OBJECT there; Express takes the first match, so a route named
// `pin` here would shadow it. That is why pinning a CHAT to the top of the
// list is `pinTop` / POST /pin-top, further down.)

// STAR a chat (Aug 2026, Sophie) — "chats that were important, that have work
// I want to refer back to, but I'm not actively using them". Imprint and the
// original Anthony Chene chat were the two she named. A starred chat wears a
// red star at the front of its row and can be pulled up from anywhere with the
// ★ chip, INCLUDING out of the archive — which is where these end up, and the
// whole reason the chip ignores `archived`.
//
// A plain boolean, like `archived`: it is a permanent judgement about the chat,
// not a state that anything newer should clear.
router.post('/star', async (req, res) => {
  try {
    const { chat, starred } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = starred !== false;
    await regRef(chat)
      .set({ starred: on ? true : admin.firestore.FieldValue.delete() }, { merge: true });
    res.json({ ok: true, starred: on });
  } catch (err) { fail(res, err); }
});

// BOOKMARK A CHAT — "keep this forever" (Aug 2026, Sophie, splitting the two
// marks apart: "bookmarking a chat is when I want to keep it in my history and
// go back to it, like if it has useful information — there's only a handful of
// chats like that … starring chats is more of a temporary thing, like a chat
// I'm currently working on. Bookmarks stay forever").
//
// The two had been ONE mark since Aug 2026 — a starred chat filled the Chats
// tab of the Bookmarks pile — on the reasoning that a second per-chat flag
// would make her remember which of two piles a chat went into. She wants both,
// because they answer different questions:
//   `starred`    — what she is on RIGHT NOW. Temporary; comes off when done.
//                  The red star at the front of a row and the ★ chip.
//   `bookmarked` — the handful worth keeping: the dating-book chat the Writing
//                  Room came out of, the moon milk films, Imprint. Permanent.
//                  This is what fills the Bookmarks pile's CHATS tab.
// Both are plain booleans on the registry doc; nothing newer clears either.
//
// Same phantom-row guard as /archive-kind: a merge-set on a missing doc CREATES
// it, and every pile derives from the registry keys.
router.post('/chat-bookmark', async (req, res) => {
  try {
    const { chat, bookmarked } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = bookmarked !== false;
    const slug = await followMoves(String(chat).slice(0, 60));
    const snap = await db().collection(REG).doc(slug).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such chat' });
    await regRef(slug).set(
      { bookmarked: on ? true : admin.firestore.FieldValue.delete() }, { merge: true });
    res.json({ ok: true, chat: slug, bookmarked: on });
  } catch (err) { fail(res, err); }
});

// THE BELL — notifications ON for this chat (Aug 2026, Sophie: "add a little
// bell next to the star that I can click in. This will enable notifications
// for this chat and un-click and it will turn them off — only the ones I
// clicked the bell on will notify me").
//
// A WHITELIST, and the third per-chat mark beside `starred` and `bookmarked`:
//   `starred`    — what she is on right now (temporary)
//   `bookmarked` — the handful worth keeping (permanent)
//   `notify`     — the ones allowed to buzz her phone
// Absent = silent, so nothing pushes until she taps a bell. `push-gate.js`
// reads it (`chatNotifies`) in front of BOTH doors — a finished reply and a
// new Compare page.
//
// Same phantom-row guard as /chat-bookmark: a merge-set on a missing doc
// CREATES it, and every pile derives from the registry keys.
router.post('/notify', async (req, res) => {
  try {
    const { chat, notify } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = notify !== false;
    const slug = await followMoves(String(chat).slice(0, 60));
    const snap = await db().collection(REG).doc(slug).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such chat' });
    await regRef(slug).set(
      { notify: on ? true : admin.firestore.FieldValue.delete() }, { merge: true });
    res.json({ ok: true, chat: slug, notify: on });
  } catch (err) { fail(res, err); }
});

// PIN A CHAT TO THE TOP OF THE LIST (Aug 2026, Sophie: "an option to pin chat
// to the top so they always show first when they come out of hiding and they
// never disappeared to the bottom if I don't look at them for a while, and I
// guess I can just unpin them if necessary").
//
// The home list is sorted by newest message, which is right for an inbox and
// wrong for the two or three chats she is steering: a chat she leaves alone
// for a day sinks under 190 others, and one she parks in the hidden pile comes
// back wherever its last message puts it. This is her override — a pinned chat
// sits above the sort, in every pile, until she taps the pin again.
//
// FIELD IS `pinTop`, ROUTE IS `/pin-top` — `pinned` and POST `/pin` are TAKEN
// by the pinned DELIVERABLE (the link/film row at the top of a thread), which
// stores an OBJECT there. Express takes the first match, so a route named
// `pin` here would shadow it, and a field named `pinned` would collide with a
// value of a completely different shape.
//
// The fourth per-chat mark, and a plain boolean like the other three:
//   `starred`    — what she is on right now (temporary)
//   `bookmarked` — the handful worth keeping (permanent)
//   `notify`     — the ones allowed to buzz her phone
//   `pinTop`     — the ones that stay at the top of the list
//
// Same phantom-row guard as /chat-bookmark and /notify: a merge-set on a
// missing doc CREATES it, and every pile derives from the registry keys.
router.post('/pin-top', async (req, res) => {
  try {
    const { chat, pinTop } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = pinTop !== false;
    const slug = await followMoves(String(chat).slice(0, 60));
    const snap = await db().collection(REG).doc(slug).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such chat' });
    await regRef(slug).set(
      { pinTop: on ? true : admin.firestore.FieldValue.delete() }, { merge: true });
    res.json({ ok: true, chat: slug, pinTop: on });
  } catch (err) { fail(res, err); }
});

// SPLIT THE ARCHIVE IN TWO (Aug 2026, Sophie: "right now the archive is a
// single list — I want to split it using the hairline pattern into two piles,
// one of things where we built something and something was accomplished and
// everything worked out, and then another one that's pretty much trash but
// I'm just keeping it for bookkeeping"). Her own examples of the second pile:
// the chat where her computer wouldn't turn on (fixed, but not important) and
// the one about Google Takeout failing on her email.
//
// ONE field, `archiveKind`, and only the SECOND pile is ever stored. Absent =
// built = the left tab = the landing tab, so the 81 chats already archived
// need no backfill and read correctly the moment this ships; she only ever
// marks the throwaways, which is the smaller pile and the easier judgement.
//
// It is a plain permanent judgement about the chat, like `starred` and unlike
// `hiddenAt`/`notifSeenAt` — nothing newer clears it. It is also deliberately
// INDEPENDENT of `archived`: a chat marked here and then pulled back out of
// the archive keeps the mark, so re-archiving it doesn't ask her twice.
//
// Bulk-capable for the same reason /category is: triaging a pile is a
// several-at-a-time gesture, and it is how a chat backfills a first pass.
//
// A name that has no registry doc is SKIPPED, never written. `set(…, merge)`
// on a missing doc CREATES it, and sortedChatNames lists every registry key —
// so one typo would put a phantom row in her list that only the Admin SDK can
// remove. That has happened here before; the read is cheap next to the cost.
router.post('/archive-kind', async (req, res) => {
  try {
    const body = req.body || {};
    const names = (Array.isArray(body.chats) ? body.chats : [body.chat])
      .filter(Boolean).map((c) => String(c).slice(0, 60)).slice(0, 200);
    if (!names.length) return res.status(400).json({ error: 'chat required' });
    const other = String(body.kind || '') === 'other';
    const val = other ? 'other' : admin.firestore.FieldValue.delete();
    const resolved = await Promise.all(names.map((n) => followMoves(n)));
    const snaps = await Promise.all(
      resolved.map((n) => db().collection(REG).doc(n).get()));
    const live = resolved.filter((n, i) => snaps[i].exists);
    const missing = resolved.filter((n, i) => !snaps[i].exists);
    if (live.length) {
      const batch = db().batch();
      live.forEach((n) => batch.set(regRef(n), { archiveKind: val }, { merge: true }));
      await batch.commit();
    }
    res.json({ ok: true, chats: live, missing, kind: other ? 'other' : 'built' });
  } catch (err) { fail(res, err); }
});

// ---- ONE PILE OF LABELS — categories AND tags, many per chat (Aug 2026) ----
// Sophie: "right now you can only be in one category at a time, for example
// witch or to be reviewed, and you can't add tags. I think it would make sense
// to just combine them and let you be in multiple categories or tags at once."
//
// Two fields used to sit side by side and neither could do the other's job:
//   • `category` — exactly ONE per chat, free text, her own folder names. A
//     chat about witch work that also needed reviewing had to pick.
//   • `tags` — MANY per chat, but a FIXED ten-word vocabulary she could not add
//     to, and only ever reachable on the way past (the archive sheet, later the
//     Organize sheet).
// They are ONE THING now: `labels`, an array, her vocabulary, add your own.
//
// NOTHING IS MIGRATED AND NOTHING IS DESTROYED, in both directions:
//   • Reading — a chat with no `labels` reads as `category` + `tags` unioned
//     (`labelsOf`), so all 276 chats arrive correctly labelled the day this
//     ships with no backfill, and the old data still means what it meant.
//   • Writing — every write MIRRORS the pair: `category` = the first label,
//     `tags` = the whole set. Her phone runs a cached page for days, so the
//     build she is looking at while this deploys must keep working — and so
//     must every reader that was never touched (chat-sort.js's vocabulary and
//     examples, brief.js, the /sort diagnostics, the backfill scripts).
// Drop the mirrors only once no cached page can still be reading them, which
// is months, not days — and then only by changing those readers in the same
// commit.
//
// THE VOCABULARY IS FREE TEXT NOW, which reverses the old tag rule ("a typed
// tag is a typo away from its own orphan pile"). That rule lost to her ask:
// folders were always free text and she names things herself, so refusing her
// a word here only meant the two halves could never merge. The ten legacy tag
// words survive as SEEDS in the page, so nothing already tagged loses its chip.
// `failure` joined them Aug 2026 with the page's ARCHIVE_ONLY group; the old
// `failed` had reached no chat at all and was forgotten with `POST
// /labels/forget`. Which of these the page OFFERS where is a presentation
// question and lives there (`ARCHIVE_ONLY` / `LIVE_ONLY` in chats.html) — this
// list is the vocabulary, not the row.
const TAGS = ['bug fix', 'new feature', 'built', 'failure', 'story', 'quick question',
  'film', 'research'];

// ---- A PILE, OR JUST A WORD (Aug 2026, Sophie, the day after the merge:
// "tagging shouldn't hide everything, or maybe just for certain categories —
// like `to be reviewed` should send it to the review pile … whereas other ones
// shouldn't take it off the main feed") ------------------------------------
// Combining the two fields had one consequence nobody asked for: a FOLDER
// always took a chat off the main list (her own rule — "when I mark something
// as a story it takes it out of the normal list"), and once tags were the same
// field, tagging a chat `images` hid it too.
//
// So a label carries one property: is it a PILE. A pile takes the chat off the
// unfiled home list; every other word is just a word on the chat and changes
// nothing about where it shows.
//
// THE SEED IS FROZEN ON PURPOSE. It is her folder vocabulary as measured on
// 2026-08-18, the day the two fields merged — so the app behaves EXACTLY as it
// did before the merge, and a word she invents tomorrow is a plain tag rather
// than a trapdoor. Reading `__settings.categories` instead would have been
// self-defeating: every new word joins that list, so every new word would file.
// `__settings.pileLabels` overrides the seed WHOLESALE once she touches the
// switch — it is the answer, not a diff.
// Two words left the seed in Aug 2026, both by her hand and both through
// `POST /labels/forget`: `stories` was merged INTO `story` (which takes its
// place here, so none of the 36 chats fell back onto her main list) and
// `weird games` was dropped outright.
const PILE_SEEDS = ['look at', 'story', 'come back to', 'witch', 'tech', 'xi',
  'just for fun', 'meta', 'dream app', 'chunk making',
  'waiting for something', 'to be reviewed'];

// The one word that ALSO routes: a chat carrying it becomes a row in the Review
// Queue (`review.js`), her pile of everything waiting on her. Hers, and named
// here so the two modules can never disagree about the spelling.
const REVIEW_LABEL = 'to be reviewed';

// ---- THE MANUAL TAG RULES (Aug 2026, Sophie: "i think i'll have to do manual
// rules per tag … more coming") ----------------------------------------------
// The rules themselves are the Update tab's, so they live in `chats.html`
// (TAG_RULES) where the screen they change is drawn. What is here is the half
// the SERVER has to know: the two words, so nothing can disagree about their
// spelling, and the stamps behind them.
//
//   `waiting for a response` → the card is pinned to the top of the Update tab
//     until she answers or dismisses. Costs the server nothing: it is
//     `filedAt` (the label write) against `notifSeenAt` (the ✓, or her reply),
//     both of which already exist.
//   `to be reviewed` → the cards fold behind a Review button, and dismissing
//     one there writes `reviewHoldAt`, which keeps the chat off her account
//     lists until she reviews or responds. See POST /notif-seen for the three
//     ways it ends.
//
// BOTH ARE HERS TO APPLY. `chat-sort.js` is forbidden from filing into either
// (they are on its TRIAGE list) — a word that says she owes a chat an answer,
// or that a deliverable is waiting on her eye, is not something a model can
// know, and guessing one would pin a card she never asked for.
const PIN_LABEL = 'waiting for a response';

// ---- A WORD THAT ASKS A QUESTION (Aug 2026, Sophie: "I wanna set another
// condition for the `waiting for something` tag — it should also trigger a text
// box that asks me what is it waiting for, and then that gets added to the note
// for the chat at the top: it says in bold `Waiting for:` and then my
// content") ---------------------------------------------------------------
// `waiting for something` on its own says a chat is stuck and nothing else. The
// thing worth knowing — waiting on WHAT — was in her head and nowhere on the
// screen, so the tag could not tell her whether the wait was over.
//
// The answer lives in its own field, `waitingFor`, and NOT in `sophieNote`: a
// chat must never overwrite a line she wrote (the standing rule), and this one
// is tied to the tag rather than to the chat. Taking the tag off clears it,
// which is what keeps a stale "waiting for the API key" from outliving the wait.
//
// ONE word asks, and a second is not mine to declare — same rule as the pinned
// link. If another word should ask something, she says so first.
const WAIT_LABEL = 'waiting for something';
const WAIT_ASK = 'What is it waiting for?';
const WAIT_PREFIX = 'Waiting for:';
const WAIT_MAX = 200;

function pileList(settings) {
  const s = settings || {};
  return Array.isArray(s.pileLabels) ? cleanLabels(s.pileLabels) : PILE_SEEDS.slice();
}
function isPile(label, settings) {
  return pileList(settings).indexOf(String(label || '').trim().toLowerCase()) > -1;
}

const LABEL_MAX = 40;      // one label, characters — the old `category` cap
const LABELS_MAX = 20;     // labels on one chat, a backstop and nothing more

// Lower-cased, trimmed, de-duped, capped. Lower-case because she DICTATES
// these and dictation capitalises the first word at random — "Witch" and
// "witch" as two chips is the orphan-pile problem arriving by another door.
function cleanLabels(list) {
  return (Array.isArray(list) ? list : [list])
    .map((t) => String(t == null ? '' : t).trim().toLowerCase().slice(0, LABEL_MAX))
    .filter((t, i, a) => t && a.indexOf(t) === i)
    .slice(0, LABELS_MAX);
}

// What a registry doc's labels ARE, old shape or new. The union is what makes
// the merge retroactive: a chat filed under `witch` and tagged `bug fix` reads
// as both without anything having been rewritten.
function labelsOf(reg) {
  const r = reg || {};
  if (Array.isArray(r.labels)) return cleanLabels(r.labels);
  return cleanLabels([].concat(r.category || [], Array.isArray(r.tags) ? r.tags : []));
}

// The patch that writes a label set — the ONE place the mirrors are kept in
// step, so no route can write half of it.
//
// `filedAt` is stamped on every write that leaves the chat labelled, not only
// the first: re-filing has to renew the stamp past an unread reply or the chat
// bounces straight back onto the main list and filing reads as doing nothing
// (`chatBack` in chats.html). `catBy: 'sophie'` because the app is the only
// caller of these routes — the auto-sorter writes its own field directly, and
// one tap from her locks a chat away from it forever.
function labelPatch(labels, { by = 'sophie' } = {}) {
  const del = admin.firestore.FieldValue.delete();
  const clean = cleanLabels(labels);
  // The waiting-for line belongs to the TAG, not to the chat: the moment the
  // word comes off, the answer goes with it. Otherwise "waiting for the API
  // key" sits on a chat that stopped waiting weeks ago — and a stale line she
  // wrote herself is worse than no line at all.
  const waiting = clean.indexOf(WAIT_LABEL) > -1 ? {} : { waitingFor: del };
  // …and the review HOLD belongs to its tag the same way (Aug 2026 — the
  // manual tag rules; see TAG_RULES in chats.html). The hold keeps a chat off
  // her account lists after she dismisses its card, "until i review or
  // respond" — and taking the word off IS reviewing it, so the hold cannot
  // outlive the tag. Without this a chat she un-tagged would be held off her
  // list by a rule it no longer wears, with nothing on screen to say why.
  const held = clean.indexOf(REVIEW_LABEL) > -1 ? {} : { reviewHoldAt: del };
  if (!clean.length) {
    return { labels: del, category: del, tags: del, filedAt: del, catBy: del, ...waiting, ...held };
  }
  return {
    labels: clean,
    category: clean[0],
    tags: clean,
    filedAt: new Date().toISOString(),
    catBy: by,
    ...waiting,
    ...held,
  };
}

// Remember every word she has ever made, on the `__settings` doc, so an EMPTY
// label outlives the filing that created it (Aug 2026 — she made a category,
// nothing happened to be picked at the time, and the chip never existed).
async function rememberLabels(labels) {
  const clean = cleanLabels(labels);
  if (!clean.length) return;
  await regRef(SETTINGS_DOC).set(
    { categories: admin.firestore.FieldValue.arrayUnion(...clean) }, { merge: true });
}

// Apply a change to one or many chats. `set` replaces the whole label set;
// `add`/`remove` are per-chat edits, which is what a bulk gesture needs — she
// picks six chats and taps `witch`, and the ones already in `to be reviewed`
// keep it. That is the whole difference from the old bulk filing, which could
// only overwrite.
//
// A name with no registry doc is SKIPPED, never written: `set(…, merge)` on a
// missing doc CREATES it and every pile derives from the registry keys, so one
// typo would put a phantom row in her list that only the Admin SDK can remove.
// That has happened here before.
async function applyLabels(names, { set = null, add = [], remove = [] } = {}) {
  const resolved = await Promise.all(names.map((n) => followMoves(n)));
  const snaps = await Promise.all(resolved.map((n) => db().collection(REG).doc(n).get()));
  const live = [], missing = [], out = {};
  const batch = db().batch();
  const drop = cleanLabels(remove);
  const put = cleanLabels(add);
  resolved.forEach((n, i) => {
    if (!snaps[i].exists) { missing.push(n); return; }
    let next;
    if (set) next = cleanLabels(set);
    else {
      next = labelsOf(snaps[i].data()).filter((t) => drop.indexOf(t) < 0);
      put.forEach((t) => { if (next.indexOf(t) < 0) next.push(t); });
      next = cleanLabels(next);
    }
    live.push(n); out[n] = next;
    batch.set(regRef(n), labelPatch(next), { merge: true });
  });
  if (live.length) await batch.commit();
  return { chats: live, missing, labels: out };
}

function labelNames(body) {
  return (Array.isArray(body.chats) ? body.chats : [body.chat])
    .filter(Boolean).map((c) => String(c).slice(0, 60)).slice(0, 200);
}

// THE ONE WRITE. `{chat|chats, labels:[…]}` replaces, `{chats, add, remove}`
// edits — and either half may be a string or an array. With no chats at all
// but a word given, it just MAKES the label (that is how an empty one gets
// created, and the reason /category learned the same trick).
router.post('/labels', async (req, res) => {
  try {
    const body = req.body || {};
    const names = labelNames(body);
    const set = Array.isArray(body.labels) ? body.labels
      : (typeof body.labels === 'string' ? [body.labels] : null);
    const add = body.add == null ? [] : body.add;
    const remove = body.remove == null ? [] : body.remove;
    if (!names.length && !set && !cleanLabels(add).length) {
      return res.status(400).json({ error: 'chat or labels required' });
    }
    await rememberLabels([].concat(set || [], add));
    if (!names.length) return res.json({ ok: true, chats: [], labels: {} });
    const r = await applyLabels(names, { set, add, remove });
    res.json({ ok: true, ...r });
  } catch (err) { fail(res, err); }
});

// ---- FORGETTING A WORD, AND MOVING WHAT IS IN IT (Aug 2026, Sophie:
// "there's a story and stories tags — get rid of stories, but make sure to put
// everything that's in stories currently into story before you get rid of it" ·
// "get rid of the weird games tag, I don't know who made that either") --------
// Every other route here ADDS to the vocabulary and none could take a word out
// of it, because `rememberLabels` writes `__settings.categories` with an
// `arrayUnion` — so a word she had finished with survived being stripped off
// every chat and came back as an empty chip forever. Three places hold a word
// and this is the only call that clears all three: the chats wearing it, the
// remembered vocabulary, and the pile list.
//
// `into` is what makes it a MERGE rather than a delete, and it runs FIRST on
// every chat, in the same write: nothing is ever left holding neither word. A
// chat already wearing both keeps one (cleanLabels de-dupes), and one wearing
// only the old word comes out the other side filed exactly as it was.
//
// **A MERGED WORD DOES NOT INHERIT PILE-NESS** — that is deliberate and it is
// the one thing to check before running this. `stories` filed a chat away and
// `story` did not, so merging 36 chats into it would have dumped all 36 onto
// her main list; `PILE_SEEDS` was edited in the same commit so the survivor
// takes the forgotten word's place. Check `GET /pile` first and say so.
//
// `catBy` is PRESERVED per chat rather than stamped `sophie`: renaming her own
// vocabulary is not a filing decision about the 2 chats the auto-sorter had
// filed, and stamping them would lock the sorter out of them forever.
router.post('/labels/forget', async (req, res) => {
  try {
    const body = req.body || {};
    const label = String(body.label || '').trim().toLowerCase().slice(0, LABEL_MAX);
    const into = String(body.into || '').trim().toLowerCase().slice(0, LABEL_MAX);
    if (!label) return res.status(400).json({ error: 'label required' });
    if (into === label) return res.status(400).json({ error: 'into must differ from label' });
    const dry = body.dry === true;

    const reg = await registry();
    const moved = Object.keys(reg.chats).filter(
      (n) => labelsOf(reg.chats[n]).indexOf(label) > -1);
    const labels = {};
    moved.forEach((n) => {
      const next = labelsOf(reg.chats[n]).filter((t) => t !== label);
      if (into && next.indexOf(into) < 0) next.push(into);
      labels[n] = cleanLabels(next);
    });

    const piles = pileList(reg.settings);
    const nextPiles = piles.filter((c) => c !== label);
    const droppedPile = nextPiles.length !== piles.length;
    if (dry) {
      return res.json({ ok: true, dry: true, label, into: into || null,
        chats: moved, labels, droppedPile, intoIsPile: !!into && piles.indexOf(into) > -1 });
    }

    // The chats first: a failure partway leaves a word that still has chips and
    // still finds things, which is recoverable by running it again. Clearing the
    // vocabulary first would leave the survivors unreachable instead.
    for (let i = 0; i < moved.length; i += 400) {
      const slice = moved.slice(i, i + 400);
      const batch = db().batch();
      slice.forEach((n) => {
        const by = reg.chats[n] && reg.chats[n].catBy;
        batch.set(regRef(n), labelPatch(labels[n], by ? { by } : {}), { merge: true });
      });
      await batch.commit();
    }

    // The vocabulary. `arrayRemove` and `arrayUnion` cannot be in one patch for
    // the same field, so the survivor is added in a second write — and it is
    // added at all because a merge must not depend on the word already being
    // remembered.
    await regRef(SETTINGS_DOC).set(
      { categories: admin.firestore.FieldValue.arrayRemove(label) }, { merge: true });
    if (into) {
      await regRef(SETTINGS_DOC).set(
        { categories: admin.firestore.FieldValue.arrayUnion(into) }, { merge: true });
    }
    // `pileLabels` is only written when it is ALREADY hers — the seed lives in
    // code, and materialising it here would freeze today's default into her
    // settings, which is exactly what `POST /pile` avoids doing.
    if (Array.isArray(reg.settings && reg.settings.pileLabels) && droppedPile) {
      await regRef(SETTINGS_DOC).set({ pileLabels: nextPiles }, { merge: true });
    }
    res.json({ ok: true, label, into: into || null, chats: moved, labels, droppedPile });
  } catch (err) { fail(res, err); }
});

// The vocabulary the page seeds its chips from. Named `tags` in the answer
// because that is what the route has always returned and a cached page reads
// it; `labels` is the same list under the name the field now uses.
router.get('/tags', (_req, res) => res.json({ tags: TAGS, labels: TAGS }));

// WHICH WORDS ARE PILES — one switch per word, her hand only.
// `POST /pile { label, pile }` stores the WHOLE resulting list on __settings,
// seeded from PILE_SEEDS the first time she touches it, because a diff against
// a moving default is a list that means something different next week.
// GET answers the current list so a page that has never seen a write still
// knows (the feed carries `pileLabels` in `settings` too, once it exists).
router.get('/pile', async (_req, res) => {
  try {
    const reg = await registry();
    res.json({ piles: pileList(reg.settings), seeds: PILE_SEEDS, review: REVIEW_LABEL });
  } catch (err) { fail(res, err); }
});

// ---- THE REASONS SHE HAS GIVEN BEFORE (Aug 2026, Sophie: "could you gather
// the list of reasons for waiting for something that I enter manually and put
// it behind a button") -------------------------------------------------------
// There was nothing to gather until this existed, and that is the finding
// worth writing down: `waitingFor` is DELETED with its tag (labelPatch), on
// purpose — a stale "waiting for the API key" on a chat that stopped waiting
// weeks ago is worse than no line at all. So every answer she had ever typed
// was already gone. **Measured live 2026-08-20: 378 chats, TWO carrying a
// waiting reason** — the whole history, because the field is a live state and
// never a record.
//
// So the memory is a SECOND place, on `__settings` beside her label
// vocabulary: the field stays live-and-deletable, and the list of things she
// has waited for accumulates next to it. Newest first, so a re-pick moves to
// the top and the button opens on what she is most likely to want.
//
// It rides the feed's `settings` object like `pileLabels` and `categories`,
// so the page pays no request for it — and `regRef` invalidates the registry
// cache on write, so a reason she just typed is there on the next read.
//
// Two deliberate smallnesses: it is BEST-EFFORT (a remembered reason must
// never fail the save she actually made), and it reads the settings doc
// DIRECTLY rather than through `registry()` — one extra read on an action she
// takes a few times a month, in exchange for never folding a stale cached list
// back over a newer one. Two chats saving in the same second could still lose
// one reason off the list; that is a list, not her data, and the alternative
// (arrayUnion) would throw the order away, which is the only thing making the
// list useful.
const WAIT_MEMORY_MAX = 40;

function waitReasons(settings) {
  const raw = (settings || {}).waitingReasons;
  return (Array.isArray(raw) ? raw : [])
    .map((r) => String(r == null ? '' : r).replace(/\s+/g, ' ').trim().slice(0, WAIT_MAX))
    .filter((r, i, a) => r && a.findIndex((x) => x.toLowerCase() === r.toLowerCase()) === i)
    .slice(0, WAIT_MEMORY_MAX);
}

async function rememberWaiting(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, WAIT_MAX);
  if (!t) return;                       // clearing the box forgets nothing
  const snap = await db().collection(REG).doc(SETTINGS_DOC).get();
  const cur = waitReasons(snap.data());
  const next = waitReasons({ waitingReasons: [t].concat(cur) });
  // Re-picking the one already at the top writes nothing.
  if (next.length === cur.length && next.every((r, i) => r === cur[i])) return;
  await regRef(SETTINGS_DOC).set({ waitingReasons: next }, { merge: true });
}

// WHAT IS IT WAITING FOR — the answer to the box the `waiting for something`
// tag opens. Its own field so it can never overwrite a note she wrote, and it
// is cleared by `labelPatch` the moment the tag comes off — which is why the
// answers are also remembered on __settings (above).
router.post('/waiting', async (req, res) => {
  try {
    const body = req.body || {};
    const chat = String(body.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const text = String(body.text == null ? '' : body.text).replace(/\s+/g, ' ').trim().slice(0, WAIT_MAX);
    const slug = await followMoves(chat);
    const snap = await db().collection(REG).doc(slug).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such chat' });
    await regRef(slug).set(
      { waitingFor: text || admin.firestore.FieldValue.delete() }, { merge: true });
    // Best-effort, and after the real save: the list behind the button is a
    // convenience, and losing it must never cost her the answer she just gave.
    await rememberWaiting(text).catch(() => {});
    res.json({ ok: true, chat: slug, waitingFor: text });
  } catch (err) { fail(res, err); }
});

// MAKING A WORD A PILE RE-FILES WHAT IS ALREADY WEARING IT (2026-08-26, Sophie:
// "middle one goes first chat should've left because I tagged it as PWC reel").
//
// She was right and the chat had never been touched by her hand: `pwc reel` had
// been on it since the day before, written by the auto-sorter as a plain TAG,
// and the thing she did today was flip that WORD on in this sheet. The flip
// wrote `pileLabels` and nothing else — so every chat wearing the word became
// "filed" while still carrying the `filedAt` it was given back when the word
// meant nothing. Any reply that landed after that stamp makes `chatBack`
// (chats.html) true, so the chat pops straight back onto the main list and
// never leaves again: the sheet promises "a lit word takes a chat off the main
// list until it answers you" and the chat answered a day before the promise
// existed. Measured that morning: of the 8 chats wearing `pwc reel`, the only
// one that did not leave was the only one whose reply post-dated its stamp.
//
// So the flip renews `filedAt`, exactly as filing by hand already does
// (`saveLabels` writes the stamp itself for the same reason — "without it a
// chat with an unread reply files itself and reappears on the same repaint").
// Turning a word OFF stamps nothing: those chats hand themselves back by
// `chatFiled` going false, and re-stamping them would be filing they never
// asked for.
//
// It writes `filedAt` ALONE — never `labelPatch`. A pile flip is a decision
// about the WORD, not about the chats, so it must not stamp `catBy: 'sophie'`
// and lock the auto-sorter out of ten chats it filed itself (the same care
// `/forget` takes when it preserves `by`).
async function refileWearers(reg, label) {
  const wearing = Object.keys(reg.chats).filter(
    (n) => labelsOf(reg.chats[n]).indexOf(label) > -1);
  const now = new Date().toISOString();
  for (let i = 0; i < wearing.length; i += 400) {
    const batch = db().batch();
    wearing.slice(i, i + 400).forEach((n) => batch.set(regRef(n), { filedAt: now }, { merge: true }));
    await batch.commit();
  }
  return wearing;
}

router.post('/pile', async (req, res) => {
  try {
    const body = req.body || {};
    const label = String(body.label || '').trim().toLowerCase().slice(0, LABEL_MAX);
    if (!label) return res.status(400).json({ error: 'label required' });
    const reg = await registry();
    const cur = pileList(reg.settings);
    const on = body.pile !== false;
    const next = on
      ? (cur.indexOf(label) > -1 ? cur : cur.concat(label))
      : cur.filter((c) => c !== label);
    // The chats first, then the list: a failure partway leaves the word doing
    // what it did before, over chats stamped as freshly filed — which is
    // recoverable by flipping it again. The other order files chats away
    // against a stamp that never landed.
    const refiled = on ? await refileWearers(reg, label) : [];
    await regRef(SETTINGS_DOC).set({ pileLabels: next }, { merge: true });
    res.json({ ok: true, label, pile: on, piles: next, refiled });
  } catch (err) { fail(res, err); }
});

// ---- The two legacy routes, kept LOSSLESS ----------------------------------
// Her phone can run a build from days ago, and both of these are wired to live
// chips on it. Each one now edits only the half of the label set it knows
// about, so a tap on an old page can never silently wipe labels it was never
// able to show:
//   • /category replaces the FOLDER words (anything outside the old fixed tag
//     vocabulary) and leaves the tag words alone.
//   • /tags replaces the TAG words and leaves the folders alone.
// A new page uses neither — it posts /labels.
router.post('/category', async (req, res) => {
  try {
    const body = req.body || {};
    const names = labelNames(body);
    const category = String(body.category || '').trim().slice(0, LABEL_MAX);
    if (!names.length && !category) return res.status(400).json({ error: 'chat or category required' });
    await rememberLabels([category]);
    if (!names.length) return res.json({ ok: true, chats: [], category: category || null });
    // keep the tag half, replace the folder half
    const resolved = await Promise.all(names.map((n) => followMoves(n)));
    const snaps = await Promise.all(resolved.map((n) => db().collection(REG).doc(n).get()));
    const batch = db().batch();
    const live = [];
    resolved.forEach((n, i) => {
      if (!snaps[i].exists) return;
      const keep = labelsOf(snaps[i].data()).filter((t) => TAGS.indexOf(t) > -1);
      const next = cleanLabels([].concat(category || [], keep));
      live.push(n);
      batch.set(regRef(n), labelPatch(next), { merge: true });
    });
    if (live.length) await batch.commit();
    res.json({ ok: true, chats: live, category: category || null });
  } catch (err) { fail(res, err); }
});

router.post('/tags', async (req, res) => {
  try {
    const { chat, tags } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags array required' });
    const slug = await followMoves(String(chat).slice(0, 60));
    const snap = await db().collection(REG).doc(slug).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such chat' });
    // keep the folder half, replace the tag half. Unknown words are still
    // dropped on THIS route — an old page can only mean the fixed vocabulary,
    // so anything else in its body is a word it read off a newer write.
    const keep = labelsOf(snap.data()).filter((t) => TAGS.indexOf(t) < 0);
    const clean = cleanLabels(tags).filter((t) => TAGS.indexOf(t) > -1);
    const next = cleanLabels([].concat(keep, clean));
    await regRef(slug).set(labelPatch(next), { merge: true });
    res.json({ ok: true, chat: slug, tags: clean, labels: next });
  } catch (err) { fail(res, err); }
});

// ---- AUTO-SORTING: a chat files ITSELF (Aug 2026, Sophie) ------------------
// "I've been manually sorting all my chats, but they could sort themselves in
// the chats app, and that could be a start of turn or end of turn activity."
//
// The rules, the vocabulary and every judgment live in `chat-sort.js` — read
// its header first, especially why this is derived server-side instead of
// posted by each chat (measured: 15 of 224 chats ever posted an Update card).
// This half is the reads, the writes and the money.
//
// COST AND WHEN IT SPENDS. One small Claude call — the chat's name, her note,
// its status card, and a head+tail digest of the thread — so well under a cent
// each. It is asked at most once per chat per day (`catTriedAt`), never for a
// chat that already has a folder, and the whole registry gate is answered off
// the CACHED registry read, so the ordinary finished reply spends nothing and
// reads nothing extra. Only a chat that is genuinely unsorted pays for its
// thread read.
async function sortChat(chat, { force = false, dry = false, stampNow = false } = {}) {
  const anthropic = require('./anthropic');
  const target = await followMoves(chat);
  const reg = await registry();
  const mine = reg.chats[target] || {};
  if (!reg.chats[target]) return { chat: target, sorted: false, why: 'no-such-chat' };
  // A global off switch with no UI: one field on __settings, so auto-sorting
  // can be stopped dead without a deploy if it ever files something wrong.
  const enabled = reg.settings.autoSort !== false;
  // TWO GATES, cheap one first. This one reads only the registry (cached), so
  // a chat that is already filed — the common case — costs nothing at all.
  // `messages: Infinity` skips the thin-thread test, which needs a real read.
  const pre = force
    ? { sort: true, why: 'forced' }
    : chatSort.shouldAutoSort(mine, { messages: Infinity, enabled });
  if (!pre.sort) return { chat: target, sorted: false, why: pre.why };
  if (!anthropic.available()) return { chat: target, sorted: false, why: 'no-anthropic-key' };

  const cats = chatSort.sortableCategories(reg.settings, reg.chats);
  if (!cats.length) return { chat: target, sorted: false, why: 'no-folders' };

  const snap = await db().collection(MSGS).where('chat', '==', target).get();
  const msgs = snap.docs.map((d) => d.data())
    .sort((a, b) => (String(a.created || '') < String(b.created || '') ? -1 : 1));
  // …and the second gate, now that the thread is in hand.
  const gate = force
    ? { sort: true, why: 'forced' }
    : chatSort.shouldAutoSort(mine, { messages: msgs.length, enabled });
  if (!gate.sort) return { chat: target, sorted: false, why: gate.why };

  const examples = chatSort.examplesFor(reg.chats, cats);
  const { system, user } = chatSort.buildSortPrompt({ name: target, reg: mine, msgs, cats, examples });
  // RUN THE CALL RAW so a truncated answer can still be rescued — the same
  // failure the archive summary already had, repeated here the moment the
  // output grew a second half: 300 tokens fitted {category, why} and cut
  // {state, stateWhy} off mid-string, and an unclosed brace fails both of
  // parseJSON's attempts. Measured 2026-08-15: 15 of 86 chats in one pass came
  // back "Claude did not return parseable JSON (got: {"categ…". Two fixes,
  // because either alone still loses answers — a cap with real headroom, and
  // the salvage for the day something runs past it.
  let out;
  try {
    const raw = await anthropic.chat({
      system: system + '\n\nReply with STRICT JSON only — no prose, no code fences.',
      user, maxTokens: 700,
    });
    try { out = anthropic.parseJSON(raw); }
    catch (err) { out = salvageJson(raw); if (!out) throw err; }
  } catch (err) { return { chat: target, sorted: false, why: 'model-error', error: String(err.message || err) }; }
  const pick = chatSort.pickCategory(out, cats);
  const why = String((out && out.why) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  // IS IT FINISHED? — the model judges whether the work landed; the question she
  // forgot to answer is COUNTED, not judged (chat-sort.js, archiveHint). An
  // unanswered question is a fact about the transcript, so the flag can name one
  // that provably exists instead of one that sounded likely.
  const ask = chatSort.pendingAsk(msgs);
  const state = chatSort.pickState(out);
  const stateWhy = String((out && out.stateWhy) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const hint = chatSort.archiveHint({ state, pendingAsk: ask });
  // The question itself, not a count — a count alone sends her back into the
  // chat to find out what she owes it.
  const finished = { state, stateWhy, hint, pendingAsk: ask };
  if (dry) {
    return { chat: target, sorted: false, why: 'dry-run', category: pick || null, reason: why, ...finished };
  }

  const now = new Date().toISOString();
  // NONE writes nothing but the cooldown — no folder, no filedAt, no trace on
  // any surface she looks at. The chat stays exactly where it was and is asked
  // about again tomorrow, which is what makes "none" cheap enough to prefer.
  // A RE-CHECK that comes back unsure LEAVES THE EXISTING FOLDER ALONE. Being
  // unsure is a reason not to move a chat, never a reason to pull one out of a
  // folder she may have been finding it in for weeks.
  const patch = { catTriedAt: now, archiveHint: hint, archiveWhy: stateWhy, pendingAsk: ask };
  if (pick) {
    // The label set, and its two mirrors — `labelPatch`'s fields written by
    // hand because this one stamps `catBy:'auto'` and its own `filedAt` rule
    // (below), which is the whole difference between the sorter's filing and
    // hers. It only ever writes into an EMPTY set, so nothing of hers is lost.
    patch.labels = [pick];
    patch.tags = [pick];
    patch.category = pick;
    patch.catBy = 'auto';
    patch.catWhy = why;          // why it went there — for her and for an audit
    patch.catSortedAt = now;
    // How long the thread was when it was filed — the growth the re-check
    // measures against (chat-sort.js, RESORT_*). Without it every auto-filed
    // chat would look brand new and re-ask on its next weekly window.
    patch.catMsgs = msgs.length;
    // A BACKFILL stamps now (she would have filed these by hand today); a LIVE
    // sort stamps her last message, so the reply that triggered it still pops
    // the chat back onto the main list. chat-sort.js's filedStamp is the rule.
    patch.filedAt = stampNow ? now : chatSort.filedStamp(mine);
  }
  await regRef(target).set(patch, { merge: true });
  return { chat: target, sorted: Boolean(pick), category: pick || null, why: pick ? 'sorted' : 'none',
    reason: why, ...finished };
}

// "LEAVE IT UNFILED" — her third answer on the review page, and the one the
// `category` field cannot hold: an empty folder is indistinguishable from a
// chat nobody has looked at, so without a mark of its own the sorter would file
// it again tomorrow. `catNone` records the decision; clearing it (`none:false`)
// puts the chat back in the sorter's way.
router.post('/sort/none', async (req, res) => {
  try {
    const body = req.body || {};
    const names = (Array.isArray(body.chats) ? body.chats : [body.chat])
      .filter(Boolean).map((c) => String(c).slice(0, 60)).slice(0, 200);
    if (!names.length) return res.status(400).json({ error: 'chat required' });
    const on = body.none !== false;
    const del = admin.firestore.FieldValue.delete();
    const reg = await registry();
    const batch = db().batch();
    const wrote = [];
    names.forEach((n) => {
      // A name with no registry doc is SKIPPED, never written — set(…, merge)
      // on a missing doc creates it, and every pile derives from the registry
      // keys, so one typo would put a phantom row in her list.
      if (!reg.chats[n]) return;
      wrote.push(n);
      batch.set(regRef(n), { catNone: on ? true : del }, { merge: true });
    });
    if (wrote.length) await batch.commit();
    res.json({ ok: true, chats: wrote, none: on });
  } catch (err) { fail(res, err); }
});

// Sort ONE chat on demand — what the backfill script drives, and the only way
// to see the decision without taking it (`dry:true` answers with the folder it
// would pick and changes nothing).
router.post('/sort', async (req, res) => {
  try {
    const { chat, session, force, dry, stampNow } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const resolved = await resolveChat(String(chat).slice(0, 60), String(session || '').slice(0, 120));
    res.json(await sortChat(resolved, { force: Boolean(force), dry: Boolean(dry), stampNow: Boolean(stampNow) }));
  } catch (err) { fail(res, err); }
});

// What the sorter is working with — her folder vocabulary, the examples each
// one teaches, and the counts. A READ, so it is the safe way to check the
// machinery is live (never probe a write against real data).
router.get('/sort', async (_req, res) => {
  try {
    const reg = await registry();
    const cats = chatSort.sortableCategories(reg.settings, reg.chats);
    const examples = chatSort.examplesFor(reg.chats, cats);
    const names = Object.keys(reg.chats).filter((n) => !reg.chats[n].deletedAt);
    const counted = (f) => names.filter(f).length;
    // `unfiled` USED TO COUNT THE ARCHIVE and it read as 178 chats waiting to
    // be sorted when 90 of them were chats she had already put away — a number
    // quoted straight into a reply before anyone checked it. The live pile is
    // the one a backfill would actually touch, so that is what `unfiled` means
    // now, and the archived ones are their own honest line.
    const live = (n) => !reg.chats[n].archived && !reg.chats[n].movedTo;
    res.json({
      enabled: reg.settings.autoSort !== false,
      anthropic: require('./anthropic').available(),
      categories: cats,
      triage: chatSort.TRIAGE,
      // Which of her folders are being read as WHAT THE WORK IS rather than as
      // a subject area — the half that beats the subject when both fit (see
      // WORK_KINDS in chat-sort.js). Printed here so the day the hint list goes
      // stale against her vocabulary is measurable in one read, not silent.
      workKinds: chatSort.workKinds(cats),
      examples,
      chats: names.length,
      filedBySophie: counted((n) => reg.chats[n].category && reg.chats[n].catBy !== 'auto'),
      filedByAuto: counted((n) => reg.chats[n].category && reg.chats[n].catBy === 'auto'),
      unfiled: counted((n) => !reg.chats[n].category && live(n)),
      unfiledArchived: counted((n) => !reg.chats[n].category && reg.chats[n].archived),
    });
  } catch (err) { fail(res, err); }
});

// ---- THE UPDATE SCREEN'S TWO BOXES (Aug 2026, Sophie) ----------------------
// "There's no categories on the updates page in that same style of those
// little boxes. I'd like to add two categories, one called IN A MINUTE for
// things I want to look at in a minute but not quite this second, and then
// next to it on the left another category called LATER for things I want to
// look at maybe later today or this week."
//
// The chips on the CHAT list file a chat forever (`category`, a folder). These
// file ONE UPDATE, for a while — so they are their own field, `newsQueue`, and
// they are deliberately a CLOSED set of two: she named both, and a box she can
// type is a folder, which is what the other row already is.
//
// `newsQueuedAt` is the moment it went in, and it is load-bearing exactly like
// `filedAt` on a category: an update is the newest thing a chat has handed her,
// so when something NEWER lands the card is new news again and belongs back on
// the main list. The app reads the pair as ONE place — main list or a box,
// never both — so the number on a box is what she finds when she opens it.
//
// A name with no registry doc is SKIPPED, never written: `set(…, merge)` on a
// missing doc creates it, and every pile derives from the registry keys, so
// one typo would put a phantom row in her list.
// `never` is "maybe never" — the third box, and the only one that is not also
// a filter on the page: it shows ONLY while she is actively categorising
// (Sophie, Aug 2026), the same rule DONE follows.
// THE VALUES ARE STORED WORDS, NOT DISPLAYED ONES. `later` is labelled
// "Come back to" in the app since Aug 2026 (Sophie: "can you combine the come
// back to and later categories" — the box and the chat list's folder of that
// name meant the same thing). Renaming the stored value would have orphaned
// every chat already filed under it for a word, so the label moved and this
// did not; the two are joined in `chats.html` (COME BACK TO IS ONE BUCKET).
const NEWS_QUEUES = ['later', 'soon', 'never'];
router.post('/news-queue', async (req, res) => {
  try {
    const body = req.body || {};
    const names = (Array.isArray(body.chats) ? body.chats : [body.chat])
      .filter(Boolean).map((c) => String(c).slice(0, 60)).slice(0, 200);
    if (!names.length) return res.status(400).json({ error: 'chat required' });
    const queue = String(body.queue || '').trim().slice(0, 20);
    if (queue && !NEWS_QUEUES.includes(queue)) {
      return res.status(400).json({ error: `queue must be one of ${NEWS_QUEUES.join(', ')} (or empty to clear)` });
    }
    const del = admin.firestore.FieldValue.delete();
    const stamp = queue ? new Date().toISOString() : del;
    const resolved = await Promise.all(names.map((n) => followMoves(n)));
    const snaps = await Promise.all(
      resolved.map((n) => db().collection(REG).doc(n).get()));
    const live = resolved.filter((n, i) => snaps[i].exists);
    const missing = resolved.filter((n, i) => !snaps[i].exists);
    if (live.length) {
      const batch = db().batch();
      live.forEach((n) => batch.set(regRef(n),
        { newsQueue: queue || del, newsQueuedAt: stamp }, { merge: true }));
      await batch.commit();
    }
    res.json({ ok: true, chats: live, missing, queue: queue || null, at: queue ? stamp : null });
  } catch (err) { fail(res, err); }
});

// ---- Status cards (Aug 2026, Sophie) --------------------------------------
// Every chat keeps ONE living status card it rewrites on purpose at the end
// of a turn: `need` = what it needs from Sophie, in her words ("pick a
// palette — 10 seconds"; EMPTY when nothing is needed), and `doing` = one
// line on what it's working on. Both live on the registry doc, so they ride
// the same cached read the home list already makes — the app shows them
// under the chat's name. Session-first resolution like every other post.
// A status line is ONE LINE under a chat's name on a phone. 110 chars is
// about what fits before the row ellipsis eats it, and the cap is the only
// thing that actually stops a chat pasting a changelog into the home screen
// (one did, into her note field, within a day of that field existing).
// Truncation is at a word boundary — a status line cut mid-word reads broken.
function statusLine(v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 110) return s;
  const cut = s.slice(0, 110);
  const sp = cut.lastIndexOf(' ');
  return (sp > 60 ? cut.slice(0, sp) : cut).replace(/[,;:.\-\s]+$/, '') + '…';
}
router.post('/status', async (req, res) => {
  try {
    const { chat, session, need, doing } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const resolved = await resolveChat(chat, String(session || '').slice(0, 120));
    const del = admin.firestore.FieldValue.delete();
    const patch = { statusAt: new Date().toISOString() };
    // Only the fields sent change; sending "" clears one.
    if (need !== undefined) patch.statusNeed = statusLine(need) || del;
    if (doing !== undefined) patch.statusDoing = statusLine(doing) || del;
    await regRef(resolved).set(patch, { merge: true });
    res.json({ ok: true, chat: resolved });
  } catch (err) { fail(res, err); }
});
// The note on a chat — the where-things-stand line, mostly hers ("research
// it, karaoke, tabs") but NOT locked to her (Aug 2026: "it's not that I
// wanted the field to myself, I just wanted them to know how to write
// notes"). A chat may write one; the rule is STYLE, not permission —
// telegraphic fragments, her length, never a changelog.
//
// This route briefly required `app:true` and 403'd everything else. That was
// the wrong fix twice over: it wasn't what she asked for, and it broke HER
// OWN editing — the app keeps a cached page for days, so the copy on her
// phone didn't send the new flag and her save came back refused. Never gate
// a field the app already writes on a flag only a NEW build sends.
//
// 200 chars is the cap because her own notes run 26-66. A field that can
// hold a paragraph invites one.
// THE WIDGET's feed (Aug 2026, Sophie: "I'd like the widget") — the Update
// tab in one small JSON, for a home-screen widget that refreshes on iOS's
// timeline and must never pull the real feed (~500KB) to do it.
//
// It answers the same question the tab does — which chats have something she
// hasn't checked off — off the SAME floor: `notifSeenAt`, the ✓ and nothing
// else. That used to be a forced compromise (the tab also counted the
// per-device `seen` mark, which a widget process cannot read out of the web
// view's storage, so this route was deliberately one row too generous). Since
// Aug 2026 the tab keeps every card until the ✓ as well, so the two surfaces
// agree exactly and the widget's count is the tab's count.
//
// Cost: the registry (5-min cached) + ONE capped message read. Nothing
// per-chat, so a widget refresh is cheap however many chats exist.
router.get('/widget', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limit = Math.min(6, Math.max(1, parseInt(req.query.limit, 10) || 4));
    const [reg, snap] = await Promise.all([
      registry(),
      db().collection(MSGS).orderBy('created', 'desc').limit(200).get(),
    ]);
    const newest = new Map();          // chat → its newest non-sophie message
    snap.docs.forEach((d) => {
      const m = d.data() || {};
      if (m.from === 'sophie' || m.working) return;   // hers, and live drafts
      if (!m.chat || newest.has(m.chat)) return;
      newest.set(m.chat, m);
    });
    const rows = [];
    for (const [chat, m] of newest) {
      const r = reg.chats[chat] || {};
      if (r.archived) continue;
      if (r.notifSeenAt && r.notifSeenAt >= (m.created || '')) continue;
      rows.push({
        chat,
        name: r.displayName || chat,
        // the same one line the home row shows: her note wins, then the
        // chat's status card, then its TLDR
        line: String(r.sophieNote || r.statusNeed || r.statusDoing || m.tldr
          || (m.text || '').split('\n').find((l) => l.trim()) || '').replace(/[*_`#]/g, '').slice(0, 90),
        at: m.created || '',
      });
    }
    rows.sort((a, b) => (a.at < b.at ? 1 : -1));
    res.json({ ok: true, count: rows.length, rows: rows.slice(0, limit) });
  } catch (err) { fail(res, err); }
});

// THE UPDATE CARD — the three lines behind the ⌄ on a card in the UPDATE tab
// (Aug 2026, Sophie: "I wonder if it would be a good idea to have a chat have
// like a TLDR in their update — not fully in the message, because it would
// crowd things, but more as like a button I could click and it would pop out",
// then the shape: "the first question in bold would be what I asked, and they
// just describe what I originally wanted; and then the next would be what they
// did; and then an optional one would be like if they had any questions for me
// or what would be coming next").
//
// So it is deliberately NOT the reply and NOT the TLDR: it is the chat saying
// back what she wanted, what it actually did about it, and what it needs or
// intends next — the three things she has to reconstruct by reading a whole
// thread otherwise. Kept on the registry doc beside the status card, so it
// rides the cached read the Chats app already does and costs nothing.
//
// `next` is optional by her spec; sending "" clears any field.
const UPD_MAX = 300;
function updLine(v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (s.length <= UPD_MAX) return s;
  const cut = s.slice(0, UPD_MAX);
  const sp = cut.lastIndexOf(' ');
  return (sp > UPD_MAX * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\-\s]+$/, '') + '…';
}
router.post('/update', async (req, res) => {
  try {
    const { chat, session, asked, did, next } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const resolved = await resolveChat(chat, String(session || '').slice(0, 120));
    const del = admin.firestore.FieldValue.delete();
    const patch = { updAt: new Date().toISOString() };
    if (asked !== undefined) patch.updAsked = updLine(asked) || del;
    if (did !== undefined) patch.updDid = updLine(did) || del;
    if (next !== undefined) patch.updNext = updLine(next) || del;
    await regRef(resolved).set(patch, { merge: true });
    res.json({ ok: true, chat: resolved });
  } catch (err) { fail(res, err); }
});

// CHAPTERS — headings inside a long thread (Aug 2026, Sophie: a few chats ran
// for weeks and re-reading them means scrolling past everything). A chapter is
// just { title, at }: `at` is an ISO time, and the chapter owns every message
// from there until the next one starts. The thread draws a heading where the
// chapter changes; nothing is moved, renamed or re-keyed, so getting the
// boundaries wrong costs one more POST and never touches a message.
//
// Stored on the registry doc, which the feed already loads whole — so chapters
// reach the app with NO extra request, and a chat without them renders exactly
// as before. Send `[]` to clear.
router.post('/chapters', async (req, res) => {
  try {
    const { chat, chapters } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    if (!Array.isArray(chapters)) return res.status(400).json({ error: 'chapters must be an array' });
    const clean = [];
    for (const c of chapters.slice(0, 40)) {
      const title = String((c && c.title) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const t = new Date((c && c.at) || '').getTime();
      // a chapter with no title or an unparseable time is dropped, not guessed
      if (!title || isNaN(t)) continue;
      clean.push({ title, at: new Date(t).toISOString() });
    }
    clean.sort((a, b) => (a.at < b.at ? -1 : 1));
    const target = await followMoves(chat);
    // Refuse a chat that doesn't exist. Firestore's set({},{merge:true}) WRITES
    // a missing doc, and sortedChatNames lists every registry key — so a typo
    // here would put a phantom row in her chat list that only the Admin SDK
    // could remove. That has happened before; the registry read is already
    // cached by followMoves, so the guard costs nothing.
    if (!(await registry()).chats[target]) return res.status(404).json({ error: 'no such chat' });
    await regRef(target).set({
      chapters: clean.length ? clean : admin.firestore.FieldValue.delete(),
    }, { merge: true });
    res.json({ ok: true, chat: target, chapters: clean });
  } catch (err) { fail(res, err); }
});

router.post('/chatnote', async (req, res) => {
  try {
    const { chat, note } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const target = await followMoves(chat);
    const del = admin.firestore.FieldValue.delete();
    // collapse newlines too — the row is one line, and a pasted multi-line
    // note rendered as a wall of text at the top of the thread
    const val = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    await regRef(target).set({
      sophieNote: val || del,
      sophieNoteAt: val ? new Date().toISOString() : del,
    }, { merge: true });
    res.json({ ok: true, chat: target, note: val || null });
  } catch (err) { fail(res, err); }
});
// THE PINNED DELIVERABLE (Aug 2026, Sophie: "a play button at the top, just
// the title, and when I press play it opens full screen"). A chat that has
// just made a film/audio pins it here and it sits at the top of the thread —
// she should not have to open a Compare page to get at the thing she asked
// for. One field on the registry doc, same shape as the status card, so it
// rides the feed's already-cached read. Empty url clears it.
//
// `kind:'link'` PINS A PAGE rather than a recording (Aug 2026, Sophie, on the
// fruit picker: "there was a chat that once pinned the URL to the top of the
// chat screen… if it works we could do that for lots of chats"). The pin was
// media-only and the app built a <video> straight from the url, so pinning a
// web page rendered a play button that opened a black box — the deliverable a
// chat most often wants at the top is a PAGE, and it could not say so. A link
// pin wears a link glyph and opens the page instead of embedding it.
// NEWEST CUT OF A FILM — derived, never filed (Aug 2026, Sophie, on the dream
// commercials grid: "there's a new version of the song commercial … this is a
// broader problem of how can you automatically update based on the latest
// version of the movies to the Instagram thing").
//
// A posted page is frozen HTML, so a page that names a film's url shows the
// cut that existed the day it was built — and the chats making those films
// re-cut them daily. Asking each of them to update a manifest is the shape
// that has already been measured to fail here (only 15 of 224 chats ever
// posted an Update card), so this DERIVES the answer from what already exists,
// the way questions.js and chat-sort.js do.
//
// Two sources, in this order, because a human-curated answer beats a timestamp:
//   1. the making chat's PINNED link, when it points inside that film's own
//      prefix. A chat pinning its newest render is an existing house rule, and
//      the prefix guard is what makes it safe: a chat that makes several films
//      can only pin one, and its pin must never be served as a different film.
//   2. the newest VIDEO under the prefix by Storage's own `updated` time.
//      Known limit, stated rather than hidden: re-uploading an old cut would
//      make it look newest. Nothing else here reads filenames, on purpose —
//      the version lives in the folder for some of these films and in the file
//      for others, so any filename rule would be right about half of them.
//
// Query: ?q=<prefix>|<chat>,<prefix2>|<chat2>  — the chat half is optional.
// Answers `{ films: { "<prefix>": { url, from:'pin'|'storage', title, name } } }`;
// a prefix with nothing under it is simply absent, and the caller keeps
// whatever it was built with.
const NEWEST_TTL_MS = 60 * 1000;
const newestCache = new Map();
require('./memwatch').gauge('chatNewestCache', () => newestCache.size);
const VIDEO_RE = /\.(mp4|mov|webm)$/i;
// a cut lives directly under its film's prefix; `clips/` and `stills/` are the
// pieces it was built from and must never be served as the film
const PART_RE = /\/(clips|stills|parts|frames)\//i;

async function newestUnder(prefix) {
  const hit = newestCache.get(prefix);
  if (hit && Date.now() - hit.at < NEWEST_TTL_MS) return hit.val;
  let val = null;
  try {
    const [files] = await admin.storage().bucket().getFiles({ prefix, maxResults: 400 });
    const vids = files.filter((f) => VIDEO_RE.test(f.name) && !PART_RE.test(f.name));
    for (const f of vids) {
      const up = f.metadata && f.metadata.updated ? f.metadata.updated : '';
      if (!val || up > val.updated) val = { name: f.name, updated: up };
    }
  } catch (e) { val = null; }              // no Storage, no answer — never a throw
  newestCache.set(prefix, { at: Date.now(), val });
  return val;
}

/** THE DECISION, with no IO in it — the pin when it is unmistakably this
 *  film, else the newest video Storage has, else nothing (and the caller keeps
 *  what it was built with). Exported so the whole table can be tested without
 *  a bucket or a registry. */
function pickFilm(prefix, pinned, newest, base) {
  const pin = pinned && pinned.url ? pinned : null;
  // "inside this film's prefix" is matched on a PATH BOUNDARY: without the
  // leading slash, prefix `dream-commercial/spot-` would also accept a url
  // from `other-dream-commercial/spot-…`, and the whole point of the guard is
  // that a chat's pin can never be served as a different film.
  if (pin && VIDEO_RE.test(pin.url) && pin.url.indexOf('/' + prefix) > -1) {
    return { url: pin.url, from: 'pin', title: pin.title || '', name: pin.url.split('/').pop() };
  }
  if (newest && newest.name) {
    return { url: (base || '') + newest.name, from: 'storage', title: '',
      name: newest.name.split('/').pop(), updated: newest.updated || '' };
  }
  return null;
}

router.get('/newest', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const raw = String(req.query.q || '').slice(0, 2000);
    const entries = raw.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12)
      .map((x) => {
        const [prefix, chat] = x.split('|');
        return { prefix: String(prefix || '').trim(), chat: String(chat || '').trim().slice(0, 60) };
      })
      // a prefix is a Storage path and nothing else — no traversal, no scheme
      .filter((e) => /^[A-Za-z0-9._\-]+(\/[A-Za-z0-9._\-]+)*\/?[A-Za-z0-9._\-]*$/.test(e.prefix)
        && !e.prefix.includes('..'));
    if (!entries.length) return res.json({ films: {} });
    const bucketName = admin.apps.length ? admin.storage().bucket().name : '';
    const base = `https://storage.googleapis.com/${bucketName}/`;
    const reg = await registry();
    const films = {};
    await Promise.all(entries.map(async (e) => {
      const d = (e.chat && reg.chats && reg.chats[e.chat]) || {};
      const hit = pickFilm(e.prefix, d.pinned, await newestUnder(e.prefix), base);
      if (hit) films[e.prefix] = hit;
    }));
    res.json({ films });
  } catch (err) { fail(res, err); }
});

// NOTE: scripts/test-pin-current.js evaluates a SLICE of this file — from the
// PIN_KINDS declaration below down to the pin POST route — so that span must
// hold only the pin helpers; a route dropped inside it breaks that test with
// "router is not defined". The slice is found by indexOf on those two literal
// strings, so do not write either of them in a comment above them either: the
// search takes the FIRST match, and a comment mentioning them wins.
const PIN_KINDS = new Set(['audio', 'video', 'link']);
// A MISSING `kind` IS READ OFF THE URL (Aug 2026). The pin used to fall back to
// `video` for anything it didn't recognise, which was right while only films
// were pinned and wrong the moment pinning a PAGE became the common case: a web
// page dropped into a <video> renders a black box that never loads. The
// extension decides — a media url ends in one — and an explicit `kind` still
// wins, so a film pinned the old way behaves exactly as it did.
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|#|$)/i;
const AUDIO_EXT = /\.(m4a|mp3|wav|aac|caf|aiff?)(\?|#|$)/i;
function pinKind(kind, url) {
  if (PIN_KINDS.has(kind)) return kind;
  if (VIDEO_EXT.test(url)) return 'video';
  if (AUDIO_EXT.test(url)) return 'audio';
  return 'link';
}
// THE "current" TAG (Aug 2026, Sophie: "for the movie that gets updated to have
// like a tag on it that says like current or recent, and it only says that if
// the chat updated the last turn that they finished"). What a pin cannot say on
// its own is whether what sits behind it is FRESH — a link to /science looks
// identical whether the page moved an hour ago or last week.
//
// So the pin carries `turns` = how many finished replies this chat has posted
// SINCE the pin was written, incremented by the reply post below. 0 = the turn
// that set it hasn't ended yet; 1 = it ended, and that is the chat's most
// recent finished turn. Either way the last finished turn updated the pin, so
// both read as current; 2 means the chat has since finished a turn that left it
// alone, and the tag goes out. Counting turns rather than comparing timestamps
// is what makes this exact: a turn's `created` is the first DRAFT's time when a
// hook posts drafts and the final post's time when it doesn't, so any
// pin.at-vs-message-time rule is wrong for half the chats.
//
// Re-POSTing the same url is therefore the whole update ritual: it resets the
// count and lights the tag again.
const PIN_CURRENT_TURNS = 1;
function pinBump(pinned) {
  if (!pinned || !pinned.url) return null;             // nothing pinned
  const turns = Number.isFinite(pinned.turns) ? pinned.turns : 0;
  // Once it can never be current again the count stops moving — no point
  // writing the registry doc on every reply for the rest of the chat's life.
  if (turns > PIN_CURRENT_TURNS) return null;
  return { ...pinned, turns: turns + 1 };
}
router.post('/pin', async (req, res) => {
  try {
    const { chat, session, title, url, kind } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const target = await resolveChat(chat, session);
    const del = admin.firestore.FieldValue.delete();
    const u = String(url || '').trim();
    if (u && !/^https:\/\//.test(u)) return res.status(400).json({ error: 'url must be https' });
    const pinned = u ? {
      url: u,
      title: String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      kind: pinKind(kind, u),
      at: new Date().toISOString(),
      turns: 0,
    } : del;
    await regRef(target).set({ pinned }, { merge: true });
    // A MEDIA pin is a deliverable being handed over (a film, an audio cut) —
    // it also lands on the running deliverables list (/deliverables), which
    // buzzes her on a NEW url whatever the chat's bell says (Sophie's ask,
    // 2026-08-27). Fire-and-forget: the list can never fail a pin.
    if (u && require('./deliverables').pinDeliverable(pinned)) {
      require('./deliverables')
        .record({ chat: target, url: u, title: pinned.title, kind: pinned.kind, source: 'pin' })
        .catch((e) => console.warn('deliverables: pin record failed', e.message));
    }
    res.json({ ok: true, chat: target, pinned: u ? pinned : null });
  } catch (err) { fail(res, err); }
});

// A chat reads its own card + her note (pass session for session-first
// resolution, same contract as GET /name).
router.get('/status', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    let chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const session = String(req.query.session || '').slice(0, 120);
    chat = session ? await resolveChat(chat, session) : await followMoves(chat);
    // plain read — regRef() is the WRITE path and drops the registry cache
    const snap = await db().collection(REG).doc(chat).get();
    const d = snap.exists ? snap.data() : {};
    res.json({
      chat,
      need: d.statusNeed || null,
      doing: d.statusDoing || null,
      statusAt: d.statusAt || null,
      note: d.sophieNote || null,
      noteAt: d.sophieNoteAt || null,
      // …and what it has pinned, so a chat coming back to a thread can see
      // whether its link is still up there and whether the "current" tag is
      // still lit (`turns` — see pinBump) without re-pinning blind.
      pinned: (d.pinned && d.pinned.url) ? d.pinned : null,
      // …and its LABELS (2026-08-27, Sophie's tag rules) — so a chat can act
      // on the words it wears: `bug fix` archives itself when the fix lands
      // clean, `quick question` sets its own bell. Read-only here; filing is
      // still hers and the auto-sorter's, never the chat's.
      labels: labelsOf(d),
    });
  } catch (err) { fail(res, err); }
});

// Turn started (v8, Aug 2026) — the hook pings this from UserPromptSubmit the
// moment Sophie messages a session, and the app tints that chat pink until the
// reply lands. This tiny route exists because the obvious signal doesn't work:
// the hook can only lift HER MESSAGE out of the transcript at the END of the
// turn (at UserPromptSubmit the transcript doesn't hold it yet — measured
// live: her messages' postedAt lands ~1s before the reply's, every time), so
// "newest message is hers" is true for about one second, ever. The ping needs
// no transcript at all — just the chat — so it can fire at submit time. The
// mark lives on the registry doc (rides the same cached read as the icons)
// and the final reply's registry write clears it.
router.post('/working', async (req, res) => {
  try {
    const { chat, session, v } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const resolved = await resolveChat(chat, String(session || '').slice(0, 120));
    // Parks the chat as well as marking it (see POST /reply). This is the
    // turn-start ping from the CLAUDE app rather than the Chats app's reply
    // box, and it only fires from a hook new enough to send it — an environment
    // still on an older setup script never calls /working at all, which is
    // exactly why the tint could never be trusted. Where it DOES fire it parks
    // the chat earlier than /reply can, which is the better moment.
    const stamp = new Date().toISOString();
    const reg = { workingAt: stamp, hiddenAt: stamp };
    // …AND THE ACCOUNT, WHICH ONLY A FINISHED REPLY USED TO STAMP (2026-08-26,
    // Sophie: "they seem to exist, but their button takes me nowhere"). A chat
    // whose turn started and never posted a reply — exactly the empty chats in
    // the MORE fold — therefore carried NO account tag, so the app fired its
    // Open link blind into whichever account it was on and dead-ended on the
    // wrong one. The ping already runs with FORGE_ACCOUNT in its environment;
    // it just never sent it. An older hook sends none and is unchanged.
    const acct = String((req.body || {}).account || '').slice(0, 20);
    if (acct) reg.account = acct;
    // v11 telemetry (Sophie, 2026-08-10: "rather than me having to give it to
    // each one individually… a place where each chat checks"): the ping carries
    // the md5 of the chat's INSTALLED hook file; compare it to the repo copy
    // this server deployed with (setup.sh installs byte-identical, verified)
    // and mark the chat, so the app can show "hook out of date" instead of
    // Sophie hunting stale chats by hand. Detection only — the server never
    // pushes code anywhere; the heal stays a paste into the chat. (Auto-update
    // designs were refused by the chat harness twice, with her permission on
    // record — see the hook's v11 header. Don't rebuild them.)
    const hv = String(v || '').slice(0, 40);
    if (hv) { reg.hookV = hv; reg.hookStale = hv !== repoHookMd5(); }
    await regRef(resolved).set(reg, { merge: true });
    res.json({ ok: true, chat: resolved });
  } catch (err) { fail(res, err); }
});

// The repo's own hook file deploys with this server, and setup.sh installs it
// byte-identical — so its md5 IS the current hook version, measured off the
// real artifact rather than a constant someone forgets to bump. Cached per
// process; a deploy restarts the server, which is exactly when it can change.
let hookMd5Cache = null;
function repoHookMd5() {
  if (!hookMd5Cache) {
    try {
      const p = path.join(__dirname, '.claude', 'hooks', 'post-to-feed.sh');
      hookMd5Cache = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
    } catch (e) { hookMd5Cache = 'unknown'; }
  }
  return hookMd5Cache;
}

// ---- WHAT A BOOKMARK IS FOR — the tag set on a kept thing --------------
// Aug 2026, Sophie: "both shud now have a set of tag buttons: to read, and
// 'important' level (1-3) - icons, and review finished feature, review bug fix
// or information/question answered". A note says WHY she kept it in her own
// words; these say what KIND of thing it is and how much it matters, in the
// same four words every time, so the pile can be filtered instead of read.
//
// A FIXED VOCABULARY, the same rule the archive tags follow: this table and
// BMK_TAGS in chats.html are pinned equal by
// `node scripts/test-chats-bookmark-tags.js`, so a word can never exist on one
// side only. `to-read` is the one with a door of its own — it is what the To
// read chip on the Update tab counts.
//
// The IMPORTANCE is deliberately NOT a tag: it is a level 1-3 on its own
// field, because it is a dial (a thing has one) where the tags are a set (a
// thing can be several). 0 clears it.
const BMK_TAGS = ['to-read', 'feature', 'bugfix', 'answered'];

// Both bookmark routes take the same two fields, so the whitelist is written
// once: an unknown word is DROPPED rather than refused, so an older page that
// learns a new word later cannot fail a save she has already made.
function bookmarkMarks(body) {
  const patch = {};
  if (body.tags !== undefined) {
    const list = Array.isArray(body.tags) ? body.tags : [];
    const clean = [];
    list.forEach((t) => {
      const w = String(t || '').trim().toLowerCase();
      if (BMK_TAGS.includes(w) && !clean.includes(w)) clean.push(w);
    });
    patch.bmkTags = clean.length ? clean : admin.firestore.FieldValue.delete();
  }
  if (body.level !== undefined) {
    const n = Math.round(Number(body.level) || 0);
    patch.bmkLevel = (n >= 1 && n <= 3) ? n : admin.firestore.FieldValue.delete();
  }
  // I READ IT — hers to tick, never derived (Aug 2026, Sophie: "a rounded
  // square check box that is empty with a gray outline and becomes red with a
  // check in it… I'll mark it manually"). Opening a thing is not reading it,
  // which is why nothing here watches for a view: the tick is the whole
  // signal, and it is what takes a thing out of the To read count.
  if (body.read !== undefined) {
    patch.bmkRead = body.read ? true : admin.firestore.FieldValue.delete();
  }
  return patch;
}

// Bookmark a message Sophie wants to find later — a flag on the message doc
// itself, so it rides along on GET / (every message already spreads its data)
// and any chat can read which of its messages she flagged.
// `note` = why she kept it (Aug 2026, Sophie: "when I bookmark messages I want
// to leave a note or title the message so I remember what it was and why I
// bookmarked it"). A bookmark's snippet is the message's first line, which is
// rarely the reason she saved it. Sent on its own it only edits the note, so
// typing one never toggles the bookmark off.
router.post('/bookmark', async (req, res) => {
  try {
    const body = req.body || {};
    const { id, bookmarked, note } = body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const patch = Object.assign({}, bookmarkMarks(body));
    if (bookmarked !== undefined) patch.bookmarked = !!bookmarked;
    if (note !== undefined) {
      const t = String(note).trim().slice(0, 300);
      patch.bookmarkNote = t || admin.firestore.FieldValue.delete();
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    await db().collection(MSGS).doc(String(id)).set(patch, { merge: true });
    res.json({ ok: true, bookmarked: patch.bookmarked, note: note });
  } catch (err) { fail(res, err); }
});

// Every bookmarked message, across every chat — the BOOKMARKS view on the home
// screen. Until this existed a bookmark could only be seen by scrolling to that
// exact message inside its own thread, which made the button close to useless.
// ONE equality filter and the sort done in memory, so Firestore needs no
// composite index (the same discipline as the crystals/audio queries).
// The full `text` is deliberately NOT returned: it is only a list, and a chat
// with long replies would otherwise send megabytes to a phone.
// Sophie bookmarks two different things (Aug 2026, her own description): "code
// I want to keep that has copy and paste instructions", and "a long explanation
// I'll need to read later". That split is DERIVED, never asked for — she should
// not have to categorise at bookmark time. A fenced code block is the signal,
// and a precise one: it is exactly what the page renders as a copy-button code
// box, i.e. the thing she copies. Inline `code` does not count — a sentence
// mentioning a filename is still prose.
function bookmarkKind(text) {
  return /```/.test(String(text || '')) ? 'code' : 'read';
}

// THREE KINDS IN ONE PILE (Aug 2026, Sophie: "I should be able to bookmark
// chats, compare pages and messages and they should all live in the same
// place"). Bookmarks is THE keep-pile, split three ways by the tab row in the
// app — CHATS · ARTIFACTS · MESSAGES, her words for them.
//   kind:'chat'    — a STARRED chat, read straight off the registry (no extra
//                    query; it is already loaded for the display names). The
//                    star and the bookmark are deliberately the SAME mark:
//                    `starred` already meant "important, work I want to refer
//                    back to", and a second per-chat keep-flag would mean
//                    remembering which of two piles a chat went into.
//   kind:'page'    — a kept Compare page. `bookmarked` lives on the PAGE DOC,
//                    so deleting the page takes its bookmark with it and the
//                    pile can never hold a row pointing at a 404.
//   kind:'code' |
//   kind:'read'    — a kept message, split the way it always was.
// The client MUST branch on `kind`: a chat row and a message row open a
// thread, a page row launches the artifact full-screen.
// Two single-equality queries plus the cached registry, sorted together in
// memory: still no composite index, the same discipline as everything here.
router.get('/bookmarks', async (req, res) => {
  try {
    const [msgs, keptPages, refPages] = await Promise.all([
      db().collection(MSGS).where('bookmarked', '==', true).limit(500).get(),
      db().collection(PAGES).where('bookmarked', '==', true).limit(500).get(),
      // The REFERENCE SHELF rides in the ARTIFACTS tab without her keep-tap
      // (see POST /page): a standing comparison is kept by definition, and
      // only 4 of 333 pages had ever been bookmarked, so waiting for the tap
      // would have left the shelf empty on the screen she looks at.
      db().collection(PAGES).where('reference', '==', true).limit(500).get(),
    ]);
    // A page can be BOTH (she kept one that is also on the shelf) — two
    // equality queries can't be OR'd in Firestore, so the union is done here,
    // by doc id, and it must be: a duplicated row is a row she taps twice.
    const seenPage = new Set();
    const pageDocs = keptPages.docs.concat(refPages.docs)
      .filter((d) => (seenPage.has(d.id) ? false : seenPage.add(d.id)));
    const reg = await registry();
    const items = msgs.docs.map((d) => {
      const m = d.data() || {};
      const line = String(m.tldr || m.text || '').replace(/\s+/g, ' ').trim();
      return {
        id: d.id,
        chat: m.chat || '',
        from: m.from || '',
        created: m.created || m.postedAt || '',
        snippet: line.slice(0, 220),
        note: m.bookmarkNote || '',
        kind: bookmarkKind(m.text),
        // her marks ride along so the pile can be filtered and re-tagged in
        // place — the same two fields on a message and on an artifact
        tags: Array.isArray(m.bmkTags) ? m.bmkTags : [],
        level: Number(m.bmkLevel) || 0,
        read: !!m.bmkRead,
      };
    }).concat(pageDocs.map((d) => {
      const p = d.data() || {};
      // A page's TITLE is genuinely descriptive ("Cutting blocks v6 (s96) —
      // …"), unlike a message's first line — so it fills the snippet slot and
      // the row keeps ONE shape, note above and subtitle below.
      return {
        id: d.id,
        chat: p.chat || '',
        from: '',
        created: p.created || '',
        title: String(p.title || ''),
        snippet: String(p.title || '').slice(0, 220),
        note: p.bookmarkNote || '',
        kind: 'page',
        superseded: !!p.superseded,
        // both flags ride along: the client has to know whether a page taken
        // off the shelf still belongs in the pile (she kept it) or leaves it.
        bookmarked: !!p.bookmarked,
        reference: !!p.reference,
        topic: p.refTopic || '',
        tags: Array.isArray(p.bmkTags) ? p.bmkTags : [],
        level: Number(p.bmkLevel) || 0,
        read: !!p.bmkRead,
      };
    })).concat(Object.keys(reg.chats).filter((slug) => {
      const r = reg.chats[slug] || {};
      // BOOKMARKED, not starred (Aug 2026 — the two were split apart; see
      // POST /chat-bookmark). A star is what she is working on THIS WEEK and
      // has no business in a keep-forever pile.
      return r.bookmarked && !r.movedTo;       // never a tombstone
    }).map((slug) => {
      const r = reg.chats[slug] || {};
      return {
        id: slug,
        chat: slug,
        from: '',
        created: r.lastSeen || '',
        title: r.displayName || slug,
        // its status line — what that chat is on — is the useful subtitle
        // here; the chat's NAME is already the thing she is looking for.
        snippet: r.statusNeed || r.statusDoing || '',
        note: r.sophieNote || '',
        kind: 'chat',
      };
    })).sort((a, b) => (a.created < b.created ? 1 : -1));   // newest first
    res.json({ items, chats: reg.chats });
  } catch (err) { fail(res, err); }
});

// HOW MANY THINGS ARE WAITING TO BE READ — the count on the To read chip in
// the Update tab's doors row (Aug 2026, Sophie: "add a to read button next to
// it"). Its own tiny route rather than the whole keep-pile: that tab paints on
// every poll, and GET /bookmarks returns up to a thousand documents.
//
// Two array-contains queries, each a single-field index Firestore keeps by
// itself — the same no-composite-index discipline as everything else here.
router.get('/to-read', async (req, res) => {
  try {
    const [msgs, pages] = await Promise.all([
      db().collection(MSGS).where('bmkTags', 'array-contains', 'to-read').limit(300).get(),
      db().collection(PAGES).where('bmkTags', 'array-contains', 'to-read').limit(300).get(),
    ]);
    // A THING SHE UN-KEPT MUST LEAVE THE COUNT, and the tag alone cannot say
    // so: `bookmarked` and `bmkTags` are separate fields ON PURPOSE (a patch
    // touches only what it names, so tagging never un-keeps and un-keeping
    // never drops her words) — which left an un-kept page counting towards the
    // To read door forever. Found live 2026-08-24 superseding a page: the door
    // read 4 with 3 things in the pile. Filtered HERE rather than in the query
    // because `array-contains` + an equality needs a composite index, and both
    // reads are already capped at 300.
    // AND A TICKED ONE LEAVES IT TOO (Aug 2026, Sophie: "when I read it I'll
    // mark it manually") — the pile is what is still waiting, so her tick is
    // what makes the number go down.
    const kept = (snap) => snap.docs
      .filter((d) => d.data().bookmarked !== false && !d.data().bmkRead).length;
    const m = kept(msgs); const pg = kept(pages);
    res.json({ ok: true, count: m + pg, messages: m, pages: pg });
  } catch (err) { fail(res, err); }
});

// ---- The running to-do list ----------------------------------------------
// Sophie, Aug 2026: "I kind of wanna do like a running to-do list." Things she
// thinks of on her phone and would otherwise lose — a bug she noticed, an art
// direction to try — kept in one place instead of scattered across whichever
// chat happened to be open.
//
// Deliberately NOT per-chat: the whole point is that an idea arrives while she
// is somewhere else. A chat READS the list (GET /todos) and can act on an item
// the next time she messages it, the same snail-mail rhythm as asset notes.
//
// One tiny collection, no index: the list is short, so it is fetched whole and
// sorted in memory (open items first, newest at the top of each group).
const TODOS = 'forge-chat-todos';

router.get('/todos', async (req, res) => {
  try {
    const snap = await db().collection(TODOS).limit(500).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (!!a.done !== !!b.done)
        ? (a.done ? 1 : -1)
        : ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1));
    res.json({ items });
  } catch (err) { fail(res, err); }
});

router.post('/todo', async (req, res) => {
  try {
    const text = String((req.body || {}).text || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: 'text required' });
    const doc = {
      text,
      done: false,
      createdAt: new Date().toISOString(),
      // who wrote it — she types most of them, a chat can file one too
      from: String((req.body || {}).from || 'sophie').slice(0, 20),
    };
    const ref = await db().collection(TODOS).add(doc);
    res.json({ ok: true, id: ref.id, item: { id: ref.id, ...doc } });
  } catch (err) { fail(res, err); }
});

router.patch('/todo/:id', async (req, res) => {
  try {
    const { done, text } = req.body || {};
    const patch = {};
    if (done !== undefined) {
      patch.done = !!done;
      patch.doneAt = done ? new Date().toISOString() : admin.firestore.FieldValue.delete();
    }
    if (text !== undefined) patch.text = String(text).trim().slice(0, 2000);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    await db().collection(TODOS).doc(String(req.params.id)).set(patch, { merge: true });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

router.delete('/todo/:id', async (req, res) => {
  try {
    await db().collection(TODOS).doc(String(req.params.id)).delete();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ---- Compare pages -------------------------------------------------------
// A chat can publish a full self-contained HTML page (a comparison sheet, an
// options board — what used to be a claude.ai artifact) into its own Compare
// tab. HTML goes to Storage (can exceed Firestore's 1MB doc cap when images
// are inlined); a small metadata doc lists it. Served back through the server
// so viewing stays same-origin and gated with the rest of the feed.
const PAGES = 'forge-chat-pages';

// KIT WARNINGS — checked AT THE MOMENT OF POSTING, answered to the chat that
// can still fix it (Aug 2026). Chats keep hand-rolling Compare pages that skip
// the shared kit, and every skip re-ships the same long-fixed bugs on Sophie's
// phone: a pill styled black on transparent, taps that don't pause the
// autoscroll, a video slab parked at the top. Nothing is ever BLOCKED — the
// page is stored either way; the warnings just ride back on the POST response
// (and onto the doc as `kitWarnings`) so the posting chat sees them in its own
// tool output and can repost fixed.
//
// Cheap string checks only — no parser, no network.
function kitWarnings(html) {
  // COMMENTS ARE STRIPPED FIRST, and that is load-bearing: compare-shell.html
  // carries the rules in its own comment block — including the literal
  // "<video>" and "/compare.js" — so reading the raw text both warns a shell
  // page about a player it hasn't got and lets a commented-out script pass.
  const s = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  // Only a full self-contained PAGE is what these rules are about. A fragment
  // gets nothing, and neither does a page carrying its OWN pill (`id="vtop"` —
  // the same marker GET /page/:id reads to skip injecting the shared one).
  const isPage = /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<meta\s|<title[\s>]/i.test(s);
  if (!isPage || s.includes('id="vtop"')) return [];
  const out = [];
  if (!/(?:src|href)\s*=\s*["'][^"']*\/compare\.js/i.test(s)) {
    out.push('No /compare.js: taps won\'t pause the autoscroll, and the lightbox '
      + 'and external-link contracts are missing — start from '
      + 'public/compare-shell.html or add <script src="/compare.js"></script>.');
  }
  const hasCss = /href\s*=\s*["'][^"']*\/compare\.css/i.test(s);
  // --ink2 must not satisfy --ink, hence the word boundary.
  const tokens = ['--ink', '--paper', '--chg', '--ink2', '--rose'];
  if (!hasCss && !tokens.every((t) => new RegExp(t + '\\b').test(s))) {
    out.push('No /compare.css and not all five tokens (--ink, --paper, --chg, '
      + '--ink2, --rose): the injected pill will render black on transparent — '
      + 'link /compare.css or define the five :root tokens.');
  }
  if (/<video[\s>]/i.test(s)) {
    out.push('An embedded <video>: a film is a line of text with a play button '
      + 'via window.__filmRow({url,label,meta,mount}), never an embedded player.');
  }
  // THE TITLE, ONCE, AND NOTHING ABOVE IT (Aug 2026, Sophie — asked for on
  // page after page, and the shells themselves taught the opposite until she
  // caught it). The gold CHAT NAME · DATE eyebrow and the tagline under the
  // title are the two rows she keeps having removed by hand. Both classes
  // still exist in compare.css so pages posted before the rule render, which
  // is exactly why a NEW page has to be told.
  if (/class\s*=\s*["'][^"']*\beyebrow\b/i.test(s)) {
    out.push('An .eyebrow line above the title: the page opens with its <h1> '
      + 'and nothing above it — no chat/date line (she knows which chat she '
      + 'is in). Delete it.');
  }
  if (/class\s*=\s*["'][^"']*\bsub\b/i.test(s)) {
    out.push('A .sub tagline under the title: the title is the only text at '
      + 'the top. Anything worth explaining goes behind the "?" — '
      + 'window.__compareHelp({ html: "…" }).');
  }
  // A PROSE BLOCK BETWEEN THE TITLE AND THE FIRST PICTURE — INCLUDING ONE SHE
  // ASKED FOR (Aug 2026, Sophie, after this page shipped with two paragraphs
  // at the top: "can you put lots of extra text at the top that should be
  // hidden behind the ?").
  //
  // The .eyebrow and .sub checks above only catch the two NAMED classes, and
  // every written copy of the rule says "no INSTRUCTIONS on the page" — so a
  // chat asked to "explain the idea at the top" reads its own paragraph as
  // neither an instruction nor an eyebrow, writes it into a plain .card, and
  // ships it. That is the hole this closes: the rule is about the SHAPE of
  // the top of the page, not the genre of the text, and her asking for an
  // explanation is an ask for the "?" CARD, which is the top of the page.
  //
  // Only fires when the page has pictures at all — a deliberately text-only
  // page (a transcript, a read-through) is not what the rule is about — and
  // only counts prose BEFORE the first one, so per-item captions and the
  // folds under a row are untouched.
  const media = s.search(/<img\b|<video\b|<audio\b|class\s*=\s*["'][^"']*\b(?:imgrow|duo|trio)\b/i);
  if (media > 0) {
    const before = s.slice(0, media);
    const prose = (before.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
      .join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (prose.length > 180) {
      out.push(`A ${prose.length}-character prose block between the title and `
        + 'the first picture: the page goes straight from its <h1> into the '
        + 'thing. This applies to an explanation SHE ASKED FOR too — "explain '
        + 'it at the top" means the "?" card, which is at the top: '
        + 'window.__compareHelp({ html: "…" }).');
    }
  }
  // TEXT BOXES SHIP EMPTY (Aug 2026, Sophie: "whenever there's a text box
  // there should not be anything in it, no example text… I prefer nothing").
  // An example she has to clear before typing is work.
  if (/<(?:input|textarea)\b[^>]*\bplaceholder\s*=\s*["'][^"']/i.test(s)) {
    out.push('Example text in a box (placeholder=): text boxes ship EMPTY. '
      + 'If an example is genuinely needed, put it behind the "?" instead.');
  }
  return out;
}

// THE REFERENCE SHELF (Aug 2026, Sophie: "we should save compare pages if
// they're comparing things that often need to be re-referenced — for example
// the different qualities of images like high, medium and low, or the
// different styles").
//
// Most Compare pages answer ONE question once: which cut, which cover, which
// of these six. A few answer a question that gets asked again every week by a
// different chat — what low/medium/high actually look like, what the five
// styles look like side by side, what LoRA scale 1 / 1.2 / 1.4 does. Those are
// REFERENCE pages, and until now they were indistinguishable from the one-offs:
// findable only by remembering which chat happened to make one.
//
// Measured 2026-08-14 over all 333 pages on file: ~34 carry a comparison title
// and the reusable ones are scattered across a dozen unrelated chats
// ("Quality ladder — low vs medium vs high" in hospital-story-images, "3x3
// sheet — low vs medium vs high" in netlify-site-review, "Style tests — side
// by side" in chatgpt-image-style-reference). Only FOUR pages in the whole
// collection had ever been bookmarked, so her own keep-tap was never going to
// gather them.
//
// Two halves, and the second is the one that saves money:
//   • `reference` + `refTopic` on the page doc; reference pages surface in the
//     Bookmarks pile's ARTIFACTS tab without her having to tap anything.
//   • GET /references — the cross-chat shelf ANY chat can read before it
//     builds (and pays for) a comparison that already exists.
// It is deliberately SEPARATE from `bookmarked`: that flag is hers, this one
// is the chats' (the same split as `starred` vs `bookmarked` on a chat). She
// can always take one off the shelf; nothing takes one off by itself.
const REF_TOPIC_MAX = 40;
function refTopic(t) { return String(t == null ? '' : t).trim().toLowerCase().slice(0, REF_TOPIC_MAX); }

// THE STOCK TEMPLATES (Aug 2026, Sophie: "ready-made templates… they will be
// forced into the structure of a page that's already built"). A chat that has
// a LIST — options to judge, variants to compare, a to-do to walk — POSTs the
// list, not HTML: { chat, title, template:'deck'|'grid', data:{…} }. The full
// item shape and the two templates live in page-templates.js; the page is
// rendered by the CURRENT stock renderer at serve time, so improvements reach
// every template page ever posted. `template:'grid', from:{assets:true}`posts
// the auto-grouped quality/model ladders straight out of the chat's Assets tab
// (only the objective exact-prompt groups — near-variants are the chat's own
// call: GET /api/gallery/assets/variants flags those).
async function chatAssetRows(chat) {
  // the same union the Assets tab serves, minus the iOS-creations leg (those
  // records carry no prompts, and prompts are what grouping runs on)
  const snap = await admin.firestore().collection('forge-chat-assets')
    .where('chat', '==', chat).get();
  return assetUnion.unionAssets(snap.docs.map((d) => assetUnion.assetRecord(d.data())))
    .sort((x, y) => y.ms - x.ms);
}

// ─── AUTO-COMPARE — the server files the pages ITSELF (Aug 2026 v2) ─────────
// Sophie: "if an image is exactly the same except one or two variables have
// been changed, for example the quality… then this should automatically file
// into a compare page", and "a compare page for only images that have the
// same style prompt but different dreams". The first cut left this to the
// chats ({ from:{assets:true} } was a door a chat had to walk through), and
// measured reality was that nobody walked through it — so filing the prompt
// IS the trigger now: POST /api/gallery/assets/prompt and a curated caption
// filing both poke this, debounced per chat, and the server upserts up to two
// standing grid pages (planAutoPages in page-templates.js).
//
// UPDATED IN PLACE, deliberately — the one exception to "a new version is a
// new page". That rule protects her saved answers from being re-pointed at
// different content; here every item id derives from its storage FILENAME, so
// a new image joining a group changes no existing id, the verdict sheet
// (page-<id>) never moves, and her ♥/✕/notes survive every update. The doc id
// is deterministic (auto-<kind>--<chat>) so concurrent pokes converge on one
// page, `updated` bumps on every rewrite (the Review Queue keys its item
// cache on it), and a push goes out only on CREATE — never on the updates.
const autoTimers = new Map();
const AUTO_DEBOUNCE_MS = 45_000;

// LEADING EDGE AS WELL AS TRAILING (2026-08-24). The poke was trailing-only:
// a 45s timer, reset by every filing. Two consequences, both real.
//
// A batch of filings left the page 45 SECONDS STALE — Sophie filed a low sheet
// beside a medium one, looked, and the quality ladder was not there yet. It
// arrived; it just arrived after she had looked.
//
// And the timer lives in THIS PROCESS. Several chats merge here all day and a
// Render deploy restarts the box — twice today it landed inside a running job —
// so a deploy inside the window drops the pending poke on the floor and NOTHING
// re-runs it. The page then stays wrong until the next unrelated filing.
//
// Running on the FIRST filing as well means the page is right within a second
// of something landing, and a deploy can now only cost the trailing refresh
// (the coalesced tail of a batch) rather than the whole update.
function autoComparePoke(chat) {
  const slug = String(chat || '').trim().slice(0, 60);
  if (!slug) return;
  const pending = autoTimers.get(slug);
  clearTimeout(pending);
  // nothing was queued for this chat → this is the start of a batch, so run
  // now as well. Free: Firestore reads and a page write, no model call.
  if (!pending) {
    runAutoCompare(slug).catch((e) => console.error('[auto-compare lead]', slug, e.message));
  }
  const t = setTimeout(() => {
    autoTimers.delete(slug);
    runAutoCompare(slug).catch((e) => console.error('[auto-compare]', slug, e.message));
  }, AUTO_DEBOUNCE_MS);
  if (t.unref) t.unref();   // a pending poke must never hold a process open
  autoTimers.set(slug, t);
}

async function runAutoCompare(chat) {
  const slug = String(chat || '').trim().slice(0, 60);
  if (!slug || !admin.apps.length) return { ok: false, error: 'unavailable' };
  const rows = await chatAssetRows(slug);
  const plans = pageTemplates.planAutoPages(rows);
  const out = [];
  for (const plan of plans) {
    const v = pageTemplates.validateTemplate('grid', plan.data);
    if (!v.ok) { out.push({ kind: plan.kind, ok: false, error: v.error }); continue; }
    const json = JSON.stringify(v.data);
    // the hash covers the TITLE and HEADING as well as the data, so renaming
    // either repaints an already-filed page instead of reporting "unchanged"
    const hash = crypto.createHash('sha1')
      .update(`${plan.title}\n${plan.heading || ''}\n${json}`).digest('hex');
    const id = `auto-${plan.kind}--${slug.replace(/[^\w.-]+/g, '-')}`;
    const ref = db().collection(PAGES).doc(id);
    const snap = await ref.get();
    if (snap.exists && snap.data().dataHash === hash) {
      out.push({ kind: plan.kind, ok: true, id, unchanged: true });
      continue;
    }
    const file = admin.storage().bucket().file(`chat-pages/${id}.json`);
    await file.save(Buffer.from(json, 'utf8'), {
      contentType: 'application/json', resumable: false,
    });
    const stamp = new Date().toISOString();
    if (snap.exists) {
      await ref.set({ title: plan.title, heading: plan.heading || '',
        dataHash: hash, updated: stamp }, { merge: true });
      out.push({ kind: plan.kind, ok: true, id, updated: true });
    } else {
      await ref.set({
        chat: slug, title: plan.title, heading: plan.heading || '',
        created: stamp, updated: stamp,
        template: 'grid', auto: plan.kind, path: file.name, dataHash: hash,
      });
      try {
        const { chats } = await registry();
        const reg = chats[slug] || {};
        if (chatNotifies(reg)) require('./push').notifyChat(slug, reg.displayName || slug, plan.title);
      } catch (e) { /* push must never fail a filing */ }
      out.push({ kind: plan.kind, ok: true, id, created: true });
    }
  }
  return { ok: true, chat: slug, pages: out };
}

// A deliberate run — a chat backfilling a tab it filed prompts into before
// this existed, or checking what would group. The automatic path never needs
// this route; the debounced poke fires on every prompt/caption filing.
router.post('/auto-compare', async (req, res) => {
  try {
    const chat = String((req.body || {}).chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    res.json(await runAutoCompare(chat));
  } catch (err) { fail(res, err); }
});

router.post('/page', async (req, res) => {
  try {
    const { chat, title, html, template, data, from, reference, topic } = req.body || {};
    if (!chat || !title || (!html && !template)) {
      return res.status(400).json({ error: 'chat, title and html (or template + data) required' });
    }
    if (template) {
      let body = data;
      if (!body && template === 'grid' && from && from.assets) {
        const rows = await chatAssetRows(String(chat).slice(0, 60));
        const { ladders } = pageTemplates.groupAssetVariants(rows);
        if (!ladders.length) {
          return res.status(400).json({ error: 'no auto-groupable ladders in this chat\'s assets '
            + '(same prompt content, differing model/quality). GET /api/gallery/assets/variants '
            + 'to see near-variant candidates you can file yourself.' });
        }
        body = { groups: ladders };
      }
      const v = pageTemplates.validateTemplate(template, body);
      if (!v.ok) return res.status(400).json({ error: v.error });
      const tdoc = {
        chat: String(chat).slice(0, 60),
        title: String(title).slice(0, 140),
        created: new Date().toISOString(),
        template,
      };
      if (reference) {
        tdoc.reference = true;
        const t = refTopic(topic);
        if (t) tdoc.refTopic = t;
      }
      // AN ARCHIVE-REVIEW DECK CARRIES ITS OWN item→chat MAP (Aug 2026).
      // On the page DOC, not in the Storage payload: a verdict tap then costs
      // one small cached Firestore read instead of a bucket download.
      if (v.data.applyArchive) {
        const map = pageTemplates.archiveMapOf(v.data);
        if (Object.keys(map).length) { tdoc.applyArchive = true; tdoc.archiveMap = map; }
      }
      const tref = db().collection(PAGES).doc();
      const tfile = admin.storage().bucket().file(`chat-pages/${tref.id}.json`);
      await tfile.save(Buffer.from(JSON.stringify(v.data), 'utf8'), {
        contentType: 'application/json', resumable: false,
      });
      tdoc.path = tfile.name;
      await tref.set(tdoc);
      try {
        const { chats } = await registry();
        const reg = chats[tdoc.chat] || {};
        if (chatNotifies(reg)) require('./push').notifyChat(tdoc.chat, reg.displayName || tdoc.chat, tdoc.title);
      } catch (e) { /* push must never fail a post */ }
      // sheet = page-<id>: unique per page, and a new version is a new page,
      // so the verdict sheet's identity carries the item set's shape for free
      return res.json({ ok: true, id: tref.id, url: `/api/chatfeed/page/${tref.id}`,
        template, sheet: `page-${tref.id}`,
        items: template === 'grid'
          ? v.data.groups.reduce((n, g) => n + g.items.length, 0) : v.data.items.length });
    }
    const warnings = kitWarnings(html);
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title).slice(0, 140),
      created: new Date().toISOString(),
    };
    // A chat that KNOWS it is publishing a standing reference says so here —
    // the topic is what groups it on the shelf, so keep it plain and reusable
    // ("image quality", "styles", "lora scale"), never this page's own title.
    if (reference) {
      doc.reference = true;
      const t = refTopic(topic);
      if (t) doc.refTopic = t;
    }
    if (warnings.length) doc.kitWarnings = warnings;
    const ref = db().collection(PAGES).doc();
    const bucket = admin.storage().bucket();
    const file = bucket.file(`chat-pages/${ref.id}.html`);
    await file.save(Buffer.from(String(html), 'utf8'), {
      contentType: 'text/html; charset=utf-8', resumable: false,
    });
    doc.path = file.name;
    await ref.set(doc);
    // A new Compare page is a delivery even when the chat says nothing — the
    // same reason the Update tab counts it as an arrival. Same debounce, so a
    // page and the reply that follows it in one turn are one buzz. And the
    // same BELL: a chat she has not belled never reaches her lock screen, by
    // either door.
    try {
      const { chats } = await registry();
      const reg = chats[doc.chat] || {};
      const name = reg.displayName || doc.chat;
      if (chatNotifies(reg)) require('./push').notifyChat(doc.chat, name, doc.title);
    } catch (e) { /* push must never fail a post */ }
    const body = { ok: true, id: ref.id, url: `/api/chatfeed/page/${ref.id}` };
    if (warnings.length) body.warnings = warnings;   // never blocks the post
    res.json(body);
  } catch (err) { fail(res, err); }
});

router.get('/pages', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');   // always a live list
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const snap = await db().collection(PAGES).where('chat', '==', chat).get();
    const pages = snap.docs
      .map((d) => ({
        id: d.id, title: d.data().title, created: d.data().created,
        // the Compare tab needs to know a page is ONE SCREEN before it opens
        // it: a deck gets no viewer bar (see openPage in chats.html), because
        // that bar's height is what pushed the deck's own controls off an
        // iPhone. Empty for a hand-built html page.
        template: d.data().template || '',
        superseded: !!d.data().superseded,
        bookmarked: !!d.data().bookmarked,
        bookmarkNote: d.data().bookmarkNote || '',
        // her marks on a kept artifact, so the Compare tab can draw the same
        // tag row a kept message carries
        bmkTags: Array.isArray(d.data().bmkTags) ? d.data().bmkTags : [],
        bmkLevel: Number(d.data().bmkLevel) || 0,
        bmkRead: !!d.data().bmkRead,
        reference: !!d.data().reference,
        topic: d.data().refTopic || '',
      }))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
    res.json({ pages });
  } catch (err) { fail(res, err); }
});

// SUPERSEDED (Aug 2026, Sophie: "make a superseded tab and a current tab, that
// way the drafts that have changed can still exist, but not crowd the current
// area"). A new version of a deliverable is a NEW page and the old one is the
// history — but eleven drafts of one tool buried the thing she is using. This
// moves an old page behind a tab instead of deleting it, which is the whole
// point: deleting it throws away the record of what she was looking at when
// she left a note.
router.post('/page/:id/supersede', async (req, res) => {
  try {
    const id = String(req.params.id || '').slice(0, 60);
    if (!id) return res.status(400).json({ error: 'id required' });
    const ref = db().collection(PAGES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such page' });
    const on = req.body && req.body.superseded === false ? false : true;
    await ref.set({ superseded: on }, { merge: true });
    res.json({ ok: true, id, superseded: on });
  } catch (err) { fail(res, err); }
});

// Keep a Compare page (Aug 2026, Sophie). Deliberately the SAME contract as
// the message bookmark route above, field for field: `bookmarked` toggles,
// `note` sent on its own edits ONLY the note — so writing why she kept an
// artifact can never quietly un-keep it. It lands in the same Bookmarks view
// (see GET /bookmarks).
// Bookmarking a SUPERSEDED page is allowed on purpose: the old version is
// often exactly the thing worth keeping, which is the whole reason superseded
// pages are never deleted.
router.post('/page/:id/bookmark', async (req, res) => {
  try {
    const id = String(req.params.id || '').slice(0, 60);
    if (!id) return res.status(400).json({ error: 'id required' });
    const body = req.body || {};
    const { bookmarked, note } = body;
    const patch = Object.assign({}, bookmarkMarks(body));
    if (bookmarked !== undefined) patch.bookmarked = !!bookmarked;
    if (note !== undefined) {
      const t = String(note).trim().slice(0, 300);
      patch.bookmarkNote = t || admin.firestore.FieldValue.delete();
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    const ref = db().collection(PAGES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such page' });
    await ref.set(patch, { merge: true });
    res.json({ ok: true, id, bookmarked: patch.bookmarked, note });
  } catch (err) { fail(res, err); }
});

// THE REVIEW STAMPS — "not a review" and "I'm finished with this one" (Aug
// 2026, Sophie: "get rid of the X on all of the icons and instead offer a skip
// or done button in the piles area"). Both live on the PAGE doc, which this
// module owns and review.js only reads, and both are set from INSIDE the deck
// — that is why the route is here rather than on /api/review: the deck already
// posts its verdicts to this router, so it is reachable under exactly the same
// gate as the answers it is saving.
//   hidden — skip: never a review (a demo, a browse deck). Reversible from the
//            queue's hidden pile; nothing is ever deleted.
//   done   — finished, whatever the cards still say. The queue derives DONE
//            from the counts as well, so this only ever adds a way to say it.
router.post('/page/:id/review', async (req, res) => {
  try {
    const id = String(req.params.id || '').slice(0, 60);
    if (!id) return res.status(400).json({ error: 'id required' });
    const { hidden, done } = req.body || {};
    const patch = {};
    if (hidden !== undefined) patch.reviewHidden = !!hidden;
    if (done !== undefined) patch.reviewDone = !!done;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    const ref = db().collection(PAGES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such page' });
    await ref.set(patch, { merge: true });
    // …AND THIS IS THE "UNTIL I REVIEW" HALF (Aug 2026 — the `to be reviewed`
    // rule; see POST /notif-seen). She dismissed the chat's card from the
    // Update tab on the promise that the work was waiting in the queue; done
    // or skipped, she has now been through it, so the chat may sit on her
    // account list again. Best-effort and never fatal — the stamp it clears
    // only hides a chat from a list, and failing the review write over it
    // would lose the answer she actually came here to give.
    // The existence check is not paranoia: `set(…, merge)` on a MISSING doc
    // creates it, every pile derives from the registry's keys, and a page whose
    // chat has been merged away would put a phantom row in her list that only
    // the Admin SDK can remove. That has happened here before.
    const chat = doc.get('chat');
    if (chat) {
      await regRef(chat).get().then((reg) => (reg.exists
        ? regRef(chat).set({ reviewHoldAt: admin.firestore.FieldValue.delete() }, { merge: true })
        : null)).catch(() => {});
    }
    res.json({ ok: true, id, ...patch });
  } catch (err) { fail(res, err); }
});

// Put a page ON the reference shelf, or take it off (see the REFERENCE SHELF
// note above POST /page). Same field-for-field contract as the bookmark route
// beside it: `topic` sent alone edits ONLY the topic, so renaming what a page
// files under can never quietly take it off the shelf. `topic:''` clears the
// topic; `reference:false` takes the page off and leaves the topic alone, so
// putting it back keeps what it was filed under.
router.post('/page/:id/reference', async (req, res) => {
  try {
    const id = String(req.params.id || '').slice(0, 60);
    if (!id) return res.status(400).json({ error: 'id required' });
    const { reference, topic } = req.body || {};
    const patch = {};
    if (reference !== undefined) patch.reference = !!reference;
    if (topic !== undefined) {
      const t = refTopic(topic);
      patch.refTopic = t || admin.firestore.FieldValue.delete();
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    const ref = db().collection(PAGES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such page' });
    await ref.set(patch, { merge: true });
    res.json({ ok: true, id, reference: patch.reference, topic: refTopic(topic) });
  } catch (err) { fail(res, err); }
});

// THE SHELF ITSELF — every reference page across every chat, newest first.
// READ THIS BEFORE BUILDING A COMPARISON that sounds like one somebody has
// already made and paid for (quality ladders, style sets, LoRA scale rungs):
// pointing Sophie at the page that exists costs nothing, and re-rendering it
// costs her money and her attention.
// ONE equality filter, sorted in memory — no composite index, the same
// discipline as /bookmarks and the crystals/audio queries. `topics` comes back
// alongside so a caller can see what the shelf is organised by without
// paging it.
router.get('/references', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const want = refTopic(req.query.topic);
    const snap = await db().collection(PAGES).where('reference', '==', true).limit(500).get();
    let pages = snap.docs.map((d) => {
      const p = d.data() || {};
      return {
        id: d.id,
        chat: p.chat || '',
        title: String(p.title || ''),
        topic: p.refTopic || '',
        created: p.created || '',
        superseded: !!p.superseded,
        url: `/api/chatfeed/page/${d.id}`,
      };
    }).sort((a, b) => (a.created < b.created ? 1 : -1));
    const topics = Array.from(new Set(pages.map((p) => p.topic).filter(Boolean))).sort();
    if (want) pages = pages.filter((p) => p.topic === want);
    res.json({ pages, topics });
  } catch (err) { fail(res, err); }
});

// The Status view's "new pages" strip — the newest Compare pages across every
// chat, one query. Single-field orderBy on `created`, so no composite index.
router.get('/pages-recent', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const snap = await db().collection(PAGES).orderBy('created', 'desc').limit(limit).get();
    const pages = snap.docs.map((d) => ({
      id: d.id, title: d.data().title, chat: d.data().chat || '', created: d.data().created,
    }));
    res.json({ pages });
  } catch (err) { fail(res, err); }
});

// The shared autoscroll pill, appended to every served page so Compare pages
// scroll hands-free like the rest of the app. Self-contained snippet built by
// scripts/gen-pill-inject.py (re-run it after changing scripts/pill.py).
// Exported: server.js appends the SAME snippet to gated static pages that opt
// in (serveGated(file, { pill:true }) — e.g. /editor), so the pill is sourced
// from one place and never re-implemented per page.
let pillSnippet = null;
function pillInject() {
  if (pillSnippet === null) {
    try { pillSnippet = fs.readFileSync(path.join(__dirname, 'public', 'pill-inject.html'), 'utf8'); }
    catch (e) { pillSnippet = ''; }
  }
  return pillSnippet;
}

router.get('/page/:id', async (req, res) => {
  try {
    const snap = await db().collection(PAGES).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).send('Not found');
    const [buf] = await admin.storage().bucket().file(snap.data().path).download();
    if (snap.data().template) {
      // a TEMPLATE page stores its DATA; the chrome is rendered fresh by the
      // current stock renderer, so shared fixes reach every page ever posted
      let data = {};
      try { data = JSON.parse(buf.toString('utf8')); } catch (e) { /* renders empty */ }
      let thtml = pageTemplates.renderTemplatePage({
        template: snap.data().template, title: snap.data().title || '',
        // the page's own <h1> when it differs from the name the Compare tab
        // lists (an auto page drops its "Auto-compare — " prefix here)
        heading: snap.data().heading || '',
        chat: snap.data().chat || '', sheet: `page-${snap.id}`, data,
        // ?clean=1 — no h1, straight onto the cards (the Review Queue's door)
        clean: req.query.clean === '1',
      });
      if (req.query.embed !== '1') thtml += pillInject();
      res.set('Cache-Control', 'no-store');   // the renderer may improve under it
      return res.set('Content-Type', 'text/html; charset=utf-8').send(thtml);
    }
    let html = buf.toString('utf8');
    // Inject the shared pill for direct/browser viewing. Skip it when embedded
    // in the app's Compare viewer (?embed=1): iOS renders position:fixed badly
    // inside an iframe, so the parent page supplies a pill that scrolls this one.
    if (req.query.embed !== '1' && !html.includes('id="vtop"')) html += pillInject();
    // a page id's content never changes (replacing = delete + re-post under a
    // new id), so short-cache reopens for snappy back-and-forth
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { fail(res, err); }
});

router.delete('/page/:id', async (req, res) => {
  try {
    const ref = db().collection(PAGES).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    await admin.storage().bucket().file(snap.data().path).delete().catch(() => {});
    await ref.delete();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// Set a chat's one-line "what this is" — shown on its tile so the Chats grid
// reads like a project directory. Sophie sets it in the app; a chat can also
// set its own. Stored on the registry doc next to the icon.
router.post('/about', async (req, res) => {
  try {
    const { chat, about } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    await regRef(chat)
      .set({ about: String(about || '').slice(0, 140) }, { merge: true });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// Give a chat a custom display name shown in the app. Purely cosmetic — the
// underlying `chat` key (branch-derived) is unchanged, so every reply still
// groups into the same chat; only the label Sophie sees changes. Empty name
// clears it (falls back to the chat key). Stored on the registry doc.
// What Sophie has named this chat. The rename in the Chats app (the pencil in
// the thread header) is the SOURCE OF TRUTH for a chat's name — the Claude app's
// own session title is not readable from anywhere and cannot be synced, so a
// chat asks here instead of guessing from its git branch. Returns the slug's
// displayName when she has set one, else null (the slug is then the name).
router.get('/name', async (req, res) => {
  try {
    let chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    res.set('Cache-Control', 'no-store');
    // Pass &session=<id> to resolve session-first — a chat asking "what am I
    // called?" then gets its EFFECTIVE slug (fork, re-bound thread, or merge
    // target) along with Sophie's display name, not the raw branch slug.
    const session = String(req.query.session || '').slice(0, 120);
    chat = session ? await resolveChat(chat, session) : await followMoves(chat);
    const snap = await regRef(chat).get();
    const d = snap.exists ? snap.data() : {};
    res.json({ chat, displayName: d.displayName || null, name: d.displayName || chat });
  } catch (err) { fail(res, err); }
});

router.post('/rename', async (req, res) => {
  try {
    const { chat, name } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const val = String(name || '').trim().slice(0, 60);
    await regRef(chat)
      .set({ displayName: val || admin.firestore.FieldValue.delete() }, { merge: true });
    res.json({ ok: true, displayName: val || null });
  } catch (err) { fail(res, err); }
});

// Render a message in the polished neural voice (same onyx-British read as
// the Writing Room's Listen button). Result is cached on the message doc as
// audioUrl, so each message costs at most one render (~1¢).
const polishJobs = new Set();
router.post('/polish', async (req, res) => {
  try {
    const id = String((req.body || {}).id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'openai not configured' });
    const ref = db().collection(MSGS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown message' });
    const data = doc.data();
    if (data.audioUrl) return res.json({ ok: true, url: data.audioUrl, cached: true });
    if (polishJobs.has(id)) return res.json({ ok: false, rendering: true });
    polishJobs.add(id);
    try {
      // verbatim, lightly adapted for listening: drop URLs and markdown marks
      const text = String(data.text || '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[*#`_]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 16000);
      if (!text) return res.status(400).json({ error: 'nothing to read' });
      const sentences = text.replace(/\n+/g, ' ').match(/[^.!?…]+[.!?…]+["”']?\s*/g) || [text];
      const chunks = []; let cur = '';
      for (const s of sentences) {
        if (cur && (cur + s).length > 3200) { chunks.push(cur.trim()); cur = ''; }
        cur += s;
      }
      if (cur.trim()) chunks.push(cur.trim());
      const bufs = [];
      for (const chunk of chunks) {
        const r = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini-tts', voice: 'onyx', input: chunk,
            instructions: 'Read warmly and naturally in a British accent, conversational and unhurried.',
          }),
        });
        if (!r.ok) throw new Error('tts: ' + r.status + ' ' + (await r.text()).slice(0, 150));
        bufs.push(Buffer.from(await r.arrayBuffer()));
      }
      let out;
      if (bufs.length === 1) out = bufs[0];
      else {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'polish-'));
        const files = bufs.map((b, i) => {
          const f = path.join(tmp, `c${i}.mp3`); fs.writeFileSync(f, b); return f;
        });
        const listFile = path.join(tmp, 'list.txt');
        fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'));
        const mp3 = path.join(tmp, 'out.mp3');
        const ffmpeg = require('ffmpeg-static');
        await new Promise((resolve, reject) => {
          const p = spawn(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', mp3]);
          let err = ''; p.stderr.on('data', (c) => err += c);
          p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-200)))));
        });
        out = fs.readFileSync(mp3);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      const bucket = admin.storage().bucket();
      const dest = bucket.file(`chat-feed/polish/${id}.mp3`);
      await dest.save(out, { contentType: 'audio/mpeg', resumable: false });
      await dest.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${dest.name}`;
      await ref.set({ audioUrl: url }, { merge: true });
      res.json({ ok: true, url });
    } finally { polishJobs.delete(id); }
  } catch (err) { fail(res, err); }
});

router.post('/reply', async (req, res) => {
  try {
    // Sophie's SIDE of a thread is her real conversation: the app's reply box
    // and the hook lifting her messages out of the transcript. Notes typed
    // inside a Compare page are NOT messages (Aug 2026: two pages' note boxes
    // posted her notes into the thread as if she'd said them there) — so a
    // /reply fired from inside a served page is REROUTED, not refused: the
    // note lands on the page's verdict doc (sheet `page-<id>`, readable via
    // GET /verdict) where the page's chat picks it up, the thread stays
    // clean, and nothing she typed is ever dropped. New pages should post to
    // /api/chatfeed/verdict directly.
    const { chat, text, created, session, explicit } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const pageRef = String(req.get('referer') || '').match(/\/api\/chatfeed\/page\/([A-Za-z0-9_-]+)/);
    if (pageRef) {
      const sheet = 'page-' + pageRef[1];
      const id = `${String(chat).slice(0, 80)}__${sheet}`;
      await db().collection('forge-chat-verdicts').doc(id).set({
        chat: String(chat).slice(0, 60),
        sheet,
        texts: { ['note-' + Date.now()]: String(text).slice(0, 2000) },
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return res.json({ ok: true, keptOnPage: true });
    }
    // `created` = when she actually sent it (the hook passes the transcript's
    // timestamp for her own messages, so hers sorts ABOVE the reply it
    // prompted). Ignored unless it parses and isn't in the future.
    let at = new Date().toISOString();
    if (created) {
      const t = new Date(created).getTime();
      if (!isNaN(t) && t <= Date.now() + 60000) at = new Date(t).toISOString();
    }
    // Same session-first routing as the feed: the hook sends `session` with
    // her lifted messages so they land in the SAME chat as the reply they
    // prompted, even if the hook's cached slug is stale. The app's reply box
    // sends no session — that targets the slug she's looking at (tombstones
    // still redirect a merged chat's slug to the surviving thread).
    const her = explicit
      ? await followMoves(chat)
      : await resolveChat(chat, String(session || '').slice(0, 120));
    const doc = {
      chat: String(her).slice(0, 60),
      text: String(text).slice(0, 8000),
      from: 'sophie',
      created: at,
      // when the doc was WRITTEN — the delta poll needs a monotonic field,
      // because `created` here is her real send time and runs behind the reply.
      postedAt: new Date().toISOString(),
    };
    const ref = await db().collection(MSGS).add(doc);
    // ANSWERING A CHAT PARKS IT (Aug 2026, Sophie: "is there any way you could
    // directly send a chat that I answered to the hidden section until it comes
    // back?"). `hiddenAt` is a self-clearing stamp, so this needs no new field
    // and no new rule: the chat leaves the list now and the stamp's own
    // comparison brings it back the moment the reply lands.
    //
    // This REPLACES the rose working tint, which is off — the two defeat each
    // other (a chat that parks itself is off the list, so there is nothing left
    // to tint) and the tint could not be made honest: it needs the hook's
    // turn-start ping, which only sessions started since the setup script was
    // re-pasted ever send. Parking rides on HER MESSAGE arriving instead, which
    // is what this route already is — and when a chat's hook is too old to post
    // it, parking just doesn't happen, which is the plain list rather than a
    // wrong signal. `workingAt` is still stamped: the Status view reads it, and
    // it costs nothing.
    //
    // The stamp is `postedAt`, never her message's `created` — `created` is her
    // real send time and a stamp older than the newest message reads as
    // not-hidden, i.e. it would park nothing.
    //
    // MESSAGING AN ARCHIVED CHAT TAKES IT OUT OF THE ARCHIVE (Aug 2026,
    // Sophie: "when I message a chat that I archived, can it automatically
    // come out of the archive"). Archive means "away for good" — and going
    // back to talk to it is her saying it isn't, so the app should not make
    // her undo the archive by hand first. It is written HERE rather than in
    // the page for the same reason parking is: this route is where her
    // message ARRIVES, including the one the hook lifts out of the Claude app
    // with no page open anywhere.
    // Only HER message does it. A chat's own reply must never drag itself
    // back out of the archive she put it in — that is the whole difference
    // between Archive and the self-clearing `hiddenAt` stamp, and /reply is
    // hers by definition (`from:'sophie'`).
    //
    // ANSWERING A CHAT ALSO CLEARS ITS UPDATE CARD (Aug 2026, Sophie: "we made
    // it so that opening messages on the update tab doesn't get rid of the
    // notification. Is it possible to make it so that if I actually replied to
    // the message that does get rid of the notification"). The ✓ stays the
    // deliberate way to clear one, and OPENING a chat still clears nothing —
    // that is the whole point of the pin's removal. Replying is the third
    // thing, and it is not a weaker version of opening: she has dealt with the
    // news, in the chat, in her own words.
    //
    // It costs no new field and no new rule, because `notifSeenAt` is a
    // self-clearing STAMP compared against the newest arrival: everything that
    // existed when she wrote goes quiet, and the reply her message prompts is
    // newer, so the card comes straight back carrying it. Her oven example
    // holds either way — answering the v5 chat cannot silence v6.
    //
    // WHY HERE AND NOT IN /working: that ping fires from UserPromptSubmit for
    // ANY turn, and since hook v14 a turn started by a background event (a wake
    // event, a task notification) is still a turn. Machinery would silently
    // clear cards she never saw. /reply is her words by definition
    // (`from:'sophie'`, `her_words` in the hook), which is exactly the
    // difference she asked for.
    //
    // The stamp is `postedAt` (now), never her message's `created` — same
    // reason parking uses it: `created` is her real send time and can sit
    // behind the news it is answering.
    //
    // HER MESSAGE IS WHAT ARMS THE PUSH (Aug 2026 — see push-gate.js). This
    // route is both doors: the hook lifting her words out of the Claude app,
    // and the Chats app's own reply box. `lastHerAt` is her REAL send time
    // (`doc.created`), never `postedAt` — an old hook lifts her message
    // minutes late, and stamping the lift time would make the reply she is
    // waiting for look like it predates her.
    // …AND IT ENDS A REVIEW HOLD (Aug 2026 — the `to be reviewed` rule; see
    // POST /notif-seen). "Until i review or respond": this is respond, in her
    // own words, in the chat. The chat goes back to behaving like any other
    // filed chat, so the next thing it delivers pops it onto her list again.
    const patch = {
      workingAt: doc.postedAt, hiddenAt: doc.postedAt, notifSeenAt: doc.postedAt,
      lastHerAt: doc.created,
      reviewHoldAt: admin.firestore.FieldValue.delete(),
    };
    const wasArch = (await regRef(doc.chat).get()).get('archived');
    if (wasArch) patch.archived = false;
    await regRef(doc.chat).set(patch, { merge: true });
    // The stamp rides the answer so the PAGE can mirror it: the app's reply
    // box clears the chat's Update card the moment Send lands, instead of
    // waiting out the next registry poll (up to 20s — long enough that the
    // clear read as broken; Sophie, 2026-08-19: "if I actually send a message
    // back to a chat then it disappears from the update tab").
    res.json({ ok: true, id: ref.id, unarchived: !!wasArch, notifSeenAt: doc.postedAt });
  } catch (err) { fail(res, err); }
});

// ─── Voice notes on a template page's card (Aug 2026, Sophie) ───────────────
// The deck template's mic: she taps to record on a card, taps again to stop,
// and the note lands ON that card — audio in Storage, transcript appended to
// the card's verdict-note thread as her message (same `— me:` markers the
// note kit paints), so the chat reads it exactly where typed notes live.
// Transcription is gpt-4o-mini-transcribe (the audio model — mechanical
// extraction, allowed): best-effort, a failed transcription never loses the
// recording. The client mirrors to the Assets thread itself when the card is
// an asset (same one-way mirror as typed notes).
router.post('/page-voice', express.json({ limit: '8mb' }), async (req, res) => {
  try {
    const { chat, sheet, item, audio } = req.body || {};
    if (!chat || !sheet || !item) return res.status(400).json({ error: 'chat, sheet and item required' });
    const m = /^data:(audio\/[\w.+-]+);base64,(.+)$/.exec(String(audio || ''));
    if (!m) return res.status(400).json({ error: 'audio must be a data:audio/… URL' });
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return res.status(400).json({ error: 'empty recording' });
    const ext = m[1].includes('mp4') ? 'm4a' : m[1].split('/')[1].split(';')[0];
    const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const bucket = admin.storage().bucket();
    const file = bucket.file(`page-voice/${safe(sheet)}/${safe(item)}-${Date.now()}.${ext}`);
    await file.save(buf, { contentType: m[1].split(';')[0], resumable: false });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    let transcript = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const form = new FormData();
        form.append('file', new Blob([buf], { type: m[1].split(';')[0] }), `note.${ext}`);
        form.append('model', 'gpt-4o-mini-transcribe');
        // globalThis.fetch: the module-level `fetch` is node-fetch v2, which
        // cannot send a web FormData/Blob (writing.js posts the same way)
        const r = await globalThis.fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        });
        const t = await r.json();
        if (t && t.text) transcript = String(t.text).trim().slice(0, 1500);
      } catch (err) { console.error('page-voice transcription failed:', err.message); }
    }
    // append onto the card's note thread — never replace what's there
    const vdb = admin.firestore();
    const vid = `${String(chat).slice(0, 80)}__${String(sheet).slice(0, 80)}`;
    const vref = vdb.collection('forge-chat-verdicts').doc(vid);
    const cur = ((await vref.get()).data() || {});
    const prev = (cur.texts || {})[String(item)] || '';
    const line = `— me: ${transcript || '(voice note)'} (voice: ${url})`;
    const text = (prev ? `${prev}\n\n` : '') + line;
    await vref.set({ chat, sheet, updatedAt: new Date().toISOString(),
      texts: { [String(item)]: text.slice(0, 2000) } }, { merge: true });
    res.json({ ok: true, url, transcript, text: text.slice(0, 2000) });
  } catch (err) { fail(res, err); }
});

// ─── Hands-free voice: one recording, split across the cards she swiped ─────
// (Aug 2026 — built the day her in-app mic probe passed.) The deck keeps ONE
// recording running while she swipes and logs when each card came up; this
// route transcribes the whole thing with whisper-1 (verbose_json — its
// segments carry start times, which gpt-4o-mini-transcribe does not return)
// and lands each sentence on the card that was showing when the sentence
// STARTED (assignVoiceSegments in page-templates.js — the tested half).
// Every card's text is appended to its note thread with the recording's url
// and that card's timestamp, so she can always hear the original. Without an
// OPENAI key the recording still saves — filed whole onto the first card
// rather than lost. ~0.6c/min.
router.post('/page-voice-session', express.json({ limit: '40mb' }), async (req, res) => {
  try {
    const { chat, sheet, timeline, audio } = req.body || {};
    if (!chat || !sheet) return res.status(400).json({ error: 'chat and sheet required' });
    if (!Array.isArray(timeline) || !timeline.length) {
      return res.status(400).json({ error: 'timeline required: [{item, at}] ms offsets' });
    }
    const m = /^data:(audio\/[\w.+-]+);base64,(.+)$/.exec(String(audio || ''));
    if (!m) return res.status(400).json({ error: 'audio must be a data:audio/… URL' });
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return res.status(400).json({ error: 'empty recording' });
    const ext = m[1].includes('mp4') ? 'm4a' : m[1].split('/')[1].split(';')[0];
    const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const bucket = admin.storage().bucket();
    const file = bucket.file(`page-voice/${safe(sheet)}/session-${Date.now()}.${ext}`);
    await file.save(buf, { contentType: m[1].split(';')[0], resumable: false });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    let perCard = {};
    if (process.env.OPENAI_API_KEY) {
      try {
        const form = new FormData();
        form.append('file', new Blob([buf], { type: m[1].split(';')[0] }), `session.${ext}`);
        form.append('model', 'whisper-1');
        form.append('response_format', 'verbose_json');
        const r = await globalThis.fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        });
        const t = await r.json();
        perCard = pageTemplates.assignVoiceSegments(t.segments || [], timeline);
      } catch (err) { console.error('voice-session transcription failed:', err.message); }
    }
    if (!Object.keys(perCard).length) {
      // untranscribed (no key / whisper down / silence): the recording is
      // still hers — file it whole on the first card rather than lose it
      perCard = { [String(timeline[0].item)]: '(voice session, untranscribed)' };
    }
    const vdb = admin.firestore();
    const vid = `${String(chat).slice(0, 80)}__${String(sheet).slice(0, 80)}`;
    const vref = vdb.collection('forge-chat-verdicts').doc(vid);
    const cur = ((await vref.get()).data() || {});
    const texts = {};
    const tl = timeline.map((e) => ({ item: String(e.item), at: Number(e.at) || 0 }))
      .sort((a, b) => a.at - b.at);
    const stampOf = (item) => {
      const e = tl.find((x) => x.item === item);
      const s = Math.max(0, Math.round((e ? e.at : 0) / 1000));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    for (const [item, said] of Object.entries(perCard)) {
      const prev = (cur.texts || {})[item] || '';
      const line = `— me: ${said} (voice @${stampOf(item)}: ${url})`;
      texts[item] = ((prev ? `${prev}\n\n` : '') + line).slice(0, 2000);
    }
    await vref.set({ chat, sheet, updatedAt: new Date().toISOString(), texts }, { merge: true });
    res.json({ ok: true, url, perCard, texts });
  } catch (err) { fail(res, err); }
});

// ─── Verdicts on a Compare page ─────────────────────────────────────────────
// Check pages need a yes/no per item that survives the tab closing, so the chat
// can read back what she decided instead of asking her to recite it.
//   POST /api/chatfeed/verdict { chat, sheet, item, ok }
//   GET  /api/chatfeed/verdict?chat=&sheet=
// The page-doc lookup behind the rule above. Cached for a minute: a swipe
// through thirty cards is thirty taps on ONE page, and its map never changes
// (a new version is a new page, always).
const pageMapCache = new Map();
require('./memwatch').gauge('chatPageMapCache', () => pageMapCache.size);
async function pageArchiveMap(sheet) {
  const m = /^page-(.+)$/.exec(sheet || '');
  if (!m) return null;
  const pid = m[1];
  const hit = pageMapCache.get(pid);
  if (hit && Date.now() - hit.at < 60000) return hit.map;
  const snap = await db().collection(PAGES).doc(pid).get();
  const d = snap.exists ? snap.data() : {};
  const map = d.applyArchive && d.archiveMap ? d.archiveMap : null;
  pageMapCache.set(pid, { map, at: Date.now() });
  return map;
}

/**
 * Her mark on one card of an archive-review deck → the chat archived or taken
 * back out. Returns `{chat, archived}` when it acted, else null.
 *
 * 'archive' puts it away; ANY other verdict (her Keep, or clearing the mark)
 * takes it back out — so the chip is a true toggle and a mis-tap costs one
 * more tap, which is the whole reason this is safe to fire from a card.
 */
/**
 * Should this verdict move a chat, and which way? null = leave it alone.
 *
 * CLEARING A MARK IS NOT AN ANSWER (Aug 2026). In browse mode judge.js turns a
 * second tap on the LIT chip into `ok:null` — "no verdict" — and reading that
 * as "not archive" made a card's own undo tap quietly pull a chat back out of
 * the archive. Undecided and Keep are different things: only an explicit
 * verdict moves a chat, in either direction, and Keep is on the card saying
 * exactly what it does.
 *
 * Pure, and exported for the test — this is the whole decision.
 */
function archiveActionFor(ok) {
  if (ok === null || ok === undefined) return null;
  return ok === 'archive';
}

async function applyPageVerdict(sheet, item, ok) {
  const on = archiveActionFor(ok);
  if (on === null) return null;
  const map = await pageArchiveMap(sheet);
  const chat = map && map[item];
  if (!chat) return null;
  await setArchived(chat, on);
  return { chat, archived: on };
}

router.post('/verdict', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const { chat, sheet, item, ok, text } = req.body || {};
    if (!chat || !sheet || item === undefined) return res.status(400).json({ error: 'chat, sheet and item are required' });
    const db = admin.firestore();
    const id = `${String(chat).slice(0, 80)}__${String(sheet).slice(0, 80)}`;
    const patch = { chat, sheet, updatedAt: new Date().toISOString() };
    // a vote and a dictation are separate fields so writing one never clears the other.
    // Booleans stay booleans (♥/✕ and every older vote page). A SHORT STRING
    // rides through unchanged for the judge template's piles ('maybe' /
    // 'later' — judge.js, Aug 2026); anything else coerces to boolean as before.
    if (ok !== undefined) {
      patch.items = {
        [String(item)]: ok === null ? null
          : typeof ok === 'string' ? String(ok).slice(0, 24) : !!ok,
      };
    }
    if (text !== undefined) patch.texts = { [String(item)]: String(text || '').slice(0, 2000) };
    await db.collection('forge-chat-verdicts').doc(id).set(patch, { merge: true });
    // A VERDICT THAT ACTUALLY DOES THE THING (Aug 2026, Sophie: she marked
    // eleven cards "Archive", told the chat "I archived all of them", and not
    // one was archived — the chip filed an opinion while wearing the name of
    // an action. Now the word means what it says.)
    //
    // Only ever on a page that OPTED IN at post time (`applyArchive`), only
    // for the chat that page's own map names for this card, and only from her
    // tap. It stays inside the verdict route rather than becoming a general
    // "run this on tap" hook: archiving is one reversible, visible act, and
    // that is what makes it safe to fire from a card.
    let archived = null;
    if (ok !== undefined) {
      try { archived = await applyPageVerdict(String(sheet), String(item), ok); }
      catch (e) { /* her mark is saved either way — never fail the tap */ }
    }
    res.json({ ok: true, archived });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
router.get('/verdict', async (req, res) => {
  try {
    const { chat, sheet } = req.query || {};
    if (!chat || !sheet) return res.status(400).json({ error: 'chat and sheet are required' });
    const id = `${String(chat).slice(0, 80)}__${String(sheet).slice(0, 80)}`;
    const doc = await admin.firestore().collection('forge-chat-verdicts').doc(id).get();
    const d = doc.exists ? doc.data() : {};
    res.json({ ok: true, items: d.items || {}, texts: d.texts || {} });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// The wake-up doorbell (Aug 2026): message a chat from the app and it actually
// wakes. Routes live in chat-wake.js; it shares this router, the registry
// cache and the session-first resolution so a wake can never target a chat the
// feed itself wouldn't. Full design: docs/chats-wake-doorbell.md.
require('./chat-wake').mount(router, { db, regRef, registry, followMoves, resolveChat });

// compileQuery/queryMatches/snippetAnchor are exported for the search tests —
// they are pure, so the grammar is testable without Firestore or a server.
// `registry` is exported so brief.js can read the SAME 5-minute cache the feed
// already keeps rather than opening a second one — two caches of one collection
// is how a stale answer gets served from whichever module happened to answer.
  // `regRef` is exported for chaticons.js — it is the ONE write path that
  // invalidates the registry cache, so a sweep must not reach the collection
  // around it.
module.exports = { router, regRef, pillInject, archiveActionFor, resolveChat, followMoves, compileQuery, queryMatches, snippetAnchor, registry, pickFilm,
  rankGroups, phraseRegex, phraseRank, bestPerChat,
  SEARCH_WHO, whoOf, whoParam, whoMatches,
  SEARCH_ARCH, archParam, archMatches, pickOne, pickNameRows, NAME_ROWS,
  autoComparePoke, runAutoCompare,
  TAGS, cleanLabels, labelsOf, labelPatch, applyLabels,
  PILE_SEEDS, REVIEW_LABEL, PIN_LABEL, pileList, isPile,
  WAIT_LABEL, WAIT_ASK, WAIT_PREFIX, WAIT_MAX, WAIT_MEMORY_MAX, waitReasons,
  BMK_TAGS, bookmarkMarks };
