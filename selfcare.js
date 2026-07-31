// Memory Passport — the stamps half of Sticker Day (/selfcare).
//
// Four slots a day. You type a small moment that happened ("the light on the
// kitchen wall at four", "Dana called about the dog") and it comes back drawn
// as a passport stamp you stick into a slot.
//
// The art is the SAME house line style as the self-care stickers and the Witch
// School lesson cards, but on a pastel palette (soft pink, mint, lilac) — so
// the passport reads as its own thing next to the stickers.
//
// Only the INSIDE of the stamp is generated. The white scalloped border is
// drawn by the page as an SVG path, because a model draws a scallop
// differently every time and the whole point of a stamp is that the frame is
// identical on all of them.
//
// Rendering is a BACKGROUND JOB (house rule — nothing slow blocks a request,
// nobody watches a spinner): POST returns an id in ~0.2s, the page polls and
// resumes polling when you come back, and the result is persisted so leaving
// the app never loses a stamp you already paid for.
const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');

const router = express.Router();
const COLLECTION = 'forge-selfcare-stamps';
const REFS = ['witch-school/refs/style-1.png', 'witch-school/refs/style-2.png'];

// Same line quality as the stickers, repainted pastel. The palette is stated
// twice on purpose — the attached refs are warm gold/salmon and the model
// drifts back to them if it's only said once.
const STYLE = 'Use the attached images ONLY as a STYLE reference for the DRAWING STYLE — match their bold confident black ink outlines, flat playful modern editorial illustration, flat colors with NO gradients and minimal shading. IGNORE the reference colours completely. Instead use a soft PASTEL palette only: pale pink, mint green, lilac, butter yellow, powder blue, on a plain off-white background. Every colour must be pale and pastel — no saturated or warm golden tones. ';
const END = ' A simple scene with one clear subject and generous empty space, drawn to fill a square. No border, no frame, no postage stamp edge, no scalloped edge. Absolutely no text, no words, no letters, no numbers.';

const MAX_TEXT = 240;

// The page is public and image generation costs real money, so a single
// address can't sit there minting stamps. The app's own rule is 4 a day; this
// is only the abuse ceiling behind it.
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();          // crude, but it can't grow forever
  return false;
}

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

let refCache = null;
async function styleRefs() {
  if (refCache) return refCache;
  const out = [];
  for (const remote of REFS) {
    const local = '/tmp/sc-ref-' + remote.split('/').pop();
    if (!fs.existsSync(local)) await bucket().file(remote).download({ destination: local });
    out.push(local);
  }
  refCache = out;
  return out;
}

async function drawStamp(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const refs = await styleRefs();
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', STYLE + 'Draw this moment from someone\'s day: ' + text + '.' + END);
  fd.append('size', '1024x1024');
  fd.append('quality', 'low');                 // a stamp is small on screen; low is ~a cent
  fd.append('n', '1');
  for (const p of refs) {
    fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), p.split('/').pop());
  }
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: 'Bearer ' + key }, body: fd,
  });
  const d = await r.json();
  if (d.error) throw new Error(String(d.error.message || d.error.code || 'image failed').slice(0, 200));
  if (!d.data || !d.data[0] || !d.data[0].b64_json) throw new Error('no image returned');
  return Buffer.from(d.data[0].b64_json, 'base64');
}

async function put(buf, path, contentType) {
  const file = bucket().file(path);
  await file.save(buf, { metadata: { contentType }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${path}`;
}

// The stamp is displayed at ~150px but generated at 1024, and a passport page
// stacks up over time — so a display copy rides along, same as the library art
// gets from scripts/selfcare-thumbs.js. The full-size PNG is always kept.
async function upload(buf, id) {
  const url = await put(buf, `selfcare/passport/${id}.png`, 'image/png');
  let thumb = null;
  try {
    const sharp = require('sharp');
    const webp = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 }).toBuffer();
    thumb = await put(webp, `selfcare/passport/${id}-512.webp`, 'image/webp');
  } catch (e) { /* the full-size PNG is enough on its own */ }
  return { url, thumb };
}

// Fire-and-forget: the request has already been answered by the time this runs.
async function render(id, text) {
  try {
    const buf = await drawStamp(text);
    const { url, thumb } = await upload(buf, id);
    await db().collection(COLLECTION).doc(id).set(
      { status: 'done', url, thumb, finishedAt: Date.now() }, { merge: true });
  } catch (e) {
    await db().collection(COLLECTION).doc(id).set(
      { status: 'failed', error: String(e.message || e).slice(0, 300), finishedAt: Date.now() },
      { merge: true },
    ).catch(() => {});
  }
}

router.get('/status', (req, res) => {
  res.json({ ok: true, openai: !!process.env.OPENAI_API_KEY, firebase: !!admin.apps.length });
});

// Start a stamp. Returns immediately with the id to poll.
router.post('/stamp', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const text = String((req.body && req.body.text) || '').trim().slice(0, MAX_TEXT);
    if (!text) return res.status(400).json({ error: 'text required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'storage unavailable' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'image generation unavailable' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many stamps for now — try again later' });

    const ref = db().collection(COLLECTION).doc();
    await ref.set({ text, status: 'rendering', day: String((req.body && req.body.day) || ''), createdAt: Date.now() });
    render(ref.id, text);                       // deliberately not awaited
    res.json({ id: ref.id, status: 'rendering', poll: `/api/selfcare/stamp/${ref.id}` });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

router.get('/stamp/:id', async (req, res) => {
  try {
    const doc = await db().collection(COLLECTION).doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    const d = doc.data();
    res.json({ id: doc.id, status: d.status, url: d.url || null, thumb: d.thumb || null, text: d.text || '', error: d.error || null });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

module.exports = { router };
