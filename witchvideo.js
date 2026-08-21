// witchvideo.js — the witch-video pipeline's review room. Theo's ideas go in,
// draft cuts come out, and Sophie's mom reviews them on her phone.
//
// The shape of the pipeline (docs/witch-video-pipeline.md is the map):
//   1. An IDEA is filed — Theo's pitch, pasted by whoever is holding it (her
//      mom from the review page, Sophie or a chat via the API).
//   2. The owning CHAT makes the stills and stitches a draft cut (480p, the
//      movies.js recipe — generation never happens in this module, so opening
//      or using this room can never spend money).
//   3. The chat POSTs the cut's Storage url here; the review page shows it at
//      the top of the reviewer's feed with a NEW dot (and emails her when
//      Brevo is configured — fruit.js's sender, same missing-key refusals).
//   4. She watches it. TAPPING THE VIDEO PAUSES IT and opens the note box —
//      she dictates what she wants different, and the note lands on the doc
//      stamped with the second she paused at. ♥ = approved, ✕ = another pass.
//   5. Every note/verdict RINGS THE WAKE DOORBELL for the owning chat
//      (chat-wake.ring — the switchboard design, one shared implementation),
//      so "the chat gets right on the issues" without her doing anything
//      else. Where account 1's switchboard isn't configured yet the note
//      still lands and the chat sweeps GET /inbox next time it's awake —
//      snail mail, never lost.
//   6. The nitty-gritty variant: the chat POSTs each STILLS batch and she
//      comments on the stills the same way, before animation money is spent.
//
// THE LINK IS THE IDENTITY (fruit.js's pattern, verbatim in spirit): each
// reviewer gets /witchvideo?who=<personId>, an unguessable random token, no
// login. Emails live only on the __reviewers doc and never leave the gated
// routes; every public read strips them.
//
// Firestore (deckfactory-43176): `forge-witch-videos` — one doc per video,
// plus the reserved `__reviewers` doc (ids starting `__` are never videos).
// History is kept, capped: cuts 12, stills batches 8, thread 300. Nothing the
// reviewer or a chat wrote is ever deleted by this module.
//
// Mounted at /api/witchvideo by server.js. Page: /witchvideo (PUBLIC — opened
// from a texted link by someone with no studio token; no iOS tile on purpose,
// same as /fruit and /desktop).
//
// Routes:
//   GET  /status                → { ok, firebase, brevo, sender }      (open)
//   GET  /feed?who=             → this reviewer's videos, newest first (open)
//   POST /note                  → { who, id, text, t?, still? }        (open, rate-limited)
//   POST /verdict               → { who, id, mark:'love'|'changes' }   (open, rate-limited)
//   POST /seen                  → { who, id } — clears the NEW dot     (open, rate-limited)
//   POST /idea                  → { who, title, pitch } from the page  (open, rate-limited)
//   GET  /list                  → every video + state                 (gated)
//   GET  /inbox?chat=           → what's waiting on that chat         (gated)
//   POST /video                 → file/patch an idea (chats)          (gated)
//   POST /cut                   → { id, url, seconds?, note? }        (gated)
//   POST /stills                → { id, items:[{url,label}], note? }  (gated)
//   POST /reviewers             → mint/keep reviewer links            (gated)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');

const VIDEOS = 'forge-witch-videos';
const REVIEWERS_DOC = '__reviewers';
const DEFAULT_CHAT = 'witch-video-pipeline';

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const SITE = process.env.FRUIT_SITE_ORIGIN || 'https://imageforge-q125.onrender.com';

const db = () => admin.firestore();

/* ── caps (history is kept, capped — the house rule) ───────────────────── */
const CUTS_MAX = 12;
const STILLS_BATCHES_MAX = 8;
const THREAD_MAX = 300;
const NOTE_MAX = 2000;          // over-length is REFUSED, never truncated
                                // (the Assets-tab note rule)

/* ── public-route rate limit (fruit.js's, verbatim in shape) ───────────── */
const RATE_MAX = 120;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
function limited(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  if (!rateLimited(ip)) return false;
  res.status(429).json({ error: 'too many requests — try again later' });
  return true;
}

