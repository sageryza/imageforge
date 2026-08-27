// Character Creator — upload a photo + a name, generate a diary-comic
// character reference (the exact wired-in prompt), save it, and compile the
// recurring "main characters" into one sheet. Web prototype of the feature
// that will live in the iOS Story Boards screen. Self-contained router,
// mirrors movies.js patterns (form-data edits, Firebase Storage, Firestore).
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const COLLECTION = process.env.CHARACTER_COLLECTION || 'forge-characters';

// The diary-comic style reference (same one movies/zines use).
let styleRef = null;
try {
  styleRef = fs.readFileSync(path.join(__dirname, 'refs', 'dream-mystery.jpg'));
} catch {
  console.warn('character: no refs/dream-mystery.jpg — Character Creator disabled');
}

function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function db() {
  try { return admin.apps.length ? admin.firestore() : null; } catch { return null; }
}

// ─── Name matching (dream/story cast → saved characters) ────────────
// Normalize a name for comparison: lowercase, strip punctuation, collapse
// spaces. Aliases let "me"/"Sophie" and "Daddy"/"Dad" resolve to one character.
const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const nameWords = (s) => normName(s).split(' ').filter((w) => w.length > 1);
function normAliases(a) {
  const arr = Array.isArray(a) ? a : (typeof a === 'string' ? a.split(',') : []);
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))].slice(0, 12);
}
// How well a cast name matches a saved character: 3 = exact name/alias,
// 2 = whole-word containment either way ("Jonathan" ⊂ "Jonathan Small"), 0 = no.
function matchScore(castName, ch) {
  const c = normName(castName);
  if (!c) return 0;
  const keys = [ch.name, ...(Array.isArray(ch.aliases) ? ch.aliases : [])].map(normName).filter(Boolean);
  if (keys.includes(c)) return 3;
  const cw = new Set(nameWords(castName));
  if (!cw.size) return 0;
  for (const k of keys) {
    const kw = nameWords(k);
    if (!kw.length) continue;
    if (kw.every((w) => cw.has(w))) return 2;                 // saved key's words all appear in the cast name
    const kset = new Set(kw);
    if ([...cw].every((w) => kset.has(w))) return 2;          // cast name's words all appear in the key
  }
  return 0;
}
// For each requested name, EVERY plausible saved character, best first — the
// dream flow shows all candidates when one name could be two people ("J" the
// ex vs "J" the coworker) and the user picks. Cap 4 per name.
async function matchCandidates(names) {
  const d = db();
  if (!d) return names.map((n) => ({ name: n, matches: [] }));
  const snap = await d.collection(COLLECTION).get();
  const chars = snap.docs.map((s) => ({ id: s.id, ...s.data() }));
  return names.map((n) => {
    const matches = chars
      .map((ch) => ({ ch, score: matchScore(n, ch) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((m) => ({ id: m.ch.id, name: m.ch.name, url: m.ch.url, tier: m.ch.tier || 'side', score: m.score }));
    return { name: n, matches };
  });
}

// For each requested name, the best-scoring saved character (or null).
async function matchCharacters(names) {
  const d = db();
  if (!d) return names.map((n) => ({ name: n, match: null }));
  const snap = await d.collection(COLLECTION).get();
  const chars = snap.docs.map((s) => ({ id: s.id, ...s.data() }));
  return names.map((n) => {
    let best = null, bestScore = 0;
    for (const ch of chars) {
      const sc = matchScore(n, ch);
      if (sc > bestScore) { best = ch; bestScore = sc; }
    }
    return {
      name: n,
      // cleanUrl mirrors url: characters keep their original backgrounds now
      // (the field name survives for older clients that read cleanUrl).
      match: best ? { id: best.id, name: best.name, url: best.url, cleanUrl: best.url, score: bestScore } : null,
    };
  });
}

async function saveBufferToStorage(buffer, contentType, folder) {
  const b = bucket();
  const ext = contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'jpg';
  if (!b) return `data:${contentType};base64,${buffer.toString('base64')}`;
  const filename = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const file = b.file(filename);
  await file.save(buffer, { metadata: { contentType } });
  await file.makePublic();
  return `https://storage.googleapis.com/${b.name}/${filename}`;
}

// gender → the pronoun words the wired-in prompt needs.
function pronouns(gender) {
  const g = String(gender || 'they').toLowerCase();
  if (g === 'he' || g === 'him' || g === 'his' || g === 'male')
    return { poss: 'His', obj: 'him', poss2: 'his' };
  if (g === 'she' || g === 'her' || g === 'female')
    return { poss: 'Her', obj: 'her', poss2: 'her' };
  return { poss: 'Their', obj: 'them', poss2: 'their' };
}

// The exact prompt, wired in; only the name, pronouns, subject-photo count,
// and an optional extra note (e.g. "no hat") vary.
function buildPrompt(name, gender, note, subjectCount = 1) {
  const p = pronouns(gender);
  const nm = String(name || '').trim() || 'them';
  let prompt = subjectCount > 1
    ? `Make a character reference image, just one straightforward face looking forward, `
      + `using the first image as a style reference and the next ${subjectCount} images as `
      + `multiple reference photos of the same subject. `
      + `${p.poss} name is ${nm}. No other text or images, just ${p.obj} with ${p.poss2} name on it.`
    : `Make a character reference image, just one straightforward face looking forward, `
      + `using the first image as a style reference and the second image as the subject. `
      + `${p.poss} name is ${nm}. No other text or images, just ${p.obj} with ${p.poss2} name on it.`;
  const n = String(note || '').trim();
  if (n) prompt += ` ${n}`;
  return prompt;
}

async function generatePortrait(photoBuffers, name, gender, quality = 'medium', note = '', retries = 2) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  if (!styleRef) throw new Error('style reference missing');
  // Normalize every subject photo to a clean sRGB PNG: iPhone photos arrive
  // with an EXIF orientation tag, a non-sRGB profile, or bytes (HEIC/odd mode)
  // that gpt-image-2's edits endpoint rejects as "invalid image file or mode".
  // Re-encoding with sharp (auto-orient, sRGB, RGBA, PNG) makes them valid and
  // makes the bytes match the image/png label we send.
  const sharp = require('sharp');
  const raw = Array.isArray(photoBuffers) ? photoBuffers : [photoBuffers];
  const buffers = [];
  for (const b of raw) {
    try {
      buffers.push(await sharp(b).rotate().toColourspace('srgb').ensureAlpha().png().toBuffer());
    } catch (e) {
      console.warn('character: photo normalize failed —', e.message);
      buffers.push(b);
    }
  }
  // THE WHOLE PROMPT (Sophie's hard rule, 2026-08-24). This is the literal
  // text sent below; `lastPrompt` carries it back to the caller so the doc
  // stores what was SENT rather than a rebuild — the subject count is only
  // known here, after the photos have been normalized and any bad one dropped.
  const prompt = buildPrompt(name, gender, note, buffers.length);
  generatePortrait.lastPrompt = prompt;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('image[]', styleRef, { filename: 'style.jpg', contentType: 'image/jpeg' });
      buffers.forEach((buf, i) => {
        form.append('image[]', buf, { filename: `subject${i}.png`, contentType: 'image/png' });
      });
      form.append('size', '1024x1024');
      form.append('quality', quality);
      form.append('output_format', 'webp');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
        body: form,
        timeout: 180000,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('gpt-image-2 returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ── Batch mode: find every person in a photo, crop head-and-shoulders ──
// Claude vision (Haiku by default) returns a head-and-shoulders box per person;
// sharp crops each. Claude — unlike gpt-4o — reliably returns face crop boxes
// without refusing. Override the model with CHARACTER_VISION_MODEL.
const VISION_MODEL = process.env.CHARACTER_VISION_MODEL || 'claude-haiku-4-5-20251001';
const VISION_PROMPT = 'You are the detector for an automatic photo-cropping tool that cuts each person out of a group photo into their own separate portrait. For each person in the image, ordered left to right, return the crop rectangle covering their head and shoulders as fractions of the image width and height [x, y, w, h] (x,y = top-left corner). Also give a short look (hair and clothing) and a gender guess ("he","she","unknown"). Respond with ONLY a JSON object and nothing else: {"people":[{"box":[x,y,w,h],"desc":"...","gender":"..."}]}';

async function visionPeople(photoBuffer, mime) {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const sharp = require('sharp');
  // downscale for the vision call — boxes are fractional so full-res cropping still works
  const small = await sharp(photoBuffer)
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } },
        { type: 'text', text: VISION_PROMPT },
      ] }],
    }),
    timeout: 60000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  let parsed = {};
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  return Array.isArray(parsed.people) ? parsed.people : [];
}

