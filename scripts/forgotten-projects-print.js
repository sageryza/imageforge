#!/usr/bin/env node
// forgotten-projects-print.js — THE PRINT CATALOG (2026-09-03, Sophie: "i was
// kind of hoping to get a print catalog").
//
// The same 92 projects `forgotten-projects.js` posts as a Compare page, laid
// out as a printable catalog: US Letter, a cover with the chapters, one
// chapter per page start, entries two across with the chat's own icon, what
// it was, where it stopped, and how long it has been quiet. Rendered by
// headless Chromium from an HTML the script writes, so the type is the house
// serif (Newsreader, fetched from Google Fonts into a cache dir) and the
// pictures ride through a tiny local proxy (the sandbox's Chromium cannot
// reach Storage directly; node can).
//
//   node scripts/forgotten-projects-print.js            → writes the PDF
//   node scripts/forgotten-projects-print.js --upload   → …and files it in the
//                                                         Dump (bundle
//                                                         "Forgotten projects")
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');
const { build } = require('./forgotten-projects');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'forgotten-projects-catalog';
// the posted page whose verdict doc carries her answers (`--sheet page-<id>`;
// default: the newest "Forgotten projects" page in the chat)
const ASKS = [['wrong', 'What went wrong'], ['next', 'Next steps']];
const OUT = process.env.OUT_DIR || path.join(process.env.TMPDIR || '/tmp', 'forgotten-projects');
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap';
const FONTS = [['nr-i400', 'italic', 400], ['nr-400', 'normal', 400], ['nr-500', 'normal', 500], ['nr-600', 'normal', 600]];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0' } }, (r) => {
      if (r.statusCode >= 300 && r.headers.location) return get(r.headers.location).then(resolve, reject);
      const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(chunks), type: r.headers['content-type'] }));
    }).on('error', reject);
  });
}

