// ingest.js — import externally-made card art into the pipeline.
//
// The "bring your own Midjourney" path: Sophie generates in her OWN Midjourney
// account and bulk-downloads the keepers by keyword with a browser export tool
// (that step runs on her computer — Midjourney has no API, it's her account, and
// it needs a browser, so the server can't do it). This module automates
// everything AFTER that: it accepts the downloaded images (uploaded from the
// /import page, or mirrored from URLs), stores them in Firebase as named,
// keyword-tagged batches, and hands a batch to the rest of the pipeline — the
// same Claude style-review → print prep → MPC flow the APIFRAME art uses.
//
// Mounted at /api/ingest by server.js. STUDIO_TOKEN-gated (only GET /status open).

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* direct */ }
}

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40);
}

// Resolve a data: URL or http(s) URL to a { buf, ct }.
async function toBuffer(ref) {
  if (typeof ref !== 'string' || !ref) throw new Error('empty image reference');
  if (ref.startsWith('data:')) {
    const comma = ref.indexOf(',');
    const ct = ref.slice(5, ref.indexOf(';')) || 'image/png';
    return { buf: Buffer.from(ref.slice(comma + 1), 'base64'), ct };
  }
  const r = await fetch(ref, { agent: proxyAgent || undefined, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${ref.slice(0, 60)}`);
  return { buf: await r.buffer(), ct: r.headers.get('content-type') || 'image/png' };
}

function extFor(ct) {
  return ct.includes('webp') ? 'webp' : (ct.includes('jpeg') || ct.includes('jpg')) ? 'jpg' : 'png';
}

async function saveOne(bucket, batch, keyword, buf, ct, i) {
  const kw = keyword ? slug(keyword) + '__' : '';
  const name = `ingest/${slug(batch) || 'default'}/${kw}${Date.now()}-`
    + `${Math.random().toString(36).slice(2, 7)}-${i}.${extFor(ct)}`;
  const file = bucket.file(name);
  await file.save(buf, { metadata: { contentType: ct } });
  await file.makePublic();
  return { name, url: `https://storage.googleapis.com/${bucket.name}/${name}` };
}

const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(bucketOrNull()) });
});

// POST /upload — import a batch of images.
// Body: { batch?, keyword?, images: [dataURL | httpURL, ...] }
router.post('/upload', async (req, res) => {
  try {
    const b = req.body || {};
    const images = Array.isArray(b.images) ? b.images.filter(Boolean) : [];
    if (!images.length) return res.status(400).json({ error: 'images[] required (data URLs or http URLs)' });
    const bucket = bucketOrNull();
    if (!bucket) return res.status(501).json({ error: 'Firebase Storage not configured — cannot store the batch' });
    const out = [];
    for (let i = 0; i < images.length; i++) {
      const { buf, ct } = await toBuffer(images[i]);
      out.push(await saveOne(bucket, b.batch, b.keyword, buf, ct, i));
    }
    res.json({
      ok: true, batch: slug(b.batch) || 'default', keyword: b.keyword || null,
      count: out.length, images: out.map((o) => o.url), files: out,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /batch/:batch?keyword=&limit= — list a batch's images (keyword = substring
// filter on the filename, so a keyword you tagged at upload time is searchable).
router.get('/batch/:batch', async (req, res) => {
  try {
    const bucket = bucketOrNull();
    if (!bucket) return res.status(501).json({ error: 'Firebase not configured' });
    const prefix = `ingest/${slug(req.params.batch) || 'default'}/`;
    const [files] = await bucket.getFiles({ prefix });
    const kw = req.query.keyword ? slug(req.query.keyword) : '';
    let imgs = files
      .map((f) => ({ name: f.name, url: `https://storage.googleapis.com/${bucket.name}/${f.name}` }))
      .filter((x) => /\.(png|jpe?g|webp)$/i.test(x.name))
      .filter((x) => !kw || x.name.toLowerCase().includes(kw));
    if (req.query.limit) imgs = imgs.slice(0, Number(req.query.limit));
    res.json({
      batch: slug(req.params.batch) || 'default', keyword: req.query.keyword || null,
      count: imgs.length, images: imgs.map((i) => i.url), files: imgs,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /batches — list the batch names that exist.
router.get('/batches', async (req, res) => {
  try {
    const bucket = bucketOrNull();
    if (!bucket) return res.status(501).json({ error: 'Firebase not configured' });
    const [files] = await bucket.getFiles({ prefix: 'ingest/' });
    const set = new Set();
    for (const f of files) {
      const m = f.name.match(/^ingest\/([^/]+)\//);
      if (m) set.add(m[1]);
    }
    res.json({ batches: [...set].sort() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { router, toBuffer, slug };
