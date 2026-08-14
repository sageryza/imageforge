// fruit.js — the favorite-fruit poll. A Tinder-style swipe deck of watercolour
// fruit, one personal link per person, and the answers grouped into charts.
//
// Sophie wants a favorite-fruit chart for her fridge. Asking people by email
// gets you a sentence back ("idk, mango?") that nobody can chart; asking them
// to fill in a form gets you nothing back at all. So the ask is a DECK: 27
// fruits drawn in her own ink-and-watercolour look (refs/sage-sandy-mirror.png
// through gpt-image-2), swiped one at a time, ♥ or ✕, then one tap to crown a
// favorite. That produces structured answers — a like set, a nope set, and a
// #1 — which is what a chart needs.
//
// THREE ANSWERS, NOT TWO (Aug 2026, Sophie: "I like apples but I don't love
// them, but I love mangoes"). Every fruit is loved, tolerated, or refused —
// ♥ / ○ / ✕ — and then one of them is crowned. Two buckets flattened exactly
// the distinction the chart is for, since a fruit somebody merely puts up with
// scored the same as their favourite. The old two-way `likes` field is read as
// `loves` wherever it survives, so no ballot written before this is lost.
//
// THE LINK IS THE IDENTITY. Each person gets `/fruit?p=<poll>&who=<personId>`
// in their email; there is no login, because the people filling this in are
// Sophie's family and a password would simply end the experiment. The person
// id is a random token, so the url is unguessable and is also the only thing
// that ties a ballot to a name.
//
// A BALLOT DOC IS CONTENT-ADDRESSED (`<pollId>__<personId>`), so swiping the
// deck twice UPDATES one ballot instead of piling up copies — which is what
// makes "close the tab, come back later" work. The page saves after every
// swipe (`partial:true`) and the ballot only counts as an answer once `done`
// is set, so an abandoned half-deck never lands in the chart as a real vote.
//
// EMAILS LIVE ONLY ON THE POLL DOC and never leave the gated routes: the
// public poll read strips them, so opening someone else's link cannot enumerate
// the family's addresses.
//
// Sending runs on Brevo's transactional endpoint (the same account tarot-email.js
// uses). BREVO_API_KEY + BREVO_FROM_EMAIL are required — without them /invite
// answers 400 and says which one is missing, rather than half-sending.
//
// Firestore (deckfactory-43176): `forge-fruit` = one doc per poll,
// `forge-fruit-votes` = one doc per (poll, person).
//
// Mounted at /api/fruit by server.js. Pages: /fruit (the swipe deck, PUBLIC —
// it is opened from an email) and /fruitchart (the results). PUBLIC routes are
// rate-limited per IP like selfcare.js; everything else is STUDIO_TOKEN-gated.
//
// Routes:
//   GET  /status                      → { ok, firebase, brevo, sender }  (open)
//   GET  /poll/:id                    → poll + fruits, NO emails          (open)
//   GET  /ballot/:poll/:person        → that person's saved ballot        (open)
//   POST /ballot/:poll/:person        → { loves, oks, nopes, top, done }  (open, rate-limited)
//   GET  /results/:poll               → tallies + per-person answers      (open)
//   POST /poll                        → create/replace a poll            (gated)
//   GET  /poll/:id/people             → people WITH emails + links       (gated)
//   POST /invite                      → send the emails via Brevo        (gated)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');

const POLLS = 'forge-fruit';
const VOTES = 'forge-fruit-votes';

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const SITE = process.env.FRUIT_SITE_ORIGIN || 'https://imageforge-q125.onrender.com';

const db = () => admin.firestore();

/* ── Public-route rate limit (selfcare.js's, verbatim in shape) ────────── */
const RATE_MAX = 120;                       // a 27-card deck saves ~28 times
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

const router = express.Router();

