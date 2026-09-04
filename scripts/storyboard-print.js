#!/usr/bin/env node
// storyboard-print.js — a Story Room pad laid out on LETTER paper as a
// storyboard she can print (2026-09-04, Sophie: "i want to print some things
// out · pdf letter paper · my scratch pad story boards so i can see them · lay
// things out · expect revisions").
//
// One pad → one PDF: every beat in order, its picture in the frame colour she
// gave it on the pad, her words under it, a bar joining the beats of a chunk.
// The picture is the side the story is SHOWING (the pad's own style toggle),
// falling back to another side that has art — the shelf tile's rule — so a
// beat is never blank while any art exists for it. Rendered by the
// pre-installed Chromium from an html the script writes; the pictures ride
// inline as flattened JPEGs (Chromium here cannot reach Storage, node can, and
// a JPEG is the one thing Chromium embeds as-is — the triset sheets' lesson).
// It costs nothing: reads, sharp, and ffmpeg-free Chromium on our own box.
//
//   node scripts/storyboard-print.js --pad <id> [--pad <id> …]   build; html + pdf + page previews in --out
//   --go                 upload the pdf (and the page previews) to the Dump, bundle "Storyboard print"
//   --cols 4 --rows 3    the grid on a page (default 4 across, 3 down = 12 beats a page)
//   --side dreamy        force a side (watercolor / dreamy / pastel) instead of the pad's own toggle
//   --out <dir>          where everything lands (default: $OUT_DIR or /tmp/storyboard-print)
//   --manifest <file>    write {pads:[…]} — what the Compare page builder reads
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const STYLES = ['watercolor', 'dreamy', 'pastel'];
const COLORS = { mustard: '#c99b3f', green: '#7d9b76', blue: '#7189a5', pink: '#c88fa2' };
const SHAPES = { portrait: 2 / 3, square: 1 };
const FONT = path.join(__dirname, '..', 'ios', 'ImageForge', 'EBGaramond.ttf');

function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === '--' + name && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}
const arg = (name, dflt) => args(name)[0] || dflt;
const flag = (name) => process.argv.includes('--' + name);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const slotFor = (b, s) => (s === 'watercolor' ? b : ((b && b.alt && b.alt[s]) || {}));
const faceOf = (slot) => (slot && slot.kind === 'clip' ? (slot.poster || null) : ((slot && slot.url) || null));

// The beats as they print: number, words, frame colour, chunk, and ONE
// picture — the showing side first, then any other side with art.
function boardOf(pad, side) {
  const style = STYLES.includes(side) ? side : (STYLES.includes(pad.style) ? pad.style : 'watercolor');
  const beats = Array.isArray(pad.beats) ? pad.beats : [];
  return beats.map((b, i) => {
    let url = faceOf(slotFor(b, style)), from = style;
    if (!url) {
      for (const s of STYLES.filter((x) => x !== style)) {
        const u = faceOf(slotFor(b, s));
        if (u) { url = u; from = s; break; }
      }
    }
    return {
      n: i + 1, id: b.id || String(i), text: String(b.text || ''), color: COLORS[b.color] ? b.color : null,
      chunk: b.chunk || null, url: url || null, side: url ? from : null, clip: Boolean(slotFor(b, style).kind === 'clip'),
    };
  });
}