async function cropPerson(buffer, box, pad = 0.12) {
  const sharp = require('sharp');
  const meta = await sharp(buffer).metadata();
  const W = meta.width, H = meta.height;
  let [x, y, w, h] = (box || []).map(Number);
  if (![x, y, w, h].every(n => Number.isFinite(n))) throw new Error('bad box');
  x = Math.max(0, Math.min(1, x)); y = Math.max(0, Math.min(1, y));
  w = Math.max(0.02, Math.min(1, w)); h = Math.max(0.02, Math.min(1, h));
  let left = Math.round((x - w * pad) * W);
  let top = Math.round((y - h * pad) * H);
  let width = Math.round(w * (1 + 2 * pad) * W);
  let height = Math.round(h * (1 + 2 * pad) * H);
  left = Math.max(0, left); top = Math.max(0, top);
  width = Math.min(W - left, width); height = Math.min(H - top, height);
  if (width < 8 || height < 8) throw new Error('degenerate box');
  return await sharp(buffer).extract({ left, top, width, height }).png().toBuffer();
}

const router = express.Router();
router.use(express.json({ limit: '40mb' }));

function gated(req, res, next) {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN)
    return res.status(401).json({ error: 'unauthorized' });
  next();
}

router.get('/status', (req, res) => {
  res.json({ ok: true, openai: Boolean(OPENAI_API_KEY), style: Boolean(styleRef),
    firestore: Boolean(db()), storage: Boolean(bucket()), gated: Boolean(STUDIO_TOKEN) });
});

