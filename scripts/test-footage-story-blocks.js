#!/usr/bin/env node
/* STORY BLOCKS, AND ‹ › THROUGH A PART'S OLD PROMPTS — public/footage.html
   (2026-09-14, Sophie: "replace footage blocks w story blocks, next and back
   to see old prompts").

   A Story Timeline story's Send to Footage now carries the story by id and one
   entry per connected PART (keyed by its first moment id); Footage binds its
   blocks to those parts, tags every send with the story and the part, and a
   block walks every prompt already sent for its part, newest first.

   Every assertion here is a MEASUREMENT of the real page in headless Chromium
   against a stub that records what it really receives: a hand-off that lands
   the words and forgets the key, a send that carries the prompt and not the
   part, a merge that replaces her prompt with the story's words again, an old
   prompt that "shows" in a box the star would still send, and a step that
   POSTs are all identical in the source.

   Run: node scripts/test-footage-story-blocks.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE STORY BLOCKS — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE STORY BLOCKS — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage story blocks: playwright not installed — skipped'); report(); return; }
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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const posted = [];      // every body POST /jobs really received
const reads = [];       // every GET /jobs url
const LOG = [];         // the stub's own log — a send lands here as a card
let n = 0;

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (u.pathname === '/footage' || u.pathname === '/belt') {
      const html = u.pathname === '/belt'
        ? '<!doctype html><title>belt</title><body>a belt page on the same origin</body>'
        : fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { openrouter: true, apiframe: true, atlascloud: true },
        balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      reads.push(u.search);
      const story = u.searchParams.get('story') || '';
      const jobs = story ? LOG.filter((j) => j.story === story) : LOG.slice();
      return json({ ok: true, jobs: jobs.slice().reverse(), more: false, folders: {} });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      n += 1;
      const id = 'j' + n;
      // the stub files what the route would: the card the page will read back
      LOG.push({ id, prompt: b.prompt, words: b.words || '', unit: b.unit || '', story: b.story || '',
        model: b.model, modelLabel: 'Mini', door: 'atlascloud', seconds: b.seconds, resolution: b.resolution, ratio: b.ratio,
        sound: true, seed: null, refs: b.refs || [], status: 'done', video: '', poster: '', trims: [], trim: null,
        cost: null, estimate: 4.4, sentAt: new Date(Date.now() + n * 1000).toISOString(), doneAt: '', error: '', note: '',
        why: '', drewMs: null, lastFrame: '', vote: '', hidden: false, title: '', resentAs: '', project: '', folder: '', chat: 'footage' });
      return json({ ok: true, jobId: id, door: 'atlascloud', estimate: 4.4 }, 202);
    }
    res.writeHead(404); res.end('nope');
  });
});

// the shape the Story Timeline writes (public/timeline.html, Send to Footage)
function storyHandoff(port, story, units, extra) {
  const bl = units.map((u) => u.text);
  return Object.assign({
    prompt: bl[0], blocks: bl, from: 'timeline', title: story.title,
    story: story, units: units, at: Date.now(),
  }, extra || {});
}
const ST1 = { id: 'st1', title: 'The ward at night' };
const U1 = [
  { key: 'm1', ids: ['m1', 'm2'], text: 'She wakes in the ward\nThe nurse is at the door' },
  { key: 'm4', ids: ['m4'], text: 'The corridor' },
  { key: 'm7', ids: ['m7'], text: 'The office' },
];
const arm = (h) => `localStorage.setItem('footage_handoff', ${JSON.stringify(JSON.stringify(h))})`;

// what the page really shows, read off the rendered nodes
const readState = () => {
  const ws = [...document.querySelectorAll('.panel > .promptwrap')];
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
  return {
    blocks: ws.map((w) => w.querySelector('.pblock').value),
    labels: ws.map((w) => w.querySelector('.bflab').textContent),
    heads: ws.map((w) => vis(w.querySelector('.bfold'))),
    story: ws.map((w) => w.classList.contains('story')),
    shut: ws.map((w) => w.classList.contains('shut')),
    lw: ws.map((w) => w.querySelector('.lw').textContent),
    rows: ws.map((w) => vis(w.querySelector('.hrow'))),
    pos: ws.map((w) => w.querySelector('.hpos').textContent),
    past: ws.map((w) => w.classList.contains('past')),
    pastVis: ws.map((w) => vis(w.querySelector('.hpast'))),
    boxVis: ws.map((w) => vis(w.querySelector('.pblock'))),
    hwords: ws.map((w) => w.querySelector('.hwords').textContent),
    hcard: ws.map((w) => w.querySelector('.hcard').textContent),
    prevOff: ws.map((w) => w.querySelector('.hprev').disabled),
    nextOff: ws.map((w) => w.querySelector('.hnext').disabled),
    active: ws.findIndex((w) => w.classList.contains('active')),
    // THE STORY'S NAME MOVED TO ITS OWN ROW (2026-09-14, "remove prompt
    // collapse" took the PROMPT fold row it used to ride). A label, not a
    // fold: hidden outright with no story bound.
    label: (() => { const r = document.getElementById('storyrow'); return r && !r.hidden ? r.textContent : ''; })(),
    undo: !document.getElementById('undojob').hidden,
    refs: ws.map((w) => ((w.__job && w.__job.refs) || []).length),
    key: localStorage.getItem('footage_handoff'),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
    toast: (document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : ''),
  };
};
// type into block i (0-based) the way she does — focus makes it the active one
const typeInto = (i, text) => `(() => {
  const w = document.querySelectorAll('.panel > .promptwrap')[${i}]; const b = w.querySelector('.pblock');
  b.focus(); b.value = ${JSON.stringify(text)}; b.dispatchEvent(new Event('input', { bubbles: true })); })()`;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const errors = [];

  async function scene(name, h, pre) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(name + ': ' + e));
    await page.goto(base + '/belt');
    if (pre) await page.evaluate(pre);
    if (h) await page.evaluate(arm(h));
    await page.goto(base + '/footage');
    await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
    await page.waitForFunction(() => /¢/.test(document.getElementById('cost').textContent));
    await page.waitForTimeout(500);
    return { ctx, page };
  }
  const ready = (page) => page.waitForFunction(() => !document.getElementById('go').disabled);
  // `nth-of-type` counts every div in the panel (the heads, the fold row, the
  // join rows), so a block is found by its place among the blocks
  const clickIn = (page, i, sel) => page.locator('.panel > .promptwrap').nth(i).locator(sel).click();

  // ── 1. a story lands as its parts, and every send is tagged with its part ──
  const one = await scene('bind', storyHandoff(port, ST1, U1));
  let s = await one.page.evaluate(readState);
  ok('one block per part, in the story\'s order — ' + JSON.stringify(s.blocks),
    s.blocks.length === 3 && /She wakes/.test(s.blocks[0]) && s.blocks[1] === 'The corridor' && s.blocks[2] === 'The office');
  ok('the line breaks inside a part survive', /\n/.test(s.blocks[0]));
  ok('every block is a story part and its heading says so — ' + JSON.stringify(s.labels),
    s.story.every(Boolean) && JSON.stringify(s.labels) === '["Part 1","Part 2","Part 3"]');
  ok('the story row names the story — ' + JSON.stringify(s.label), /The ward at night/.test(s.label));
  ok('the draft carries the story and each part\'s key — ' + JSON.stringify((s.draft.jobs || []).map((j) => j.unit)),
    s.draft.story && s.draft.story.id === 'st1' && JSON.stringify((s.draft.jobs || []).map((j) => j.unit)) === '["m1","m4","m7"]');
  ok('no part has been sent from, so no block draws a walk — ' + JSON.stringify(s.rows), s.rows.every((r) => !r));
  ok('the key is gone', s.key === null);
  ok('the toast names the story — ' + JSON.stringify(s.toast), /From the story: The ward at night/.test(s.toast));
  ok('nothing was sent', posted.length === 0);

  // a send from part 2 carries the story, the part and the block's own words
  await ready(one.page);
  await one.page.evaluate(typeInto(1, 'The corridor, camera at eye level'));
  await one.page.click('#go');
  await one.page.waitForFunction(() => document.querySelectorAll('#feed .job, #feed [id^=job-]').length > 0 || true);
  await one.page.waitForTimeout(600);
  ok('the star sent one job', posted.length === 1);
  ok('and it carries the story, the part and the words — ' + JSON.stringify([posted[0].story, posted[0].unit, posted[0].words]),
    posted[0].story === 'st1' && posted[0].unit === 'm4' && posted[0].words === 'The corridor, camera at eye level');
  ok('with no heads written the prompt IS the words', posted[0].prompt === posted[0].words);

  // with a head written, `prompt` carries it and `words` does not
  await one.page.evaluate(`(() => { const b = document.querySelector('.headwrap .hpart[data-head=characters] .hblock');
    b.value = 'Sophie is the woman in [Image1]'; b.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await one.page.evaluate(typeInto(1, 'The corridor, camera at eye level, she walks toward us'));
  await ready(one.page);
  await one.page.click('#go');
  await one.page.waitForTimeout(600);
  ok('a second send from the same part', posted.length === 2 && posted[1].unit === 'm4');
  ok('the prompt carries the head and the words do not — ' + JSON.stringify(posted[1].prompt.slice(0, 30)),
    /^Sophie is the woman/.test(posted[1].prompt) && posted[1].words === 'The corridor, camera at eye level, she walks toward us' && !/Sophie/.test(posted[1].words));

  // ── the walk: ‹ shows the old prompt read-only, › comes back, use this puts it back ──
  s = await one.page.evaluate(readState);
  ok('the part that has been sent from draws its walk, and no other — ' + JSON.stringify(s.rows), JSON.stringify(s.rows) === '[false,true,false]');
  ok('at rest it says now and how many — ' + JSON.stringify(s.pos[1]), /now · 2 sent/.test(s.pos[1]));
  ok('and › is off at now, ‹ is on', s.nextOff[1] && !s.prevOff[1]);
  ok('the box is on screen at now', s.boxVis[1] && !s.pastVis[1]);
  const before = posted.length;
  await clickIn(one.page, 1, '.hprev');
  await one.page.waitForTimeout(150);
  s = await one.page.evaluate(readState);
  ok('one step back shows the NEWEST old prompt in the box\'s place — ' + JSON.stringify(s.hwords[1].slice(0, 40)),
    s.past[1] && s.pastVis[1] && s.hwords[1] === posted[1].words);
  ok('the words shown are the block\'s own, never the heads', !/Sophie/.test(s.hwords[1]));
  ok('the box and its corner buttons are OUT of the layout (measured)', !s.boxVis[1]);
  ok('the row counts it — ' + JSON.stringify(s.pos[1]), /1 of 2 sent/.test(s.pos[1]));
  // right after the tap this is the OPTIMISTIC card (still "drawing" on the
  // page's own model label); the log's copy replaces it on the next read
  ok('the line under it says when it went and what came of it — ' + JSON.stringify(s.hcard[1]), /^sent \w+ \d+, [\d:]+ [ap]m · 4s · .*Mini · (drawing|drawn)$/.test(s.hcard[1]));
  if (process.env.SHOT) await one.page.screenshot({ path: process.env.SHOT, fullPage: false });
  ok('her own words are untouched underneath — ' + JSON.stringify(s.blocks[1]), s.blocks[1] === 'The corridor, camera at eye level, she walks toward us');
  ok('stepping POSTs nothing', posted.length === before);
  // the star refuses while an old prompt is showing
  await one.page.click('#go');
  await one.page.waitForTimeout(300);
  s = await one.page.evaluate(readState);
  ok('the star REFUSES while an old prompt is showing and says which tap sends — ' + JSON.stringify(s.toast),
    posted.length === before && /old prompt/.test(s.toast));
  await clickIn(one.page, 1, '.hprev');
  await one.page.waitForTimeout(150);
  s = await one.page.evaluate(readState);
  ok('a second step back is the older one — ' + JSON.stringify(s.hwords[1]), s.hwords[1] === posted[0].words && /2 of 2 sent/.test(s.pos[1]));
  ok('and ‹ is off at the oldest', s.prevOff[1] && !s.nextOff[1]);
  await clickIn(one.page, 1, '.hnext');
  await one.page.waitForTimeout(150);
  s = await one.page.evaluate(readState);
  ok('› walks forward again — ' + JSON.stringify(s.pos[1]), /1 of 2 sent/.test(s.pos[1]) && s.hwords[1] === posted[1].words);
  await clickIn(one.page, 1, '.hnext');
  await one.page.waitForTimeout(150);
  s = await one.page.evaluate(readState);
  ok('› once more is now: the box is back, her words in it', !s.past[1] && s.boxVis[1] && /now · 2 sent/.test(s.pos[1]) && s.blocks[1] === 'The corridor, camera at eye level, she walks toward us');
  // use this
  await clickIn(one.page, 1, '.hprev');
  await clickIn(one.page, 1, '.hprev');
  await one.page.waitForTimeout(150);
  await clickIn(one.page, 1, '.huse');
  await one.page.waitForTimeout(300);
  s = await one.page.evaluate(readState);
  ok('use this puts the old words back in THAT block\'s box — ' + JSON.stringify(s.blocks[1]),
    !s.past[1] && s.blocks[1] === posted[0].words && s.active === 1);
  ok('and what was there is banked — undo is on screen', s.undo);
  ok('the other blocks are untouched', /She wakes/.test(s.blocks[0]) && s.blocks[2] === 'The office');
  ok('use this POSTs nothing', posted.length === before);

  // ── a reload keeps the story, the parts and the walk ─────────────────────
  await one.page.waitForTimeout(3000);
  await one.page.reload();
  await one.page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await one.page.waitForFunction(() => document.querySelectorAll('.panel > .promptwrap')[1] && !document.querySelectorAll('.panel > .promptwrap')[1].querySelector('.hrow').hidden, null, { timeout: 6000 }).catch(() => {});
  await one.page.waitForTimeout(400);
  s = await one.page.evaluate(readState);
  ok('after a reload the blocks are still the story\'s parts — ' + JSON.stringify(s.labels), JSON.stringify(s.labels) === '["Part 1","Part 2","Part 3"]');
  ok('and the row still names the story — ' + JSON.stringify(s.label), /The ward at night/.test(s.label));
  ok('and the walk is read back off the log for the part that was sent from — ' + JSON.stringify(s.rows) + ' ' + JSON.stringify(s.pos[1]),
    JSON.stringify(s.rows) === '[false,true,false]' && /now · 2 sent/.test(s.pos[1]));
  ok('the read asked for the STORY over the whole log — ' + JSON.stringify(reads.filter((r) => /story=/.test(r)).slice(-1)),
    reads.some((r) => /story=st1/.test(r) && /limit=300/.test(r)));
  // a shut story part says the story's own words, not the prompt's
  await clickIn(one.page, 1, '.bfold');
  await one.page.waitForTimeout(150);
  s = await one.page.evaluate(readState);
  ok('a folded part says the story\'s words for it, not the prompt — ' + JSON.stringify(s.lw[1]),
    s.shut[1] && /The corridor/.test(s.lw[1]) && !/camera/.test(s.lw[1]));
  ok('and its walk folds away with it', !s.rows[1]);
  await one.ctx.close();

  // ── 2. the same story sent again MERGES; a different one replaces ────────
  const two = await scene('merge', storyHandoff(port, ST1, U1));
  await two.page.evaluate(typeInto(0, 'MY PROMPT for part 1'));
  await clickIn(two.page, 2, '.bfold');   // fold part 3 away
  await two.page.waitForTimeout(150);
  const belt = await two.ctx.newPage();
  await belt.goto(base + '/belt');
  // reordered, one changed in the story, one gone, one new
  await belt.evaluate(arm(storyHandoff(port, ST1, [
    { key: 'm4', ids: ['m4'], text: 'The corridor, later' },
    { key: 'm1', ids: ['m1', 'm2'], text: 'She wakes in the ward\nThe nurse is at the door' },
    { key: 'm9', ids: ['m9'], text: 'A new part' },
  ])));
  await two.page.waitForFunction(() => document.querySelectorAll('.panel > .promptwrap').length === 3
    && document.querySelectorAll('.panel > .promptwrap')[2].querySelector('.pblock').value === 'A new part', null, { timeout: 6000 }).catch(() => {});
  await two.page.waitForTimeout(300);
  s = await two.page.evaluate(readState);
  ok('the same story again keeps HER prompt for a part she already has, in the story\'s new order — ' + JSON.stringify(s.blocks),
    JSON.stringify(s.blocks) === JSON.stringify(['The corridor', 'MY PROMPT for part 1', 'A new part']));
  ok('the part keys follow — ' + JSON.stringify((s.draft.jobs || []).map((j) => j.unit)),
    JSON.stringify((s.draft.jobs || []).map((j) => j.unit)) === '["m4","m1","m9"]');
  ok('a part gone from the story is gone here, and what was there is banked (undo)', s.undo && !s.blocks.some((t) => t === 'The office'));
  ok('a part whose story words changed shows the NEW words on its heading, her prompt in the box', (() => {
    const j = (s.draft.jobs || [])[0]; return j && /later/.test(j.utext) && s.blocks[0] === 'The corridor';
  })());
  await belt.evaluate(arm(storyHandoff(port, { id: 'st2', title: 'Another story' }, [{ key: 'x1', ids: ['x1'], text: 'Only part' }])));
  await two.page.waitForFunction(() => /Another story/.test(document.getElementById('storyrow').textContent), null, { timeout: 6000 }).catch(() => {});
  await two.page.waitForTimeout(300);
  s = await two.page.evaluate(readState);
  ok('a DIFFERENT story replaces — ' + JSON.stringify(s.blocks) + ' ' + JSON.stringify(s.label),
    JSON.stringify(s.blocks) === '["Only part"]' && /Another story/.test(s.label) && s.draft.story && s.draft.story.id === 'st2');
  ok('a one-part story still draws its heading (measured) — ' + JSON.stringify(s.labels), s.heads[0] && s.labels[0] === 'Part 1');
  // a belt scene (no story) replaces and unbinds
  await belt.evaluate(arm({ prompt: 'a belt scene', refs: [], from: 'belt', title: 'Scene 3', at: Date.now() }));
  await two.page.waitForFunction(() => document.getElementById('prompt').value === 'a belt scene', null, { timeout: 6000 }).catch(() => {});
  await two.page.waitForTimeout(200);
  s = await two.page.evaluate(readState);
  ok('a belt scene unbinds the story — plain blocks again — ' + JSON.stringify([s.label, s.labels[0]]),
    s.label === '' && !s.story[0] && !s.draft.story);
  await two.ctx.close();

  // ── 3. a plain page is byte-for-byte what it was ─────────────────────────
  const three = await scene('plain', null);
  await ready(three.page);
  await three.page.evaluate(typeInto(0, 'a plain clip'));
  await three.page.click('#go');
  await three.page.waitForTimeout(500);
  const last = posted[posted.length - 1];
  ok('a send from a plain page carries no story, no unit, no words',
    last.prompt === 'a plain clip' && !('story' in last) && !('unit' in last) && !('words' in last));
  s = await three.page.evaluate(readState);
  ok('and draws no walk and no Part label', !s.rows[0] && s.labels[0] === 'Block 1' && !s.story[0]);
  // a divided story part: the tail inherits the part
  await three.ctx.close();
  const four = await scene('divide', storyHandoff(port, ST1, U1));
  await four.page.evaluate(`(() => { const b = document.querySelectorAll('.panel > .promptwrap')[0].querySelector('.pblock');
    b.focus(); b.setSelectionRange(21, 21); })()`);
  await clickIn(four.page, 0, '.divide');
  await four.page.waitForTimeout(200);
  s = await four.page.evaluate(readState);
  ok('a divided part\'s tail is the same part — ' + JSON.stringify((s.draft.jobs || []).map((j) => j.unit)),
    s.blocks.length === 4 && JSON.stringify((s.draft.jobs || []).map((j) => j.unit)) === '["m1","m1","m4","m7"]');
  await four.ctx.close();

  ok('no page errors anywhere — ' + JSON.stringify(errors), errors.length === 0);
  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
