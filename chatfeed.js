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
//   GET  /api/chatfeed/status?chat=&session= → the card + Sophie's pinned note
//   POST /api/chatfeed/chatnote  → { chat, note } — her pinned note (hers alone;
//                                  chats read it, only the app writes it)
//   GET  /api/chatfeed/search?q= → substring search across every message
//                                  (in-memory index): { results:[{chat,id,snippet,created,url}] }
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
    const truncated = Object.keys(perChat)
      .filter((c) => perChat[c] > (rank[c] < DEEPCHATS ? DEEP : TAIL));
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

router.get('/search', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [], chatMatches: [], indexed: searchIndex.length });
    await refreshSearchIndex();
    // Chats whose NAME matches the query — Sophie's display name first, the
    // slug as fallback — returned separately so the client can pin them at
    // the top of the results (her rule: searching a chat's name should find
    // the chat itself before any message-content hits).
    let chatMatches = [];
    try {
      const reg = await registry();
      const ql = q.toLowerCase();
      chatMatches = Object.keys(reg.chats || {})
        .map((slug) => ({ chat: slug, name: (reg.chats[slug].displayName || slug), lastSeen: reg.chats[slug].lastSeen || '' }))
        .filter((c) => c.name.toLowerCase().includes(ql) || c.chat.toLowerCase().includes(ql))
        .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
        .slice(0, 10)
        .map((c) => ({ chat: c.chat, name: c.name }));
    } catch (e) { /* name matches are a bonus; message search still answers */ }
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 80);
    // Word-aware match: anchor the query at a word start (\b) so "aries" no
    // longer matches inside "boundaries", while a prefix like "bound" still
    // finds "boundaries"/"boundary". Falls back to a plain substring match if
    // the query is all punctuation (regex would be empty).
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let re = null;
    try { re = /[a-z0-9]/i.test(q) ? new RegExp('\\b' + esc, 'i') : null; } catch (e) { re = null; }
    const matches = (s) => (re ? re.test(s) : s.toLowerCase().indexOf(q.toLowerCase()) !== -1);
    const findIn = (s) => (re ? s.search(re) : s.toLowerCase().indexOf(q.toLowerCase()));
    const hits = searchIndex.filter((m) => matches(m.chat + '\n' + m.tldr + '\n' + m.text));
    hits.sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
    const results = hits.slice(0, limit).map((m) => {
      // snippet centred on the match — prefer the body, else the tldr/chat name
      const src = m.text && findIn(m.text) > -1 ? m.text
        : (m.tldr && findIn(m.tldr) > -1 ? m.tldr : (m.text || m.tldr || ''));
      const i = findIn(src);
      let snip = src;
      if (i > -1) {
        const s = Math.max(0, i - 45);
        snip = (s > 0 ? '…' : '') + src.slice(s, i + q.length + 70).replace(/\s+/g, ' ')
          + (i + q.length + 70 < src.length ? '…' : '');
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

router.post('/', async (req, res) => {
  try {
    const { chat, title, text, audio, tldr, url, account, session, explicit, turn, working } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title || '').slice(0, 120),
      text: String(text).slice(0, 20000),
      tldr: String(tldr || '').slice(0, 1000),
      from: 'claude',
      created: new Date().toISOString(),
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
    let msgId;
    const turnKey = String(turn || '').slice(0, 120);
    if (turnKey) {
      msgId = 't' + crypto.createHash('sha1')
        .update((skey || doc.chat) + '|' + turnKey).digest('hex').slice(0, 28);
      const ref = db().collection(MSGS).doc(msgId);
      if (working) doc.working = true;
      const prev = await ref.get();
      if (prev.exists) {
        // keep the first write's `created` (it's what the unread dot keys on —
        // a draft pings once when it appears, never again as it grows/finishes)
        const patch = {
          chat: doc.chat, text: doc.text, tldr: doc.tldr, postedAt: doc.postedAt,
          working: working ? true : admin.firestore.FieldValue.delete(),
        };
        if (doc.url) patch.url = doc.url;
        if (doc.audioUrl) patch.audioUrl = doc.audioUrl;
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
    // A FINAL reply ends the turn: clear the turn-start mark the hook stamped
    // at UserPromptSubmit (see POST /working), so the app's pink tint drops
    // the moment the reply lands. A growing draft is still mid-turn.
    if (!working) reg.workingAt = admin.firestore.FieldValue.delete();
    await regRef(doc.chat).set(reg, { merge: true });
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
router.post('/archive', async (req, res) => {
  try {
    const { chat, archived } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    await regRef(chat)
      .set({ archived: archived !== false }, { merge: true });
    res.json({ ok: true, archived: archived !== false });
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
router.post('/pin', async (req, res) => {
  try {
    const { chat, session, title, url, kind } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const target = await resolveChat(chat, session);
    const del = admin.firestore.FieldValue.delete();
    const u = String(url || '').trim();
    if (u && !/^https:\/\//.test(u)) return res.status(400).json({ error: 'url must be https' });
    await regRef(target).set({
      pinned: u ? {
        url: u,
        title: String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        kind: kind === 'audio' ? 'audio' : 'video',
        at: new Date().toISOString(),
      } : del,
    }, { merge: true });
    res.json({ ok: true, chat: target, pinned: u || null });
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

router.get('/bookmarks', async (req, res) => {
  try {
    const snap = await db().collection(MSGS).where('bookmarked', '==', true).limit(500).get();
    const reg = await registry();
    const items = snap.docs.map((d) => {
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
    }).sort((a, b) => (a.created < b.created ? 1 : -1));   // newest first
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

router.post('/page', async (req, res) => {
  try {
    const { chat, title, html } = req.body || {};
    if (!chat || !title || !html) return res.status(400).json({ error: 'chat, title and html required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title).slice(0, 140),
      created: new Date().toISOString(),
    };
    const ref = db().collection(PAGES).doc();
    const bucket = admin.storage().bucket();
    const file = bucket.file(`chat-pages/${ref.id}.html`);
    await file.save(Buffer.from(String(html), 'utf8'), {
      contentType: 'text/html; charset=utf-8', resumable: false,
    });
    doc.path = file.name;
    await ref.set(doc);
    res.json({ ok: true, id: ref.id, url: `/api/chatfeed/page/${ref.id}` });
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
    await regRef(doc.chat).set({ workingAt: doc.postedAt, hiddenAt: doc.postedAt }, { merge: true });
    res.json({ ok: true, id: ref.id });
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

module.exports = { router, pillInject, resolveChat, followMoves };
