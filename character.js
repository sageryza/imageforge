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
  styleRef = fs.readFileSync(path.join(__dirname, 'refs', 'movie-style.jpg'));
} catch {
  console.warn('character: no refs/movie-style.jpg — Character Creator disabled');
}

function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function db() {
  try { return admin.apps.length ? admin.firestore() : null; } catch { return null; }
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

// The exact prompt, wired in; only the name, pronouns, and an optional extra
// note (e.g. "no hat") vary.
function buildPrompt(name, gender, note) {
  const p = pronouns(gender);
  const nm = String(name || '').trim() || 'them';
  let prompt = `Make a character reference image, just one straightforward face looking forward, `
    + `using the first image as a style reference and the second image as the subject. `
    + `${p.poss} name is ${nm}. No other text or images, just ${p.obj} with ${p.poss2} name on it.`;
  const n = String(note || '').trim();
  if (n) prompt += ` ${n}`;
  return prompt;
}

async function generatePortrait(photoBuffer, name, gender, quality = 'medium', note = '', retries = 2) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  if (!styleRef) throw new Error('style reference missing');
  const prompt = buildPrompt(name, gender, note);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('image[]', styleRef, { filename: 'style.jpg', contentType: 'image/jpeg' });
      form.append('image[]', photoBuffer, { filename: 'subject.png', contentType: 'image/png' });
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

// Remove the cream paper OUTSIDE the framed box in one flood-fill pass (from
// the four corners), leaving the box + name on transparency — so the sheet
// tiles cleanly on uniform cream with no mismatched halos. Server-side (sharp)
// so the browser needs no CORS-tainted canvas. Falls back to the raw image if
// anything goes wrong.
async function cleanBox(buffer) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const cr = data[0], cg = data[1], cb = data[2];         // top-left = paper colour
  const TOL = 120;                                        // sum of abs channel diffs
  const visited = new Uint8Array(w * h);
  const stack = [];
  for (const [sx, sy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) stack.push(sx, sy);
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * ch;
    if (Math.abs(data[i] - cr) + Math.abs(data[i + 1] - cg) + Math.abs(data[i + 2] - cb) > TOL) continue;
    data[i + 3] = 0;                                      // paper → transparent
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return await sharp(data, { raw: { width: w, height: h, channels: ch } }).trim().png().toBuffer();
}

// ── Batch mode: find every person in a photo, crop head-and-shoulders ──
// GPT-4o vision returns a head-and-shoulders box per person; sharp crops each.
async function visionPeople(photoBuffer, mime) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const dataUrl = `data:${mime || 'image/jpeg'};base64,${photoBuffer.toString('base64')}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'This is an automatic photo-cropping tool that cuts each person out of a group photo into their own separate portrait. For each person, ordered left to right, return the crop rectangle covering their head and shoulders as fractions of the image width/height [x, y, w, h] (top-left origin), a short look (hair and clothing), and a gender guess ("he","she","unknown"). Respond ONLY as JSON: {"people":[{"box":[x,y,w,h],"desc":"...","gender":"..."}]}' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ] }],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    }),
    timeout: 60000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  let parsed = {};
  try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); } catch {}
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
    const { photo, name, gender, quality, note } = req.body || {};
    if (!photo || typeof photo !== 'string') return res.status(400).json({ error: 'photo (data URL) required' });
    const m = /^data:([^;]+);base64,(.*)$/.exec(photo);
    if (!m) return res.status(400).json({ error: 'photo must be a data URL' });
    const buf = Buffer.from(m[2], 'base64');
    const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
    const out = await generatePortrait(buf, name, gender, q, note);
    const url = await saveBufferToStorage(out, 'image/webp', 'characters');
    res.json({ ok: true, url, name: String(name || '').trim(), gender: String(gender || 'they') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persist a generated character. tier 'main' shows on the sheet; 'side' is
// saved but off the sheet.
router.post('/save', gated, async (req, res) => {
  try {
    const { url, name, gender, tier } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });
    const d = db();
    if (!d) return res.status(503).json({ error: 'firestore unavailable' });
    // flood-fill a clean (transparent-background) version for the sheet
    let cleanUrl = String(url);
    try {
      const src = await (await fetch(String(url), { redirect: 'follow' })).buffer();
      const clean = await cleanBox(src);
      cleanUrl = await saveBufferToStorage(clean, 'image/png', 'characters/clean');
    } catch (e) { console.warn('character: cleanBox failed —', e.message); }
    const doc = {
      name: String(name || '').trim(),
      gender: String(gender || 'they'),
      url: String(url),
      cleanUrl,
      tier: tier === 'main' ? 'main' : 'side',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await d.collection(COLLECTION).add(doc);
    res.json({ ok: true, id: ref.id, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List saved characters (newest first).
router.get('/', gated, async (req, res) => {
  try {
    const d = db();
    if (!d) return res.json({ characters: [] });
    const snap = await d.collection(COLLECTION).orderBy('createdAt', 'desc').limit(200).get();
    const characters = snap.docs.map(s => {
      const v = s.data();
      return { id: s.id, name: v.name, gender: v.gender, url: v.url, cleanUrl: v.cleanUrl || v.url, tier: v.tier,
        createdAt: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : null };
    });
    res.json({ characters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
          let cleanUrl = url, id = null;
          const tier = it.tier === 'main' ? 'main' : 'side';
          if (d) {
            try { cleanUrl = await saveBufferToStorage(await cleanBox(out), 'image/png', 'characters/clean'); }
            catch (e) { console.warn('character: cleanBox failed —', e.message); }
            const ref = await d.collection(COLLECTION).add({
              name: String(it.name).trim(), gender: it.gender || 'they', url, cleanUrl, tier,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            id = ref.id;
          }
          results.push({ ok: true, id, name: String(it.name).trim(), url, cleanUrl, tier });
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

module.exports = { router, generatePortrait, buildPrompt };
