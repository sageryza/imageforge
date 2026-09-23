#!/usr/bin/env node
// poster-maker.js — the POSTER MAKER page: she changes the spacing and the
// font sizes herself and sees the poster change (2026-09-23, Sophie: "make a
// program allows me to change spacing and font size"). A Compare page, so a
// new version needs no deploy: the poster is painted on a canvas by ONE
// painter (the same layout scripts/posters.js renders — the fit that picks
// the columns and the biggest picture that still fills the sheet, her
// choices on top of it), every slider repaints, SAVE keeps her settings on
// the chat's verdict sheet (`poster-maker` / `settings`, its own key, never
// a note thread) so the page opens on them next time, and EXPORT paints the
// same thing at 2x into a PNG, files it in the Dump and the Assets tab, and
// shows the link. Nothing here calls a model.
//
//   node scripts/poster-maker.js [--chat minimal-animal-fruit-posters] [--v 1]
//        [--supersede <pageId>] [--out file.html]   (--out writes, posts nothing)
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const CHAT = flag('chat', 'minimal-animal-fruit-posters');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const VERSION = flag('v', '1');
const OUT = flag('out', '');
const SUPERSEDE = (flag('supersede', '') || '').split(',').filter(Boolean);

const SETS = JSON.parse(fs.readFileSync(path.join(__dirname, 'posters', 'sets.json'), 'utf8'));
const FACTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'posters', 'facts.json'), 'utf8'));
const SOURCES = {
  animals: JSON.parse(fs.readFileSync(path.join(__dirname, 'decks', 'animals-drawn.json'), 'utf8')),
  fruits: JSON.parse(fs.readFileSync(path.join(__dirname, 'decks', 'fruits-finished.json'), 'utf8')),
};
const data = Object.entries(SETS).map(([key, set]) => {
  const all = SOURCES[set.from];
  const byName = new Map(all.map((r) => [r.name.toLowerCase(), r]));
  const names = set.pick || all.map((r) => r.name).sort((a, b) => a.localeCompare(b));
  return { key, title: set.title, items: names.map((n) => { const r = byName.get(n.toLowerCase()); if (!r) throw new Error(`${set.title}: no picture for "${n}"`); return { name: r.name.toLowerCase(), img: r.full || r.url, fact: FACTS[r.name.toLowerCase()] || '' }; }) };
});

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const title = `Poster maker v${VERSION}`;
const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .pm-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;padding-right:64px}
  .pm-top select{font:600 14px/1 -apple-system,'Helvetica Neue',sans-serif;border:1.5px solid var(--gold);color:var(--gold);background:var(--surface);border-radius:6px;padding:9px 10px}
  .seg{display:inline-flex;border:1.5px solid var(--gold);border-radius:6px;overflow:hidden}
  .seg button{border:0;border-radius:0;padding:9px 11px}
  .seg button+button{border-left:1.5px solid var(--gold)}
  .seg button.on{background:var(--gold);color:var(--surface)}
  /* the poster stays on screen while the sliders under it scroll — a slider she cannot see the effect of is no use */
  .pm-stick{position:sticky;top:0;z-index:2;background:var(--paper);padding:8px 0 10px}
  .pm-canvas{display:block;height:42vh;width:auto;max-width:100%;margin:0 auto;border:1px solid var(--line);background:#fdfdfd}
  .pm-rows{margin:14px 0 6px}
  .pm-row{display:grid;grid-template-columns:96px 1fr 44px;align-items:center;gap:10px;padding:5px 0;font-size:13px;color:var(--ink2)}
  .pm-row b{font-weight:600;color:var(--ink)}
  .pm-row output{text-align:right;font-variant-numeric:tabular-nums}
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;background:transparent;margin:0}
  input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--line)}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-10px;border-radius:6px;background:var(--surface);border:1.5px solid var(--gold)}
  input[type=range]::-moz-range-track{height:2px;background:var(--line)}
  input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:6px;background:var(--surface);border:1.5px solid var(--gold)}
  .pm-act{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}
  .pm-msg{font-size:13px;color:var(--ink2)}
  .pm-msg a{color:var(--gold)}
  .pm-tick{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);padding:5px 0}
  .pm-tick input{width:20px;height:20px;margin:0}
