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
const { buildQuestions, answeredOnly } = require('./questions');
const { parseQuery } = require('./search-grammar');
const { shouldPushReply } = require('./push-gate');

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
  const sid = String(session || '').slice(0, 120);
  if (!chat || !sid) return chat;
  // 1) Session-first: this session already has a home → everything it posts
  //    goes there, no matter what slug it arrived under. This is what makes a
  //    chat's identity survive branch renames and naming-convention changes.
  const reg = await registry();
  const mine = Object.keys(reg.chats)
    .filter((s) => (reg.chats[s].sessionId || '') === sid && !reg.chats[s].movedTo);
  if (mine.length) {
    if (mine.includes(chat)) return chat;
    // duplicates only happen after registry surgery — pick deterministically
    mine.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    return mine[0];
  }
  // 2) First post from a new session: take the pretty name if it's unclaimed…
  const owner = (reg.chats[chat] || {}).sessionId || '';
  if (!owner) {
    await regRef(chat).set({ sessionId: sid }, { merge: true });
    return chat;
  }
  if (owner === sid) return chat;
  // 3) …else fork to a chat of its own. If even the fork slug is taken by yet
  //    another session (two ids sharing 6 leading chars), widen the tail.
  let tail = sidTail(sid) || 'x';
  let fork = (chat + '-' + tail).slice(0, 60);
  const fowner = (reg.chats[fork] || {}).sessionId || '';
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
    const val = String(sessionId || '').slice(0, 120);
    const chatId = String(chat).slice(0, 60);
    if (val) {
      const dupes = await db().collection(REG).where('sessionId', '==', val).get();
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
let searchIndex = [];        // [{chat, id, text, tldr, created, url}]
const searchSeen = new Set(); // doc ids already in the index
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
      searchIndex.push({ chat: m.chat || '', id: d.id, text: m.text || '', tldr: m.tldr || '', created: m.created || '', url: m.url || '' });
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
function snippetAnchor(src, groups) {
  let best = null;
  for (const g of groups) {
    if (g.neg) continue;
    for (const t of g.terms) {
      if (!t.re) continue;
      const found = src.match(t.re);
      if (!found) continue;
      const all = new RegExp(t.re.source, 'gi');
      let n = 0;
      while (all.exec(src) && n < 60) n++;
      if (!best || n < best.n) best = { i: src.search(t.re), len: found[0].length, n };
    }
  }
  return best;
}

router.get('/search', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [], chatMatches: [], indexed: searchIndex.length });
    await refreshSearchIndex();
    const groups = compileQuery(q);
    if (!groups.length) return res.json({ results: [], chatMatches: [], indexed: searchIndex.length });
    // Chats whose NAME matches the query — Sophie's display name first, the
    // slug as fallback — returned separately so the client can pin them at
    // the top of the results (her rule: searching a chat's name should find
    // the chat itself before any message-content hits).
    let chatMatches = [];
    try {
      const reg = await registry();
      chatMatches = Object.keys(reg.chats || {})
        .map((slug) => ({ chat: slug, name: (reg.chats[slug].displayName || slug), lastSeen: reg.chats[slug].lastSeen || '' }))
        .filter((c) => queryMatches(`${c.name}\n${c.chat}`, groups))
        .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
        .slice(0, 10)
        .map((c) => ({ chat: c.chat, name: c.name }));
    } catch (e) { /* name matches are a bonus; message search still answers */ }
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 80);
    // Every word she typed has to land in the SAME message — that is the whole
    // point — so the haystack is the one message, name and TLDR included.
    const hits = searchIndex.filter((m) => queryMatches(m.chat + '\n' + m.tldr + '\n' + m.text, groups));
    hits.sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
    const results = hits.slice(0, limit).map((m) => {
      // Snippet centred on the match — prefer the body, else the tldr/chat name.
      const inBody = m.text ? snippetAnchor(m.text, groups) : null;
      const src = inBody ? m.text : (m.tldr && snippetAnchor(m.tldr, groups) ? m.tldr : (m.text || m.tldr || ''));
      const at = inBody || snippetAnchor(src, groups);
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
    const gate = shouldPushReply({
      working,
      replyCreated: bornAt,
      lastHerAt: mine.lastHerAt,
      pushedAt: mine.pushedAt,
    });
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
          doc.tldr || (doc.text.split('\n').find((l) => l.trim()) || '').slice(0, 240),
          { debounce: false });
      } catch (e) { /* push must never fail a post */ }
    }
    res.json({ ok: true, id: msgId });
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
const wrapLineOf = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200);
const wrapTextOf = (s) => String(s || '').replace(/[ \t]+/g, ' ').trim().slice(0, 2000);

