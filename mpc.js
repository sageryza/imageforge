// mpc.js — MakePlayingCards (MPC) card-deck fulfilment, cloud edition.
//
// The pipeline generates a deck's card images and they live as URLs (Firebase
// Storage / Replicate / data URLs) — never as files on anyone's computer. This
// module is the fulfilment tail that works from those URLs:
//
//   card image URLs → [prep: bleed + 300 DPI] → order.xml → ZIP hand-off
//
// The ZIP contains press-ready fronts/ (+ backs/ or back.png) and an MPC
// Autofill `order.xml`. Whoever fulfils an Etsy order downloads that one ZIP and
// runs the community MPC Autofill desktop tool from it (`autofill --directory .`)
// to upload into MakePlayingCards, then reviews + checks out by hand. We own only
// the stable prep+XML+bundle step; the fragile browser upload stays with the
// maintained tool. (See docs/mpc-fulfillment.md; mirrors scripts/mpc_card_prep.py
// and scripts/mpc_order_builder.py, kept in sync.)
//
// Mounted at /api/mpc by server.js. Self-contained; sharp + jszip are required
// defensively so a missing lib degrades this one feature instead of blocking boot.

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('mpc: sharp unavailable —', e.message); }
let JSZip = null;
try { JSZip = require('jszip'); } catch (e) { console.warn('mpc: jszip unavailable —', e.message); }

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// Finished (trim) card sizes in inches — MPC's common products.
const CARD_SIZES = {
  poker: [2.5, 3.5], bridge: [2.25, 3.5], tarot: [2.75, 4.75],
  square: [2.5, 2.5], mini: [1.75, 2.5], jumbo: [3.5, 5.0],
};

// Deck-size brackets: smallest tier >= card count is chosen unless overridden.
const DEFAULT_BRACKETS = [18, 36, 55, 72, 90, 108, 126, 144, 162,
  180, 198, 216, 234, 396, 504, 612];

// Exact stock strings MPC's XML accepts, plus friendly aliases.
const STOCKS = {
  '(s30) standard smooth': '(S30) Standard Smooth',
  '(s33) superior smooth': '(S33) Superior Smooth',
  '(m31) linen': '(M31) Linen',
  '(p10) plastic': '(P10) Plastic',
  standard: '(S30) Standard Smooth', s30: '(S30) Standard Smooth',
  superior: '(S33) Superior Smooth', smooth: '(S33) Superior Smooth', s33: '(S33) Superior Smooth',
  linen: '(M31) Linen', m31: '(M31) Linen',
  plastic: '(P10) Plastic', p10: '(P10) Plastic',
};
const DEFAULT_STOCK = '(S30) Standard Smooth';

function normalizeStock(s) {
  if (!s) return DEFAULT_STOCK;
  return STOCKS[String(s).trim().toLowerCase()] || s;
}

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

function px(inches, dpi) { return Math.round(inches * dpi); }

