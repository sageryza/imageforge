// Reconstruct the Cutting Blocks v14 film order by running the REAL page in
// headless Chromium with the live 148-key marks injected, then compute the
// page-cut parts with the page's own span math (copied verbatim).
const fs = require('fs');
const path = require('path');
const http = require('http');

const SCRATCH = __dirname;
const REPO = '/home/user/imageforge';
const html = fs.readFileSync(path.join(SCRATCH, 'blocks-v14.html'), 'utf8');
const verdict = fs.readFileSync(path.join(SCRATCH, 'marks-148.json'), 'utf8');
const { MODEL } = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'model.json'), 'utf8'));

const BY = {}; MODEL.forEach((b) => { BY[b.id] = b; });
const BLOCK_INDEX = {}; MODEL.forEach((b, i) => { BLOCK_INDEX[b.id] = i; });
function decSegs(str) {
  return String(str || '').split(',').filter(Boolean).map((p) => {
    const m = /^(\w+):(\d+)-(\d+)$/.exec(p); if (!m) return null;
    return { b: m[1], a: +m[2], z: +m[3] };
  }).filter((s) => s && BY[s.b]);
}
// verbatim port of the page's segSpansOf (seam bridging included)
function segSpansOf(segsStr) {
  const out = []; let prevB = null;
  decSegs(segsStr).forEach((sg) => {
    const b = BY[sg.b];
    let t0 = b.t0 + (b.t1 - b.t0) * (sg.a / Math.max(1, b.words.length));
    let t1 = b.t0 + (b.t1 - b.t0) * (sg.z / Math.max(1, b.words.length));
    if (t1 <= t0) t1 = t0 + 0.2;
    const last = out[out.length - 1];
    const adjacent = prevB !== null && (sg.b === prevB || BLOCK_INDEX[sg.b] === BLOCK_INDEX[prevB] + 1);
    const gap = last ? t0 - last.t1 : 999;
    if (last && ((adjacent && gap >= -0.06 && gap < 1.0) || Math.abs(gap) < 0.06)) last.t1 = t1;
    else out.push({ t0, t1 });
    prevB = sg.b;
  });
  return out;
}

(async () => {
  const pw = require(path.join(REPO, 'node_modules', 'playwright'));
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/page') { res.setHeader('content-type', 'text/html'); res.end(html); return; }
    if (u === '/compare.js') { res.setHeader('content-type', 'text/javascript'); res.end(fs.readFileSync(path.join(REPO, 'public', 'compare.js'))); return; }
    if (u === '/compare.css') { res.setHeader('content-type', 'text/css'); res.end(fs.readFileSync(path.join(REPO, 'public', 'compare.css'))); return; }
    if (u === '/api/chatfeed/verdict') { res.setHeader('content-type', 'application/json'); res.end(verdict); return; }
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  // swallow media/storage fetches the sandbox can't serve
  await page.route(/storage\.googleapis\.com/, (r) => r.abort());
  await page.goto(`http://127.0.0.1:${port}/page`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.l3 .c').length > 50, { timeout: 15000 });
  await page.waitForTimeout(500);

  const cards = await page.evaluate(() => {
    return [].slice.call(document.querySelectorAll('.l3 .c')).map((c) => ({
      id: c.dataset.id,
      sec: c.closest('.s').dataset.sec,
      secTitle: c.closest('.s').querySelector('.ti').textContent,
      state: c.dataset.state || '',
      isNew: c.classList.contains('new'),
      segs: c.dataset.segs || '',
      text: c.classList.contains('new')
        ? ((c.querySelector('.ed') || {}).textContent || '')
        : [].slice.call(c.querySelectorAll('.w')).map((w) => w.textContent).join(' '),
      who: (c.querySelector('.wh') || {}).textContent || 'you',
      dur: +c.dataset.dur || 0,
    }));
  });
  await browser.close(); server.close();

  const marks = JSON.parse(verdict).texts;
  const ttsUrls = {}; Object.keys(marks).forEach((k) => { if (k.startsWith('__tts:') && marks[k]) ttsUrls[k.slice(6)] = marks[k]; });

  // partsFor(allCards()) — the whole film, exactly as the page posts it
  const parts = []; const units = [];
  cards.forEach((c) => {
    if (c.state === 'cut') return;
    if (c.isNew) {
      const text = (c.text || '').trim();
      if (!text) return;
      if (!ttsUrls[c.id]) { console.error('typed line with no TTS url:', c.id); return; }
      const idx = parts.length;
      parts.push({ tts: ttsUrls[c.id] });
      units.push({ id: c.id, kind: 'tts', text, state: c.state, sec: c.sec, secTitle: c.secTitle, parts: [idx] });
    } else {
      const spans = segSpansOf(c.segs).map((s) => ({ t0: +s.t0.toFixed(2), t1: +s.t1.toFixed(2) }));
      const idxs = spans.map((s) => { parts.push(s); return parts.length - 1; });
      units.push({ id: c.id, kind: 'cut', text: c.text, who: c.who, state: c.state, sec: c.sec, secTitle: c.secTitle, segs: c.segs, spans, parts: idxs, dur: c.dur });
    }
  });

  fs.writeFileSync(path.join(SCRATCH, 'units.json'), JSON.stringify({ units, parts, cards }, null, 1));
  console.log('cards:', cards.length, 'kept units:', units.length, 'parts:', parts.length);
  console.log('maybe units:', units.filter((u) => u.state === 'maybe').length);
  units.forEach((u, i) => console.log(String(i).padStart(2), u.sec, u.state || 'in ', u.id.padEnd(8), (u.kind === 'tts' ? 'TTS ' : '') + u.text.slice(0, 70)));
})().catch((e) => { console.error(e); process.exit(1); });