// Freeze whatever the chat already said about itself into a wrap-up. Returns
// the patch to merge, or null when there is nothing to freeze — never invents.
function frozenWrapUp(r) {
  if (!r || r.wrapUp || r.wrapLine) return null;          // already has one
  const asked = String(r.updAsked || '').trim();
  const did = String(r.updDid || '').trim();
  const doing = String(r.statusDoing || '').trim();
  if (!asked && !did && !doing) return null;
  const line = wrapLineOf(did || doing || asked);
  const full = wrapTextOf([
    asked && 'What you asked: ' + asked,
    did && 'What it did: ' + did,
    (!asked && !did && doing) && 'Was working on: ' + doing,
  ].filter(Boolean).join('\n\n'));
  return { wrapLine: line, wrapUp: full, wrapUpAt: new Date().toISOString(), wrapFrom: 'update-card' };
}

router.post('/archive', async (req, res) => {
  try {
    const { chat, archived } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = archived !== false;
    const ref = regRef(chat);
    const patch = { archived: on };
    // Only on the way IN. Taking a chat back out must not re-freeze anything,
    // and un-archiving is a gesture that should cost nothing.
    let froze = false;
    if (on) {
      const snap = await ref.get();
      const add = frozenWrapUp(snap.exists ? snap.data() : null);
      if (add) { Object.assign(patch, add); froze = true; }
    }
    await ref.set(patch, { merge: true });
    res.json({ ok: true, archived: on, wrapUp: froze });
  } catch (err) { fail(res, err); }
});