</style>
<div class="wrap">
  <h1>${esc(title)}</h1>
  <div class="pm-top">
    <select id="set" aria-label="set"></select>
    <span class="seg" id="face"><button type="button" data-v="hand">handwriting</button><button type="button" data-v="magic">magic title</button></span>
    <span class="seg" id="paper"><button type="button" data-v="3x4">3:4</button><button type="button" data-v="legal">legal</button></span>
  </div>
  <div class="pm-stick"><canvas id="cv" class="pm-canvas"></canvas></div>
  <div class="pm-rows" id="rows"></div>
  <label class="pm-tick"><input type="checkbox" id="facts" checked> facts</label>
  <div class="pm-act">
    <button type="button" id="save">Save</button>
    <button type="button" id="export">Export PNG</button>
    <button type="button" id="reset">Reset</button>
    <span class="pm-msg" id="msg"></span>
  </div>
</div>
<script src="/compare.js"></script>
<script>
(function(){
  var CHAT = ${JSON.stringify(CHAT)}, SHEET = 'poster-maker';
  var DATA = ${JSON.stringify(data)};
  var PAPER = { '3x4': [1200, 1600], legal: [1275, 2100] };
  // Every knob, with the value posters.js uses as its default.
  var KNOBS = [
    ['title', 'title size', 40, 160, 1, { hand: 104, magic: 96 }],
    ['titleSp', 'title spacing', 0, 0.8, 0.01, 0.34],
    ['rule', 'line length', 0, 100, 1, 60],
    ['name', 'name size', 8, 40, 1, 0],
    ['nameSp', 'name spacing', 0, 0.5, 0.01, 0.18],
    ['fact', 'fact size', 8, 30, 1, 0],
    ['cols', 'columns', 0, 8, 1, 0],
    ['pic', 'picture size', 30, 100, 1, 100],
    ['gap', 'row gap', 0, 120, 1, 0],
    ['side', 'side margin', 20, 240, 1, 110],
    ['top', 'top margin', 20, 200, 1, 64],
    ['bottom', 'bottom margin', 20, 200, 1, 64],
    ['border', 'border inset', 0, 80, 1, 22]
  ];
  var S = { set: DATA[0].key, face: 'hand', paper: 'legal', facts: true };
  KNOBS.forEach(function (k) { S[k[0]] = typeof k[5] === 'object' ? k[5][S.face] : k[5]; });
  var cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  var IMGS = {}, fontsReady = false, dirty = 0;

  var $ = function (id) { return document.getElementById(id); };
  var sel = $('set');
  DATA.forEach(function (d) { var o = document.createElement('option'); o.value = d.key; o.textContent = d.title; sel.appendChild(o); });
  var rows = $('rows');
  KNOBS.forEach(function (k) {
    var row = document.createElement('div'); row.className = 'pm-row';
    row.innerHTML = '<b>' + k[1] + '</b><input type="range" data-k="' + k[0] + '" min="' + k[2] + '" max="' + k[3] + '" step="' + k[4] + '"><output></output>';
    rows.appendChild(row);
  });
  function setSeg(id, v) { [].forEach.call($(id).querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.v === v); }); }
  function syncUI() {
    sel.value = S.set; setSeg('face', S.face); setSeg('paper', S.paper); $('facts').checked = !!S.facts;
    [].forEach.call(rows.querySelectorAll('input'), function (i) {
      var k = i.dataset.k; i.value = S[k];
      var o = i.parentElement.querySelector('output');
      o.textContent = (k === 'cols' && !S.cols) ? 'auto' : (k === 'name' || k === 'fact') && !S[k] ? 'auto' : k === 'pic' ? S.pic + '%' : k === 'rule' ? S.rule + '%' : k.slice(-2) === 'Sp' ? S[k].toFixed(2) + 'em' : String(S[k]);
    });
  }

  // ---- the painter: ONE layout, preview and export ----
  function spacedWidth(c, text, sp) { var w = 0; for (var i = 0; i < text.length; i++) w += c.measureText(text[i]).width; return w + sp * Math.max(0, text.length - 1); }
  function drawSpaced(c, text, cx, y, sp) { var w = spacedWidth(c, text, sp), x = cx - w / 2; for (var i = 0; i < text.length; i++) { c.fillText(text[i], x, y); x += c.measureText(text[i]).width + sp; } }
  function wrap(c, text, maxW, sp) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (spacedWidth(c, t, sp) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur); return lines;
  }
  function fonts(face) {
    return face === 'hand' ? { T: 'Sophie Hand', N: 'Sophie Hand', F: 'Magic Subtitle Italic' } : { T: 'Magic Title', N: 'Magic Subtitle', F: 'Magic Subtitle Italic' };
  }
  // Lays the set out for a given column count and picture size; returns the
  // rows' total height and the per-item measurements. k scales the sizes
  // for the export.
  function layout(c, items, cols, pic, k, W, H, F) {
    var inner = W - 2 * (S.border + S.side) * k, cell = Math.floor(inner / cols);
    var nm = (S.name || Math.max(11, Math.min(22, Math.round(cell / k * 0.072)))) * k;
    var ft = (S.fact || Math.max(10, Math.round((S.name || Math.max(11, Math.min(22, Math.round(cell / k * 0.072)))) * 0.82))) * k;
    var gap = (S.gap || Math.round(cell / k * 0.22)) * k;
    var rowsH = [], row = [], total = 0, meas = [];
    items.forEach(function (it, i) {
      var nsp = S.nameSp * nm, nmText = it.name.toUpperCase(), nsz = nm;
      c.font = nsz + 'px "' + F.N + '"';
      while (spacedWidth(c, nmText, nsp) > cell - 32 * k && nsz > 8 * k) { nsz -= 0.5 * k; c.font = nsz + 'px "' + F.N + '"'; nsp = S.nameSp * nsz; }
      var nameW = spacedWidth(c, nmText, nsp);
      c.font = ft + 'px "' + F.F + '"';
      var lines = S.facts && it.fact ? wrap(c, it.fact, Math.max(cell * 0.6, nameW + 16 * k), ft * 0.05) : [];
      var h = pic + nm * 0.35 + nm * 1.2 + (lines.length ? ft * 0.3 + lines.length * ft * 1.3 : 0) + gap;
      meas.push({ lines: lines, h: h });
      row.push(h);
      if (row.length === cols || i === items.length - 1) { var m = Math.max.apply(null, row); rowsH.push(m); total += m; row = []; }
    });
    return { inner: inner, cell: cell, nm: nm, ft: ft, gap: gap, rowsH: rowsH, total: total, meas: meas };
  }
  function paint(c, W, H, k) {
    var d = DATA.filter(function (x) { return x.key === S.set; })[0], items = d.items, F = fonts(S.face);
    c.fillStyle = '#fdfdfd'; c.fillRect(0, 0, W, H);
    var b = S.border * k;
    c.strokeStyle = '#111'; c.lineWidth = 2 * k; c.strokeRect(b + k, b + k, W - 2 * b - 2 * k, H - 2 * b - 2 * k);
    var inner = W - 2 * (S.border + S.side) * k, cx = W / 2, y = (S.border + S.top) * k;
    // title, shrunk until it fits the width
    var t = S.title * k, sp; c.fillStyle = '#111'; c.textBaseline = 'alphabetic';
    var text = d.title.toUpperCase();
    for (;;) { c.font = t + 'px "' + F.T + '"'; sp = S.titleSp * t; if (spacedWidth(c, text, sp) <= inner || t <= 20 * k) break; t -= 2 * k; }
    y += t * 0.95; drawSpaced(c, text, cx, y, sp);
    // the line under it
    var rw = inner * S.rule / 100; y += 22 * k;
    if (rw > 0) {
      c.beginPath(); c.lineCap = 'round'; c.lineJoin = 'round';
      if (S.face === 'hand') { c.lineWidth = 1.8 * k; for (var i = 0; i <= 12; i++) { var px = cx - rw / 2 + rw * i / 12, py = y + (Math.sin(i * 1.7) * 1.6 + Math.cos(i * 0.9) * 0.8) * k; i ? c.lineTo(px, py) : c.moveTo(px, py); } }
      else { c.lineWidth = 1.5 * k; c.moveTo(cx - rw / 2, y); c.lineTo(cx + rw / 2, y); }
      c.stroke();
    }
    y += 30 * k;
    var gridTop = y, gridH = H - (S.border + S.bottom) * k - gridTop;
    // the fit: her column count, or the one whose biggest picture is biggest
    var best = null, colsList = S.cols ? [S.cols] : [2, 3, 4, 5, 6, 7, 8];
    colsList.forEach(function (cols) {
      if (cols > items.length && !S.cols) return;
      var cell = Math.floor(inner / cols), lo = 30 * k, hi = Math.round(cell * 0.62);
      if (layout(c, items, cols, lo, k, W, H, F).total > gridH && !S.cols) return;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (layout(c, items, cols, mid, k, W, H, F).total <= gridH) lo = mid; else hi = mid; }
      if (!best || lo > best.pic) best = { cols: cols, pic: lo };
    });
    if (!best) best = { cols: S.cols || 8, pic: 30 * k };
    var pic = Math.round(best.pic * S.pic / 100), L = layout(c, items, best.cols, pic, k, W, H, F);
    var spare = Math.max(0, gridH - L.total), rowsN = L.rowsH.length, lead = rowsN > 1 ? spare / (rowsN - 1) : 0;
    var x0 = (W - inner) / 2, r = 0, yy = gridTop;
    items.forEach(function (it, i) {
      var col = i % best.cols, inRow = Math.min(best.cols, items.length - (i - col));
      var rowLeft = x0 + (inner - inRow * L.cell) / 2;
      if (col === 0 && i) { yy += L.rowsH[r] + lead; r++; }
      var ix = rowLeft + col * L.cell + (L.cell - pic) / 2, im = IMGS[it.img];
      if (im && im.complete && im.naturalWidth) c.drawImage(im, ix, yy, pic, pic);
      var ty = yy + pic + L.nm * 0.35 + L.nm * 0.95, ccx = rowLeft + col * L.cell + L.cell / 2;
      c.fillStyle = '#111'; c.font = L.nm + 'px "' + F.N + '"';
      var nsp = S.nameSp * L.nm, nmText = it.name.toUpperCase(), nsz = L.nm;
      while (spacedWidth(c, nmText, nsp) > L.cell - 32 * k && nsz > 8 * k) { nsz -= 0.5 * k; c.font = nsz + 'px "' + F.N + '"'; nsp = S.nameSp * nsz; }
      drawSpaced(c, nmText, ccx, ty, nsp);
      if (L.meas[i].lines.length) {
        c.fillStyle = '#333'; c.font = L.ft + 'px "' + F.F + '"';
        var fy = ty + L.ft * 0.3 + L.ft;
        L.meas[i].lines.forEach(function (ln) { drawSpaced(c, ln, ccx, fy, L.ft * 0.05); fy += L.ft * 1.3; });
      }
    });
  }
  function repaint() {
    var wh = PAPER[S.paper], W = wh[0], H = wh[1], k = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * k; cv.height = H * k; cv.style.aspectRatio = W + ' / ' + H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!fontsReady) return;
    paint(ctx, W * k, H * k, k);
  }
  var pending = null;
  function schedule() { if (pending) return; pending = requestAnimationFrame(function () { pending = null; repaint(); }); }

  // pictures: fetched once, CORS on so the export canvas stays clean
  function loadSet() {
    var d = DATA.filter(function (x) { return x.key === S.set; })[0];
    d.items.forEach(function (it) {
      if (IMGS[it.img]) return;
      var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = schedule; im.src = it.img; IMGS[it.img] = im;
    });
  }
  // fonts: hers, off /fonts
  Promise.all([
    ['Sophie Hand', '/fonts/sophie-hand.ttf'], ['Magic Title', '/fonts/magic-title.ttf'],
    ['Magic Subtitle', '/fonts/magic-subtitle.ttf'], ['Magic Subtitle Italic', '/fonts/magic-subtitle-italic.ttf']
  ].map(function (f) { var ff = new FontFace(f[0], 'url(' + f[1] + ')'); document.fonts.add(ff); return ff.load(); })).then(function () { fontsReady = true; schedule(); }, function () { fontsReady = true; schedule(); });

  // ---- her settings, kept on the sheet ----
  function verdictUrl() { return '/api/chatfeed/verdict?chat=' + encodeURIComponent(CHAT) + '&sheet=' + SHEET; }
  fetch(verdictUrl()).then(function (r) { return r.json(); }).then(function (j) {
    try { var saved = JSON.parse((j.texts || {}).settings || 'null'); if (saved && typeof saved === 'object') Object.keys(S).forEach(function (k) { if (saved[k] !== undefined) S[k] = saved[k]; }); } catch (e) {}
    syncUI(); loadSet(); schedule();
  }, function () { syncUI(); loadSet(); schedule(); });
  function say(t, html) { var m = $('msg'); if (html) m.innerHTML = t; else m.textContent = t; }
  $('save').addEventListener('click', function () {
    fetch('/api/chatfeed/verdict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, sheet: SHEET, item: 'settings', text: JSON.stringify(S) }) })
      .then(function (r) { return r.json(); }).then(function (j) { say(j.ok ? 'saved' : 'could not save'); }, function () { say('could not save'); });
  });
  $('reset').addEventListener('click', function () {
    KNOBS.forEach(function (k) { S[k[0]] = typeof k[5] === 'object' ? k[5][S.face] : k[5]; }); S.facts = true; syncUI(); schedule();
  });
  $('export').addEventListener('click', function () {
    var wh = PAPER[S.paper], W = wh[0] * 2, H = wh[1] * 2, off = document.createElement('canvas'); off.width = W; off.height = H;
    paint(off.getContext('2d'), W, H, 2);
    say('exporting…');
    off.toBlob(function (blob) {
      if (!blob) { say('could not export'); return; }
      var d = DATA.filter(function (x) { return x.key === S.set; })[0];
      var fn = 'poster-' + S.set + '-' + S.face + '-' + S.paper + '-' + Date.now() + '.png';
      var q = new URLSearchParams({ session: 'poster-maker', bundle: 'poster maker', filename: fn });
      fetch('/api/drop/upload-file?' + q, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { say('could not export'); return; }
        var url = j.item.url;
        fetch('/api/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: url, description: d.title + ' poster — ' + (S.face === 'hand' ? 'handwriting' : 'magic title') + ' · ' + S.paper + ' · her settings', prompt: 'poster maker · no model · ' + W + 'x' + H }) }).catch(function () {});
        say('exported — <a href="' + url + '" target="_blank" rel="noopener">open the PNG</a> · <a href="/api/drop/file/' + j.item.id + '">save</a> · it is in the Assets tab too', true);
      }, function () { say('could not export'); });
    }, 'image/png');
  });
  sel.addEventListener('change', function () { S.set = sel.value; loadSet(); schedule(); });
  [].forEach.call($('face').querySelectorAll('button'), function (b) { b.addEventListener('click', function () { var was = S.face; S.face = b.dataset.v; if (S.title === (typeof KNOBS[0][5] === 'object' ? KNOBS[0][5][was] : 0)) S.title = KNOBS[0][5][S.face]; syncUI(); schedule(); }); });
  [].forEach.call($('paper').querySelectorAll('button'), function (b) { b.addEventListener('click', function () { S.paper = b.dataset.v; syncUI(); schedule(); }); });
  $('facts').addEventListener('change', function () { S.facts = $('facts').checked; schedule(); });
  rows.addEventListener('input', function (e) { var i = e.target; if (!i.dataset.k) return; S[i.dataset.k] = parseFloat(i.value); syncUI(); schedule(); });
  if (window.__compareHelp) window.__compareHelp({ html: '<p>Pick a set and a face, move the sliders, and the poster repaints. Columns, name size and fact size on <b>auto</b> are the fit posters.js uses. <b>Save</b> keeps these settings for next time; <b>Export PNG</b> makes the file at print size (legal is 2550x4200, 300 DPI) and files it in the Assets tab.</p>' });
})();
</script>
`;

(async () => {
  if (OUT) { fs.writeFileSync(OUT, html); console.log('wrote', OUT); return; }
  const posted = await (await fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, title, html }) })).json();
  console.log('page', JSON.stringify(posted));
  for (const id of SUPERSEDE) console.log('superseded', id, (await fetch(`${BASE}/api/chatfeed/page/${id}/supersede`, { method: 'POST' })).status);
  console.log(`\nmaker: ${BASE}/api/chatfeed/page/${posted.id}`);
})().catch((e) => { console.error(e); process.exit(1); });
