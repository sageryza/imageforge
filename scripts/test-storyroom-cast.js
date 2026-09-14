#!/usr/bin/env node
// THE TYPED CAST IN THE STORY ROOM (2026-09-06, Sophie: "also add the
// character description feature as an option that's not character image, like
// playground. u can copy the code"). Drives the REAL public/scratchpad.html in
// headless Chromium against a stub API and MEASURES:
//   1. the character button on the beat card opens the sheet under a hairline
//      row of exactly two tabs — Pictures, Descriptions — with the underline
//      really measured under the lit one;
//   2. Descriptions: a row ships EMPTY (placeholders only name the field);
//      typing a name and a description POSTs /cast {cast:[{name,description}]};
//   3. the clause printed on the page equals sheetGrid.castBlock of the same
//      rows, single-picture opening, and a picked picture's line rides beside it;
//   4. the badge on the button counts pictures + descriptions;
//   5. Enter in a description is refused and a pasted newline collapses;
//   6. the bigger box opens the description on its own full-width line;
//   7. none of it stales the film; back on the card, Draw POSTs /generate
//      (the server reads pad.cast — scripts/test-scratchpad-cast.js pins the
//      clause into the prompt);
//   8. removing the row empties the cast: POST /cast {cast:[]}, no clause,
//      the badge counts only the picture.
//   node scripts/test-storyroom-cast.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const servePublic = require('./lib/public-asset');
const sheetGrid = require('../sheet-grid');
const { charLine } = require('../pad-characters');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

const PNG = (() => {
  const w = 200, h = 300;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    for (let x = 0; x < w; x++) { raw[row + 1 + x * 3] = 180; raw[row + 2 + x * 3] = 140; raw[row + 3 + x * 3] = 90; }
  }
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

const beats = [];
for (let i = 0; i < 6; i++) beats.push({ id: 'b' + i, url: '/px.png?' + i, text: 'beat ' + i, color: null });
const characters = [{ id: 'c1', name: 'Nicholas', url: '/px.png?c1' }];
let cast = [];
const posted = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/cast') { cast = b.cast; return json({ ok: true, cast }); }
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'cast test', film: null, audios: [], characters, cast });
  if (url.pathname.startsWith('/px.png') || url.pathname === '/api/story/thumb' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG);
  }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