// A chat writes its OWN wrap-up — the good one, because it was there. Do this
// when work wraps up, not every turn: it is what Sophie reads months later to
// remember what a chat was. `line` is the one row line, `text` the full story.
// Sending only `text` derives the line from its first sentence.
router.post('/wrapup', async (req, res) => {
  try {
    const { chat, session, line, text, open } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const resolved = await resolveChat(chat, String(session || '').slice(0, 120));
    const full = wrapTextOf(text);
    const one = wrapLineOf(line || (full.split(/(?<=[.!?])\s/)[0] || full));
    const still = wrapLineOf(open);
    if (!one && !full) return res.status(400).json({ error: 'line or text required' });
    const del = admin.firestore.FieldValue.delete();
    await regRef(resolved).set({
      wrapLine: one || del,
      wrapUp: full || del,
      // What was still open when it stopped — the same field the Summarize
      // button fills. A chat that knows it left something hanging says so here.
      wrapOpen: still || del,
      wrapUpAt: new Date().toISOString(),
      wrapFrom: 'chat',
    }, { merge: true });
    res.json({ ok: true, chat: resolved, wrapLine: one, wrapUp: full, wrapOpen: still });
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

Return JSON: {"line": "...", "text": "...", "open": "..."}

"line": ONE line, under 120 characters, no trailing period. What this chat WAS — concrete and specific, naming the actual thing worked on. It is the only line she sees on the archive row.
"text": 2-5 short sentences. What she wanted, what actually got built or decided, and how it ended. Say plainly if it was abandoned, went nowhere, or was superseded — an honest dead end is more useful to her than a flattering summary.
"open": what was still unfinished or unanswered when it stopped, in one line — a question of hers nobody answered, a decision nobody made, work left half-done. Empty string when the chat genuinely ended settled. Never pad this to look thorough: a made-up loose end sends her back into a chat that had nothing left in it.

Plain past tense, no preamble, no markdown, no headings. Never invent a detail that is not in the transcript; if the material is thin, write less. Do not use the phrases "this chat", "we discussed", or "explored".`;

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
    const out = await anthropic.chatJSON({
      system: WRAP_SYS,
      user: 'Chat name: ' + (cur.displayName || target) + '\nMessages: ' + msgs.length
        + (unanswered.length
          ? '\n\nQuestions Sophie asked that nobody ever answered:\n' + unanswered.join('\n')
          : '\n\nEvery question she asked in here got a reply.')
        + '\n\n' + digest,
      maxTokens: 600,
    });
    const full = wrapTextOf(out && out.text);
    const one = wrapLineOf(out && out.line) || wrapLineOf(full.split(/(?<=[.!?])\s/)[0]);
    const open = wrapLineOf(out && out.open);
    if (!one && !full) return res.status(502).json({ error: 'no summary came back' });
    await regRef(target).set({
      wrapLine: one,
      wrapUp: full,
      // Cleared rather than left behind: a rewrite that finds nothing open must
      // not leave the last run's loose end sitting under the summary.
      wrapOpen: open || admin.firestore.FieldValue.delete(),
      wrapUpAt: new Date().toISOString(),
      wrapFrom: 'claude',
    }, { merge: true });
    res.json({ ok: true, chat: target, wrapLine: one, wrapUp: full, wrapOpen: open,
      messages: msgs.length, unanswered: unanswered.length });
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
router.post('/notif-seen', async (req, res) => {
  try {
    const { chat, seen } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const on = seen !== false;
    const stamp = new Date().toISOString();
    await regRef(chat).set(
      { notifSeenAt: on ? stamp : admin.firestore.FieldValue.delete() },
      { merge: true },
    );
    res.json({ ok: true, notifSeenAt: on ? stamp : null });
  } catch (err) { fail(res, err); }
});

// (POST /news-pin lived here — the Update card's pin, a `newsPinned` boolean
// on the registry. Removed Aug 2026: an Update card is now kept until the ✓
// whatever happens, so the pin had nothing left to opt out of. Stale
// `newsPinned:true` fields may still sit on old registry docs; nothing reads
// them. Note for whoever adds the next route here — `pinned` and POST /pin
// are TAKEN by the pinned DELIVERABLE, the film at the top of a thread, which
// stores an OBJECT there; Express takes the first match, so a route named
// `pin` here would shadow it.)

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

// File chats under a category — the chips where the LIST/TILES toggle used to
// be (Aug 2026, Sophie: "category tags, the first two I can think of are
// stories and tech"). One field on the registry doc, so it rides the cached
// read the icons already use, exactly like the Dump's `track`.
//
// Takes ONE chat or a whole selection (`chats:[…]`), because filing is a bulk
// gesture there: she picks several rows in select mode and taps a category
// once. An empty category clears the field back to unfiled.
// A CATEGORY IS A THING, not just a side effect of filing (Aug 2026 — Sophie
// made one and it wasn't there: she typed a name in select mode with no chats
// picked, so nothing was written and the chip never existed). The name is now
// remembered on the `__settings` doc, so an EMPTY folder survives, and a
// request with no chats at all is valid — that is how a category gets created
// on its own.
router.post('/category', async (req, res) => {
  try {
    const body = req.body || {};
    const names = (Array.isArray(body.chats) ? body.chats : [body.chat])
      .filter(Boolean).map((c) => String(c).slice(0, 60)).slice(0, 200);
    const category = String(body.category || '').trim().slice(0, 40);
    if (!names.length && !category) return res.status(400).json({ error: 'chat or category required' });
    if (names.length) {
      const del = admin.firestore.FieldValue.delete();
      const val = category || del;
      // `filedAt` = the moment it went into the folder, so the app can tell a
      // reply that arrived AFTER filing from the one that was already sitting
      // there unread. Without it, filing a chat she hadn't opened would put it
      // straight back on the main list and read as filing not working. A chat
      // taken out of every folder loses the stamp with the category.
      const stamp = category ? new Date().toISOString() : del;
      const batch = db().batch();
      names.forEach((n) => batch.set(regRef(n), { category: val, filedAt: stamp }, { merge: true }));
      await batch.commit();
    }
    if (category) {
      await regRef(SETTINGS_DOC).set(
        { categories: admin.firestore.FieldValue.arrayUnion(category) }, { merge: true });
    }
    res.json({ ok: true, chats: names, category: category || null });
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
    const { id, bookmarked, note } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const patch = {};
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

router.post('/page', async (req, res) => {
  try {
    const { chat, title, html, reference, topic } = req.body || {};
    if (!chat || !title || !html) return res.status(400).json({ error: 'chat, title and html required' });
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
    // page and the reply that follows it in one turn are one buzz.
    try {
      const { chats } = await registry();
      const name = (chats[doc.chat] && chats[doc.chat].displayName) || doc.chat;
      require('./push').notifyChat(doc.chat, name, doc.title);
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
        superseded: !!d.data().superseded,
        bookmarked: !!d.data().bookmarked,
        bookmarkNote: d.data().bookmarkNote || '',
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
    const { bookmarked, note } = req.body || {};
    const patch = {};
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
    const patch = {
      workingAt: doc.postedAt, hiddenAt: doc.postedAt, notifSeenAt: doc.postedAt,
      lastHerAt: doc.created,
    };
    const wasArch = (await regRef(doc.chat).get()).get('archived');
    if (wasArch) patch.archived = false;
    await regRef(doc.chat).set(patch, { merge: true });
    res.json({ ok: true, id: ref.id, unarchived: !!wasArch });
  } catch (err) { fail(res, err); }
});

// ─── Verdicts on a Compare page ─────────────────────────────────────────────
// Check pages need a yes/no per item that survives the tab closing, so the chat
// can read back what she decided instead of asking her to recite it.
//   POST /api/chatfeed/verdict { chat, sheet, item, ok }
//   GET  /api/chatfeed/verdict?chat=&sheet=
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
    res.json({ ok: true });
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

// compileQuery/queryMatches/snippetAnchor are exported for the search tests —
// they are pure, so the grammar is testable without Firestore or a server.
module.exports = { router, pillInject, resolveChat, followMoves, compileQuery, queryMatches, snippetAnchor };
