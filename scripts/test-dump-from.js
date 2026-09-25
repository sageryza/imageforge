#!/usr/bin/env node
'use strict';
// WHO SENT IT — `from: 'sophie' | 'claude'` on every Dump file, and the /dump
// page's FROM ME · FROM CLAUDE tabs (2026-09-25, Sophie: "hide every single
// thing a chat has ever uploaded or make a new tab. make it like 'from
// claude' and from me"). The rule pure, then the real page headless — the
// chat album COUNTED off the rendered list (a hidden row and a never-drawn
// one look identical to any source assertion), and the tab line MEASURED
// under the lit word.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const drop = require('../dropbox.js');
const ROOT = path.join(__dirname, '..');
let pass = 0;
const fails = [];
const t = (name, fn) => {
  try { fn(); pass += 1; console.log('  ok  ' + name); } catch (e) {
    fails.push(name + ': ' + e.message); console.error('  FAIL ' + name + '\n       ' + e.message);
  }
};

t('an upload that says who it is from wins, in her words or a chat\'s', () => {
  assert.strictEqual(drop.whoFrom('curl/8.4', 'me'), 'sophie');
  assert.strictEqual(drop.whoFrom('Mozilla/5.0 (iPhone)', 'claude'), 'claude');
  assert.strictEqual(drop.whoFrom('curl/8.4', 'sophie'), 'sophie');
  assert.strictEqual(drop.whoFrom('curl/8.4', 'chat'), 'claude');
  assert.strictEqual(drop.fromWord('nonsense'), null);
});
t('otherwise the User-Agent: her phone and a browser are hers, a script is a chat\'s', () => {
  assert.strictEqual(drop.whoFrom('DumpShare/1 CFNetwork/1568 Darwin/24.0'), 'sophie');
  assert.strictEqual(drop.whoFrom('ImageForge/12 CFNetwork/1568 Darwin/24.0'), 'sophie');
  assert.strictEqual(drop.whoFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605 Mobile/15E148'), 'sophie');
  assert.strictEqual(drop.whoFrom('curl/8.4.0'), 'claude');
  assert.strictEqual(drop.whoFrom('node'), 'claude');
  assert.strictEqual(drop.whoFrom('undici'), 'claude');
  assert.strictEqual(drop.whoFrom('python-requests/2.32'), 'claude');
  assert.strictEqual(drop.whoFrom(''), 'claude');
  assert.strictEqual(drop.whoFrom(undefined), 'claude');
  // a page driven by playwright from a container is a chat, whatever the page
  assert.strictEqual(drop.whoFrom('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/128.0'), 'claude');
});
t('an older doc is judged by its shape — the phone\'s names are hers', () => {
  const S = 'sophie'; const C = 'claude';
  assert.strictEqual(drop.guessFrom({ session: '2026-08-23-1102', filename: '66FB6123-CF7B-4897-9C6E-0E07D98DE604-IMG_2138.HEIC' }), S);
  assert.strictEqual(drop.guessFrom({ session: '2026-08-23-1102', filename: 'EB9BB164-5300-4014-8874-29609030FC83.mov' }), S);
  assert.strictEqual(drop.guessFrom({ session: '2026-09-12-1930', filename: 'IMG_0534.png' }), S);
  assert.strictEqual(drop.guessFrom({ session: '2026-09-12-1930', filename: 'save-FA175981-A09D-4F8B-96B3-BD80233E3F43.png' }), S);
  assert.strictEqual(drop.guessFrom({ session: '2026-09-12-1930', filename: '81070035281__14D9A761-1715-4D10-B518-9D79141FFBAA.MOV' }), S);
  assert.strictEqual(drop.guessFrom({ session: '2026-08-21-2200', filename: 'sophiespincher_httpss.mj.run3OYgxGA_0.mp4' }), S);
  assert.strictEqual(drop.guessFrom({ session: '2026-08-21-2200', filename: 'Sean and Jonathan.mp4' }), S);
  // and a chat's
  assert.strictEqual(drop.guessFrom({ session: 'card-pattern', filename: 'poster-fruits-hand-v1.png' }), C);
  assert.strictEqual(drop.guessFrom({ session: 'seedance-cut1', filename: 'ward-intake-A-25.mp4' }), C);
  assert.strictEqual(drop.guessFrom({ session: '2026-09-10-2247', filename: 'desk-sweep-commercial-v22.mp4' }), C);
  assert.strictEqual(drop.guessFrom({ session: '2026-09-10-2247', filename: 'alocasia.png' }), C);
  assert.strictEqual(drop.guessFrom({ session: '2026-09-10-2247', filename: null }), C);
  // the phone's shape wins even inside a chat-named session — she dumped into its album
  assert.strictEqual(drop.guessFrom({ session: 'seedance-cut1', dumpSession: '2026-09-12-1930', filename: 'IMG_0601.MOV' }), S);
  // a word already on the doc is never re-guessed
  assert.strictEqual(drop.guessFrom({ from: 'claude', session: '2026-09-12-1930', filename: 'IMG_0534.png' }), C);
  assert.strictEqual(drop.guessFrom({ from: 'me', session: 'card-pattern', filename: 'x.png' }), S);
});
t('an album is judged whole, by majority, a tie to her', () => {
  const her = (n) => ({ session: '2026-08-23-1102', filename: `${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}-IMG_${n}.HEIC` });
  const chat = (n) => ({ session: '2026-08-23-1102', filename: `recovered-${n}.heic` });
  assert.strictEqual(drop.albumFrom([her(1), her(2), her(3), chat(1)]), 'sophie');
  assert.strictEqual(drop.albumFrom([her(1), chat(1)]), 'sophie');
  assert.strictEqual(drop.albumFrom([her(1), chat(1), chat(2)]), 'claude');
  assert.strictEqual(drop.albumFrom([]), 'claude');
});
t('the page draws covers and tiles from the display copy, never the original', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/dump.html'), 'utf8');
  assert.ok(/b\.coverThumb\|\|b\.cover/.test(html), 'the list cover');
  assert.ok(/f\.thumb\|\|/.test(html), 'the file tiles');
  assert.ok(/viewswitch\.js/.test(html) && /viewswitch\.css/.test(html), 'the one view switch, linked');
  assert.ok(!/localStorage\.setItem\(['"]dump_/.test(html), 'the switch keeps its own keys');
});
t('a zip filed as an image on an older row gets no thumb', () => {
  assert.strictEqual(drop.thumbLink({ id: 'Z', media: 'image', storagePath: 'drops/_/a.zip' }), null);
  assert.strictEqual(drop.thumbLink({ id: 'P', media: 'image', storagePath: 'drops/_/a.jpg' }), '/api/drop/thumb/P');
  assert.strictEqual(drop.thumbLink({ id: 'P', media: 'image', thumbUrl: 'T' }), 'T');
  assert.strictEqual(drop.thumbLink({ id: 'V', media: 'video', posterUrl: 'PO' }), 'PO');
});
t('the page carries the two tabs, opens on FROM ME, and asks the server for one side', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/dump.html'), 'utf8');
  assert.ok(/class="acctab on" data-from="me">From me</.test(html));
  assert.ok(/class="acctab" data-from="claude">From Claude</.test(html));
  assert.ok(/let curFrom='me'/.test(html), 'opens on hers');
  assert.ok(/api\('\/bundles'\+q\)/.test(html) && /'\?from='\+encodeURIComponent\(curFrom\)/.test(html));
  assert.ok(!/localStorage\.(get|set)Item\(['"]dump/.test(html), 'the side is memory, never a setting');
});

async function page() {
  let chromium, express;
  try { ({ chromium } = require('playwright')); express = require('express'); }
  catch { console.log('  (headless half skipped — playwright not installed)'); return; }
  const asked = [];
  const album = (name, from, id) => ({
    bundle: name.toLowerCase().replace(/\s+/g, '-'), bundleName: name, track: null, from, session: '2026-09-25-1200',
    newest: 5, label: 'Sep 25 · 12:00 pm',
    files: [{ id, url: '/x.jpg', media: 'image', posterUrl: null, photoIndex: 0 }],
  });
  const app = express();
  app.get('/api/drop/tracks', (q, r) => r.json({ tracks: [] }));
  app.get('/api/drop/sessions', (q, r) => {
    asked.push('sessions:' + (q.query.from || ''));
    // 143 of these on the live page — the row they used to fill scrolled sideways
    r.json({ sessions: Array.from({ length: 143 }, (_, i) => ({ session: '2026-09-' + (10 + (i % 15)) + '-' + String(1000 + i), label: 'Sep ' + (10 + (i % 15)) + ' · ' + (i % 12 + 1) + ':00 pm', files: 3, unlabelled: 1, cover: null })) });
  });
  app.get('/api/drop/bundles', (q, r) => {
    asked.push('bundles:' + (q.query.from || ''));
    const side = q.query.from;
    r.json({ bundles: side === 'claude' ? [album('Posters v9', 'claude', 'C1')] : [album('Pink quartz', 'sophie', 'S1')] });
  });
  app.get('/x.jpg', (q, r) => r.status(204).end());
  app.use(express.static(path.join(ROOT, 'public')));
  const srv = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const port = srv.address().port;
  let browser;
  try {
    let exe = null; const root = '/opt/pw-browsers';
    if (fs.existsSync(root)) {
      for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
        const c = path.join(root, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(c)) { exe = c; break; }
      }
    }
    browser = await chromium.launch(exe ? { executablePath: exe } : {});
  } catch { console.log('  (headless half skipped — no browser binary)'); srv.close(); return; }
  try {
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(`http://127.0.0.1:${port}/dump.html`);
    await pg.waitForTimeout(700);
    const names = async () => pg.$$eval('.card .nm', (els) => els.map((e) => e.textContent));
    t('opens on FROM ME: her album drawn, the chat\'s not', async () => {});
    const first = await names();
    assert.deepStrictEqual(first, ['Pink quartz']); pass++;
    assert.deepStrictEqual(asked.filter((a) => a.startsWith('bundles')), ['bundles:me'], 'one read, hers'); pass++;
    // the line sits under the lit word — measured, not asserted in source
    const line = async () => pg.evaluate(() => {
      const row = document.getElementById('fromtabs');
      const on = row.querySelector('.acctab.on').getBoundingClientRect();
      const cs = getComputedStyle(row, '::after');
      const m = new DOMMatrix(cs.transform);
      return { tabLeft: on.left, tabWidth: on.width, lineX: row.getBoundingClientRect().left + m.m41, lineW: parseFloat(cs.width), word: row.querySelector('.acctab.on').textContent.trim() };
    });
    let l = await line();
    assert.strictEqual(l.word, 'From me'); pass++;
    assert.ok(Math.abs(l.lineX - l.tabLeft) < 1 && Math.abs(l.lineW - l.tabWidth) < 1, `line under FROM ME: ${JSON.stringify(l)}`); pass++;
    // a tap at the other tab's own centre reaches it
    const hit = await pg.evaluate(() => {
      const r = document.querySelector('[data-from="claude"]').getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el && el.dataset && el.dataset.from;
    });
    assert.strictEqual(hit, 'claude', 'a tap reaches FROM CLAUDE'); pass++;
    await pg.click('[data-from="claude"]');
    await pg.waitForTimeout(600);
    assert.deepStrictEqual(await names(), ['Posters v9'], 'the chat side shows only the chat album'); pass++;
    assert.deepStrictEqual(asked.filter((a) => a.startsWith('bundles')), ['bundles:me', 'bundles:claude']); pass++;
    l = await line();
    assert.strictEqual(l.word, 'From Claude'); pass++;
    assert.ok(Math.abs(l.lineX - l.tabLeft) < 1 && Math.abs(l.lineW - l.tabWidth) < 1, `line under FROM CLAUDE: ${JSON.stringify(l)}`); pass++;
    // a chip tap is a filter over memory, never another read
    await pg.evaluate(() => { document.querySelector('.chip[data-un]').click(); });
    await pg.waitForTimeout(200);
    assert.strictEqual(asked.filter((a) => a.startsWith('bundles')).length, 2, 'a chip re-reads nothing'); pass++;
    assert.deepStrictEqual(await names(), ['Posters v9']); pass++;
    // NO SECOND SCROLL: the chips wrap, the page is exactly as wide as the phone
    const widths = await pg.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth,
      document.querySelector('.chips').scrollWidth, document.querySelector('.chips').clientWidth,
      document.querySelectorAll('.chip').length]);
    assert.strictEqual(widths[0], widths[1], 'the page does not scroll sideways'); pass++;
    assert.strictEqual(widths[2], widths[3], 'the chip row does not scroll sideways'); pass++;
    assert.ok(widths[4] < 20, `143 dumps are one Date chip, not 143 chips (${widths[4]} chips)`); pass++;
    // the Date chip opens the sheet; a dump picked there filters and lights the chip
    await pg.click('.chip.date');
    await pg.waitForTimeout(200);
    assert.strictEqual(await pg.$$eval('#datelist .alb', (els) => els.length), 143); pass++;
    await pg.click('#datelist .alb:nth-child(2)');
    await pg.waitForTimeout(200);
    assert.ok(/✕$/.test((await pg.textContent('.chip.date')).trim()), 'the lit chip reads the dump and offers ✕'); pass++;
    assert.strictEqual(await pg.evaluate(() => document.getElementById('datesheet').hidden), true); pass++;
    // TILES: the wall `--cols` across, every tile inside the screen
    await pg.click('.chip.date'); await pg.waitForTimeout(150);   // ✕ clears the dump
    await pg.click('#v-tiles');
    await pg.waitForTimeout(200);
    const wall = await pg.evaluate(() => {
      const tiles = [...document.querySelectorAll('.wall .tile')].map((t) => t.getBoundingClientRect());
      return { n: tiles.length, cols: getComputedStyle(document.documentElement).getPropertyValue('--cols').trim(),
        maxRight: Math.max(...tiles.map((r) => r.right)), w: document.documentElement.clientWidth, names: [...document.querySelectorAll('.wall .tn')].map((e) => e.textContent) };
    });
    assert.strictEqual(wall.n, 1); pass++;
    assert.deepStrictEqual(wall.names, ['Posters v9']); pass++;
    assert.ok(wall.maxRight <= wall.w, `a tile past the screen: ${wall.maxRight} > ${wall.w}`); pass++;
    await pg.click('#v-list'); await pg.waitForTimeout(150);
    assert.deepStrictEqual(await names(), ['Posters v9'], 'back to the list'); pass++;
    if (errs.length) fails.push('page errors: ' + errs.join(' | ')); else pass++;
    console.log('  ok  headless: her side, the chat side, the measured line, no re-reads, one Date chip, tiles');
  } catch (e) {
    fails.push('headless: ' + e.message); console.error('  FAIL headless\n       ' + e.message);
  } finally { await browser.close(); srv.close(); }
}

page().then(() => {
  if (fails.length) { console.error(`test-dump-from: ${fails.length} FAILED`); process.exit(1); }
  console.log(`test-dump-from: ${pass} checks passed`);
});