function pickBracket(n, brackets) {
  for (const b of brackets) if (n <= b) return b;
  return brackets[brackets.length - 1];
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slug(name) {
  return String(name || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'card';
}

// Fetch any card image reference (http(s) URL or data: URL) into a Buffer.
async function fetchImageBuffer(ref) {
  if (typeof ref !== 'string' || !ref) throw new Error('empty image reference');
  if (ref.startsWith('data:')) {
    const comma = ref.indexOf(',');
    return Buffer.from(ref.slice(comma + 1), 'base64');
  }
  const r = await fetch(ref, { redirect: 'follow' });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${ref.slice(0, 70)}`);
  return await r.buffer();
}

function geometry(size, bleed, dpi) {
  const [wIn, hIn] = CARD_SIZES[size];
  const trimW = px(wIn, dpi), trimH = px(hIn, dpi);
  const fullW = px(wIn + 2 * bleed, dpi), fullH = px(hIn + 2 * bleed, dpi);
  const offX = Math.floor((fullW - trimW) / 2), offY = Math.floor((fullH - trimH) / 2);
  return { wIn, hIn, trimW, trimH, fullW, fullH, offX, offY };
}

// Turn one raw card image into a press-ready PNG (exact card size + bleed + DPI).
//   mode: cover (fill + center-crop) | extend (fit trim, mirror the bleed) | fit
// Returns { buffer, effDpi, cropped } — effDpi is how sharply the art resolves at
// card size (a low value flags grid-sourced / low-res art that will print soft).
async function prepCardImage(buf, opts) {
  const { size = 'poker', mode = 'cover', bleed = 0.125, dpi = 300, bg = '#ffffff' } = opts || {};
  if (!sharp) throw new Error('sharp not installed');
  if (!CARD_SIZES[size]) throw new Error(`unknown size '${size}'`);
  const g = geometry(size, bleed, dpi);

  const meta = await sharp(buf).metadata();
  const effDpi = Math.min(meta.width / g.wIn, meta.height / g.hIn);

  let img = sharp(buf).flatten({ background: bg });
  if (mode === 'cover') {
    img = img.resize(g.fullW, g.fullH, { fit: 'cover', position: 'centre' });
  } else if (mode === 'extend') {
    img = img.resize(g.trimW, g.trimH, { fit: 'cover', position: 'centre' })
      .extend({
        top: g.offY, bottom: g.fullH - g.trimH - g.offY,
        left: g.offX, right: g.fullW - g.trimW - g.offX, extendWith: 'mirror',
      });
  } else if (mode === 'fit') {
    img = img.resize(g.trimW, g.trimH, { fit: 'contain', background: bg })
      .extend({
        top: g.offY, bottom: g.fullH - g.trimH - g.offY,
        left: g.offX, right: g.fullW - g.trimW - g.offX, extendWith: 'mirror',
      });
  } else {
    throw new Error(`unknown mode '${mode}'`);
  }
  const buffer = await img.png().withMetadata({ density: dpi }).toBuffer();
  return { buffer, effDpi, meta };
}

// Build the MPC Autofill order.xml (local-files dialect). fronts/backs are arrays
// of { path, name, slot }; cardback is the default back's relative path.
function buildOrderXml({ fronts, backs, cardback, quantity, bracket, stock, foil }) {
  const card = (c) =>
    `    <card>\n` +
    `      <id>${xmlEscape(c.path)}</id>\n` +
    `      <sourceType>Local File</sourceType>\n` +
    `      <slots>${c.slot}</slots>\n` +
    `      <name>${xmlEscape(c.name)}</name>\n` +
    `      <query>${xmlEscape(slug(c.name))}</query>\n` +
    `    </card>`;
  let xml = `<?xml version="1.0" ?>\n<order>\n`;
  xml += `  <details>\n`;
  xml += `    <quantity>${quantity}</quantity>\n`;
  xml += `    <bracket>${bracket}</bracket>\n`;
  xml += `    <stock>${xmlEscape(stock)}</stock>\n`;
  xml += `    <foil>${foil ? 'true' : 'false'}</foil>\n`;
  xml += `  </details>\n`;
  xml += `  <fronts>\n${fronts.map(card).join('\n')}\n  </fronts>\n`;
  if (backs && backs.length) {
    xml += `  <backs>\n${backs.map(card).join('\n')}\n  </backs>\n`;
  }
  xml += `  <cardback>${xmlEscape(cardback)}</cardback>\n`;
  xml += `</order>\n`;
  return xml;
}

const README = (deckName, cards, bracket, stock) =>
  `MPC order bundle — ${deckName}\n` +
  `${'='.repeat(40)}\n\n` +
  `${cards} card front(s), MPC deck bracket ${bracket}, stock: ${stock}.\n\n` +
  `To upload into MakePlayingCards:\n` +
  `  1. Unzip this folder.\n` +
  `  2. Install the MPC Autofill desktop tool: https://mpcfill.com\n` +
  `  3. From this folder, run:  autofill --directory .\n` +
  `     It signs into your MPC account, fills every card slot from order.xml,\n` +
  `     and auto-saves the project.\n` +
  `  4. Review the saved project in your MPC account and check out by hand.\n\n` +
  `Images are already press-ready: correct card size with 1/8" bleed at 300 DPI.\n` +
  `Tip: before a full run, test with a 2-3 card folder first to confirm the\n` +
  `desktop tool loads it and places images in the right slots.\n`;

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Gate: when STUDIO_TOKEN is set, everything except GET /status needs the header.
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    ready: Boolean(sharp && JSZip),
    sharp: Boolean(sharp),
    zip: Boolean(JSZip),
    firebase: Boolean(bucketOrNull()),
    sizes: Object.keys(CARD_SIZES),
    modes: ['cover', 'extend', 'fit'],
    default_stock: DEFAULT_STOCK,
  });
});