const router = express.Router();

// Open paths: /status plus everything the texted link needs. The gate only
// bites when STUDIO_TOKEN is set at all; the who token is validated per
// handler, which is the real identity on the open routes.
function isOpen(req) {
  const p = req.path;
  return p === '/status' || p === '/feed' || p === '/note'
    || p === '/verdict' || p === '/seen' || p === '/idea';
}
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (isOpen(req)) return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

/* ── helpers ───────────────────────────────────────────────────────────── */
const token = () => crypto.randomBytes(6).toString('hex');
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const now = () => new Date().toISOString();

function reviewerLink(personId) {
  return `${SITE}/witchvideo?who=${encodeURIComponent(personId)}`;
}

// The one state table. A note or an ✕ puts the ball back with the chat; a cut
// puts it with the reviewer; ♥ closes it. Pure, exported for the tests.
function stateAfter(current, event, mark) {
  if (event === 'cut') return 'review';
  if (event === 'stills') return current === 'idea' ? 'working' : current;
  if (event === 'note') return current === 'approved' ? 'changes' : (current === 'idea' || current === 'working' ? current : 'changes');
  if (event === 'verdict') return mark === 'love' ? 'approved' : 'changes';
  return current;
}

// What a note POST is allowed to append. Over-length is refused whole — a
// silently truncated note reads as her trailing off mid-sentence. Pure.
function cleanNote(b) {
  const text = String(b && b.text != null ? b.text : '').trim();
  if (!text) return { error: 'text required' };
  if (text.length > NOTE_MAX) return { error: `note over ${NOTE_MAX} chars — trim it and resend` };
  const entry = { text, at: now() };
  const t = Number(b.t);
  if (Number.isFinite(t) && t >= 0) entry.t = Math.round(t * 10) / 10;
  if (b.still) entry.still = clip(b.still, 500);
  if (Number.isFinite(Number(b.cutV))) entry.cutV = Number(b.cutV);
  return { entry };
}

// A video is NEW to a reviewer while it has moved since they last opened it.
function isNew(video, personId) {
  const seen = (video.seenAt || {})[personId];
  if (!seen) return true;
  return String(video.updatedAt || '') > String(seen);
}

// The public shape — no emails anywhere near this (they live only on the
// __reviewers doc), internal fields dropped, newest cut resolved.
function publicVideo(id, d, personId) {
  const cuts = d.cuts || [];
  const cur = cuts.length ? cuts[cuts.length - 1] : null;
  return {
    id,
    title: d.title || 'Untitled',
    pitch: d.pitch || '',
    state: d.state || 'idea',
    from: d.from || '',
    updatedAt: d.updatedAt || d.createdAt || null,
    cut: cur ? { v: cur.v, url: cur.url, seconds: cur.seconds || null, note: cur.note || '', at: cur.at } : null,
    cutsCount: cuts.length,
    stills: (d.stills || []).map(s => ({
      batch: s.batch, at: s.at, note: s.note || '',
      items: (s.items || []).map(i => ({ url: i.url, label: i.label || '' })),
    })),
    thread: (d.thread || []).map(m => ({
      from: m.from, text: m.text, at: m.at,
      t: m.t != null ? m.t : null, still: m.still || null, cutV: m.cutV != null ? m.cutV : null,
    })),
    isNew: personId ? isNew(d, personId) : false,
  };
}

async function reviewers() {
  const snap = await db().collection(VIDEOS).doc(REVIEWERS_DOC).get();
  return snap.exists ? (snap.data().people || []) : [];
}
async function reviewerByToken(who) {
  if (!who) return null;
  return (await reviewers()).find(p => p.id === String(who)) || null;
}

// Ring the owning chat's wake doorbell — the ONE shared implementation
// (chat-wake.ring; the switchboard design). Best-effort: a note must land on
// the doc whether or not anything can be woken right now.
async function ringChat(chat) {
  try {
    const chatfeed = require('./chatfeed');
    const wake = require('./chat-wake');
    return await wake.ring({ db, registry: chatfeed.registry, followMoves: chatfeed.followMoves },
      chat || DEFAULT_CHAT);
  } catch (err) {
    return { ok: false, status: 'ring-failed', error: String(err.message || err).slice(0, 200) };
  }
}