async function fonts() {
  const have = FONTS.every(([n]) => fs.existsSync(path.join(OUT, 'fonts', n + '.ttf')));
  if (have) return;
  const css = (await get(FONT_CSS)).body.toString();
  // google answers the faces in the order asked; each `src: url(...)` is one
  const urls = [...css.matchAll(/src: url\(([^)]+)\)/g)].map((m) => m[1]);
  for (let i = 0; i < FONTS.length && i < urls.length; i++) {
    fs.writeFileSync(path.join(OUT, 'fonts', FONTS[i][0] + '.ttf'), (await get(urls[i])).body);
  }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function herAnswers(sheetArg) {
  let sheet = sheetArg;
  if (!sheet) {
    const pages = (await get(BASE + '/api/chatfeed/pages?chat=' + encodeURIComponent(CHAT))).body;
    let list = [];
    try { list = JSON.parse(pages.toString()).pages || []; } catch (e) { list = []; }
    const mine = list.filter((p) => /^Forgotten projects/.test(p.title || '') && !p.superseded)
      .sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
    if (mine[0]) sheet = 'page-' + mine[0].id;
  }
  if (!sheet) return {};
  const v = (await get(BASE + '/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + encodeURIComponent(sheet))).body;
  try { return JSON.parse(v.toString()).texts || {}; } catch (e) { return {}; }
}

function html(groups, dateLabel, texts) {
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  const faces = FONTS.map(([name, style, weight]) =>
    `@font-face{font-family:'Newsreader';font-style:${style};font-weight:${weight};src:url(/fonts/${name}.ttf) format('truetype');}`).join('\n');
  const chapters = groups.map((g, i) => `<li><span class="n">${i + 1}</span>${esc(g.label)}<span class="c">${g.items.length}</span></li>`).join('');
  const body = groups.map((g, i) => `
    <section class="chap">
      <h2><span class="n">${i + 1}</span>${esc(g.label)}<span class="c">${g.items.length} ${g.items.length === 1 ? 'project' : 'projects'}</span></h2>
      <div class="grid">${g.items.map((it) => {
        const parts = [];
        (it.sections || []).forEach((sec) => parts.push([sec.label, sec.text]));
        ASKS.forEach(([key, label]) => { const t = (texts[it.id + ':q:' + key] || '').trim(); if (t) parts.push([label, t, true]); });
        return `
        <article>
          ${it.img ? `<img src="/img?u=${encodeURIComponent(it.img)}" alt="">` : '<div class="noimg"></div>'}
          <div class="eb">${esc(it.eyebrow || '')}</div>
          <h3>${esc(it.label)}</h3>
          <p class="what">${esc(it.text)}</p>
          ${parts.map(([l, t, hers]) => `<div class="sec${hers ? ' hers' : ''}"><div class="sl">${esc(l)}</div><p>${esc(t)}</p></div>`).join('')}
          ${it.chat ? `<div class="slug">${esc(it.chat)}</div>` : (it.link && /storyroom/.test(it.link.url) ? '<div class="slug">Story Room</div>' : '')}
        </article>`; }).join('')}</div>
    </section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Forgotten projects</title>
<style>
${faces}
@page { size: letter; margin: 0.55in 0.6in 0.7in 0.6in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Newsreader', 'Liberation Serif', Georgia, serif; color: #26221c; background: #fff; font-size: 10.5pt; line-height: 1.35; }
.cover { height: 9.2in; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.cover .kicker { font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; color: #b5563a; }
.cover h1 { font-size: 44pt; font-weight: 500; line-height: 1.05; margin: 10pt 0 6pt; letter-spacing: -.01em; }
.cover .sub { font-size: 14pt; font-style: italic; color: #6b6259; margin-bottom: 26pt; }
.cover ol { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 28pt; }
.cover li { display: flex; align-items: baseline; gap: 8pt; padding: 4pt 0; border-bottom: 1px solid #e6dfd3; break-inside: avoid; font-size: 12pt; }
.cover li .n, h2 .n { font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 8pt; color: #b5563a; width: 14pt; flex: none; }
.cover li .c { margin-left: auto; font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #8a8076; }
.cover .rule { font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #6b6259; margin-top: 26pt; line-height: 1.5; max-width: 5.6in; }
.chap { page-break-before: always; }
h2 { display: flex; align-items: baseline; gap: 8pt; font-size: 20pt; font-weight: 500; margin: 0 0 12pt; padding-bottom: 6pt; border-bottom: 1.5px solid #26221c; }
h2 .c { margin-left: auto; font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #8a8076; font-weight: 400; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 18pt; }
article { padding: 8pt 0 10pt; border-bottom: 1px solid #e6dfd3; break-inside: avoid; page-break-inside: avoid; }
article img, article .noimg { display: block; width: 100%; height: 1.2in; object-fit: contain; object-position: left center; margin-bottom: 6pt; }
article .noimg { height: 0.5in; }
.eb { font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 6.5pt; letter-spacing: .12em; text-transform: uppercase; color: #b5563a; margin-bottom: 2pt; }
h3 { font-size: 12.5pt; font-weight: 500; margin: 0 0 3pt; line-height: 1.15; }
.what { margin: 0 0 5pt; font-size: 10pt; }
.sec { margin: 4pt 0 0; }
.sec .sl { font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 6.5pt; letter-spacing: .1em; text-transform: uppercase; color: #8a8076; margin-bottom: 1pt; }
.sec p { margin: 0; font-family: 'Liberation Sans', Helvetica, Arial, sans-serif; font-size: 8.5pt; line-height: 1.4; color: #4a433c; }
.sec.hers .sl { color: #b5563a; }
.sec.hers p { font-family: 'Newsreader', serif; font-style: italic; font-size: 10pt; color: #26221c; }
.slug { font-family: 'Liberation Mono', monospace; font-size: 7pt; color: #a59c91; margin-top: 4pt; }
</style></head><body>
<div class="cover">
  <div class="kicker">Deck Factory · ${esc(dateLabel)}</div>
  <h1>Forgotten<br>projects</h1>
  <div class="sub">${n} things you started, in ${groups.length} chapters</div>
  <ol>${chapters}</ol>
  <div class="rule">Every project here has a chat that has been quiet a week or more, where the chat spoke last and left something open — plus the story pads the old Story Room left empty, and the desktop queue. The small grey line under an entry is the chat's name in the Chats app. What you write in the two boxes on the swipe cards — what went wrong, next steps — prints here in italic.</div>
</div>
${body}
</body></html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const upload = args.includes('--upload');
  const si = args.indexOf('--sheet');
  await fonts();
  const { groups } = await build();
  const texts = await herAnswers(si >= 0 ? args[si + 1] : '');
  const answered = Object.keys(texts).filter((k) => /:q:/.test(k) && String(texts[k]).trim()).length;
  console.log(`her answers on file: ${answered}`);
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
  const page = html(groups, dateLabel, texts);
  fs.writeFileSync(path.join(OUT, 'catalog.html'), page);

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/img') {
      // a DERIVED display copy, never the original (the webp rule): a chat
      // icon is a ~1MB png and a pad cover can be 3MB, and a print entry is
      // an inch wide — 30MB of PDF for 88 pictures the first time round.
      // Resized HERE with sharp rather than through Render's thumb service,
      // which bakes each new thumb on the 512MB box one at a time.
      try {
        const r = await get(u.searchParams.get('u'));
        const out = await require('sharp')(r.body).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        res.writeHead(200, { 'Content-Type': 'image/webp' }); return res.end(out);
      } catch (e) { res.writeHead(502); return res.end(); }
    }
    if (u.pathname.startsWith('/fonts/')) {
      const f = path.join(OUT, 'fonts', path.basename(u.pathname));
      if (fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': 'font/ttf' }); return res.end(fs.readFileSync(f)); }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const { chromium } = require('playwright');
  const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe });
  const pg = await browser.newPage();
  await pg.goto(base + '/', { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const decoded = await pg.evaluate(() => [...document.images].filter((i) => i.naturalWidth > 0).length);
  const total = await pg.evaluate(() => document.images.length);
  const pdfPath = path.join(OUT, 'Forgotten projects — ' + dateLabel.replace(/,/g, '') + '.pdf');
  await pg.pdf({ path: pdfPath, format: 'Letter', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7pt;color:#8a8076;padding:0 0.6in;display:flex;justify-content:space-between;">'
      + '<span>Forgotten projects · ' + esc(dateLabel) + '</span><span class="pageNumber"></span></div>' });
  await browser.close(); server.close();
  const pages = (() => { try { return execFileSync('python3', ['-c', 'import sys;from pypdf import PdfReader;print(len(PdfReader(sys.argv[1]).pages))', pdfPath]).toString().trim(); } catch (e) { return '?'; } })();
  console.log(`wrote ${pdfPath} — ${pages} pages, ${decoded}/${total} pictures`);

  if (upload) {
    const buf = fs.readFileSync(pdfPath);
    const name = path.basename(pdfPath);
    const q = `?bundle=${encodeURIComponent('Forgotten projects')}&filename=${encodeURIComponent(name)}`;
    const ans = await new Promise((resolve, reject) => {
      const u = new URL(BASE + '/api/drop/upload-file' + q);
      const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
        headers: { 'content-type': 'application/pdf', 'content-length': buf.length } },
      (res) => { let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(new Error(s.slice(0, 300))); } }); });
      r.on('error', reject); r.end(buf);
    });
    console.log(JSON.stringify(ans, null, 1));
    if (ans && ans.item && ans.item.id) console.log('save link:', BASE + '/api/drop/file/' + ans.item.id);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