// POST /prep-order
// Body: {
//   deckName?, size?, mode?, stock?, foil?, bleed?, dpi?, bg?, bracket?,
//   fronts: [url|dataURL, ...]        (required),
//   backs?:  [url|dataURL, ...]       (per-card, matched to fronts by position),
//   back?:   url|dataURL              (single shared back for the whole deck),
//   names?:  [str, ...]               (optional per-card names -> filenames/labels)
// }
// → ZIP (press-ready fronts/ + backs|back + order.xml + README). Returns a
//   Firebase download URL when Storage is set, else streams the zip binary.
router.post('/prep-order', async (req, res) => {
  try {
    if (!sharp || !JSZip) {
      return res.status(501).json({
        error: 'prep unavailable: ' +
          [!sharp && 'sharp', !JSZip && 'jszip'].filter(Boolean).join(' + ') + ' not installed',
      });
    }
    const b = req.body || {};
    const deckName = (b.deckName || 'deck').toString().trim() || 'deck';
    const size = b.size || 'poker';
    const mode = b.mode || 'cover';
    const stock = normalizeStock(b.stock);
    const foil = Boolean(b.foil);
    const bleed = b.bleed != null ? Number(b.bleed) : 0.125;
    const dpi = b.dpi != null ? Number(b.dpi) : 300;
    const bg = b.bg || '#ffffff';
    if (!CARD_SIZES[size]) return res.status(400).json({ error: `unknown size '${size}'` });
    if (!['cover', 'extend', 'fit'].includes(mode)) return res.status(400).json({ error: `unknown mode '${mode}'` });

    const fronts = Array.isArray(b.fronts) ? b.fronts.filter(Boolean) : [];
    if (!fronts.length) return res.status(400).json({ error: 'fronts[] is required (image URLs or data URLs)' });
    const backs = Array.isArray(b.backs) ? b.backs.filter(Boolean) : [];
    const sharedBack = typeof b.back === 'string' ? b.back : null;
    const names = Array.isArray(b.names) ? b.names : [];

    const pad = fronts.length > 99 ? 3 : 2;
    const warnings = [];
    const zip = new JSZip();

    const frontCards = [];
    for (let i = 0; i < fronts.length; i++) {
      const label = names[i] ? slug(names[i]) : 'card';
      const fname = `${String(i + 1).padStart(pad, '0')}_${label}.png`;
      const rel = `fronts/${fname}`;
      const raw = await fetchImageBuffer(fronts[i]);
      const { buffer, effDpi } = await prepCardImage(raw, { size, mode, bleed, dpi, bg });
      zip.file(rel, buffer);
      frontCards.push({ path: rel, name: fname, slot: i });
      if (effDpi < dpi - 1) {
        warnings.push(`card ${i + 1}${names[i] ? ` (${names[i]})` : ''}: art resolves to ~${Math.round(effDpi)} DPI ` +
          `(want ${dpi}) — likely a grid/low-res source; will print soft`);
      }
    }

    // Backs: per-card (matched by position) OR a single shared back.
    let cardback = null;
    const backCards = [];
    if (backs.length) {
      for (let i = 0; i < backs.length && i < fronts.length; i++) {
        const fname = `${String(i + 1).padStart(pad, '0')}_${names[i] ? slug(names[i]) : 'card'}.png`;
        const rel = `backs/${fname}`;
        const raw = await fetchImageBuffer(backs[i]);
        const { buffer, effDpi } = await prepCardImage(raw, { size, mode, bleed, dpi, bg });
        zip.file(rel, buffer);
        backCards.push({ path: rel, name: fname, slot: i });
        if (effDpi < dpi - 1) warnings.push(`back ${i + 1}: art resolves to ~${Math.round(effDpi)} DPI — will print soft`);
      }
      if (backs.length !== fronts.length) {
        warnings.push(`${backs.length} backs vs ${fronts.length} fronts; unmatched fronts use the default back`);
      }
      cardback = backCards[0].path; // slot 0's back is MPC's default cardback
    } else if (sharedBack) {
      const raw = await fetchImageBuffer(sharedBack);
      const { buffer, effDpi } = await prepCardImage(raw, { size, mode, bleed, dpi, bg });
      zip.file('back.png', buffer);
      cardback = 'back.png';
      if (effDpi < dpi - 1) warnings.push(`shared back: art resolves to ~${Math.round(effDpi)} DPI — will print soft`);
    } else {
      return res.status(400).json({ error: 'no back image: provide back (shared) or backs[] (per-card)' });
    }

    // Per-card back overrides: only the slots whose back differs from the default.
    const overrides = backCards.filter((c) => c.path !== cardback);

    const n = fronts.length;
    const bracket = b.bracket ? Number(b.bracket) : pickBracket(n, DEFAULT_BRACKETS);
    if (n > bracket) warnings.push(`${n} cards exceeds bracket ${bracket}; the desktop tool will offer to split the order`);

    const orderXml = buildOrderXml({
      fronts: frontCards, backs: overrides, cardback,
      quantity: n, bracket, stock, foil,
    });
    zip.file('order.xml', orderXml);
    zip.file('README.txt', README(deckName, n, bracket, stock));

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const safeName = slug(deckName);
    const zipName = `${safeName}_mpc_order.zip`;

    const bucket = bucketOrNull();
    if (bucket) {
      const filename = `mpc-orders/${Date.now()}-${safeName}.zip`;
      const file = bucket.file(filename);
      await file.save(zipBuf, { metadata: { contentType: 'application/zip' } });
      await file.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      return res.json({
        ok: true, url, filename: zipName, deckName,
        cards: n, bracket, stock, mode, size, foil,
        backs: backCards.length ? 'per-card' : 'shared',
        warnings,
      });
    }
    // No Firebase — stream the zip binary directly.
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    if (warnings.length) res.setHeader('X-MPC-Warnings', warnings.join(' | '));
    return res.send(zipBuf);
  } catch (err) {
    console.error('mpc/prep-order failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  configured: () => Boolean(sharp && JSZip),
  prepCardImage,
  buildOrderXml,
  normalizeStock,
  pickBracket,
  CARD_SIZES,
};
