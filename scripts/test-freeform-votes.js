#!/usr/bin/env node
/* ♥ / ✕ AND THE BIGGER BOX IN FREEFORM (2026-09-04, Sophie: "freeform has no
   heart x?" → "that and an expand textbox button").

   Measured before the fix: nothing in Freeform could be hearted or crossed
   out — no mark on the cards, no `_cast` wired into the shared lightbox (so it
   drew no ♥/✕ there either), no vote field on the run doc, no vote route — and
   the prompt box had no way to open bigger.

   The server half is pinned by SOURCE (the route, the Assets round trip in
   both directions, the my-creations rule reaching a Freeform url); the page
   half drives the REAL public/freeform.html in headless Chromium against a
   stub that RECORDS what the page really POSTs, because a lit class says
   nothing about whether a mark ever left the phone.

   Run: node scripts/test-freeform-votes.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };

// ── the server half, by source and by the pure rule ─────────────────────────
{
  const ff = fs.readFileSync(path.join(ROOT, 'freeform.js'), 'utf8');
  const sv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  ok('freeform.js has POST /run/:id/vote', /router\.post\('\/run\/:id\/vote'/.test(ff));
  ok('a vote is one field per picture on the run doc (votes.{i})', /\[`votes\.\$\{i\}`\]/.test(ff));
  ok('freeform.js exports voteFromAssets', /voteFromAssets/.test(ff.slice(ff.indexOf('module.exports'))));
  ok('server.js hands syncVoteToAssets into freeform.init',
    /require\('\.\/freeform'\)\.init\(\{[^}]*syncVoteToAssets/s.test(sv));
  ok('the Assets vote route calls freeform.voteFromAssets back',
    /require\('\.\/freeform'\)\.voteFromAssets\(url, vote\)/.test(sv));
  ok('a Freeform output counts as a My Creations picture for the Assets sync',
    /\/promptlab\\\/\|\\\/freeform\\\/out\\\/\//.test(sv));
  const { voteValue, OUT_URL } = require('../freeform');
  ok('voteValue keeps like/dislike and clears anything else',
    voteValue('like') === 'like' && voteValue('dislike') === 'dislike' && voteValue('x') === '' && voteValue(null) === '');
  ok('the Assets round trip only ever reaches a Freeform OUTPUT url',
    OUT_URL.test('https://storage.googleapis.com/b/freeform/out/abc-1.webp') && !OUT_URL.test('https://storage.googleapis.com/b/freeform/refs/abc.png'));
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('freeform votes: playwright not installed — page half skipped');
    report(); return;
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
function report() {
  if (fails.length) { console.log('FREEFORM VOTES — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FREEFORM VOTES — ' + pass + ' passed');
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const RUNS = [
  { id: 'r1', prompt: 'two cats on a fence', quality: 'medium', size: 'portrait', status: 'done',
    images: ['/out/r1-1.png', '/out/r1-2.png'], refs: [], refIds: [], outputs: 2, createdAt: 3 },
  // arrives already carrying a mark, so the first paint is read off the doc
  { id: 'r2', prompt: 'a plain house', quality: 'medium', size: 'portrait', status: 'done',
    images: ['/out/r2-1.png', '/out/r2-2.png'], refs: [], refIds: [], outputs: 2, createdAt: 2,
    votes: { 1: 'dislike' } },
  { id: 'r3', prompt: 'a long one '.repeat(20), quality: 'medium', size: 'portrait', status: 'done',
    images: ['/out/r3-1.png'], refs: [], refIds: [], outputs: 1, createdAt: 1 },
];
const posted = [];   // every vote the page really sent
const notes = [];    // every note it really sent
let runs = RUNS;

function serve() {
  return http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const p = req.url.split('?')[0];
    const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (p === '/freeform') {
      res.setHeader('content-type', 'text/html');
      return res.end(fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8').replace('__STUDIO_TOKEN__', '')
        + '<script src="/pagehead.js" defer></script>' + PILL);
    }
    if (p.startsWith('/out/')) { res.setHeader('content-type', 'image/png'); return res.end(PNG); }
    if (p === '/api/freeform/refs') return json({ ok: true, refs: [] });
    if (p === '/api/gallery/assets/note') {
      if (req.method !== 'POST') return json({ ok: true, thread: [] });
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { const b = JSON.parse(body || '{}'); notes.push(b);
        json({ ok: true, thread: [{ from: 'sophie', text: b.text, at: 'now' }] }); });
      return;
    }
    if (p === '/api/freeform/runs') return json({ ok: true, runs });
    const m = p.match(/^\/api\/freeform\/run\/([^/]+)\/vote$/);
    if (m && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { posted.push({ id: m[1], ...JSON.parse(body || '{}') }); json({ ok: true }); });
      return;
    }
    res.statusCode = 404; res.end('{}');
  });
}

(async () => {
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  await pg.goto(base + '/freeform', { waitUntil: 'load' });
  await pg.waitForSelector('#run-r1 .cell');
  await pg.waitForTimeout(300);

  const cellState = (run, i) => pg.evaluate(([run, i]) => {
    const c = document.querySelector('#run-' + run + ' .cell[data-i="' + i + '"]');
    const img = c.querySelector('img');
    return { vote: c.dataset.vote, hidden: c.hidden, nay: c.classList.contains('nay'),
      heartOn: c.querySelector('.vote.heart').classList.contains('on'),
      xOn: c.querySelector('.vote.nope').classList.contains('on'),
      imgOpacity: parseFloat(getComputedStyle(img).opacity) };
  }, [run, i]);
  const lbOpen = () => pg.evaluate(() => { const el = document.getElementById('clightbox'); return !!el && el.style.display === 'flex'; });

  // ── ♥ / ✕ on every picture of every card ──
  {
    const marks = await pg.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#feed .cell'));
      return { cells: cells.length,
        withBoth: cells.filter((c) => c.querySelector('.vote.heart') && c.querySelector('.vote.nope')).length,
        reachable: cells.every((c) => {
          c.scrollIntoView({ block: 'center' });   // elementFromPoint answers only inside the viewport
          const b = c.querySelector('.vote.heart').getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return !!(hit && hit.closest('.vote.heart'));
        }) };
    });
    ok('every picture on every card carries a ♥ and a ✕ (' + marks.withBoth + ' of ' + marks.cells + ')',
      marks.cells === 5 && marks.withBoth === 5);
    ok('a tap at the ♥\'s own centre reaches it', marks.reachable);
    const pre = await cellState('r2', 1);
    ok('a mark already on the doc paints on first load (r2 picture 2 is ✕\'d)', pre.xOn && pre.nay && pre.imgOpacity < 0.5);
  }

  // ── casting from the card ──
  {
    await pg.click('#run-r1 .cell[data-i="0"] .vote.heart');
    await pg.waitForTimeout(200);
    let s = await cellState('r1', 0);
    ok('a ♥ on the card lights', s.heartOn && s.vote === 'like');
    ok('and the page really POSTed it', posted.length === 1 && posted[0].id === 'r1' && posted[0].image === 0 && posted[0].vote === 'like');
    ok('a tap on the ♥ does NOT open the lightbox', !(await lbOpen()));
    await pg.click('#run-r1 .cell[data-i="0"] .vote.heart');
    await pg.waitForTimeout(200);
    s = await cellState('r1', 0);
    ok('tapping the lit ♥ clears it', !s.heartOn && s.vote === '');
    ok('and the clear is POSTed as an empty vote', posted.length === 2 && posted[1].vote === '');
    await pg.click('#run-r1 .cell[data-i="1"] .vote.nope');
    await pg.waitForTimeout(200);
    s = await cellState('r1', 1);
    ok('a ✕ dims the picture on the card', s.xOn && s.nay && s.imgOpacity < 0.5);
    ok('a ✕ is POSTed as dislike', posted[2] && posted[2].image === 1 && posted[2].vote === 'dislike');
    await pg.click('#run-r1 .cell[data-i="1"] .vote.heart');
    await pg.waitForTimeout(200);
    s = await cellState('r1', 1);
    ok('a ♥ over a ✕ replaces it — one mark per picture', s.heartOn && !s.xOn && !s.nay);
  }

  // ── the same marks in the shared lightbox ──
  {
    await pg.click('#run-r1 .cell[data-i="1"] img');
    await pg.waitForTimeout(400);
    ok('tapping the picture opens the shared lightbox', await lbOpen());
    const lb = await pg.evaluate(() => {
      const h = document.querySelector('#clightbox .vote.heart'), x = document.querySelector('#clightbox .vote.nope');
      return { has: !!(h && x), heartOn: !!h && h.classList.contains('on') };
    });
    ok('the lightbox draws ♥ and ✕ (it drew none before — no _cast was wired)', lb.has);
    ok('and the ♥ there shows the mark the card has', lb.heartOn);
    await pg.click('#clightbox .vote.nope');
    await pg.waitForTimeout(200);
    const after = await pg.evaluate(() => ({
      lbX: document.querySelector('#clightbox .vote.nope').classList.contains('on'),
      lbH: document.querySelector('#clightbox .vote.heart').classList.contains('on') }));
    const s = await cellState('r1', 1);
    ok('a ✕ cast in the lightbox lights there', after.lbX && !after.lbH);
    ok('and repaints the card underneath', s.xOn && !s.heartOn);
    ok('and is POSTed', posted[posted.length - 1].vote === 'dislike' && posted[posted.length - 1].image === 1);
    // the shared lightbox draws a note box beside the marks — it has to land
    // somewhere, or the send throws on a box she can see
    await pg.fill('#clightbox .lbnote input', 'more fence, less cat');
    await pg.click('#clightbox .notesend');
    await pg.waitForTimeout(300);
    ok('a note written under the picture reaches its my-creations thread',
      notes.length === 1 && notes[0].chat === 'my-creations' && /less cat/.test(notes[0].text) && /r1-2/.test(notes[0].url));
    ok('and shows in the thread under the box', await pg.evaluate(() => /less cat/.test((document.querySelector('#clightbox .lbthread') || {}).textContent || '')));
    await pg.evaluate(() => window.__assetLightboxClose && window.__assetLightboxClose());
    await pg.waitForTimeout(200);
  }

  // ── the two filters ──
  {
    // state now: r1 = [none, dislike], r2 = [none, dislike], r3 = [none]
    await pg.click('#run-r3 .cell[data-i="0"] .vote.heart');
    await pg.waitForTimeout(150);
    const chips = await pg.evaluate(() => ({
      bar: !document.getElementById('feedbar').hidden,
      heart: !!document.querySelector('#v-liked svg'), x: !!document.querySelector('#v-hidex svg') }));
    ok('the filter pair shows over the feed once there are runs', chips.bar && chips.heart && chips.x);
    await pg.click('#v-liked'); await pg.waitForTimeout(150);
    let f = await pg.evaluate(() => ({
      lit: document.getElementById('v-liked').classList.contains('on'),
      r1: document.getElementById('run-r1').hidden, r2: document.getElementById('run-r2').hidden,
      r3: document.getElementById('run-r3').hidden,
      r3cells: Array.from(document.querySelectorAll('#run-r3 .cell')).map((c) => c.hidden) }));
    ok('hearts-only lights the chip', f.lit);
    ok('and drops every run with nothing hearted', f.r1 && f.r2 && !f.r3);
    ok('keeping the hearted picture showing', f.r3cells.join() === 'false');
    await pg.click('#v-liked'); await pg.waitForTimeout(150);
    await pg.click('#v-hidex'); await pg.waitForTimeout(150);
    f = await pg.evaluate(() => ({
      lit: document.getElementById('v-hidex').classList.contains('on'),
      bg: getComputedStyle(document.getElementById('v-hidex')).backgroundColor,
      heartBg: (() => { const b = document.getElementById('v-liked'); b.classList.add('on'); const c = getComputedStyle(b).backgroundColor; b.classList.remove('on'); return c; })(),
      r1: document.getElementById('run-r1').hidden,
      r1cells: Array.from(document.querySelectorAll('#run-r1 .cell')).map((c) => c.hidden),
      r2cells: Array.from(document.querySelectorAll('#run-r2 .cell')).map((c) => c.hidden) }));
    ok('hide-the-✕\'d lights its chip', f.lit);
    ok('in a DIFFERENT colour from the heart (' + f.bg + ' vs ' + f.heartBg + ')', f.bg !== f.heartBg);
    ok('it hides only the ✕\'d pictures and keeps the run', !f.r1 && f.r1cells.join() === 'false,true' && f.r2cells.join() === 'false,true');
    // every picture crossed out → the run leaves and the list says why
    await pg.click('#run-r1 .cell[data-i="0"] .vote.nope'); await pg.waitForTimeout(150);
    f = await pg.evaluate(() => ({ r1: document.getElementById('run-r1').hidden }));
    ok('a run whose every picture is ✕\'d leaves the list', f.r1);
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForSelector('#run-r1 .cell');
    await pg.waitForTimeout(300);
    f = await pg.evaluate(() => ({ lit: document.getElementById('v-hidex').classList.contains('on'),
      r2cells: Array.from(document.querySelectorAll('#run-r2 .cell')).map((c) => c.hidden) }));
    ok('the filter is sticky across a reload, and still applied', f.lit && f.r2cells.join() === 'false,true');
    await pg.click('#v-hidex'); await pg.waitForTimeout(100);
    // emptied by hearts-only with nothing hearted → the list says why
    runs = RUNS.map((r) => ({ ...r, votes: {} }));
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForSelector('#run-r1 .cell');
    await pg.click('#v-liked'); await pg.waitForTimeout(150);
    const note = await pg.evaluate(() => (document.querySelector('#feed .emptynote') || {}).textContent || '');
    ok('an emptied list SAYS why rather than looking like a lost history (' + note + ')', /Nothing hearted/.test(note));
    await pg.click('#v-liked'); await pg.waitForTimeout(100);
  }

  // ── the bigger box ──
  {
    await pg.evaluate(() => window.scrollTo(0, 0));
    const corner = await pg.evaluate(() => {
      const b = document.getElementById('bigprompt'), t = document.getElementById('prompt');
      const bb = b.getBoundingClientRect(), tb = t.getBoundingClientRect();
      const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
      return { inside: bb.right <= tb.right && bb.bottom <= tb.bottom && bb.top >= tb.top,
        right: bb.left > tb.left + tb.width / 2 && (tb.bottom - bb.bottom) <= 12,
        radius: getComputedStyle(b).borderRadius, square: Math.round(bb.width) === Math.round(bb.height),
        reachable: !!(hit && hit.closest('#bigprompt')),
        padBottom: parseFloat(getComputedStyle(t).paddingBottom), btnH: bb.height };
    });
    ok('the expand button sits inside the box\'s bottom-right corner', corner.inside && corner.right);
    ok('a rounded square at the house 6px (' + corner.radius + ')', corner.square && corner.radius === '6px');
    ok('a tap at its centre reaches it', corner.reachable);
    ok('the compact box reserves the corner with padding (' + corner.padBottom + 'px for ' + corner.btnH + 'px)', corner.padBottom >= corner.btnH + 6);

    // the pill at the iPhone 13's real 47px inset — a plain headless check
    // puts it 33px higher and misses a collision
    await pg.addStyleTag({ content: '.float{top:47px !important}' });
    await pg.evaluate(() => { if (window.__pillSync) window.__pillSync(); if (window.__fitPillGap) window.__fitPillGap(); });
    await pg.waitForTimeout(300);
    const rail = await pg.evaluate(() => {
      const f = document.querySelector('.float'); if (!f) return { nopill: true };
      const b = document.getElementById('bigprompt');
      const fb = f.getBoundingClientRect(), bb = b.getBoundingClientRect();
      const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
      return { overlaps: !(bb.right <= fb.left || bb.left >= fb.right || bb.bottom <= fb.top || bb.top >= fb.bottom),
        reachable: !!(hit && hit.closest('#bigprompt')), hit: hit ? (hit.closest('.float') ? 'the pill' : (hit.id || hit.tagName)) : 'nothing' };
    });
    ok('the pill renders (the runs make the page scroll)', !rail.nopill);
    ok('the button clears the pill\'s column at the real inset', rail.nopill || !rail.overlaps);
    ok('and a tap still reaches it, not the pill (hit: ' + rail.hit + ')', rail.nopill || rail.reachable);

    await pg.fill('#prompt', 'the moon came up over the parking lot like it had somewhere else to be');
    const small = await pg.evaluate(() => document.getElementById('prompt').getBoundingClientRect().height);
    await pg.click('#bigprompt');
    const big = await pg.evaluate(() => ({ h: document.getElementById('prompt').getBoundingClientRect().height,
      words: document.getElementById('prompt').value, fields: document.querySelectorAll('.promptwrap textarea').length,
      label: document.getElementById('bigprompt').getAttribute('aria-label') }));
    ok('one tap: the SAME textarea is bigger (' + Math.round(small) + ' → ' + Math.round(big.h) + 'px)', big.h > small && big.fields === 1 && /parking lot/.test(big.words));
    ok('the label offers the way back (' + big.label + ')', /small/i.test(big.label));
    const CAP = Math.round(844 * 0.52), FLOOR = Math.round(844 * 0.24);
    ok('a short prompt does not open at the cap', big.h < CAP - 8 && big.h >= FLOOR - 2);
    const grown = await pg.evaluate(() => { const t = document.getElementById('prompt');
      t.value = new Array(60).join('the moon came up over the parking lot, and then it kept going. ');
      t.dispatchEvent(new Event('input')); return t.getBoundingClientRect().height; });
    ok('it fits the words — a long one opens taller (' + Math.round(grown) + 'px) and stops at the cap', grown > big.h && Math.abs(grown - CAP) <= 2);
    const shrunk = await pg.evaluate(() => { const t = document.getElementById('prompt');
      t.value = 'one short line.'; t.dispatchEvent(new Event('input')); return t.getBoundingClientRect().height; });
    ok('and shrinks back when she deletes a paragraph', shrunk < grown - 20);
    // putting a prompt back sets .value with no input event — it must refit
    const refit = await pg.evaluate(() => { const t = document.getElementById('prompt');
      const before = t.getBoundingClientRect().height;
      applyRunIn({ prompt: new Array(60).join('a very long prompt put back into the box. '), refIds: [] });
      return { before, after: t.getBoundingClientRect().height }; });
    ok('a prompt put back from a card refits the open box (' + Math.round(refit.before) + ' → ' + Math.round(refit.after) + 'px)', refit.after > refit.before + 20);
    await pg.evaluate(() => { document.getElementById('prompt').style.height = '500px'; });
    await pg.click('#bigprompt');
    const back = await pg.evaluate(() => document.getElementById('prompt').getBoundingClientRect().height);
    ok('the next tap comes back to the compact box, past a hand-dragged height (' + Math.round(back) + 'px)', Math.abs(back - small) <= 2);
    await pg.click('#bigprompt');
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForSelector('#bigprompt');
    ok('not sticky — a reload opens compact', !(await pg.evaluate(() => document.getElementById('prompt').classList.contains('big'))));
  }

  ok('no page errors (' + errors.join(' | ') + ')', errors.length === 0);
  await browser.close();
  srv.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
