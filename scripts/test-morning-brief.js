#!/usr/bin/env node
/**
 * The morning brief's page, driven for real in headless Chromium.
 *
 * Builds the page from scripts/morning-brief.example.json, serves it with the
 * REAL injected pill (public/pill-inject.html) and a stub verdict API, then
 * taps it the way she does. Also loads it inside a same-origin iframe that
 * stands in for chats.html, because the app is where she actually reads it and
 * a link that navigates the frame would put the whole Chats app inside the
 * page viewer.
 *
 *   node scripts/test-morning-brief.js
 *
 * Skips (exit 0) when playwright or a browser is missing, like the other
 * headless tests here.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { build, idFor } = require('./morning-brief.js');

const ROOT = path.join(__dirname, '..');
const PORT = 8791;
let bad = 0;
const ok = (c, m) => { if (!c) bad++; console.log((c ? 'PASS  ' : 'FAIL  ') + m); };

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('SKIP  playwright not installed'); process.exit(0); }
const EXE = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean).find(p => fs.existsSync(p));

const HOST_PAGE = '<!doctype html><meta charset=utf-8><title>host</title>'
  + '<script>window.__opened=[];window.__openThread=function(n){window.__opened.push(n);return true;};</script>'
  + '<iframe id=f src="/page?embed=1" style="width:390px;height:800px;border:0"></iframe>';

function serve(html) {
  const pill = fs.readFileSync(path.join(ROOT, 'public/pill-inject.html'), 'utf8');
  const types = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };
  const store = { items: {}, texts: {} };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/page') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html + pill); }
    if (u.pathname === '/host') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(HOST_PAGE); }
    if (u.pathname === '/chats') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<title>CHATS APP</title>'); }
    if (u.pathname === '/api/chatfeed/verdict') {
      if (req.method === 'POST') {
        let b = ''; req.on('data', d => b += d);
        return req.on('end', () => {
          try {
            const j = JSON.parse(b);
            if (j.ok === null) delete store.items[j.item];
            else if (j.ok !== undefined) store.items[j.item] = j.ok;
            if (j.text !== undefined) store.texts[j.item] = j.text;
          } catch (_) { /* the stub only has to not crash */ }
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, items: store.items, texts: store.texts }));
    }
    const f = path.join(ROOT, 'public', u.pathname);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return new Promise(r => srv.listen(PORT, () => r(srv)));
}

(async () => {
  // ---- pure: the id is derived from the words, which is why a tick survives
  // the evening re-post (a positional id would hand it to another task).
  ok(idFor({ chat: 'a', title: 'b' }) === idFor({ chat: 'a', title: 'b' }), 'same task → same id');
  ok(idFor({ chat: 'a', title: 'b' }) !== idFor({ chat: 'a', title: 'c' }), 'different task → different id');
  ok(idFor({ chat: 'a', title: 'b' }) !== idFor({ chat: 'z', title: 'b' }), 'same words in another chat → different id');

  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'morning-brief.example.json'), 'utf8'));
  const html = build(data);
  ok(html.indexOf('claude.ai') < 0, 'no claude.ai session links in the built page');
  ok(html.indexOf('/compare.css') > 0 && html.indexOf('/compare.js') > 0, 'links the shared kit');

  if (!EXE) { console.log('SKIP  no chromium at a known path'); process.exit(bad ? 1 : 0); }
  const srv = await serve(html);
  const U = 'http://127.0.0.1:' + PORT;
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const sec = item => p.$eval('.row[data-item="' + item + '"]', e => e.closest('section').id || e.closest('section').dataset.sec);

  await p.goto(U + '/page', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  const heads = await p.$$eval('#today section[data-sec] h2', e => e.map(x => x.textContent));
  ok(heads.join('|') === 'Now|Later|At some point', 'the sections ARE the three timings — ' + heads.join(' · '));
  ok(await p.$$eval('#today .row[data-item]', e => e.length) === data.today.length, 'every today item is a row');
  ok(await p.$$eval('.cmp-note-open', e => e.length) === data.today.length, 'a note + on every today row');
  ok(await p.$eval('#today [data-box]', e => getComputedStyle(e).borderTopColor) === 'rgb(192, 97, 74)', 'the boxes are red');

  const first = await p.$eval('#today section[data-sec="now"] .row', e => e.dataset.item);
  ok(await p.$eval('.row[data-item="' + first + '"] [data-pri="now"]', e => e.getAttribute('aria-pressed')) === 'true',
     "an untouched row lights the run's own timing");

  // her flag is the grouping control
  await p.click('.row[data-item="' + first + '"] [data-pri="some"]'); await p.waitForTimeout(300);
  ok(await sec(first) === 'some', 'flagging moves the row into that group');
  await p.click('.row[data-item="' + first + '"] [data-pri="some"]'); await p.waitForTimeout(300);
  ok(await sec(first) === 'now', "clearing her flag returns it to the run's group");
  ok(await p.$eval('.row[data-item="' + first + '"] [data-pri="now"]', e => e.getAttribute('aria-pressed')) === 'true',
     'a row is never left with no timing lit');

  // ticking → Done, and back
  await p.click('.row[data-item="' + first + '"] [data-box]'); await p.waitForTimeout(300);
  ok(await sec(first) === 'donebox', 'a ticked row drops into Done');
  ok(/of/.test(await p.$eval('#cTod', e => e.textContent)), 'the tab count shows what is left');
  await p.click('.row[data-item="' + first + '"] [data-box]'); await p.waitForTimeout(300);
  ok(await sec(first) === 'now', 'unticking returns it to its group');

  // star → red outline, and everything survives a reload
  await p.click('.row[data-item="' + first + '"] [data-star]');
  await p.click('.row[data-item="' + first + '"] [data-pri="later"]'); await p.waitForTimeout(400);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  ok(await sec(first) === 'later', 'after reload: her flag still holds it');
  ok(await p.$eval('.row[data-item="' + first + '"]', e => /192, 97, 74/.test(getComputedStyle(e).boxShadow)),
     'after reload: the star still outlines the row red');

  // the pill owns the top-right corner, so the marks live bottom-left
  const px = await p.$eval('.float', e => e.getBoundingClientRect().x);
  const mx = await p.$$eval('#today .marks .pri', els => Math.max.apply(null, els.slice(0, 4).map(e => e.getBoundingClientRect().right)));
  ok(mx < px, 'a row\'s marks clear the pill (' + Math.round(mx) + ' < ' + Math.round(px) + ')');
  const ow = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(ow[0] <= ow[1], 'no sideways scroll (' + ow.join('/') + ')');

  // EMBEDDED — in the app the page is an iframe of chats.html
  const hp = await ctx.newPage();
  await hp.goto(U + '/host', { waitUntil: 'networkidle' }); await hp.waitForTimeout(800);
  const fr = hp.frames().find(f => f.url().indexOf('/page') > 0);
  await fr.click('a.go'); await hp.waitForTimeout(400);
  ok((await hp.evaluate(() => window.__opened)).length === 1, 'embedded: a tap hands the parent __openThread');
  ok((await fr.title()) !== 'CHATS APP', 'embedded: the iframe never navigates into the Chats app');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nall green');
  process.exit(bad ? 1 : 0);
})();