// Open paths: /status plus everything the emailed link needs. The gate only
// bites when STUDIO_TOKEN is set at all.
function isOpen(req) {
  const p = req.path;
  if (p === '/status') return true;
  if (/^\/(poll|ballot|results)\//.test(p) && !/\/people$/.test(p)) return true;
  return false;
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

function ballotId(poll, person) { return `${poll}__${person}`; }

function personLink(pollId, personId) {
  return `${SITE}/fruit?p=${encodeURIComponent(pollId)}&who=${encodeURIComponent(personId)}`;
}

// The public shape of a poll — emails stripped, people reduced to id + name.
function publicPoll(id, d) {
  return {
    id,
    title: d.title || 'Favorite fruit',
    intro: d.intro || '',
    fruits: (d.fruits || []).map(f => ({ id: f.id, name: f.name, url: f.url })),
    people: (d.people || []).map(p => ({ id: p.id, name: p.name })),
    createdAt: d.createdAt || null,
  };
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

/* ── create / replace a poll (gated) ───────────────────────────────────── */
// { id?, title?, intro?, fruits:[{id,name,url}], people:[{name,email,id?}] }
// Re-POSTing the same id keeps each person's EXISTING id (so links already in
// an inbox keep working) and only adds ids for people who are new.
router.post('/poll', async (req, res) => {
  try {
    const b = req.body || {};
    const fruits = (b.fruits || []).map(f => ({
      id: slug(f.id || f.name),
      name: clip(f.name, 60),
      url: clip(f.url, 500),
    })).filter(f => f.id && f.url);
    if (!fruits.length) return res.status(400).json({ error: 'fruits[] required ({id,name,url})' });

    const id = slug(b.id) || 'fruit-' + token();
    const ref = db().collection(POLLS).doc(id);
    const prev = await ref.get();
    const prevPeople = prev.exists ? (prev.data().people || []) : [];
    const byName = new Map(prevPeople.map(p => [slug(p.name), p]));

    const people = (b.people || []).map(p => {
      const old = byName.get(slug(p.name));
      return {
        id: p.id || (old && old.id) || token(),
        name: clip(p.name, 60),
        email: clip(p.email, 200),
        // Sent state rides along so /invite can report who has been mailed.
        invitedAt: (old && old.invitedAt) || null,
      };
    }).filter(p => p.name);

    const doc = {
      title: clip(b.title, 120) || 'Favorite fruit',
      intro: clip(b.intro, 600),
      fruits,
      people,
      createdAt: prev.exists ? prev.data().createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    await ref.set(doc, { merge: false });
    res.json({
      id,
      fruits: fruits.length,
      people: people.map(p => ({ id: p.id, name: p.name, link: personLink(id, p.id) })),
      chart: `${SITE}/fruitchart?p=${id}`,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── read a poll (public — no emails) ──────────────────────────────────── */
router.get('/poll/:id', async (req, res) => {
  try {
    const snap = await db().collection(POLLS).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such poll' });
    res.json(publicPoll(snap.id, snap.data()));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── the people, WITH emails and links (gated) ─────────────────────────── */
router.get('/poll/:id/people', async (req, res) => {
  try {
    const snap = await db().collection(POLLS).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such poll' });
    const people = (snap.data().people || []).map(p => ({
      ...p, link: personLink(snap.id, p.id),
    }));
    res.json({ id: snap.id, people });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── a ballot ──────────────────────────────────────────────────────────── */
router.get('/ballot/:poll/:person', async (req, res) => {
  try {
    const snap = await db().collection(VOTES).doc(ballotId(req.params.poll, req.params.person)).get();
    if (!snap.exists) return res.json({ loves: [], oks: [], nopes: [], top: null, done: false, fresh: true });
    const d = snap.data();
    res.json({
      // `likes` was the two-way field before the middle option existed. A
      // ballot written then is read as loves, so nobody has to re-swipe.
      loves: d.loves || d.likes || [], oks: d.oks || [], nopes: d.nopes || [],
      top: d.top || null, done: Boolean(d.done), fresh: false,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

// Saved after every swipe. `done:true` is what promotes it to a real answer —
// a half-swiped deck stays out of the chart.
router.post('/ballot/:poll/:person', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.ip || '';
    if (rateLimited(String(ip).split(',')[0].trim())) {
      return res.status(429).json({ error: 'too many saves — try again later' });
    }
    const pollId = String(req.params.poll), personId = String(req.params.person);
    const pollSnap = await db().collection(POLLS).doc(pollId).get();
    if (!pollSnap.exists) return res.status(404).json({ error: 'no such poll' });
    const poll = pollSnap.data();
    const person = (poll.people || []).find(p => p.id === personId);
    if (!person) return res.status(404).json({ error: 'no such person' });

    // Only ids that are actually in this deck, so a stale link can't invent one.
    const valid = new Set((poll.fruits || []).map(f => f.id));
    const clean = a => [...new Set((Array.isArray(a) ? a : []).map(String))].filter(x => valid.has(x)).slice(0, 200);
    const b = req.body || {};
    const loves = clean(b.loves != null ? b.loves : b.likes), oks = clean(b.oks), nopes = clean(b.nopes);
    const top = valid.has(String(b.top)) ? String(b.top) : null;

    await db().collection(VOTES).doc(ballotId(pollId, personId)).set({
      poll: pollId, person: personId, name: person.name,
      loves, oks, nopes, top, done: Boolean(b.done), updatedAt: Date.now(),
      // The old two-way field is cleared, not left behind: a stale `likes`
      // would out-vote `loves` for any reader still falling back to it.
      likes: admin.firestore.FieldValue.delete(),
    }, { merge: true });
    res.json({ ok: true, loves: loves.length, oks: oks.length, nopes: nopes.length, top, done: Boolean(b.done) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── results ───────────────────────────────────────────────────────────── */
// ONE equality filter (`poll`), everything else sorted in memory — the house
// rule that keeps this off a composite index.
router.get('/results/:poll', async (req, res) => {
  try {
    const pollId = String(req.params.poll);
    const pollSnap = await db().collection(POLLS).doc(pollId).get();
    if (!pollSnap.exists) return res.status(404).json({ error: 'no such poll' });
    const poll = pollSnap.data();
    const qs = await db().collection(VOTES).where('poll', '==', pollId).get();

    const ballots = qs.docs.map(d => d.data())
      .map(d => ({
        person: d.person, name: d.name || '',
        loves: d.loves || d.likes || [], oks: d.oks || [], nopes: d.nopes || [],
        top: d.top || null, done: Boolean(d.done), updatedAt: d.updatedAt || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const answered = ballots.filter(b => b.done);
    const tally = new Map();
    for (const f of poll.fruits || []) {
      tally.set(f.id, { ...f, loves: 0, oks: 0, nopes: 0, tops: 0, lovedBy: [], okBy: [], topBy: [] });
    }
    for (const b of answered) {
      for (const id of b.loves) { const t = tally.get(id); if (t) { t.loves++; t.lovedBy.push(b.name); } }
      for (const id of b.oks) { const t = tally.get(id); if (t) { t.oks++; t.okBy.push(b.name); } }
      for (const id of b.nopes) { const t = tally.get(id); if (t) t.nopes++; }
      if (b.top) { const t = tally.get(b.top); if (t) { t.tops++; t.topBy.push(b.name); } }
    }
    // ORDER IS BY LOVES, the same number the Popular view draws its size from,
    // so position and size can never disagree. `oks` breaks a tie but never
    // outranks a love — a fruit three people merely tolerate is not more
    // popular than one somebody loves, on a chart about favourites.
    const fruits = [...tally.values()].sort((a, b) =>
      (b.loves - a.loves) || (b.oks - a.oks) || (b.tops - a.tops) || a.name.localeCompare(b.name));

    res.json({
      poll: publicPoll(pollSnap.id, poll),
      people: (poll.people || []).map(p => ({ id: p.id, name: p.name })),
      ballots,                                  // includes half-done ones, flagged
      answered: answered.length,
      waiting: (poll.people || []).filter(p => !answered.some(b => b.person === p.id)).map(p => p.name),
      fruits,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── the email ─────────────────────────────────────────────────────────── */
// Plain, warm, and one big button. No tracking pixels, no unsubscribe machinery
// — this is a transactional note to three people, not a campaign.
function buildInvite({ fromName, toName, link, title, note }) {
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const body = note || `I'm making a favorite fruit chart for my fridge. I know. But I drew all the fruit myself, so you have to help.\n\nTap the link and swipe through — heart the ones you like, X the ones you don't, then pick your number one. Takes about a minute.`;
  const paras = body.split('\n\n').map(p => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2622;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return {
    subject: `${toName ? toName + ', w' : 'W'}hat's your favorite fruit?`,
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f7f3ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf9;border:1px solid #e5ddd0;border-radius:6px;padding:28px 26px;">
<tr><td style="font-family:Georgia,'Times New Roman',serif;">
<p style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#2b2622;">${esc(title || 'Favorite fruit')}</p>
${toName ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2622;">${esc(toName)},</p>` : ''}
${paras}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
<tr><td style="background:#2b2622;border-radius:6px;">
<a href="${esc(link)}" style="display:inline-block;padding:13px 22px;font-family:Georgia,serif;font-size:16px;color:#fffdf9;text-decoration:none;">Pick your fruit</a>
</td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#8a7f72;">This link is yours — it remembers your answers, so you can stop and come back.</p>
<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#a99e90;word-break:break-all;">${esc(link)}</p>
<p style="margin:20px 0 0;font-size:15px;color:#2b2622;">— ${esc(fromName || 'Sophie')}</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
  };
}

async function sendViaBrevo({ to, toName, subject, html, fromName }) {
  const key = process.env.BREVO_API_KEY || '';
  const from = process.env.BREVO_FROM_EMAIL || '';
  if (!key) throw new Error('BREVO_API_KEY not set');
  if (!from) throw new Error('BREVO_FROM_EMAIL not set (must be a sender verified in Brevo)');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: fromName || process.env.BREVO_FROM_NAME || 'Sophie' },
      to: [{ email: to, name: toName || undefined }],
      subject, htmlContent: html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Brevo error ${res.status}`);
  return data;
}

// { poll, who?:[personId|name], note?, fromName?, dryRun? }
// dryRun renders the email and reports the recipients WITHOUT sending — the
// same guard asc-metadata.yml's dry_run gives the App Store workflows.
router.post('/invite', async (req, res) => {
  try {
    const b = req.body || {};
    const pollId = slug(b.poll);
    if (!pollId) return res.status(400).json({ error: 'poll required' });
    // A dry run sends nothing, so it must not require the credentials — the
    // whole point is to read the exact email and recipient list BEFORE any key
    // exists. Gating it on the key made the guard useless on a fresh server,
    // which is the only time it matters.
    if (!b.dryRun) {
      const missing = [];
      if (!process.env.BREVO_API_KEY) missing.push('BREVO_API_KEY');
      if (!process.env.BREVO_FROM_EMAIL) missing.push('BREVO_FROM_EMAIL (a sender verified in Brevo)');
      if (missing.length) return res.status(400).json({ error: 'not set on this server: ' + missing.join(' and ') });
    }

    const ref = db().collection(POLLS).doc(pollId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such poll' });
    const poll = snap.data();

    const want = (b.who || []).map(slug);
    let people = (poll.people || []).filter(p => p.email);
    if (want.length) people = people.filter(p => want.includes(slug(p.name)) || want.includes(slug(p.id)));
    if (!people.length) return res.status(400).json({ error: 'nobody to send to (no matching person with an email)' });

    const sent = [], failed = [];
    for (const p of people) {
      const link = personLink(pollId, p.id);
      const { subject, html } = buildInvite({
        fromName: b.fromName, toName: p.name, link, title: poll.title, note: b.note,
      });
      if (b.dryRun) { sent.push({ name: p.name, email: p.email, link, subject, bytes: html.length }); continue; }
      try {
        const r = await sendViaBrevo({ to: p.email, toName: p.name, subject, html, fromName: b.fromName });
        sent.push({ name: p.name, email: p.email, link, messageId: r.messageId || null });
        p.invitedAt = Date.now();
      } catch (e) {
        failed.push({ name: p.name, email: p.email, error: String(e.message || e).slice(0, 200) });
      }
    }
    if (!b.dryRun && sent.length) await ref.set({ people: poll.people, updatedAt: Date.now() }, { merge: true });
    res.json({ ok: !failed.length, dryRun: Boolean(b.dryRun), sent, failed });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

module.exports = { router, buildInvite, personLink };
