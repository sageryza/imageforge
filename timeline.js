// timeline.js — Story Timeline. A dictated list of moments becomes a timeline
// you can put in order.
//
// It started as one Compare page for one story (Sophie's, Aug 2026): she
// dictates the moments of a story out of order, in her own words, and needs to
// see them as cards she can move around until the shape is right — because the
// order is the work, and it only becomes obvious when you can look at it. Then
// she asked for it as a tool "other places can use for other stories", so the
// story stopped being baked into the page and became a row in a collection.
//
// THE CARD IS THE ATOM, THE UNIT IS WHAT MOVES. A moment is one card. A UNIT is
// one moment or a run of them that travel together — her word is a SEQUENCE —
// and a unit carries ONE number, because the number is its place in the order
// and a sequence has one place. So `units` is an array of arrays of moment ids,
// and it is the whole arrangement: order and grouping in one field.
//
// WHY THE WORDS ARE A MAP AND THE ARRANGEMENT IS A LIST. `moments` is keyed by
// id and `units` holds ids, never text. Moving a moment can therefore never
// alter it, re-ordering can never lose one, and a note left on a card follows
// the card wherever it goes. Ids are handed out once and never reused.
//
// PARSING IS A STARTING POINT, NOT A VERDICT. `parseStory` turns a pasted
// dictation into moments and a first guess at the sequences (an ALL-CAPS line
// opens a group; an END line, a blank line or the next header closes it). It
// will get some groups wrong — her second list had no END markers — and that is
// fine by design: fixing a group on the page is two taps, and no parser is
// going to out-guess her about where a sequence stops.
//
// NOTHING SLOW, NOTHING PAID — WITH ONE DELIBERATE EXCEPTION. Every route the
// PAGE touches is a small Firestore read or write, so opening the page costs
// nothing and saving is instant. The one paid route is POST /beatout (below):
// a chat hands it a voiceover transcript and Claude splits it into beats —
// a background job with a poll, ~25-40c a run on claude-fable-5, never called
// by the page and never on a page load.
//
// NOTHING IS DELETED OUTRIGHT: DELETE hides a story (`hidden:true`) and a
// deleted moment leaves `moments` untouched, dropping only out of `units` —
// so a mis-tap costs an undo, never her words.
//
// One Firestore doc per STORY (collection `forge-timelines`).
//
// Mounted at /api/timeline by server.js, page at /timeline. STUDIO_TOKEN-gated
// (only /status is open).
//
// Routes:
//   GET    /status              → { ok, firebase, stories }
//   GET    /stories             → every story, newest touched first (no bodies)
//   POST   /stories             → { title?, text? } — text is a pasted dictation
//   GET    /stories/:id         → { id, title, moments, units, … }
//   PUT    /stories/:id         → { title?, moments?, units? } (whitelisted)
//   DELETE /stories/:id         → hides it
//   POST   /parse               → { text } → { moments, units } — a dry run
//   POST   /beatout             → { title?, text, model? } → { job } — Claude
//                                 (default claude-fable-5) splits a transcript
//                                 into beats and files the story; poll the job
//   GET    /beatout/:job        → { status: making|done|failed, ... }

const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const COLL = 'forge-timelines';

function db() { return admin.firestore(); }
function hasFirebase() {
  try { return !!admin.apps.length && !!db(); } catch (_) { return false; }
}