/* ── the "new cut" email (fruit.js's Brevo sender, same refusals) ──────── */
function buildCutEmail({ toName, link, title }) {
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return {
    subject: `New witch video: ${title || 'a fresh cut'}`,
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f7f3ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf9;border:1px solid #e5ddd0;border-radius:6px;padding:28px 26px;">
<tr><td style="font-family:Georgia,'Times New Roman',serif;">
<p style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#2b2622;">${esc(title || 'A new witch video')}</p>
${toName ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2622;">${esc(toName)}, a fresh cut is ready to watch.</p>` : ''}
<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2622;">Tap the button, press play, and tap the video any time to pause and say what you'd change — it comes straight back to the studio.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
<tr><td style="background:#2b2622;border-radius:6px;">
<a href="${esc(link)}" style="display:inline-block;padding:13px 22px;font-family:Georgia,serif;font-size:16px;color:#fffdf9;text-decoration:none;">Watch it</a>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a99e90;word-break:break-all;">${esc(link)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
  };
}

async function sendViaBrevo({ to, toName, subject, html }) {
  const key = process.env.BREVO_API_KEY || '';
  const from = process.env.BREVO_FROM_EMAIL || '';
  if (!key || !from) {
    const missing = [!key && 'BREVO_API_KEY', !from && 'BREVO_FROM_EMAIL'].filter(Boolean);
    throw new Error('not set on this server: ' + missing.join(' and '));
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: process.env.BREVO_FROM_NAME || 'Sophie' },
      to: [{ email: to, name: toName || undefined }],
      subject, htmlContent: html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Brevo error ${res.status}`);
  return data;
}

/* ── status ────────────────────────────────────────────────────────────── */
router.get('/status', (req, res) => {
  res.json({
    ok: true,
    firebase: Boolean(admin.apps.length),
    brevo: Boolean(process.env.BREVO_API_KEY),
    sender: Boolean(process.env.BREVO_FROM_EMAIL),
    site: SITE,
  });
});

/* ── the reviewer's feed (open — the who token IS the identity) ────────── */
router.get('/feed', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const me = await reviewerByToken(req.query.who);
    if (!me) return res.status(404).json({ error: 'no such reviewer — check the link' });
    const snap = await db().collection(VIDEOS).get();
    const videos = snap.docs
      .filter(d => !d.id.startsWith('__'))
      .map(d => publicVideo(d.id, d.data(), me.id))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    res.json({ reviewer: { id: me.id, name: me.name }, videos });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── a note from the review page ───────────────────────────────────────── */
router.post('/note', async (req, res) => {
  try {
    if (limited(req, res)) return;
    const b = req.body || {};
    const me = await reviewerByToken(b.who);
    if (!me) return res.status(404).json({ error: 'no such reviewer' });
    const ref = db().collection(VIDEOS).doc(String(b.id || ''));
    const snap = await ref.get();
    if (!snap.exists || ref.id.startsWith('__')) return res.status(404).json({ error: 'no such video' });
    const d = snap.data();
    const { entry, error } = cleanNote(b);
    if (error) return res.status(400).json({ error });
    entry.from = me.name || 'reviewer';
    if (entry.cutV == null && (d.cuts || []).length) entry.cutV = d.cuts[d.cuts.length - 1].v;
    const thread = (d.thread || []).concat([entry]).slice(-THREAD_MAX);
    await ref.set({
      thread,
      state: stateAfter(d.state || 'idea', 'note'),
      waiting: 'chat',
      updatedAt: now(),
    }, { merge: true });
    const wake = await ringChat(d.chat);
    res.json({ ok: true, state: stateAfter(d.state || 'idea', 'note'), wake: wake.status });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── ♥ / ✕ on the current cut ──────────────────────────────────────────── */
router.post('/verdict', async (req, res) => {
  try {
    if (limited(req, res)) return;
    const b = req.body || {};
    const me = await reviewerByToken(b.who);
    if (!me) return res.status(404).json({ error: 'no such reviewer' });
    const mark = b.mark === 'love' ? 'love' : b.mark === 'changes' ? 'changes' : null;
    if (!mark) return res.status(400).json({ error: "mark must be 'love' or 'changes'" });
    const ref = db().collection(VIDEOS).doc(String(b.id || ''));
    const snap = await ref.get();
    if (!snap.exists || ref.id.startsWith('__')) return res.status(404).json({ error: 'no such video' });
    const d = snap.data();
    const cutV = (d.cuts || []).length ? d.cuts[d.cuts.length - 1].v : null;
    await ref.set({
      verdict: { by: me.name || 'reviewer', mark, cutV, at: now() },
      state: stateAfter(d.state || 'idea', 'verdict', mark),
      waiting: mark === 'changes' ? 'chat' : '',
      updatedAt: now(),
    }, { merge: true });
    const wake = await ringChat(d.chat);
    res.json({ ok: true, state: stateAfter(d.state || 'idea', 'verdict', mark), wake: wake.status });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── the NEW dot ───────────────────────────────────────────────────────── */
router.post('/seen', async (req, res) => {
  try {
    if (limited(req, res)) return;
    const b = req.body || {};
    const me = await reviewerByToken(b.who);
    if (!me) return res.status(404).json({ error: 'no such reviewer' });
    const ref = db().collection(VIDEOS).doc(String(b.id || ''));
    if (ref.id.startsWith('__')) return res.status(404).json({ error: 'no such video' });
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such video' });
    // seenAt only — updatedAt must NOT move, or opening a video would re-mark
    // it new for everyone else.
    await ref.set({ seenAt: { [me.id]: now() } }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── an idea pasted on the review page ─────────────────────────────────── */
// Filing an idea never spends anything — the chat picks it up, estimates the
// cost, and the >$3 batch rule stays with Sophie. A re-paste of the same
// title while it is still just an idea updates that doc instead of piling up
// twins (tapping Send twice is not two videos).
router.post('/idea', async (req, res) => {
  try {
    if (limited(req, res)) return;
    const b = req.body || {};
    const me = await reviewerByToken(b.who);
    if (!me) return res.status(404).json({ error: 'no such reviewer' });
    const title = clip(String(b.title || '').trim(), 120);
    const pitch = clip(String(b.pitch || '').trim(), 4000);
    if (!title && !pitch) return res.status(400).json({ error: 'title or pitch required' });
    const name = title || pitch.split('\n')[0].slice(0, 80);
    const snap = await db().collection(VIDEOS).get();
    const twin = snap.docs.find(d => !d.id.startsWith('__')
      && (d.data().state || 'idea') === 'idea'
      && slug(d.data().title || '') === slug(name));
    const ref = twin ? twin.ref : db().collection(VIDEOS).doc(`${slug(name).slice(0, 40) || 'video'}-${token().slice(0, 6)}`);
    await ref.set({
      title: name, pitch,
      from: me.name || 'reviewer',
      chat: (twin && twin.data().chat) || DEFAULT_CHAT,
      state: 'idea',
      createdAt: twin ? twin.data().createdAt : now(),
      updatedAt: now(),
    }, { merge: true });
    const wake = await ringChat((twin && twin.data().chat) || DEFAULT_CHAT);
    res.json({ ok: true, id: ref.id, updated: Boolean(twin), wake: wake.status });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── the chat's side (gated) ───────────────────────────────────────────── */
// File or patch a video. Chats pass their slug + session like every other
// chat-keyed POST; session-first resolution keeps a reused branch name from
// claiming another chat's videos.
router.post('/video', async (req, res) => {
  try {
    const b = req.body || {};
    const title = clip(String(b.title || '').trim(), 120);
    if (!b.id && !title) return res.status(400).json({ error: 'title required' });
    let chat = clip(b.chat, 60) || DEFAULT_CHAT;
    try {
      const { resolveChat } = require('./chatfeed');
      chat = await resolveChat(chat, clip(b.session, 120));
    } catch (e) { /* best effort — a bad resolve must not lose the filing */ }
    const id = slug(b.id) || `${slug(title).slice(0, 40) || 'video'}-${token().slice(0, 6)}`;
    const ref = db().collection(VIDEOS).doc(id);
    if (id.startsWith('__')) return res.status(400).json({ error: 'reserved id' });
    const prev = await ref.get();
    const doc = {
      title: title || (prev.exists ? prev.data().title : 'Untitled'),
      chat,
      state: prev.exists ? (b.state && ['idea', 'working', 'review', 'changes', 'approved'].includes(b.state) ? b.state : prev.data().state) : 'idea',
      createdAt: prev.exists ? prev.data().createdAt : now(),
      updatedAt: now(),
    };
    if (b.pitch != null) doc.pitch = clip(b.pitch, 4000);
    if (b.from != null) doc.from = clip(b.from, 60);
    await ref.set(doc, { merge: true });
    res.json({ ok: true, id, state: doc.state });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

// A new draft cut. The url must already be permanent (Firebase Storage) —
// temporary model urls expire and would strand the review page on a dead
// player. Emails every reviewer with an address when Brevo is configured;
// missing keys skip the send and say so, never fail the cut.
router.post('/cut', async (req, res) => {
  try {
    const b = req.body || {};
    const url = String(b.url || '');
    if (!/^https:\/\//.test(url)) return res.status(400).json({ error: 'url required (permanent https — Storage, not a temp model url)' });
    const ref = db().collection(VIDEOS).doc(String(b.id || ''));
    const snap = await ref.get();
    if (!snap.exists || ref.id.startsWith('__')) return res.status(404).json({ error: 'no such video — POST /video first' });
    const d = snap.data();
    const cuts = (d.cuts || []);
    const v = cuts.length ? (cuts[cuts.length - 1].v || cuts.length) + 1 : 1;
    const cut = { v, url: clip(url, 600), at: now() };
    if (b.note != null) cut.note = clip(b.note, 300);
    const secs = Number(b.seconds);
    if (Number.isFinite(secs) && secs > 0) cut.seconds = Math.round(secs);
    await ref.set({
      cuts: cuts.concat([cut]).slice(-CUTS_MAX),
      state: stateAfter(d.state || 'idea', 'cut'),
      waiting: 'reviewer',
      updatedAt: now(),
    }, { merge: true });
    // Best-effort notify — the page's NEW dot is the floor, the email is the
    // doorbell on top of it.
    const emailed = [], emailSkipped = [];
    const people = (await reviewers()).filter(p => p.email);
    for (const p of people) {
      try {
        const { subject, html } = buildCutEmail({ toName: p.name, link: reviewerLink(p.id), title: d.title });
        await sendViaBrevo({ to: p.email, toName: p.name, subject, html });
        emailed.push(p.name);
      } catch (err) {
        emailSkipped.push({ name: p.name, why: String(err.message || err).slice(0, 120) });
      }
    }
    res.json({ ok: true, id: ref.id, v, state: 'review', emailed, emailSkipped });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

// A stills batch for the nitty-gritty variant — she comments before the
// animation money is spent.
router.post('/stills', async (req, res) => {
  try {
    const b = req.body || {};
    const items = (Array.isArray(b.items) ? b.items : [])
      .map(i => ({ url: clip(i && i.url, 600), label: clip(i && i.label, 200) }))
      .filter(i => /^https:\/\//.test(i.url))
      .slice(0, 40);
    if (!items.length) return res.status(400).json({ error: 'items[] required ({url,label})' });
    const ref = db().collection(VIDEOS).doc(String(b.id || ''));
    const snap = await ref.get();
    if (!snap.exists || ref.id.startsWith('__')) return res.status(404).json({ error: 'no such video — POST /video first' });
    const d = snap.data();
    const batches = d.stills || [];
    const batch = {
      batch: clip(b.batch, 80) || `batch ${batches.length + 1}`,
      items, at: now(),
    };
    if (b.note != null) batch.note = clip(b.note, 300);
    await ref.set({
      stills: batches.concat([batch]).slice(-STILLS_BATCHES_MAX),
      state: stateAfter(d.state || 'idea', 'stills'),
      updatedAt: now(),
    }, { merge: true });
    res.json({ ok: true, id: ref.id, batch: batch.batch, state: stateAfter(d.state || 'idea', 'stills') });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── every video (gated — for chats and Sophie) ────────────────────────── */
router.get('/list', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(VIDEOS).get();
    const videos = snap.docs
      .filter(d => !d.id.startsWith('__'))
      .map(d => ({ ...publicVideo(d.id, d.data(), null), chat: d.data().chat || DEFAULT_CHAT, waiting: d.data().waiting || '' }))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    res.json({ videos });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── what's waiting on a chat (the wake sweep reads this) ──────────────── */
// ONE equality filter, the rest in memory — the house rule that keeps this
// off a composite index.
router.get('/inbox', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const chat = clip(req.query.chat, 60) || DEFAULT_CHAT;
    const snap = await db().collection(VIDEOS).where('chat', '==', chat).get();
    const waiting = snap.docs
      .filter(d => !d.id.startsWith('__'))
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => (v.waiting === 'chat') || (v.state || 'idea') === 'idea' || v.state === 'changes')
      .map(v => ({
        id: v.id, title: v.title, state: v.state || 'idea',
        pitch: v.pitch || '',
        verdict: v.verdict || null,
        // The unanswered tail: everything said since the chat last spoke.
        notes: (() => {
          const t = v.thread || [];
          let i = t.length;
          while (i > 0 && t[i - 1].from !== 'chat') i--;
          return t.slice(i);
        })(),
      }))
      .sort((a, b) => (a.state === 'changes' ? -1 : 0) - (b.state === 'changes' ? -1 : 0));
    res.json({ chat, waiting });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── the chat answers ON the video (mirrors the Assets-note rhythm) ────── */
router.post('/answer', async (req, res) => {
  try {
    const b = req.body || {};
    const ref = db().collection(VIDEOS).doc(String(b.id || ''));
    const snap = await ref.get();
    if (!snap.exists || ref.id.startsWith('__')) return res.status(404).json({ error: 'no such video' });
    const { entry, error } = cleanNote(b);
    if (error) return res.status(400).json({ error });
    entry.from = 'chat';
    const d = snap.data();
    await ref.set({
      thread: (d.thread || []).concat([entry]).slice(-THREAD_MAX),
      waiting: '',
      updatedAt: now(),
    }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── reviewer links (gated) ────────────────────────────────────────────── */
// Re-POSTing keeps each existing person's id, so a link already on her phone
// keeps working (fruit.js's rule). Emails are optional and never leave the
// gated routes.
router.post('/reviewers', async (req, res) => {
  try {
    const b = req.body || {};
    const ref = db().collection(VIDEOS).doc(REVIEWERS_DOC);
    const prev = await reviewers();
    const byName = new Map(prev.map(p => [slug(p.name), p]));
    const people = (Array.isArray(b.people) ? b.people : []).map(p => {
      const old = byName.get(slug(p && p.name));
      return {
        id: (p && p.id) || (old && old.id) || token(),
        name: clip(p && p.name, 60),
        email: clip((p && p.email) != null ? p.email : (old && old.email) || '', 200),
      };
    }).filter(p => p.name);
    if (!people.length) return res.status(400).json({ error: 'people[] required ({name, email?})' });
    // Keep anyone already on file who wasn't in this POST — minting one link
    // must never drop another.
    for (const p of prev) if (!people.some(q => slug(q.name) === slug(p.name))) people.push(p);
    await ref.set({ people, updatedAt: now() }, { merge: true });
    res.json({ ok: true, people: people.map(p => ({ id: p.id, name: p.name, hasEmail: Boolean(p.email), link: reviewerLink(p.id) })) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

module.exports = {
  router,
  // pure halves, for scripts/test-witchvideo.js
  stateAfter, cleanNote, isNew, publicVideo, reviewerLink, buildCutEmail,
  NOTE_MAX, CUTS_MAX, STILLS_BATCHES_MAX, THREAD_MAX,
};
