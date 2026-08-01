// ─── Journal scans (/api/journal) ───────────────────────────────────────────
//
// Uploading the master journal PDF — Sophie's hand-sorted compilation, ~2,336
// pages and most likely close to a gigabyte.
//
// The bytes must NOT pass through this server: Render's free instance has
// 512MB for the whole app, so buffering a 1GB PDF would kill it. Instead the
// server mints a RESUMABLE UPLOAD SESSION against membry Storage and hands
// back the URL; the Mac uploads directly to Google. Nothing here ever holds
// the file, and the laptop still needs no credentials of its own.
const express = require('express');

const router = express.Router();
const FOLDER = 'journal-scans';
const MANIFEST = FOLDER + '/manifest.json';

let deps = { bucket: null };
function init(d) { deps = { ...deps, ...d }; }

async function bucket() {
  if (!deps.bucket) throw new Error('membry credential not configured');
  const b = await deps.bucket();
  if (!b) throw new Error('membry credential not configured');
  return b;
}
const clean = (n) => String(n || '')
  .replace(/[\/\\]/g, '_')
  .replace(/[^\w .,'()\-]/g, '')
  .slice(0, 160)
  .trim() || 'journal.pdf';

const gate = (req, res, next) => {
  const token = process.env.STUDIO_TOKEN;
  if (!token) return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  res.status(401).json({ error: 'unauthorized' });
};

router.get('/status', async (req, res) => {
  try {
    const b = await bucket();
    const [files] = await b.getFiles({ prefix: FOLDER + '/' });
    const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
    res.json({
      ok: true,
      scans: pdfs.length,
      files: pdfs.map(f => ({
        name: f.name.replace(FOLDER + '/', ''),
        mb: +(Number(f.metadata.size || 0) / 1e6).toFixed(1),
      })),
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Hand back a URL the Mac can upload straight to. `origin` has to match the
// header the uploader will send, or Google rejects the session.
router.post('/upload-url', gate, express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const { name, contentType, origin } = req.body || {};
    const objectPath = `${FOLDER}/${clean(name)}`;
    const file = (await bucket()).file(objectPath);
    const [uploadUrl] = await file.createResumableUpload({
      origin: origin || undefined,
      metadata: { contentType: contentType || 'application/pdf' },
    });
    res.json({ ok: true, uploadUrl, objectPath });
  } catch (err) {
    console.warn('journal upload-url failed —', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Called once the upload lands: make it readable and record it in the manifest
// beside the scans already there.
router.post('/register', gate, express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const { name, pages, master } = req.body || {};
    const b = await bucket();
    const objectPath = `${FOLDER}/${clean(name)}`;
    const file = b.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: 'that upload is not in storage yet' });
    const [meta] = await file.getMetadata();

    let manifest = [];
    try {
      const [buf] = await b.file(MANIFEST).download();
      const parsed = JSON.parse(buf.toString());
      if (Array.isArray(parsed)) manifest = parsed;
    } catch { /* first scan, or manifest missing — start a fresh list */ }

    const entry = {
      name: clean(name),
      url: `https://storage.googleapis.com/${b.name}/${encodeURI(objectPath)}`,
      size: Number(meta.size || 0),
      pages: Number(pages) || null,
      master: !!master,                   // set only for the hand-sorted compilation
      uploadedAt: new Date().toISOString(),
    };
    manifest = manifest.filter(m => m && m.name !== entry.name);
    manifest.push(entry);
    await b.file(MANIFEST).save(JSON.stringify(manifest, null, 1), { contentType: 'application/json' });
    res.json({ ok: true, entry, scans: manifest.length });
  } catch (err) {
    console.warn('journal register failed —', err.message);
    res.status(502).json({ error: err.message });
  }
});

// The timeline page-map: timeline page -> scan page -> image URL. Gated —
// this hands out links to every page of the journal.
router.get('/map', gate, async (req, res) => {
  try {
    const deck = deps.deckBucket ? await deps.deckBucket() : null;
    if (!deck) return res.status(503).json({ error: 'not configured' });
    const [buf] = await deck.file('dream-archive/timeline-map.json').download();
    res.set('Cache-Control', 'private, max-age=600').type('application/json').send(buf);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = { router, init };