// Generate a portrait from a photo + name. Returns the saved image URL; does
// NOT persist a character (that's /save) so re-rolls aren't stored.
router.post('/generate', gated, async (req, res) => {
  try {
    const { photo, photos, name, gender, quality, note } = req.body || {};
    const dataUrls = Array.isArray(photos) && photos.length ? photos : (photo ? [photo] : []);
    if (!dataUrls.length) return res.status(400).json({ error: 'photo or photos (data URL(s)) required' });
    const bufs = [];
    for (const p of dataUrls) {
      if (typeof p !== 'string') return res.status(400).json({ error: 'each photo must be a data URL' });
      const m = /^data:([^;]+);base64,(.*)$/.exec(p);
      if (!m) return res.status(400).json({ error: 'each photo must be a data URL' });
      bufs.push(Buffer.from(m[2], 'base64'));
    }
    const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
    const out = await generatePortrait(bufs, name, gender, q, note);
    const url = await saveBufferToStorage(out, 'image/webp', 'characters');
    // The prompt rides back so a caller that files this picture can store it.
    res.json({ ok: true, url, name: String(name || '').trim(), gender: String(gender || 'they'),
      fullPrompt: generatePortrait.lastPrompt || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persist a generated character. tier 'main' shows on the sheet; 'side' is
// saved but off the sheet.
router.post('/save', gated, async (req, res) => {
  try {
    const { url, name, gender, tier, quality, model, chat, aliases } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });
    const d = db();
    if (!d) return res.status(503).json({ error: 'firestore unavailable' });
    const doc = {
      name: String(name || '').trim(),
      gender: String(gender || 'they'),
      url: String(url),
      tier: tier === 'main' ? 'main' : 'side',
      // Other names this character is called in dreams/stories ("me"/"Sophie",
      // "Daddy"/"Dad") — the matcher checks these alongside the primary name.
      aliases: normAliases(aliases),
      quality: ['low', 'medium', 'high'].includes(quality) ? quality : null,
      model: model ? String(model).slice(0, 60) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await d.collection(COLLECTION).add(doc);
    // NOTE: quality/model live on the character doc above. We deliberately do
    // NOT write a forge-chat-assets caption record here: the chat hook already
    // files a COPY of this image at a different URL, and the Assets tab dedupes
    // by URL — so a record at this URL would show the same image as a second
    // tile. The label is applied to the hook's copy via the hash-match relabel.
    res.json({ ok: true, id: ref.id, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Write the character doc. Shared by /save and the detached /make job — so a
// generate that finishes after the client left still persists. Characters keep
// their original backgrounds (no transparent version is made).
async function saveCharacterDoc({ url, name, gender, tier, aliases, quality = null, model = null, fullPrompt = '' }) {
  const d = db();
  if (!d) throw new Error('firestore unavailable');
  const doc = {
    name: String(name || '').trim(),
    gender: String(gender || 'they'),
    url: String(url),
    tier: tier === 'main' ? 'main' : 'side',
    aliases: normAliases(aliases),
    quality: ['low', 'medium', 'high'].includes(quality) ? quality : null,
    model: model ? String(model).slice(0, 60) : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    // The exact text that drew this face. A portrait is wholly generated —
    // there is no typed "content" half here, so the whole prompt IS the
    // record.
    ...(fullPrompt ? { fullPrompt: String(fullPrompt).slice(0, 6000) } : {}),
  };
  const ref = await d.collection(COLLECTION).add(doc);
  return { id: ref.id, ...doc };
}

// Generate a portrait AND save it, as a DETACHED background job — the draw +
// save run off the request, so tapping Done / closing the sheet mid-draw never
// loses it (the character still finishes and lands in the list). Poll /make/:id.
const makeJobs = new Map();   // jobId → { id, status, name, character?, error? }
router.post('/make', gated, async (req, res) => {
  try {
    for (const [k, v] of makeJobs) if (Date.now() - v.createdAt > 30 * 60 * 1000) makeJobs.delete(k);
    const { photo, photos, name, gender, tier, quality, aliases } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const list = Array.isArray(photos) ? photos : (photo ? [photo] : []);
    const bufs = [];
    for (const p of list) {
      const m = String(p).match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) bufs.push(Buffer.from(m[2], 'base64'));
    }
    if (!bufs.length) return res.status(400).json({ error: 'photo required' });
    const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
    const id = crypto.randomBytes(8).toString('hex');
    const job = { id, status: 'running', name: String(name).trim(), createdAt: Date.now() };
    makeJobs.set(id, job);
    res.json({ ok: true, jobId: id });
    // Detached — completes even if the client (webview) is gone.
    (async () => {
      try {
        const buf = await generatePortrait(bufs, String(name).trim(), gender, q);
        const url = await saveBufferToStorage(buf, 'image/webp', 'characters');
        job.character = await saveCharacterDoc({ url, name, gender, tier, aliases, quality: q,
          model: 'gpt-image-2', fullPrompt: generatePortrait.lastPrompt || '' });
        job.status = 'done';
      } catch (e) {
        job.status = 'error'; job.error = e.message;
      }
    })();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/make/:id', gated, (req, res) => {
  const job = makeJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json(job);
});

// List saved characters (newest first).
router.get('/', gated, async (req, res) => {
  try {
    const d = db();
    if (!d) return res.json({ characters: [] });
    const snap = await d.collection(COLLECTION).orderBy('createdAt', 'desc').limit(200).get();
    const characters = snap.docs.map(s => {
      const v = s.data();
      return { id: s.id, name: v.name, gender: v.gender, url: v.url, cleanUrl: v.url, tier: v.tier,
        aliases: Array.isArray(v.aliases) ? v.aliases : [],
        quality: v.quality || null, model: v.model || null,
        usedCount: v.usedCount || 0, lastUsedAt: v.lastUsedAt || null,
        createdAt: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : null };
    });
    res.json({ characters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record that these characters were just used — powers the "5 most recent"
// slots on the cast sheet AND on the Playground's character picker. ONE copy
// of the rule: the route below and the Playground's own run (server.js) both
// call this, so "recent" can never mean two different things.
async function markUsed(ids) {
  const d = db();
  if (!d) return 0;
  const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean).slice(0, 20);
  const now = new Date().toISOString();
  for (const id of list) {
    await d.collection(COLLECTION).doc(id)
      .update({ usedCount: admin.firestore.FieldValue.increment(1), lastUsedAt: now })
      .catch(() => {});   // a deleted character is fine to skip
  }
  return list.length;
}

// Fire-and-forget from the client.
router.post('/used', gated, async (req, res) => {
  try {
    if (!db()) return res.status(503).json({ error: 'firestore unavailable' });
    res.json({ ok: true, updated: await markUsed(req.body?.ids) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The saved characters a picker can offer, newest-USED first — the ordering
// the Playground's five recent slots read. Kept beside markUsed so "recent"
// has one definition: her last use of a character, falling back to the day it
// was made for one she has never drawn with.
async function listCharacters(limit = 200) {
  const d = db();
  if (!d) return [];
  const snap = await d.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((s) => {
    const v = s.data();
    return { id: s.id, name: v.name || '', url: v.url || '',
      aliases: Array.isArray(v.aliases) ? v.aliases : [],
      tier: v.tier || 'side',
      lastUsedAt: v.lastUsedAt || null,
      createdAt: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : null };
  }).filter((c) => /^https?:\/\//.test(c.url));
}

// The ids a run picked → the saved records, in the order she picked them,
// deduped and capped. An id that no longer exists is simply dropped, the way
// pickCharacters drops one a story has forgotten.
async function charactersByIds(ids, max = 6) {
  const d = db();
  if (!d) return [];
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))].slice(0, max);
  if (!want.length) return [];
  const snaps = await Promise.all(want.map((id) => d.collection(COLLECTION).doc(id).get().catch(() => null)));
  return snaps
    .map((s, i) => (s && s.exists ? { id: want[i], name: s.data().name || '', url: s.data().url || '' } : null))
    .filter((c) => c && /^https?:\/\//.test(c.url));
}

// Flip a saved character between main (on sheet) and side.
router.post('/:id/tier', gated, async (req, res) => {
  try {
    const tier = req.body && req.body.tier === 'main' ? 'main' : 'side';
    const d = db();
    if (!d) return res.status(503).json({ error: 'firestore unavailable' });
    await d.collection(COLLECTION).doc(req.params.id).update({ tier });
    res.json({ ok: true, id: req.params.id, tier });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backfill/adjust metadata on a saved character (quality badge, model).
router.post('/:id/meta', gated, async (req, res) => {
  try {
    const d = db();
    if (!d) return res.status(503).json({ error: 'firestore unavailable' });
    const patch = {};
    const { quality, model, aliases, name, tier } = req.body || {};
    if (['low', 'medium', 'high'].includes(quality)) patch.quality = quality;
    if (model !== undefined) patch.model = model ? String(model).slice(0, 60) : null;
    if (aliases !== undefined) patch.aliases = normAliases(aliases);
    if (typeof name === 'string' && name.trim()) patch.name = name.trim();
    if (tier === 'main' || tier === 'side') patch.tier = tier;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to set' });
    await d.collection(COLLECTION).doc(req.params.id).update(patch);
    res.json({ ok: true, id: req.params.id, ...patch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Match a dream/story's cast names to saved characters (name + aliases).
// Body: { names: ["J","Dad","the boob girl"] } → { matches:[{name, match|null}] }.
// The client shows these as approve/deny cards, then passes the approved ones
// as characterRefs to the dream/movie render.
router.post('/match', gated, async (req, res) => {
  try {
    const names = (Array.isArray(req.body?.names) ? req.body.names : [])
      .map((n) => String(n || '').trim()).filter(Boolean).slice(0, 12);
    if (!names.length) return res.json({ matches: [] });
    res.json({ matches: await matchCharacters(names) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', gated, async (req, res) => {
  try {
    const d = db();
    if (!d) return res.status(503).json({ error: 'firestore unavailable' });
    await d.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch: detect + crop every person across the uploaded photos.
router.post('/batch/detect', gated, async (req, res) => {
  try {
    const { photos } = req.body || {};
    if (!Array.isArray(photos) || !photos.length) return res.status(400).json({ error: 'photos[] (data URLs) required' });
    const items = [];
    for (let pi = 0; pi < photos.length; pi++) {
      const m = /^data:([^;]+);base64,(.*)$/.exec(String(photos[pi] || ''));
      if (!m) continue;
      const buf = Buffer.from(m[2], 'base64');
      let people = [];
      try { people = await visionPeople(buf, m[1]); } catch (e) { console.warn('character: vision failed —', e.message); }
      for (const p of people) {
        try {
          const crop = await cropPerson(buf, p.box);
          const cropUrl = await saveBufferToStorage(crop, 'image/png', 'characters/crops');
          items.push({ photoIndex: pi, cropUrl, desc: p.desc || '',
            gender: (p.gender === 'he' || p.gender === 'she') ? p.gender : 'they' });
        } catch (e) { console.warn('character: crop failed —', e.message); }
      }
    }
    res.json({ ok: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch: generate + save a character for each named crop (unnamed = skipped).
router.post('/batch/generate', gated, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
    const d = db();
    const named = items.filter(it => it && it.cropUrl && it.name && String(it.name).trim());
    const results = [];
    let idx = 0;
    async function worker() {
      while (idx < named.length) {
        const it = named[idx++];
        try {
          const src = await (await fetch(it.cropUrl, { redirect: 'follow' })).buffer();
          const out = await generatePortrait(src, it.name, it.gender, 'medium');
          const url = await saveBufferToStorage(out, 'image/webp', 'characters');
          let id = null;
          const tier = it.tier === 'main' ? 'main' : 'side';
          if (d) {
            const ref = await d.collection(COLLECTION).add({
              name: String(it.name).trim(), gender: it.gender || 'they', url, tier,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            id = ref.id;
          }
          results.push({ ok: true, id, name: String(it.name).trim(), url, tier });
        } catch (e) {
          results.push({ ok: false, name: it.name, error: e.message });
        }
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker));
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, generatePortrait, buildPrompt, matchCharacters, matchCandidates, matchScore,
  markUsed, listCharacters, charactersByIds };