/* ---- the gate (audio.js's, verbatim in spirit): open when STUDIO_TOKEN is
   unset, otherwise every route but /status needs the header or ?token= ---- */
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN;
  if (!token) return next();
  if (req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

const {
  parseStory, cleanMoments, cleanUnits, countMoments, packUnits, unpackUnits,
  cleanBeatLines,
} = require('./timeline-parse');
const anthropic = require('./anthropic');
const crypto = require('crypto');

const EDITABLE = ['title', 'moments', 'units'];

function view(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    title: d.title || 'Untitled',
    moments: d.moments || {},
    units: unpackUnits(d.units),
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

/* ----------------------------------------------------------------- routes */

router.get('/status', (req, res) => {
  const fb = hasFirebase();
  if (!fb) return res.json({ ok: false, firebase: false, stories: null });
  db().collection(COLL).get()
    .then((s) => res.json({
      ok: true,
      firebase: true,
      stories: s.docs.filter((d) => !(d.data() || {}).hidden).length,
    }))
    .catch(() => res.json({ ok: false, firebase: true, stories: null }));
});

router.get('/stories', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    // ONE equality filter at most, everything else sorted in memory — so this
    // module never needs a composite index set up by hand
    const snap = await db().collection(COLL).get();
    const rows = snap.docs
      .filter((d) => !(d.data() || {}).hidden)
      .map((d) => {
        const x = d.data() || {};
        return {
          id: d.id,
          title: x.title || 'Untitled',
          moments: countMoments(unpackUnits(x.units)),
          units: (x.units || []).length,
          updatedAt: x.updatedAt || x.createdAt || null,
        };
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    res.json({ stories: rows });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

router.post('/parse', (req, res) => {
  const { moments, units } = parseStory((req.body || {}).text || '');
  res.json({ moments, units, count: countMoments(units) });
});

router.post('/stories', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const b = req.body || {};
    const parsed = parseStory(b.text || '');
    const now = new Date().toISOString();
    const doc = {
      title: String(b.title || '').trim().slice(0, 200) || 'Untitled',
      moments: parsed.moments,
      units: packUnits(parsed.units),
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db().collection(COLL).add(doc);
    res.json({ id: ref.id, title: doc.title, moments: doc.moments, units: parsed.units });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});


/* ---- beat out a voiceover with Claude -----------------------------------
   A chat pastes a transcript and gets back a filed story: Claude splits it
   into beats (one line each, ALL-CAPS sequence headers) in the EXACT dictation
   shape parseStory already reads, so the model's reply goes through the same
   parser as her own paste — one code path, nothing new to validate.

   THE MODEL IS FABLE BY DESIGN (Sophie, 2026-08-24: "this needs to be smart…
   it should go through fable"). Do not quietly downgrade it; a caller may
   pass `model` to run something else deliberately. The beats are HER WORDS
   VERBATIM — the prompt forbids rewording; the model's only judgment is where
   one beat ends and which beats travel as a sequence.

   A background job, never a blocking request: Fable can think for a minute or
   two and a proxy timeout would eat a finished reply. Jobs live in memory —
   a deploy mid-run loses the POLL, not the story (the write happens before
   the job flips to done); re-run if a job vanishes. */

const BEAT_MODEL = 'claude-fable-5';
const beatJobs = new Map();

const BEAT_SYSTEM = [
  'You split a spoken voiceover transcript into story beats for a timeline of cards.',
  'Output PLAIN TEXT only — no JSON, no code fences, no commentary before or after.',
  'Format: an ALL-CAPS line (2-40 characters, no lowercase letters) names a sequence;',
  'the beats of that sequence follow, ONE BEAT PER LINE, with no blank lines inside a',
  'sequence; a blank line ends the sequence before the next header.',
  '',
  'Rules for the beats themselves:',
  '- Each beat is a contiguous span of the transcript in the speaker\'s OWN words,',
  '  verbatim and in the original order. Together the beats must cover the whole',
  '  transcript — drop nothing, reword nothing, add nothing, summarize nothing.',
  '- The ONE allowed edit: where the speaker restarts the same phrase (a retake or',
  '  stutter), keep only the finished take.',
  '- A beat is one moment or one idea — it may be one sentence or several. Do NOT',
  '  force one sentence per beat, and do not make beats uniform in length.',
  '- A sequence is a run of beats that tell one episode or one movement of thought.',
  '- Never number the lines and never wrap a line in quotes.',
].join('\n');

router.post('/beatout', (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  if (!anthropic.available()) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set — beatout runs on Claude' });
  }
  const b = req.body || {};
  const text = String(b.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 200000) return res.status(400).json({ error: 'text too long' });
  const title = String(b.title || '').trim().slice(0, 200) || 'Untitled';
  const model = String(b.model || '').trim() || BEAT_MODEL;

  const job = crypto.randomBytes(8).toString('hex');
  beatJobs.set(job, { status: 'making', title, model, at: Date.now() });
  // keep the map small — a job record is only a poll target
  if (beatJobs.size > 40) {
    const oldest = [...beatJobs.keys()].slice(0, beatJobs.size - 40);
    oldest.forEach((k) => beatJobs.delete(k));
  }
  res.json({ job, model });

  (async () => {
    try {
      const reply = await anthropic.chat({
        system: BEAT_SYSTEM,
        user: 'Split this transcript into beats:\n\n' + text,
        model,
        maxTokens: 16000,
      });
      const parsed = parseStory(cleanBeatLines(reply));
      const count = countMoments(parsed.units);
      if (!count) throw new Error('model returned no beats');
      const now = new Date().toISOString();
      const doc = {
        title,
        moments: parsed.moments,
        units: packUnits(parsed.units),
        beatFrom: model,
        createdAt: now,
        updatedAt: now,
      };
      const ref = await db().collection(COLL).add(doc);
      beatJobs.set(job, {
        status: 'done', title, model, at: Date.now(),
        storyId: ref.id, count, units: parsed.units.length,
      });
    } catch (e) {
      beatJobs.set(job, {
        status: 'failed', title, model, at: Date.now(),
        error: String((e && e.message) || e),
      });
    }
  })();
});

router.get('/beatout/:job', (req, res) => {
  const j = beatJobs.get(req.params.job);
  if (!j) return res.status(404).json({ error: 'no such job (jobs do not survive a deploy — re-run)' });
  res.json(j);
});

router.get('/stories/:id', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const doc = await db().collection(COLL).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'no such story' });
    res.json(view(doc));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

router.put('/stories/:id', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const ref = db().collection(COLL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such story' });
    const b = req.body || {};
    const patch = {};

    // PATCH FIELDS, never stamp the whole doc, and only the three she owns —
    // createdAt and the id are the server's.
    if (typeof b.title === 'string') patch.title = b.title.trim().slice(0, 200) || 'Untitled';
    const moments = cleanMoments(b.moments);
    if (moments) patch.moments = moments;
    // units are validated against the moments they will live beside, whether
    // those arrive in the same call or are already on the doc
    const against = moments || (doc.data() || {}).moments || null;
    const units = cleanUnits(b.units, against);
    if (units) patch.units = packUnits(units);

    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    Object.keys(patch).forEach((k) => { if (EDITABLE.indexOf(k) < 0) delete patch[k]; });
    patch.updatedAt = new Date().toISOString();
    await ref.set(patch, { merge: true });
    res.json({ ok: true, id: ref.id, saved: Object.keys(patch) });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

router.delete('/stories/:id', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    // hidden, never removed — the same rule the moments follow
    await db().collection(COLL).doc(req.params.id)
      .set({ hidden: true, updatedAt: new Date().toISOString() }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

module.exports = { router, parseStory, cleanUnits, cleanMoments, countMoments };
