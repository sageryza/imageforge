#!/usr/bin/env node
// triset-print-letter.js — her chosen 61 cards on LETTER paper, every card
// point-UP, each inside a white border with a hairline cut line, ready to cut
// out (2026-09-04, Sophie: "i print all the cards on letter paper not legal
// and cut them out. this time, add white borders and no upside down").
//
// The earlier nature-set sheets tessellated the triangles (every other card
// upside down, edge to edge) to fit legal paper; cutting one edge cut two
// cards. This one spends paper instead: 3 across, 4 down, 12 to a page, six
// pages for 61 cards, and the cut line runs OUTSIDE the picture through a
// white rim — so a wobble of the scissors lands in white, never in the art.
//
//   node scripts/triset-print-letter.js                 build; writes the html + pdf next to --out
//   node scripts/triset-print-letter.js --go            … and upload the pdf to the Dump, print the link
//   --side 2.2 --border 0.1                             inches: the picture's side, the white rim
//   --outline off                                       no hairline cut line — just the white rim
//                                                       (her ask the same day: "two print versions,
//                                                       one without outlines"); the default draws it
//   --out <dir>                                         where the html/pdf land (default: the scratchpad)
//
// The pictures are the CURRENT cut of every card (`k` on the deck), inlined
// as data URIs so the PDF render needs no network. It costs nothing.
const fs = require('fs');
const path = require('path');
const { readDeck } = require('./lib/dominoes-deck');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const R3 = Math.sqrt(3);

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

// Geometry in inches. The picture is an equilateral triangle of side S; the
// cut line is the same triangle pushed out by B on every side, which lands
// its apex 2B above the picture's apex and its base B below the base.
function geometry(S, B) {
  const outerSide = S + 2 * B * R3;
  return {
    S, B, outerSide,
    outerH: outerSide * R3 / 2,
    imgH: S * R3 / 2,
    imgX: B * R3, // the picture's left edge inside the outer box
    imgY: 2 * B,  // the picture's apex below the outer apex
  };
}

// letter, 0.3in margins; the plan says how many fit and where each one sits
function layout(g, opts) {
  opts = opts || {};
  const pageW = 8.5, pageH = 11, m = opts.margin == null ? 0.3 : opts.margin, gap = opts.gap == null ? 0.1 : opts.gap;
  const cols = Math.max(1, Math.floor((pageW - 2 * m + gap) / (g.outerSide + gap)));
  const rows = Math.max(1, Math.floor((pageH - 2 * m + gap) / (g.outerH + gap)));
  return { pageW, pageH, margin: m, gap, cols, rows, perPage: cols * rows };
}

