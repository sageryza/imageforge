#!/usr/bin/env node
/* CHARACTERS & SETTING — ONE FOLDED BLOCK, ABOVE THE BLOCK SHE IS IN
 * (2026-09-14, Sophie: "characters/setting become one collapsed block w two
 * text boxes" · "characters/setting move to above currently selected block, w
 * relevant characters for that block"). It replaces the two permanent blocks
 * of 2026-09-13.
 *
 * The REAL page headless, and every assertion is a MEASUREMENT of what really
 * renders or a reading of what the stub server really received: a block that
 * is in the markup and never folds, a fold whose CSS never landed, one that
 * quietly joins `blocks()` and renumbers her scene, one that sits in the
 * markup above the active block and paints somewhere else, a cast that reads
 * back right and never reaches the door, and a join mark hidden by the wrap
 * that moved between two blocks all look identical in the source.
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
const CAST2 = 'Nurse Edna is alone in [Image1].';
const SCENE = Array.from({ length: 6 }, (_, i) => 'scene line ' + (i + 1) + ' — she walks the corridor').join('\n');

// what the page shows, measured
const read = () => {
  const panel = document.querySelector('.panel');
  const kids = Array.from(panel.children);
  const hw = kids.filter((c) => c.classList.contains('headwrap'));
  const ws = kids.filter((c) => c.classList.contains('promptwrap'));
  const rows = hw.length ? Array.from(hw[0].querySelectorAll('.hpart')) : [];
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
  const wrap = hw[0] || null;
  return {
    nWraps: hw.length,
    nRows: rows.length,
    ids: rows.map((r) => r.dataset.head),
    labs: rows.map((r) => (r.querySelector('.hlab') || {}).textContent || ''),
    headLab: wrap ? (wrap.querySelector('.bflab') || {}).textContent || '' : '',
    lw: wrap ? (wrap.querySelector('.lw') || {}).textContent || '' : '',
    shut: wrap ? wrap.classList.contains('shut') : null,
    hbox: rows.map((r) => seen(r.querySelector('.hblock'))),
    hrow: rows.map((r) => seen(r)),
    hhead: wrap ? seen(wrap.querySelector('.hfold')) : null,
    hvals: rows.map((r) => r.querySelector('.hblock').value),
    hcorner: rows.map((r) => seen(r.querySelector('.bigger'))),
    hasWipe: wrap ? !!wrap.querySelector('.wipeb') : null,
    hasDivide: wrap ? !!wrap.querySelector('.divide') : null,
    hasPblock: wrap ? !!wrap.querySelector('.pblock') : null,
    // WHERE IT SITS, both ways: its place in the panel's own children, and the
    // block it is really drawn above on the screen.
    wrapAt: wrap ? kids.indexOf(wrap) : -1,
    aboveIdx: wrap ? ws.indexOf(wrap.nextElementSibling) : -2,
    aboveOnScreen: wrap && wrap.nextElementSibling
      ? wrap.getBoundingClientRect().top < wrap.nextElementSibling.getBoundingClientRect().top : null,
    nBlocks: ws.length,
    firstIsPrompt: !!(ws[0] && ws[0].querySelector('#prompt')),
    many: panel.classList.contains('many'),
    blockLabs: ws.map((w) => (w.querySelector('.bflab') || {}).textContent || ''),
    blockActive: ws.map((w) => w.classList.contains('active')),
    blockVals: ws.map((w) => w.querySelector('.pblock').value),
    joinRows: kids.filter((c) => c.classList.contains('joinrow')).length,
    joinShown: kids.filter((c) => c.classList.contains('joinrow'))
      .map((r) => r.getBoundingClientRect().height > 0),
    panelHasFold: !!document.getElementById('panelfold'),
    panelShut: panel.classList.contains('shut'),
    pill: pill ? pill.getBoundingClientRect().left : null,
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const tapHead = () => document.querySelector('.panel > .headwrap .hfold').click();
const writeHead = ([id, text]) => {
  const el = document.querySelector('.panel > .headwrap .hpart[data-head="' + id + '"] .hblock');
  el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
};
const intoBlock = (i) => {
  const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
  ws[i].querySelector('.pblock').focus();
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

  // ── 1. ONE BLOCK, TWO BOXES, AND NO PROMPT FOLD ────────────────────────
  let s = await page.evaluate(read);
  ok('one head block, not two', s.nWraps === 1);
  ok('two boxes in it — ' + s.ids.join(', '), s.nRows === 2 && s.ids.join(',') === 'characters,setting');
  ok('one heading over both — "' + s.headLab + '"', /Characters/.test(s.headLab) && /etting/.test(s.headLab));
  ok('each box says which it is — ' + s.labs.join(' / '),
    /Characters/i.test(s.labs[0]) && /Setting/i.test(s.labs[1]));
  ok('the prompt fold is gone — "remove prompt collapse"', !s.panelHasFold && !s.panelShut);

  // ── 2. DEFAULT COLLAPSED, and the heading is what opens it ─────────────
  ok('it starts folded away', s.shut === true);
  ok('both boxes are out of the layout, not merely dimmed — '
    + s.hrow.map((b) => b.display + ' ' + Math.round(b.h)).join(' / '),
    s.hrow.every((b) => b.display === 'none' && b.h === 0) && s.hbox.every((b) => b.h === 0));
  ok('their corner buttons go with them', s.hcorner.every((c) => c.h === 0));
  ok('the heading is on screen', s.hhead.display === 'flex' && s.hhead.h > 0);
  ok('and a tap really reaches it', s.hhead.reaches);

  // ── 3. PERMANENT: no ✕, no divide, and never a `blocks()` block ────────
  ok('no ✕ — nothing takes it off the page', !s.hasWipe);
  ok('no divide — nothing turns it into two', !s.hasDivide);
  ok('it carries no .pblock, so `blocks()` cannot see it', !s.hasPblock);
  ok('her page is still ONE block', s.nBlocks === 1 && !s.many && s.joinRows === 0);
  ok('and the first block is still #prompt', s.firstIsPrompt);
  ok('and it sits above that block', s.aboveIdx === 0 && s.aboveOnScreen);

  // ── 4. WITH BOTH EMPTY THE SEND IS BYTE-FOR-BYTE WHAT IT WAS ───────────
  await page.evaluate(write, SCENE);
  await page.waitForTimeout(200);
  let got = await send(page, '#go');
  ok('an unwritten box adds nothing at all — the prompt is exactly her box',
    got.prompt === SCENE);

  // ── 5. OPENING IT FITS BOTH BOXES ──────────────────────────────────────
  await page.evaluate(tapHead);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('it is open', s.shut === false);
  ok('both boxes have a real height (' + s.hbox.map((b) => Math.round(b.h)).join(' / ') + ')',
    s.hbox.every((b) => b.h > 30));
  ok('and both corner buttons are on screen and tappable',
    s.hcorner.every((c) => c.h > 0 && c.reaches));

  // ── 6. THE PILL'S COLUMN IS RESERVED — it is a panel child ─────────────
  // THE BOXES RUN FULL WIDTH BEHIND THE PILL since 2026-09-14 (Sophie: "text
  // box shud just stay full width behind pill"); only the heading keeps clear
  ok('the open boxes run under the pill\'s column (right '
    + s.hbox.map((b) => Math.round(b.right)).join(' / ') + ' vs pill at ' + Math.round(s.pill) + ')',
    s.pill != null && s.hbox.every((b) => b.right > s.pill + 1));
  ok('while its heading clears it (right ' + Math.round(s.hhead.right) + ')', s.hhead.right <= s.pill + 1);

  // ── 7. SHUT, THE HEADING SAYS BOTH — the whole disclosure ──────────────
  await page.evaluate(writeHead, ['characters', CAST]);
  await page.evaluate(writeHead, ['setting', ROOM]);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('open, the heading does NOT repeat the words under it — "' + s.lw + '"', s.lw === '');
  await page.evaluate(tapHead);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('shut, it says the cast AND the room — "' + s.lw + '"',
    /Sophie is the woman/.test(s.lw) && /green-tiled ward/.test(s.lw) && /^·/.test(s.lw.trim()));
  ok('the cast comes first, since that is the half that changes block to block',
    s.lw.indexOf('Sophie') < s.lw.indexOf('green-tiled'));
  ok('the words are not lost by folding', s.hvals[0] === CAST && s.hvals[1] === ROOM);

  // ── 8. THEY RIDE AT THE TOP OF THE CLIP SHE SENDS ──────────────────────
  got = await send(page, '#go');
  ok('the prompt the server really got is characters, setting, then the scene',
    got.prompt === CAST + '\n\n' + ROOM + '\n\n' + SCENE);
  ok('and it rode while it was folded away — nothing about a fold changes the job',
    /Sophie is the woman/.test(got.prompt));

  // ── 9. A DIVIDE, AND THE WRAP FOLLOWS THE GOLD LINE ────────────────────
  const cut = SCENE.indexOf('scene line 4');
  await page.evaluate((c) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(c, c); }, cut);
  await page.click('#divide');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('two scene blocks, numbered as they always were — ' + s.blockLabs.join(' / '),
    s.nBlocks === 2 && s.blockLabs.join(',') === 'Block 1,Block 2');
  ok('the gold line is still on block 1', s.blockActive[0] === true);
  ok('and the wrap is above block 1 (' + s.aboveIdx + ')', s.aboveIdx === 0 && s.aboveOnScreen);
  ok('the join mark between them is still drawn — the wrap in the gap must not hide it',
    s.joinRows === 1 && s.joinShown[0] === true);
  await page.evaluate(intoBlock, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('tapping into block 2 moves the gold line', s.blockActive[1] === true && !s.blockActive[0]);
  ok('AND THE WRAP MOVES WITH IT — it is above block 2 now (' + s.aboveIdx + ')',
    s.aboveIdx === 1 && s.aboveOnScreen);
  ok('the join mark is still drawn with the wrap moved into that gap',
    s.joinRows === 1 && s.joinShown[0] === true);
  ok('a divide gives the new half a copy of the cast', s.hvals[0] === CAST);

  // ── 10. CHARACTERS IS THE BLOCK'S — "relevant characters for that block" ─
  await page.evaluate(writeHead, ['characters', CAST2]);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('block 2 now has its own cast', s.hvals[0] === CAST2);
  ok('and the room is untouched — it is every clip\'s', s.hvals[1] === ROOM);
  got = await send(page, '#go');
  ok('the star sends THAT block with THAT block\'s cast',
    got.prompt === CAST2 + '\n\n' + ROOM + '\n\n' + s.blockVals[1]);
  await page.evaluate(intoBlock, 0);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('tapping back into block 1 brings ITS cast back', s.hvals[0] === CAST);
  ok('and the wrap is back above block 1', s.aboveIdx === 0);
  got = await send(page, '#go');
  ok('and block 1 sends its own', got.prompt === CAST + '\n\n' + ROOM + '\n\n' + s.blockVals[0]);

  // ── 11. THE DRAFT CARRIES ONE CAST PER BLOCK, AND ONE SETTING ──────────
  ok('the draft holds a cast per block — ' + JSON.stringify(s.draft.chars),
    Array.isArray(s.draft.chars) && s.draft.chars[0] === CAST && s.draft.chars[1] === CAST2);
  ok('and the setting by name, with no `characters` beside it',
    s.draft.heads && s.draft.heads.setting === ROOM && !('characters' in s.draft.heads));

  // ── 12. A JOIN PUTS THE TWO CASTS TOGETHER ─────────────────────────────
  await page.evaluate(() => document.querySelector('.panel .joinrow .joinb').click());
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('one block again', s.nBlocks === 1 && s.joinRows === 0);
  ok('and one cast holding both — "' + s.hvals[0].replace(/\n/g, ' / ') + '"',
    /Sophie is the woman/.test(s.hvals[0]) && /Nurse Edna is alone/.test(s.hvals[0]));

  // ── 13. `clear` WIPES THE CAST AND LEAVES THE ROOM; `undo` PUTS IT BACK ─
  await page.click('#clearjob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('the job is wiped', s.blockVals.join('') === '' && s.nBlocks === 1);
  ok('the cast goes with the blocks it belonged to', s.hvals[0] === '');
  ok('and the room is still there — it is the standing thing above the job', s.hvals[1] === ROOM);
  await page.click('#undojob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('undo puts the cast back with the words', /Sophie is the woman/.test(s.hvals[0]));

  // ── 14. THEY SURVIVE A RELOAD, AND IT COMES BACK SHUT ──────────────────
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('after a reload the cast is back', /Sophie is the woman/.test(s.hvals[0]));
  ok('and the room', s.hvals[1] === ROOM);
  ok('and it is folded away again — shut is where it STARTS', s.shut === true);
  ok('the heading says the words without opening anything — "' + s.lw + '"',
    /Sophie is the woman/.test(s.lw));
  ok('and it is above the block she was in', s.aboveIdx === 0);

  // ── 15. AN EMPTIED BOX STOPS RIDING ────────────────────────────────────
  await page.evaluate(writeHead, ['characters', '']);
  await page.evaluate(write, SCENE);
  await page.waitForTimeout(200);
  got = await send(page, '#go');
  ok('an emptied cast stops riding, and the room still does',
    got.prompt === ROOM + '\n\n' + SCENE);

  // ── 16. A DRAFT FROM THE TWO-BLOCK DAY SEEDS EVERY BLOCK ───────────────
  // A shipped fix to a WRITE path leaves the records already on file wrong —
  // a page that wrote `heads.characters` as ONE value for every block has to
  // hand it to every block, or her scene comes back without the people in it.
  await page.evaluate(() => {
    // the per-project map is the standing store for the SETTING, so it is
    // cleared with the draft — otherwise the room she has already written for
    // this project (correctly) wins, and the step would be measuring that
    localStorage.removeItem('footage_heads');
    localStorage.setItem('footage_draft', JSON.stringify({
      prompt: 'shot one', blocks: ['shot two'], active: 0,
      heads: { characters: 'THE OLD ONE CAST', setting: 'THE OLD ONE ROOM' },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('the old single cast comes back on block 1', s.hvals[0] === 'THE OLD ONE CAST');
  ok('and the old room', s.hvals[1] === 'THE OLD ONE ROOM');
  await page.evaluate(intoBlock, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('and block 2 got it too — nothing of hers is left without a cast',
    s.hvals[0] === 'THE OLD ONE CAST');

  // ── A SENT JOB FOLDS IT AWAY (2026-09-24, "characters uncollapses" ·
  // "sent a job"), the References fold's own rule
  s = await page.evaluate(read);
  if (s.shut) { await page.evaluate(tapHead); await page.waitForTimeout(150); }
  s = await page.evaluate(read);
  ok('open before the send', s.shut === false);
  await page.evaluate(write, SCENE);
  await send(page, '#go');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('a sent job shuts it', s.shut === true);
  ok('and the shut heading still says what rides — "' + s.lw + '"', /THE OLD ONE CAST/.test(s.lw));

  ok('no page errors: ' + errors.join(' | '), !errors.length);

  await browser.close();
  server.close();
  report();
})();