// the picture, fetched once, resized for print and flattened onto white
async function pictureData(url, maxW) {
  const sharp = require('sharp');
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch ' + r.status + ' ' + url);
  const buf = Buffer.from(await r.arrayBuffer());
  const out = await sharp(buf).rotate().resize({ width: maxW, withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  return 'data:image/jpeg;base64,' + out.toString('base64');
}

// Letter, portrait, `cols` x `rows` beats a page. Everything in inches.
function buildHtml(pad, board, pics, opts) {
  const cols = opts.cols || 4, rows = opts.rows || 3, perPage = cols * rows;
  const m = 0.45, gap = 0.16, pageW = 8.5, pageH = 11;
  const ar = SHAPES[pad.shape] || SHAPES.portrait;
  // the cell is the narrower of what the WIDTH allows and what the HEIGHT
  // allows (title, footer, the chunk bar, four lines of caption per row) —
  // measured: 4x3 sized by width alone ran the last row's captions into the
  // footer. The grid is centred when the height decides.
  const capH = 0.6, barH = 0.1, footH = 0.3, titleH = 0.3;
  const byWidth = (pageW - 2 * m - gap * (cols - 1)) / cols;
  const rowH = (pageH - 2 * m - footH - titleH - gap * (rows - 1)) / rows;
  const byHeight = (rowH - capH - barH) * ar;
  const cellW = Math.min(byWidth, byHeight);
  const imgH = cellW / ar;
  const pages = [];
  for (let i = 0; i < board.length; i += perPage) pages.push(board.slice(i, i + perPage));
  const title = pad.title || 'Untitled';

  const cell = (b) => {
    const border = b.color ? `border:3px solid ${COLORS[b.color]};` : 'border:1px solid #cfc9be;';
    const pic = pics[b.url]
      ? `<img src="${pics[b.url]}" alt="">`
      : `<div class="none"></div>`;
    return `<div class="cell" data-n="${b.n}"><div class="pic" style="${border}">${pic}</div>`
      + `<div class="cap"><span class="n">${b.n}</span>${esc(b.text)}</div></div>`;
  };
  // a chunk's members wear one bar over them, per row (a run that wraps to
  // the next row gets a second bar there — the join is still visible)
  const pageHtml = (beats, p) => {
    const rowsHtml = [];
    for (let r = 0; r < beats.length; r += cols) {
      const row = beats.slice(r, r + cols);
      const bars = [];
      let start = 0;
      while (start < row.length) {
        const c = row[start].chunk;
        let end = start;
        while (c && end + 1 < row.length && row[end + 1].chunk === c) end++;
        if (c && end > start) {
          const col = COLORS[row[start].color] || '#2b2622';
          bars.push(`<div class="bar" style="grid-column:${start + 1} / ${end + 2}; background:${col}"></div>`);
        }
        start = end + 1;
      }
      rowsHtml.push(`<div class="row"><div class="bars">${bars.join('')}</div><div class="cells">${row.map(cell).join('')}</div></div>`);
    }
    return `<section class="page${p ? ' later' : ''}">${p === 0 ? `<h1>${esc(title)}</h1>` : ''}${rowsHtml.join('')}`
      + `<footer>${esc(title)} · ${board.length} beats · ${p + 1} / ${pages.length}</footer></section>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>
@font-face{font-family:'EBGaramond';font-weight:400 700;src:url(file://${FONT}) format('truetype');}
@page { size: letter; margin: ${m}in; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #2b2622; font-family: 'EBGaramond', Georgia, serif; }
.page { width: ${pageW - 2 * m}in; height: ${pageH - 2 * m}in; page-break-after: always; position: relative; overflow: hidden; padding-bottom: ${footH}in; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 13pt; font-weight: 400; margin: 0; height: ${titleH}in; line-height: ${titleH}in; letter-spacing: .01em; }
.page.later { padding-top: ${titleH}in; }
.row { margin-bottom: ${gap}in; }
.bars { display: grid; grid-template-columns: repeat(${cols}, ${cellW}in); column-gap: ${gap}in; height: 0.06in; margin-bottom: 0.04in; justify-content: center; }
.bar { height: 0.05in; border-radius: 1px; }
.cells { display: grid; grid-template-columns: repeat(${cols}, ${cellW}in); column-gap: ${gap}in; align-items: start; justify-content: center; }
.cell { width: ${cellW}in; }
.pic { width: ${cellW}in; height: ${imgH}in; position: relative; overflow: hidden; border-radius: 3px; background: #fff; }
.pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.pic .none { position: absolute; inset: 0; border: 1px dashed #cfc9be; border-radius: 2px; margin: 4px; }
.cap { font-size: 8pt; line-height: 1.28; margin-top: 0.05in; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.cap .n { color: #9a948a; font-size: 7pt; margin-right: 0.05in; }
footer { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font: 7pt -apple-system, system-ui, sans-serif; color: #9a948a; }
</style>${pages.map(pageHtml).join('\n')}`;
  return { html, pages: pages.length, cols, rows };
}

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

// the pdf, and one webp of each page so she can see the layout in the tab
async function render(htmlFile, pdfFile, previewStem) {
  const { chromium } = require('playwright');
  const sharp = require('sharp');
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto('file://' + htmlFile, { waitUntil: 'load' });
  await page.pdf({ path: pdfFile, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  const previews = [];
  const n = await page.locator('section.page').count();
  for (let i = 0; i < n; i++) {
    const png = await page.locator('section.page').nth(i).screenshot({ type: 'png' });
    const file = `${previewStem}-p${i + 1}.webp`;
    fs.writeFileSync(file, await sharp(png).resize({ width: 1100 }).webp({ quality: 82 }).toBuffer());
    previews.push(file);
  }
  await browser.close();
  return previews;
}

async function upload(file, name, ct, bundle) {
  const q = new URLSearchParams({ bundle, filename: name }).toString();
  const r = await fetch(BASE + '/api/drop/upload-file?' + q, {
    method: 'POST', headers: { 'Content-Type': ct }, body: fs.readFileSync(file),
  });
  const body = await r.json();
  if (!r.ok || !body.ok) throw new Error('upload failed: ' + JSON.stringify(body));
  return body.item;
}

const stemOf = (title, id) => (String(title || id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id);

async function onePad(id, opts) {
  const r = await fetch(BASE + '/api/scratchpad?pad=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('pad ' + id + ' ' + r.status);
  const pad = await r.json();
  const board = boardOf(pad, opts.side);
  const pics = {};
  const urls = [...new Set(board.map((b) => b.url).filter(Boolean))];
  await Promise.all(urls.map(async (u) => {
    try { pics[u] = await pictureData(u, 900); } catch (e) { console.warn('  picture skipped:', e.message); }
  }));
  const built = buildHtml(pad, board, pics, opts);
  const stem = stemOf(pad.title, id) + '-storyboard-letter';
  const htmlFile = path.join(opts.out, stem + '.html');
  const pdfFile = path.join(opts.out, stem + '.pdf');
  fs.writeFileSync(htmlFile, built.html);
  const previews = await render(htmlFile, pdfFile, path.join(opts.out, stem));
  const withArt = board.filter((b) => b.url).length;
  console.log(`${pad.title} · ${board.length} beats (${withArt} with a picture) · ${built.cols}x${built.rows} a page · ${built.pages} pages · ${(fs.statSync(pdfFile).size / 1e6).toFixed(1)}MB`);
  const out = { id, title: pad.title, beats: board.length, withArt, pages: built.pages, pdfFile, previews, side: opts.side || pad.style, cols: built.cols, rows: built.rows };
  if (opts.go) {
    const item = await upload(pdfFile, stem + '.pdf', 'application/pdf', 'Storyboard print');
    out.pdf = { id: item.id, url: BASE + '/api/drop/file/' + item.id, storage: item.url };
    out.pageUrls = [];
    for (const f of previews) {
      const it = await upload(f, path.basename(f), 'image/webp', 'Storyboard print previews');
      out.pageUrls.push(it.url);
    }
    console.log('  uploaded', out.pdf.url);
  }
  return out;
}

async function main() {
  const ids = args('pad');
  if (!ids.length) { console.error('usage: --pad <id> [--pad <id>…] [--go] [--cols 4 --rows 3] [--side dreamy] [--out dir] [--manifest file]'); process.exit(1); }
  const opts = {
    go: flag('go'), cols: Number(arg('cols', 4)), rows: Number(arg('rows', 3)), side: arg('side', ''),
    out: arg('out', process.env.OUT_DIR || path.join(process.env.TMPDIR || '/tmp', 'storyboard-print')),
  };
  fs.mkdirSync(opts.out, { recursive: true });
  const pads = [];
  for (const id of ids) pads.push(await onePad(id, opts));
  const manifest = arg('manifest', '');
  if (manifest) fs.writeFileSync(manifest, JSON.stringify({ pads, at: new Date().toISOString() }, null, 2));
}

module.exports = { boardOf, buildHtml, COLORS, stemOf };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
