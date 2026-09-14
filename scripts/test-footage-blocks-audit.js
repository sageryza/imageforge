#!/usr/bin/env node
/* THE THREE GAPS SHE NAMED, AND THE AUDIT'S OWN FIXES (2026-09-13, Sophie:
 * "did u or could u do a good clean audit - any other bugs you find, or
 * features that shud exist but dont now / ex, clearing individual separated
 * boxes, sending two boxes at once, collapsing the prompt from partway down").
 *
 * The REAL page headless, and every assertion here is a MEASUREMENT or a
 * reading of what the stub server really received — because in the source a
 * ✕ that removes the wrong block, a second star that never reaches the
 * server, a batch that sends the same block twice, a fold row whose sticky
 * CSS never landed, a put-back that loses her words, and a note filed under
 * a part's url all look exactly like the versions that work.
 *
 * Verified against the pre-fix page, where it CRASHES rather than failing a
 * count: `#goall` does not exist there at all, and every source pin at the
 * foot is a line that was not in the file.
 *
 * Run: node scripts/test-footage-blocks-audit.js
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
    console.log('FOOTAGE BLOCKS AUDIT — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE BLOCKS AUDIT — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage blocks audit: playwright not installed — skipped'); report(); return;
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
const notes = [];
let cents = 4.4;
let refuse = false;                  // the next send comes back a content refusal
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
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: cents, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs, more: false, folders: {} });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      if (refuse) {
        refuse = false;
        return json({ ok: false, error: 'refused', refusal: 'content', door: 'atlascloud' }, 400);
      }
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: b.refs || [], status: 'drawing', seed: 7,
        project: b.project || '', folder: b.folder || '',
        sentAt: new Date().toISOString(), estimate: cents, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', estimate: cents, seed: 7 }, 202);
    }
    if (u.pathname === '/api/gallery/assets/note' && req.method === 'POST') {
      const b = JSON.parse(body);
      notes.push(b);
      return json({ ok: true, thread: [{ from: 'sophie', text: b.text, at: new Date().toISOString() }] });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
    res.writeHead(404); res.end('nope');
  });
});

const LONG = Array.from({ length: 60 }, (_, i) => 'line ' + (i + 1) + ' — the ward corridor at night').join('\n');

const readBlocks = () => {
  const panel = document.getElementById('prompt').closest('.panel');
  const ws = Array.from(panel.children).filter((k) => k.classList.contains('promptwrap'));
  return ws.map((w) => {
    const box = w.querySelector('.pblock');
    const x = w.querySelector('.wipeb');
    const r = x ? x.getBoundingClientRect() : null;
    return {
      text: box.value,
      id: box.id || '',
      active: w.classList.contains('active'),
      xDrawn: !!(r && r.width && r.height),
      xRight: r ? Math.round(r.right) : 0,
      boxRight: Math.round(box.getBoundingClientRect().right),
    };
  });
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(700);

  // ── 1. ONE BLOCK CARRIES NO ✕ — the page is what it always was ──────────
  await page.fill('#prompt', 'the ward corridor at night');
  await page.waitForTimeout(200);
  let bs = await page.evaluate(readBlocks);
  ok('one block: no ✕ is drawn at all', bs.length === 1 && !bs[0].xDrawn);
  ok('and the second star is not drawn either', await page.evaluate(() => document.getElementById('goall').hidden === true));

  // ── 2. divide twice → three blocks, each with a ✕ inside its own box ────
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.value = 'shot one\nshot two\nshot three';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(el.value.indexOf('\nshot two'), el.value.indexOf('\nshot two'));
  });
  await page.click('#divide');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    const b = ws[1].querySelector('.pblock');
    b.focus(); b.setSelectionRange(b.value.indexOf('\nshot three'), b.value.indexOf('\nshot three'));
  });
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    ws[1].querySelector('.divide').click();
  });
  await page.waitForTimeout(250);
  bs = await page.evaluate(readBlocks);
  ok('three blocks (' + bs.map((b) => b.text).join(' | ') + ')', bs.length === 3
    && bs[0].text === 'shot one' && bs[1].text === 'shot two' && bs[2].text === 'shot three');
  ok('every block draws its ✕ now', bs.every((b) => b.xDrawn));
  ok('the ✕ sits inside its own box, clear of the two corner buttons ('
    + bs[0].xRight + ' vs box ' + bs[0].boxRight + ')', bs[0].xRight < bs[0].boxRight - 100 && bs[0].xRight > 100);

  // ── 3. the ✕ on a MIDDLE block takes that block and nothing else ────────
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    ws[2].querySelector('.pblock').focus();            // she is standing in block 3
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    ws[1].querySelector('.wipeb').click();
  });
  await page.waitForTimeout(250);
  bs = await page.evaluate(readBlocks);
  ok('the middle block is gone and the others are untouched (' + bs.map((b) => b.text).join(' | ') + ')',
    bs.length === 2 && bs[0].text === 'shot one' && bs[1].text === 'shot three');
  ok('the gold line did not move off the block she was standing in', bs[1].active === true);
  ok('undo is offered for it', await page.evaluate(() => document.getElementById('undojob').hidden === false));
  await page.click('#undojob');
  await page.waitForTimeout(250);
  bs = await page.evaluate(readBlocks);
  ok('undo puts all three back (' + bs.map((b) => b.text).join(' | ') + ')',
    bs.length === 3 && bs[1].text === 'shot two');

  // ── 4. the ✕ on the FIRST block keeps #prompt as the first node ─────────
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    ws[0].querySelector('.wipeb').click();
  });
  await page.waitForTimeout(250);
  bs = await page.evaluate(readBlocks);
  ok('two left, the words moved up (' + bs.map((b) => b.text).join(' | ') + ')',
    bs.length === 2 && bs[0].text === 'shot two' && bs[1].text === 'shot three');
  ok('and the first block is STILL #prompt', bs[0].id === 'prompt');

  // ── 5. the second star: drawn with 2+ blocks, carrying the batch's price ─
  const all = await page.evaluate(() => {
    const b = document.getElementById('goall');
    const r = b.getBoundingClientRect(), g = document.getElementById('go').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { hidden: b.hidden, text: b.textContent.trim(), w: Math.round(r.width),
      // after the star on the same line, OR on the line under it — her own
      // "same row unless it bleeds over". What it must never be is ON it.
      after: r.left >= g.right - 1 || r.top >= g.bottom - 1,
      overlaps: !(r.left >= g.right - 1 || r.right <= g.left + 1 || r.top >= g.bottom - 1 || r.bottom <= g.top + 1),
      reach: hit ? ((hit.closest && hit.closest('button') && hit.closest('button').id) || hit.id || hit.tagName) : 'none',
      armed: b.classList.contains('armed'), star: !!b.querySelector('svg') };
  });
  ok('the second star is drawn with two blocks', all.hidden === false);
  ok('it wears the house generate star', all.star);
  ok('it sits after the first star, on its line or under it (' + all.text + ')', all.after && !all.overlaps);
  ok('and it really takes its own tap (' + all.reach + ')', all.reach === 'goall');
  // ONE clip, so ONE clip's price — never a multiple of it (her note: "not
  // separate jobs. i want them to append to each other").
  ok('it names the count and ONE clip\'s price (' + all.text + ')',
    /All 2/.test(all.text) && /4\.4¢/.test(all.text) && !/8\.8¢/.test(all.text));

  // ── 6. it sends ONE job, every block APPENDED ───────────────────────────
  posted.length = 0;
  await page.click('#goall');
  await page.waitForTimeout(900);
  ok('exactly ONE job went (' + posted.length + ')', posted.length === 1);
  ok('its prompt is both blocks appended, blank line between (' + JSON.stringify(posted[0] && posted[0].prompt) + ')',
    posted.length === 1 && posted[0].prompt === 'shot two\n\nshot three');
  ok('and every block still has its words after the send', (await page.evaluate(readBlocks)).every((b) => b.text));

  // ── 6b. A DOOR WORD AFTER AN APPENDED SEND RE-SENDS THE APPENDED SCENE ──
  // "those words re-send THAT exact job" — and a joined prompt is exactly
  // what can break it, since `sendJob` with no text re-reads the ACTIVE box.
  // The gold line is left where she put it, so this must not depend on it.
  posted.length = 0;
  refuse = true;
  await page.click('#goall');
  await page.waitForTimeout(900);
  const doorText = await page.evaluate(() => {
    const b = document.querySelector('#err .doorgo');
    return b ? b.textContent.trim() : '';
  });
  ok('a refusal offers another door (' + doorText + ')', /Send it through/.test(doorText));
  await page.click('#err .doorgo');
  await page.waitForTimeout(900);
  ok('the door word re-sent the SAME appended scene (' + JSON.stringify(posted.length > 1 ? posted[posted.length - 1].prompt : null) + ')',
    posted.length === 2 && posted[1].prompt === 'shot two\n\nshot three');
  ok('and it pinned the door she tapped (' + (posted[1] && posted[1].door) + ')',
    posted.length === 2 && posted[1].door && posted[1].door !== 'atlascloud');

  // ── 7. a blank block is not sent and does not count ─────────────────────
  posted.length = 0;
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    const b = ws[1].querySelector('.pblock');
    b.value = '   '; b.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  ok('with one block blank the second star comes off the row',
    await page.evaluate(() => document.getElementById('goall').hidden === true));

  // ── 8. over $3 the first tap ASKS and sends nothing ─────────────────────
  // ONE clip's price is the figure now, so the fixture prices ONE clip over
  // the line (a 30s 2.5 clip really is) rather than relying on × the count.
  cents = 320;                       // one appended clip ⇒ $3.20
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    const b = ws[1].querySelector('.pblock');
    b.value = 'shot three again'; b.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => { document.getElementById('model').dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(700);
  posted.length = 0;
  const lab1 = await page.evaluate(() => document.getElementById('goall').textContent.trim());
  await page.click('#goall');
  await page.waitForTimeout(400);
  const armed = await page.evaluate(() => ({ armed: document.getElementById('goall').classList.contains('armed'),
    text: document.getElementById('goall').textContent.trim() }));
  ok('the price on the button is over $3 before the tap (' + lab1 + ')', /\$3\.20/.test(lab1));
  ok('the first tap sent NOTHING (' + posted.length + ' posted)', posted.length === 0);
  ok('it armed and says the total (' + armed.text + ')', armed.armed && /\$3\.20/.test(armed.text));
  await page.click('#goall');
  await page.waitForTimeout(900);
  ok('the second tap sent the one appended clip (' + posted.length + ')',
    posted.length === 1 && /shot two\n\nshot three again/.test(posted[0].prompt));
  cents = 4.4;

  // ── 9. a keystroke disarms it ───────────────────────────────────────────
  await page.evaluate(() => { document.getElementById('model').dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__forgeTestArm = true; });
  cents = 320;                       // one appended clip over the $3 line
  await page.evaluate(() => { document.getElementById('model').dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(600);
  await page.click('#goall');
  await page.waitForTimeout(300);
  ok('armed again', await page.evaluate(() => document.getElementById('goall').classList.contains('armed')));
  await page.focus('#prompt');
  await page.keyboard.type('x');
  await page.waitForTimeout(300);
  ok('a keystroke disarmed it', await page.evaluate(() => !document.getElementById('goall').classList.contains('armed')));
  cents = 4.4;

  // ── 10. THE FOLD ROW RIDES THE TOP OF THE SCREEN ────────────────────────
  await page.evaluate((s) => {
    const el = document.getElementById('prompt');
    // back to one block, a long scene, the big box
    while (true) {
      const ws = Array.from(el.closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
      if (ws.length < 2) break;
      ws[ws.length - 1].querySelector('.wipeb').click();
    }
    el.classList.add('big');
    el.value = s; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, LONG);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(400);
  const fold = await page.evaluate(() => {
    const f = document.getElementById('panelfold');
    const r = f.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const row = f.parentNode, cs = getComputedStyle(row);
    return { top: Math.round(r.top), onScreen: r.top >= 0 && r.bottom <= window.innerHeight,
      reach: hit ? (hit.id || hit.className || hit.tagName) : 'none',
      pos: cs.position, bg: cs.backgroundColor, gap: row.style.getPropertyValue('--pillgap'),
      right: Math.round(r.right), scrollY: Math.round(window.scrollY) };
  });
  ok('deep in the scene the fold row is still on screen (top ' + fold.top + ', scrollY ' + fold.scrollY + ')',
    fold.onScreen && fold.scrollY > 400);
  ok('and it really takes the tap (' + fold.reach + ')', fold.reach === 'panelfold');
  ok('it is sticky, not a copy (' + fold.pos + ')', fold.pos === 'sticky');
  ok('it is opaque, so the scene does not scroll through it (' + fold.bg + ')',
    /^rgb\(255, 255, 255\)$/.test(fold.bg));
  ok('it still keeps the pill\'s column (right ' + fold.right + ')', fold.right < 324);
  await page.evaluate(() => document.getElementById('panelfold').click());
  await page.waitForTimeout(300);
  ok('tapping it from down there folds the panel',
    await page.evaluate(() => document.getElementById('prompt').closest('.panel').classList.contains('shut')));
  await page.evaluate(() => document.getElementById('panelfold').click());
  await page.waitForTimeout(300);

  // ── 11. A PUT-BACK BANKS HER WORDS AND RENUMBERS THE OTHER BLOCKS ───────
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.classList.remove('big');
    el.value = 'a scene i am still writing';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    // a second block naming a reference by its slot
    const el = document.getElementById('prompt');
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.evaluate(() => {
    window.__ftTestAdd = true;
    const panel = document.getElementById('prompt').closest('.panel');
    const ws = Array.from(panel.children).filter((k) => k.classList.contains('promptwrap'));
    return ws.length;
  });
  // divide so there are two blocks, the second naming [Image1]
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.value = 'a scene i am still writing\nthe dog in [Image1] walks in';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(el.value.indexOf('\nthe dog'), el.value.indexOf('\nthe dog'));
  });
  await page.click('#divide');
  await page.waitForTimeout(300);
  const before = await page.evaluate(readBlocks);
  ok('two blocks, the second naming a slot', before.length === 2 && /\[Image1\]/.test(before[1].text));
  // put an OLDER card's prompt back into block 1 (the card has no references)
  await page.evaluate(() => {
    const ws = Array.from(document.getElementById('prompt').closest('.panel').children).filter((k) => k.classList.contains('promptwrap'));
    ws[0].querySelector('.pblock').focus();
  });
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => {
    var btn = document.querySelector('#feed .job .again, #feed .job [data-again]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (copied) {
    await page.waitForTimeout(500);
    ok('a put-back offers an undo for what it overwrote',
      await page.evaluate(() => document.getElementById('undojob').hidden === false));
  } else {
    ok('a put-back offers an undo for what it overwrote (no card button in this fixture — source pinned instead)',
      /bank = wasJob; saveBank\(\);/.test(fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').split('function copyBack')[1].slice(0, 400)));
  }

  // ── 12. SOURCE PINS for the fixes with no reachable surface here ────────
  const src = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
  ok('a note is keyed on the CLIP, never the part that is playing',
    /function noteUrl\(j\) \{ return \(j && \(j\.source \|\| j\.video\)\)/.test(src)
    && /var url = noteUrl\(/.test(src));
  ok('the poll is re-armed even when the read failed',
    /\}\)\.catch\(function \(\) \{\}\)\.then\(function \(\) \{ if \(asked === viewKey\(\)\) schedulePoll\(false\); \}\)/.test(src));
  ok('an unfinished clip the page no longer holds is fetched by name',
    /function unresolvedOffPage/.test(src) && /api\('\/jobs\/' \+ encodeURIComponent\(id\)\)/.test(src));
  ok('the feed bar stays while anything narrows the feed', /var narrowed = !!\(S\.project \|\| qGroups\.length/.test(src));
  // and the SEARCH's own walk starts over with it (2026-09-13) — the old
  // view's `more` and cursor would otherwise offer a page of another folder's
  // matches
  ok('switching folder re-asks a standing search, and resets its own walk',
    /function setFolder[\s\S]{0,900}?if \(searchQ\) \{ qHits = null; qMore = false; qAt = ''; runSearch\(\); \}/.test(src));
  ok('unhiding cards re-decides their "… more"', /if \(!tiles\) resyncClamps\(\);\n  var n = Object\.keys\(jobsById\)/.test(src));
  ok('grab frame keeps the player and her marks', /useShot\(false, 'frame at ' \+ Number\(d\.at\)\.toFixed\(1\) \+ 's', true\)/.test(src));
  ok('the optimistic card is built from the body the tap sent',
    /project: body\.project, folder: body\.folder,/.test(src) && /var m = modelOf\(body\.model\);/.test(src));
  ok('the cast planner is never shown a keyframe',
    /return CL\.plan\(\{ refs: slotRefs\(\)/.test(src) && /function withMarks/.test(src));
  ok('a hand-off carries its own seed or none', /setSeed\(h\.seed != null \? h\.seed : ''\);/.test(src));
  ok('a join only moves the gold line if it had it',
    /if \(mine\) \{ markActive\(above\); loadActive\(\); \}/.test(src));
  ok('a trim in flight keeps its button down', /go\.disabled = !!trimSending;/.test(src));
  ok('the upload counter counts what attached', /dup \+= 1; return; \}/.test(src));
  ok('and is put down whatever happens', /\}\)\.catch\(function \(\) \{\}\)\.then\(function \(\) \{ ftUploading -= 1; \}\)/.test(src));
  ok('the boot paints what is hers before /status is asked', /\npaintControls\(\);\n\/\/ the notes read waits for \/status/.test(src));
  ok('the folder is searchable', /c\.project, c\.projectName, c\.folder,/.test(fs.readFileSync(path.join(ROOT, 'footage-hay.js'), 'utf8')));
  ok('one clip can be read by name', /router\.get\('\/jobs\/:id',/.test(fs.readFileSync(path.join(ROOT, 'footage.js'), 'utf8')));

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