// The PDF's copy of each picture is a JPEG flattened onto white: Chromium
// embeds a JPEG as-is but re-encodes anything else losslessly, which made the
// first render 53MB for 61 cards (measured) — too heavy to open on a phone.
// The transparent corners land on the white cut-line triangle either way, so
// nothing about the print changes; the ORIGINAL cut is never touched.
async function fileData(file) {
  const sharp = require('sharp');
  const buf = await sharp(file).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

// one card: the outer (cut) triangle in white with a hairline, the picture
// point-up inside it. Everything in inches via the SVG's own units.
function cardSvg(g, src, name, outline) {
  const w = g.outerSide, h = g.outerH;
  const outer = `${w / 2},0 ${w},${h} 0,${h}`;
  const stroke = outline === false ? '' : ' stroke="#b9b3a8" stroke-width="0.006" stroke-linejoin="round"';
  return `<svg class="card" width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}" data-name="${esc(name)}">`
    + `<polygon points="${outer}" fill="#fff"${stroke}/>`
    + `<image href="${src}" x="${g.imgX}" y="${g.imgY}" width="${g.S}" height="${g.imgH}"/>`
    + `</svg>`;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

async function buildHtml(deck, srcOf, opts) {
  opts = opts || {};
  const srcs = new Map();
  for (const c of deck) srcs.set(c, await srcOf(c));
  const g = geometry(opts.side || 2.2, opts.border == null ? 0.1 : opts.border);
  const L = layout(g, opts);
  const pages = [];
  for (let i = 0; i < deck.length; i += L.perPage) pages.push(deck.slice(i, i + L.perPage));
  const body = pages.map((cards, p) =>
    `<section class="page"><div class="grid">`
    + cards.map(c => cardSvg(g, srcs.get(c), c.n, opts.outline)).join('')
    + `</div><footer>Similitude · ${deck.length} cards · ${p + 1} / ${pages.length}</footer></section>`).join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Similitude — 61 cards, letter</title>
<style>
@page { size: letter; margin: ${L.margin}in; }
html, body { margin: 0; padding: 0; background: #fff; }
.page { width: ${L.pageW - 2 * L.margin}in; height: ${L.pageH - 2 * L.margin}in; page-break-after: always; position: relative; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.grid { display: grid; grid-template-columns: repeat(${L.cols}, ${g.outerSide}in); gap: ${L.gap}in; justify-content: center; }
.card { display: block; }
footer { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font: 7pt -apple-system, system-ui, sans-serif; color: #9a948a; }
</style></head><body>${body}</body></html>`;
  return { html, geometry: g, layout: L, pages: pages.length };
}

// the pre-installed Chromium (PLAYWRIGHT_BROWSERS_PATH) — the house lookup
function exe() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall through */ }
  return null;
}

async function renderPdf(htmlFile, pdfFile) {
  const { chromium } = require('playwright');
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();
  await page.goto('file://' + htmlFile, { waitUntil: 'load' });
  await page.pdf({ path: pdfFile, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
}

async function upload(pdfFile, name) {
  const buf = fs.readFileSync(pdfFile);
  const q = new URLSearchParams({ bundle: 'Similitude print', filename: name }).toString();
  const r = await fetch(BASE + '/api/drop/upload-file?' + q, {
    method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: buf,
  });
  const body = await r.json();
  if (!r.ok || !body.ok) throw new Error('upload failed: ' + JSON.stringify(body));
  return body;
}

async function main() {
  const deck = readDeck();
  const out = arg('out', process.env.SCRATCH || path.join(process.env.TMPDIR || '/tmp', 'triset-print'));
  fs.mkdirSync(path.join(out, 'cuts'), { recursive: true });
  // fetch each current cut once (the file is content-addressed, so a re-run is free)
  for (const c of deck) {
    const f = path.join(out, 'cuts', c.k);
    if (fs.existsSync(f) && fs.statSync(f).size > 0) continue;
    const r = await fetch(c.url);
    if (!r.ok) throw new Error('cut missing: ' + c.k);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const outline = arg('outline', 'on') !== 'off';
  const built = await buildHtml(deck, c => fileData(path.join(out, 'cuts', c.k)),
    { side: Number(arg('side', 2.2)), border: Number(arg('border', 0.1)), outline });
  const stem = 'similitude-61-letter' + (outline ? '' : '-no-outline');
  const htmlFile = path.join(out, stem + '.html');
  const pdfFile = path.join(out, stem + '.pdf');
  fs.writeFileSync(htmlFile, built.html);
  console.log(`${deck.length} cards · ${built.layout.cols}x${built.layout.rows} a page · ${built.pages} pages · picture side ${built.geometry.S}in, rim ${built.geometry.B}in, cut line side ${built.geometry.outerSide.toFixed(2)}in`);
  await renderPdf(htmlFile, pdfFile);
  console.log('pdf', pdfFile, (fs.statSync(pdfFile).size / 1e6).toFixed(1) + 'MB');
  if (process.argv.includes('--go')) {
    const b = await upload(pdfFile, stem + '.pdf');
    console.log('uploaded', BASE + '/api/drop/file/' + b.item.id, b.duplicate ? '(already there)' : '');
  }
}

module.exports = { geometry, layout, buildHtml, cardSvg };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
