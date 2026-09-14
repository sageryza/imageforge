#!/usr/bin/env node
/* TWO PERMANENT BLOCKS AT THE TOP — CHARACTERS, THEN SETTING (2026-09-13,
 * Sophie: "i envision two permanent default collapsed blocks at the top of
 * footage: characters, then setting").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT of what really
 * renders or a reading of what the stub server really received: a head that
 * is in the markup and never folds, a fold whose CSS never landed, a head
 * that quietly joins `blocks()` and renumbers her scene, one that rides
 * twice on an appended send, one that rides at the BOTTOM, and one whose
 * words never reach the door at all look identical in the source. It CRASHES
 * against the pre-fix page, where there are no head blocks at all.
 *
 * Run: node scripts/test-footage-heads.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) {
    console.log('FOOTAGE HEAD BLOCKS — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE HEAD BLOCKS — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage heads: playwright not installed — skipped'); report(); return;
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const F = require('../footage');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const posted = [];
const jobs = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, chat: 'footage',
        balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: [], status: 'drawing', seed: 7,
        sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    res.writeHead(404); res.end('nope');
  });
});

const CAST = 'Sophie is the woman in [Image1]. Nurse Edna is the woman in [Image2].';
const ROOM = 'A green-tiled ward corridor at night, one strip light out.';
const SCENE = Array.from({ length: 6 }, (_, i) => 'scene line ' + (i + 1) + ' — she walks the corridor').join('\n');

// what the page shows, measured
const read = () => {
  const panel = document.querySelector('.panel');
  const kids = Array.from(panel.children);
  const hs = kids.filter((c) => c.classList.contains('headwrap'));
  const ws = kids.filter((c) => c.classList.contains('promptwrap'));
  const seen = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hit = r.width && r.height
      ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(Math.min(r.top + r.height / 2, innerHeight - 2)))
      : null;
    return { w: r.width, h: r.height, top: r.top, right: r.right, display: cs.display,
      reaches: !!(hit && (hit === el || el.contains(hit))) };
  };
  const pill = document.querySelector('body > .float');
  return {
    nHeads: hs.length,
    ids: hs.map((w) => w.dataset.head),
    labs: hs.map((w) => (w.querySelector('.bflab') || {}).textContent || ''),
    lw: hs.map((w) => (w.querySelector('.lw') || {}).textContent || ''),
    shut: hs.map((w) => w.classList.contains('shut')),
    hbox: hs.map((w) => seen(w.querySelector('.hblock'))),
    hhead: hs.map((w) => seen(w.querySelector('.hfold'))),
    hvals: hs.map((w) => w.querySelector('.hblock').value),
    hcorner: hs.map((w) => seen(w.querySelector('.bigger'))),
    hasWipe: hs.map((w) => !!w.querySelector('.wipeb')),
    hasDivide: hs.map((w) => !!w.querySelector('.divide')),
    hasPblock: hs.map((w) => !!w.querySelector('.pblock')),
    aboveFirstBlock: hs.length && ws.length ? kids.indexOf(hs[hs.length - 1]) < kids.indexOf(ws[0]) : false,
    nBlocks: ws.length,
    firstIsPrompt: !!(ws[0] && ws[0].querySelector('#prompt')),
    many: panel.classList.contains('many'),
    blockLabs: ws.map((w) => (w.querySelector('.bflab') || {}).textContent || ''),
    blockActive: ws.map((w) => w.classList.contains('active')),
    blockVals: ws.map((w) => w.querySelector('.pblock').value),
    joinRows: kids.filter((c) => c.classList.contains('joinrow')).length,
    pill: pill ? pill.getBoundingClientRect().left : null,
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const tapHead = (i) => {
  const hs = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('headwrap'));
  hs[i].querySelector('.hfold').click();
};
const writeHead = ([i, text]) => {
  const hs = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('headwrap'));
  const el = hs[i].querySelector('.hblock');
  el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
};
const write = (text) => {
  const el = document.getElementById('prompt');
  el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
};
const send = async (page, btn) => {
  const was = posted.length;
  await page.click(btn);
  for (let i = 0; i < 40 && posted.length === was; i++) await page.waitForTimeout(100);
  return posted[posted.length - 1] || {};
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);

  // ── 1. TWO OF THEM, AT THE TOP, IN HER ORDER ────────────────────────────
  let s = await page.evaluate(read);
  ok('two head blocks', s.nHeads === 2);
  ok('characters, then setting — ' + s.ids.join(', '), s.ids.join(',') === 'characters,setting');
  ok('named on their headings — ' + s.labs.join(' / '), s.labs[0] === 'Characters' && s.labs[1] === 'Setting');
  ok('both above the first scene block', s.aboveFirstBlock);
  ok('and in that order on the screen (' + s.hhead.map((h) => Math.round(h.top)).join(' → ') + ')',
    s.hhead[0].top < s.hhead[1].top);

  // ── 2. DEFAULT COLLAPSED, and the heading is what opens one ─────────────
  ok('both start folded away', s.shut[0] && s.shut[1]);
  ok('their boxes are out of the layout, not merely dimmed — '
    + s.hbox.map((b) => b.display + ' ' + Math.round(b.h)).join(' / '),
    s.hbox.every((b) => b.display === 'none' && b.h === 0));
  ok('their corner buttons go with them', s.hcorner.every((c) => c.h === 0));
  ok('each heading is on screen', s.hhead.every((h) => h.display === 'flex' && h.h > 0));
  ok('and a tap really reaches each one', s.hhead.every((h) => h.reaches));

  // ── 3. PERMANENT: no ✕, no divide, and never a `blocks()` block ─────────
  ok('no ✕ on a head — nothing takes one off the page', s.hasWipe.every((x) => !x));
  ok('no divide on a head — nothing turns one into two', s.hasDivide.every((x) => !x));
  ok('a head carries no .pblock, so `blocks()` cannot see it', s.hasPblock.every((x) => !x));
  ok('her page is still ONE block', s.nBlocks === 1 && !s.many && s.joinRows === 0);
  ok('and the first block is still #prompt', s.firstIsPrompt);

  // ── 4. WITH BOTH EMPTY THE SEND IS BYTE-FOR-BYTE WHAT IT WAS ────────────
  await page.evaluate(write, SCENE);
  await page.waitForTimeout(200);
  let got = await send(page, '#go');
  ok('an unwritten head adds nothing at all — the prompt is exactly her box',
    got.prompt === SCENE);

  // ── 5. OPENING ONE FITS IT TO ITS WORDS ─────────────────────────────────
  await page.evaluate(tapHead, 0);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('characters is open', !s.shut[0] && s.shut[1]);
  ok('its box has a real height (' + Math.round(s.hbox[0].h) + 'px)', s.hbox[0].h > 40);
  ok('and its corner button is on screen and tappable', s.hcorner[0].h > 0 && s.hcorner[0].reaches);
  ok('the OTHER one is untouched', s.hbox[1].h === 0);

  // ── 6. THE PILL'S COLUMN IS RESERVED — a head is a panel child ──────────
  ok('the open head box clears the pill\'s column (right ' + Math.round(s.hbox[0].right)
    + ' vs pill at ' + Math.round(s.pill) + ')', s.pill != null && s.hbox[0].right <= s.pill + 1);
  ok('and so does its heading (right ' + Math.round(s.hhead[0].right) + ')', s.hhead[0].right <= s.pill + 1);

  // ── 7. SHUT, THE HEADING SAYS ITS WORDS — the whole disclosure ──────────
  await page.evaluate(writeHead, [0, CAST]);
  await page.evaluate(writeHead, [1, ROOM]);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('open, the heading does NOT repeat the words under it — "' + s.lw[0] + '"', s.lw[0] === '');
  await page.evaluate(tapHead, 0);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('shut, it says the first words of the cast — "' + s.lw[0] + '"',
    /Sophie is the woman/.test(s.lw[0]) && /^·/.test(s.lw[0].trim()));
  ok('and the setting says its own — "' + s.lw[1] + '"', /green-tiled ward/.test(s.lw[1]));
  ok('the words are not lost by folding', s.hvals[0] === CAST && s.hvals[1] === ROOM);

  // ── 8. THEY RIDE AT THE TOP OF THE CLIP SHE SENDS ───────────────────────
  got = await send(page, '#go');
  ok('the prompt the server really got is characters, setting, then the scene',
    got.prompt === CAST + '\n\n' + ROOM + '\n\n' + SCENE);
  ok('and it rode while both were folded away — nothing about a fold changes the job',
    /Sophie is the woman/.test(got.prompt));

  // ── 9. THE GOLD LINE NEVER MOVES TO A HEAD ──────────────────────────────
  const cut = SCENE.indexOf('scene line 4');
  await page.evaluate((c) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(c, c); }, cut);
  await page.click('#divide');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
    ws[1].querySelector('.pblock').focus();
  });
  await page.waitForTimeout(150);
  await page.evaluate(tapHead, 0);                       // open characters
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const hs = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('headwrap'));
    hs[0].querySelector('.hblock').focus();              // and tap into it
    hs[0].querySelector('.hblock').click();
  });
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('two scene blocks, numbered as they always were — ' + s.blockLabs.join(' / '),
    s.nBlocks === 2 && s.blockLabs.join(',') === 'Block 1,Block 2');
  ok('and tapping into a head left the gold line on the block she was in',
    s.blockActive[1] === true && s.blockActive[0] === false);
  got = await send(page, '#go');
  ok('so the star still sends THAT block, with the heads on top',
    got.prompt === CAST + '\n\n' + ROOM + '\n\n' + s.blockVals[1]);

  // ── 10. THE ALL STAR: the heads ride ONCE, at the top ───────────────────
  got = await send(page, '#goall');
  ok('an appended send carries the heads once, ahead of every block',
    got.prompt === CAST + '\n\n' + ROOM + '\n\n' + s.blockVals[0] + '\n\n' + s.blockVals[1]);
  ok('and never once per block', got.prompt.split('green-tiled ward').length === 2);

  // ── 11. `clear` LEAVES THEM — they are the standing thing above the job ─
  await page.click('#clearjob');
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('the job is wiped', s.blockVals.join('') === '' && s.nBlocks === 1);
  ok('and the cast and the room are still there', s.hvals[0] === CAST && s.hvals[1] === ROOM);

  // ── 12. THEY SURVIVE A RELOAD, AND COME BACK SHUT ───────────────────────
  ok('the draft carries them by name', s.draft.heads && s.draft.heads.characters === CAST
    && s.draft.heads.setting === ROOM);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('after a reload the words are back', s.hvals[0] === CAST && s.hvals[1] === ROOM);
  ok('and they are folded away again — shut is where they START', s.shut[0] && s.shut[1]);
  ok('the heading says the words without opening anything — "' + s.lw[0] + '"',
    /Sophie is the woman/.test(s.lw[0]));

  // ── 13. ONE EMPTY, ONE WRITTEN ──────────────────────────────────────────
  await page.evaluate(writeHead, [0, '']);
  await page.evaluate(write, SCENE);
  await page.waitForTimeout(200);
  got = await send(page, '#go');
  ok('an emptied head stops riding, and the other one still does',
    got.prompt === ROOM + '\n\n' + SCENE);

  ok('no page errors: ' + errors.join(' | '), !errors.length);

  await browser.close();
  server.close();
  report();
})();
