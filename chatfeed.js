// Chat feed — "the Chat app": every project chat drops a copy of its replies
// here (standing CLAUDE.md rule), and Sophie reads/listens in one place in
// DeckFactory with a picture icon per chat. Content is live (Firestore);
// replies she leaves land as notes chats pick up on their hourly checks.
//
// Routes (x-studio-token gated like the rest):
//   GET  /api/chatfeed           → { chats:{name:{icon}}, messages:[...] } (newest first)
//   GET  /api/chatfeed?since=ISO → delta: only messages newer than ISO, for
//                                  polling (0-2 reads instead of 1500)
//   POST /api/chatfeed           → { chat, title?, text, audio? (url or data URL), tldr? }
//   POST /api/chatfeed/icon      → { chat, image (data URL) } — set a chat's picture
//   POST /api/chatfeed/reply     → { chat, text } — Sophie's reply (chats check hourly)
//   GET  /api/chatfeed/search?q= → substring search across every message
//                                  (in-memory index): { results:[{chat,id,snippet,created,url}] }
//   POST /api/chatfeed/answered  → { chat, answered } — mark a chat answered
//                                  (grayed until a newer message arrives)
//   POST /api/chatfeed/polish    → { id } — render the message in the polished
//                                  onyx-British neural voice (~1¢), cached forever
//   POST /api/chatfeed/page      → { chat, title, html } — publish a Compare page
//                                  (self-contained HTML shown in the chat's Compare tab)
//   GET  /api/chatfeed/pages?chat=name → list a chat's Compare pages
//   GET  /api/chatfeed/page/:id  → serve one (DELETE removes it)

const express = require('express');
const admin = require('firebase-admin');
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

async function registry() {
  if (regCache && Date.now() - regCacheAt < REG_TTL_MS) return regCache;
  const snap = await db().collection(REG).get();
  const chats = {};
  snap.docs.forEach((d) => { chats[d.id] = d.data(); });
  regCache = chats;
  regCacheAt = Date.now();
  return chats;
}
// Every registry WRITE goes through this, so the cache can never go stale.
function regRef(chat) {
  regCache = null;
  return db().collection(REG).doc(String(chat).slice(0, 60));
}

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
      const [dsnap, chats] = await Promise.all([
        db().collection(MSGS)
          .where('created', '>', since)
          .orderBy('created', 'desc')
          .limit(200)              // a burst backstop; a normal poll returns 0-2
          .get(),
        registry(),
      ]);
      const messages = dsnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // `delta:true` tells the client to MERGE rather than replace — it still
      // holds the trimmed tail and any full threads it has already pulled.
      return res.json({ chats, messages, truncated: [], delta: true });
    }

    const [msnap, chats] = await Promise.all([
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
    res.json({ chats, messages, truncated });
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
    if (q.length < 2) return res.json({ results: [], indexed: searchIndex.length });
    await refreshSearchIndex();
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
    res.json({ results, indexed: searchIndex.length });
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
    const { chat, title, text, audio, tldr, url } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      title: String(title || '').slice(0, 120),
      text: String(text).slice(0, 20000),
      tldr: String(tldr || '').slice(0, 1000),
      from: 'claude',
      created: new Date().toISOString(),
    };
    // "Open in Claude" deep link for this chat (claude.ai/code/session_…)
    if (url && /^https?:\/\//.test(url)) doc.url = String(url).slice(0, 400);
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
    const ref = await db().collection(MSGS).add(doc);
    const reg = { lastSeen: doc.created };
    if (doc.url) reg.url = doc.url; // keep the chat's deep link on its registry tile
    await regRef(doc.chat).set(reg, { merge: true });
    res.json({ ok: true, id: ref.id });
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

// Bookmark a message Sophie wants to find later — a flag on the message doc
// itself, so it rides along on GET / (every message already spreads its data)
// and any chat can read which of its messages she flagged.
router.post('/bookmark', async (req, res) => {
  try {
    const { id, bookmarked } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await db().collection(MSGS).doc(String(id)).set({ bookmarked: !!bookmarked }, { merge: true });
    res.json({ ok: true, bookmarked: !!bookmarked });
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
      .map((d) => ({ id: d.id, title: d.data().title, created: d.data().created }))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
    res.json({ pages });
  } catch (err) { fail(res, err); }
});

// The shared autoscroll pill, appended to every served page so Compare pages
// scroll hands-free like the rest of the app. Self-contained snippet built by
// scripts/gen-pill-inject.py (re-run it after changing scripts/pill.py).
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
    const { chat, text } = req.body || {};
    if (!chat || !text) return res.status(400).json({ error: 'chat and text required' });
    const doc = {
      chat: String(chat).slice(0, 60),
      text: String(text).slice(0, 8000),
      from: 'sophie',
      created: new Date().toISOString(),
    };
    const ref = await db().collection(MSGS).add(doc);
    res.json({ ok: true, id: ref.id });
  } catch (err) { fail(res, err); }
});

module.exports = { router };