let failures = 0;
function ok(cond, name, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond || extra === undefined ? '' : '  — ' + JSON.stringify(extra)));
  if (!cond) failures++;
}
const VW = 390, VH = 844;
const castPosts = () => posted.filter((p) => p[0] === '/api/scratchpad/cast');

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beatwrap');
  await page.waitForTimeout(150);
  const served = await page.evaluate(() => ({ sg: !!(window.__sheetGrid && window.__sheetGrid.castBlock), pc: !!(window.__padCharacters && window.__padCharacters.charLine) }));
  ok(served.sg && served.pc, 'the page really loaded /sheet-grid.js and /pad-characters.js', served);

  // 1. the button opens the sheet under two tabs
  await page.evaluate(() => window.openBeat(window.beatById('b1')));
  await page.waitForTimeout(80);
  // The draw row lives behind the Drawing prompt fold on a beat with art.
  if (await page.$eval('#drawbox', (el) => el.hidden)) await page.click('#promlab');
  await page.waitForTimeout(60);
  await page.click('#dchars');
  await page.waitForTimeout(150);
  let s = await page.evaluate(() => {
    const row = document.getElementById('chartabs');
    const tabs = Array.from(row.querySelectorAll('.acctab'));
    const on = row.querySelector('.acctab.on');
    const after = getComputedStyle(row, '::after');
    return {
      sheetOpen: !document.getElementById('charsheet').hidden, popHidden: document.getElementById('beatpop').hidden,
      n: tabs.length, words: tabs.map((t) => t.textContent), lit: on && on.id,
      lineW: parseFloat(after.width), tabW: on ? on.getBoundingClientRect().width : 0,
      picsShown: !document.getElementById('charpics').hidden, descShown: !document.getElementById('chardesc').hidden,
      right: row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight),
      rowH: row.getBoundingClientRect().height,
    };
  });
  ok(s.sheetOpen && s.popHidden, 'the character button opens the sheet over the card', s);
  ok(s.n === 2 && s.words.join('|') === 'Pictures|Descriptions', 'the hairline row is exactly two tabs: Pictures · Descriptions', s.words);
  ok(s.lit === 'ctab-pics' && s.picsShown && !s.descShown, 'it opens on Pictures', s);
  ok(s.lineW > 20 && Math.abs(s.lineW - s.tabW) < 1.5, 'the underline is MEASURED under the lit tab', { lineW: s.lineW, tabW: s.tabW });
  ok(s.right <= VW - 56 + 1, 'the row ends before the pill\'s column', s.right);
  ok(s.rowH < 40, 'the row is one hairline line, no wrap', s.rowH);

  // 2. Descriptions: an empty row, then her words → POST /cast
  await page.click('#ctab-desc');
  await page.waitForTimeout(120);
  s = await page.evaluate(() => {
    const row = document.getElementById('chartabs');
    const on = row.querySelector('.acctab.on');
    return {
      lit: on && on.id, descShown: !document.getElementById('chardesc').hidden, picsShown: !document.getElementById('charpics').hidden,
      rows: document.querySelectorAll('#castrows .castrow').length, addShown: !document.getElementById('castadd').hidden,
      plusHidden: document.getElementById('charsaddbtn').hidden, says: document.getElementById('castsays').hidden,
      lineX: parseFloat(getComputedStyle(row).getPropertyValue('--tx')), tabX: on.getBoundingClientRect().left - row.getBoundingClientRect().left,
    };
  });
  ok(s.lit === 'ctab-desc' && s.descShown && !s.picsShown, 'Descriptions takes the sheet', s);
  ok(Math.abs(s.lineX - s.tabX) < 1.5, 'the underline moved under Descriptions', { lineX: s.lineX, tabX: s.tabX });
  ok(s.rows === 0 && s.addShown && s.says, 'an empty cast: no rows, the add button, no disclosure', s);
  ok(s.plusHidden, 'the header\'s picture + stands down on the words half', s.plusHidden);
  await page.click('#castadd');
  await page.waitForTimeout(80);
  let r = await page.evaluate(() => {
    const row = document.querySelector('#castrows .castrow');
    const nm = row.querySelector('.cnm'), ds = row.querySelector('.cds');
    const rr = row.getBoundingClientRect();
    return {
      nmVal: nm.value, dsVal: ds.value, nmPh: nm.placeholder, dsPh: ds.placeholder, focused: document.activeElement === nm,
      tag: ds.tagName, oneLine: ds.getBoundingClientRect().height < 44, sameLine: Math.abs(nm.getBoundingClientRect().top - ds.getBoundingClientRect().top) < 3,
      radius: getComputedStyle(nm).borderRadius, right: rr.right, hasBig: !!row.querySelector('.cbig'), hasX: !!row.querySelector('.cx'),
    };
  });
  ok(r.nmVal === '' && r.dsVal === '' && r.focused, 'Add a character makes an EMPTY row and focuses the name', r);
  ok(r.nmPh === 'Name' && r.dsPh === 'Description', 'the placeholders only NAME the fields', r);
  ok(r.tag === 'TEXTAREA' && r.oneLine && r.sameLine, 'the description is a one-line textarea beside the name', r);
  ok(r.radius === '6px' && r.hasBig && r.hasX, 'rounded squares, a bigger-box toggle and a ✕ on the row', r);
  ok(r.right <= VW - 56 + 1, 'the row ends before the pill\'s column', r.right);
  await page.keyboard.type('Nicholas');
  await page.click('#castrows .cds');
  await page.keyboard.type('long beard, glasses, all black');
  await page.waitForTimeout(700);
  let cp = castPosts();
  ok(cp.length >= 1, 'typing POSTs /cast (debounced)', cp.length);
  const last = cp[cp.length - 1];
  ok(last && JSON.stringify(last[1].cast) === JSON.stringify([{ name: 'Nicholas', description: 'long beard, glasses, all black' }]), 'the POST carries {cast:[{name, description}]}', last && last[1]);
  ok(last && last[1].pad === 'pad', 'and the pad id', last && last[1].pad);

  // 3. the clause on the page is sheetGrid's own
  const rows = [{ name: 'Nicholas', description: 'long beard, glasses, all black' }];
  let says = await page.evaluate(() => ({ hidden: document.getElementById('castsays').hidden, txt: document.getElementById('castsaystxt').textContent }));
  ok(!says.hidden && says.txt === sheetGrid.castBlock(rows, true), 'the disclosure prints sheetGrid.castBlock(rows, true), verbatim', says.txt);
  ok(/Named characters in this picture/.test(says.txt) && !/across the panels/.test(says.txt), 'it is the single-picture opening, never the sheet\'s', says.txt);

  // 4. the badge counts both halves
  let badge = await page.evaluate(() => ({ hidden: document.getElementById('dcharsn').hidden, n: document.getElementById('dcharsn').textContent, on: document.getElementById('dchars').classList.contains('on') }));
  ok(!badge.hidden && badge.n === '1' && badge.on, 'the badge counts the one description', badge);
  await page.click('#ctab-pics');
  await page.waitForTimeout(80);
  await page.click('#charlist .charrow .cpick');   // the row's centre is the name input, which stops its own taps
  await page.waitForTimeout(80);
  badge = await page.evaluate(() => ({ n: document.getElementById('dcharsn').textContent, picked: document.querySelectorAll('#charlist .charrow.picked').length }));
  ok(badge.picked === 1 && badge.n === '2', 'picking a picture makes it 2 — pictures + descriptions', badge);
  says = await page.evaluate(() => document.getElementById('castsaystxt').textContent);
  const both = charLine(characters).trim() + '\n\n' + sheetGrid.castBlock(rows, true);
  ok(says === both, 'the disclosure now carries the picked card\'s line AND the clause, from the served rules', says);

  // 5. Enter refused, a pasted newline collapses
  await page.click('#ctab-desc');
  await page.waitForTimeout(80);
  await page.click('#castrows .cds');
  await page.evaluate(() => { const t = document.querySelector('#castrows .cds'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await page.keyboard.press('Enter');
  await page.keyboard.type(' cape');
  let ds = await page.evaluate(() => document.querySelector('#castrows .cds').value);
  ok(ds === 'long beard, glasses, all black cape', 'Enter in a description is refused — one line by contract', ds);
  await page.evaluate(() => { const t = document.querySelector('#castrows .cds'); t.value = 'line one\nline two'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  ds = await page.evaluate(() => document.querySelector('#castrows .cds').value);
  ok(ds === 'line one line two', 'a pasted newline collapses to a space', ds);
  await page.waitForTimeout(600);
  cp = castPosts();
  ok(JSON.stringify(cp[cp.length - 1][1].cast) === JSON.stringify([{ name: 'Nicholas', description: 'line one line two' }]), 'the collapsed text is what was saved', cp[cp.length - 1][1].cast);

  // 6. the bigger box
  const small = await page.evaluate(() => { const t = document.querySelector('#castrows .cds'); const r = t.getBoundingClientRect(); return { h: r.height, w: r.width, top: r.top, nmTop: document.querySelector('#castrows .cnm').getBoundingClientRect().top }; });
  await page.click('#castrows .cbig');
  await page.waitForTimeout(120);
  const big = await page.evaluate(() => {
    const row = document.querySelector('#castrows .castrow'); const t = row.querySelector('.cds'); const r = t.getBoundingClientRect();
    return { on: row.classList.contains('big'), h: r.height, w: r.width, top: r.top, nmTop: row.querySelector('.cnm').getBoundingClientRect().top, rowW: row.getBoundingClientRect().width, focused: document.activeElement === t, label: row.querySelector('.cbig').getAttribute('aria-label') };
  });
  ok(big.on && big.h > small.h * 2 && big.h >= VH * 0.18 - 1, 'the bigger box really grows (the 18vh floor)', { small: small.h, big: big.h });
  ok(big.w > small.w * 1.5 && Math.abs(big.w - big.rowW) < 2 && big.top > big.nmTop + 20, 'and drops onto its OWN full-width line under the name', big);
  ok(big.focused && /Back to the small box/.test(big.label), 'it takes the focus and the toggle says how to go back', big);
  await page.click('#castrows .cbig');
  await page.waitForTimeout(80);
  const back = await page.evaluate(() => { const t = document.querySelector('#castrows .cds'); return { h: t.getBoundingClientRect().height, on: document.querySelector('#castrows .castrow').classList.contains('big') }; });
  ok(!back.on && Math.abs(back.h - small.h) < 2, 'tapping again puts it back small', back);

  // 7. nothing staled the film; Draw carries on
  let dirty = await page.evaluate(() => window.dirtySinceFilm);
  ok(dirty === false, 'saving the cast does not stale the film', dirty);
  await page.click('#charsclose');
  await page.waitForTimeout(150);
  let back2 = await page.evaluate(() => ({ popOpen: !document.getElementById('beatpop').hidden, sheetHidden: document.getElementById('charsheet').hidden, n: document.getElementById('dcharsn').textContent, id: window.popBeat && window.popBeat.id }));
  ok(back2.popOpen && back2.sheetHidden && back2.id === 'b1' && back2.n === '2', 'Back returns to the same beat with the badge still saying 2', back2);
  const before = posted.length;
  if (await page.$eval('#drawbox', (el) => el.hidden)) await page.click('#promlab');
  await page.waitForTimeout(60);
  await page.click('#dgo');
  await page.waitForTimeout(400);
  const gen = posted.slice(before).filter((p) => p[0] === '/api/scratchpad/generate');
  ok(gen.length === 1 && gen[0][1].id === 'b1' && JSON.stringify(gen[0][1].characters) === '["c1"]', 'Draw POSTs /generate for the beat with the picked picture (the server reads pad.cast)', gen.map((g) => g[1]));
  ok(!('cast' in (gen[0] ? gen[0][1] : {})), 'the page sends no cast of its own on a draw — the pad is the one copy', gen[0] && gen[0][1]);

  // 8. removing the row empties the cast
  if (await page.$eval('#drawbox', (el) => el.hidden)) await page.click('#promlab');
  await page.waitForTimeout(60);
  await page.click('#dchars');
  await page.waitForTimeout(120);
  await page.click('#ctab-desc');
  await page.waitForTimeout(80);
  await page.click('#castrows .cx');
  await page.waitForTimeout(600);
  cp = castPosts();
  const e = await page.evaluate(() => ({ rows: document.querySelectorAll('#castrows .castrow').length, says: document.getElementById('castsaystxt').textContent, saysHidden: document.getElementById('castsays').hidden, n: document.getElementById('dcharsn').textContent, dirty: window.dirtySinceFilm }));
  ok(JSON.stringify(cp[cp.length - 1][1].cast) === '[]', 'removing the row POSTs /cast {cast:[]}', cp[cp.length - 1][1]);
  ok(e.rows === 0 && !/Character 1/.test(e.says), 'no rows, no clause', e);
  ok(e.n === '1', 'the badge falls back to the one picture', e.n);

  // reopening the sheet lands on the remembered tab
  await page.click('#charsclose');
  await page.waitForTimeout(100);
  if (await page.$eval('#drawbox', (el) => el.hidden)) await page.click('#promlab');
  await page.waitForTimeout(60);
  await page.click('#dchars');
  await page.waitForTimeout(120);
  const remembered = await page.evaluate(() => document.querySelector('#chartabs .acctab.on').id);
  ok(remembered === 'ctab-desc', 'the sheet reopens on the tab she left it on', remembered);

  ok(errors.length === 0, 'no page errors', errors);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
