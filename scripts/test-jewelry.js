#!/usr/bin/env node
/* jewelry.js — the two-step Jewelry → Etsy page for Sophie's mom.

   Pure half: the prompt record (the fidelity block wraps every shot, the
   seller's notes ride only when written, nothing describes the pictures),
   the EDITABLE whitelist, the state words, the approved-shot order for
   Etsy, the per-IP rate limit, the terminal-refusal rule.

   Page half (headless Chromium, skipped cleanly without playwright): the
   REAL public/jewelry.html against a stubbed /api/jewelry — a photo added
   through the file input arrives as a JPEG body, "Make the listing" starts
   the job, the poll lands the words and the four shots as they finish,
   "Looks good" approves, "Send to Etsy" drafts, and the page reopens on the
   same piece from localStorage. Every check is a MEASUREMENT off the page.

   Run: node scripts/test-jewelry.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const J = require(path.join(ROOT, 'jewelry.js'));

let pass = 0, failed = 0;
function ok(c, msg) { if (c) { pass++; } else { failed++; console.log('  ✗ ' + msg); } }

// ── prompts ──
{
  const r = J.shotPrompt('main');
  ok(r.full.startsWith(J.FIDELITY), 'the fidelity block leads every shot');
  ok(r.full.endsWith(J.SHOTS.main.prompt), 'the shot prompt closes it, verbatim');
  ok(r.fullPrompt === r.full, 'fullPrompt is the literal sent text');
  ok(r.promptStyle.includes('[content]') && r.promptStyle.startsWith(J.FIDELITY), 'the style half is the fidelity wrapper around [content]');
  ok(r.promptContent === J.SHOTS.main.prompt, 'the content half is the shot alone');
  ok(!/notes from the seller/i.test(r.full), 'no notes line when she wrote none');
  const n = J.shotPrompt('model', '  pendant is 2 cm across ');
  ok(/Notes from the seller about this piece: pendant is 2 cm across$/.test(n.full), 'her notes ride, trimmed, at the end');
  ok(J.SHOT_KEYS.join() === 'main,detail,styled,model', 'four shots in Etsy order');
  ok(/immutable/.test(J.FIDELITY) && /Do NOT redesign/.test(J.FIDELITY), 'the master fidelity prompt is hers');
  let threw = false; try { J.shotPrompt('nope'); } catch { threw = true; } ok(threw, 'an unknown shot refuses');
}

// ── the whitelist ──
{
  const d = J.cleanDetails({ title: ' x '.repeat(80), materials: 'silver, moonstone ,, ', price: '24.5', tags: Array(20).fill('a tag that is too long for etsy'), url: 'nope', description: 'ok' });
  ok(d.title.length === 140, 'title cut at 140');
  ok(d.materials.join('|') === 'silver|moonstone', 'materials split, trimmed, empties dropped');
  ok(d.price === 24.5, 'price is a number');
  ok(d.tags.length === 13 && d.tags[0].length === 20, '13 tags of 20 characters at most');
  ok(!('url' in d), 'an unknown field is dropped');
  ok(J.cleanDetails({ price: 'free' }).price === undefined, 'a non-number price is not written');
  ok(Object.keys(J.cleanDetails({})).length === 0, 'an empty patch writes nothing');
}

// ── state, thumb, approved order ──
{
  ok(J.stateOf({}) === 'new', 'new');
  ok(J.stateOf({ job: { status: 'running' } }) === 'working', 'working');
  ok(J.stateOf({ details: { title: 'Ring' } }) === 'ready to review', 'ready to review');
  ok(J.stateOf({ status: 'drafted', details: { title: 'Ring' } }) === 'sent to Etsy', 'sent to Etsy');
  ok(J.stateOf({ job: { status: 'failed' } }) === 'didn\'t work', 'failed');
  ok(J.thumbOf({ photos: [{ url: 'u', thumb: 't' }] }) === 't', 'the first photo is the thumb before any shot');
  ok(J.thumbOf({ photos: [{ url: 'u', thumb: 't' }], shots: { main: { status: 'done', thumb: 'm' } } }) === 'm', 'the main shot is the thumb once it exists');
  const doc = { shots: {
    main: { status: 'done', approved: true, url: 'https://x/main.png' },
    detail: { status: 'done', approved: false, url: 'https://x/d.png' },
    styled: { status: 'done', approved: true, url: 'data:image/png;base64,AAA' },
    model: { status: 'done', approved: true, url: 'https://x/model.png' } } };
  const imgs = J.approvedImages(doc);
  ok(imgs.map(i => i.url).join() === 'https://x/main.png,https://x/model.png', 'approved shots only, main first, a data url never sent to Etsy');
  ok(imgs.map(i => i.rank).join() === '1,2', 'ranks are dense');
}

// ── rate limit and refusals ──
{
  const t0 = 1000;
  for (let i = 0; i < J.RATE_MAX; i++) ok(!J.rateLimited('1.2.3.4', t0 + i), 'inside the window is allowed');
  ok(J.rateLimited('1.2.3.4', t0 + 500), 'the thirteenth in an hour is refused');
  ok(!J.rateLimited('5.6.7.8', t0 + 500), 'another address is untouched');
  ok(!J.rateLimited('1.2.3.4', t0 + J.RATE_WINDOW_MS + 1), 'the window slides');
  ok(J.terminalRefusal('Your request was rejected by our safety system'), 'a safety refusal is terminal');
  ok(!J.terminalRefusal('The server is overloaded'), 'a transient error is not');
}

console.log(`jewelry pure: ${pass} passed, ${failed} failed`);

// ── the page ──
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('jewelry page: playwright not installed — skipped');
    process.exit(failed ? 1 : 0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* playwright's own lookup */ }
  return undefined;
}

// A 1x1 white JPEG, base64 — what the page's canvas normalizer will re-encode.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');

(async () => {
  const PUB = path.join(ROOT, 'public');
  // The stub server: the real page + tool.css + house.css, and a fake
  // /api/jewelry that walks the job forward one poll at a time.
  const item = { id: 'it1', account: 'default', status: 'new', photos: [], notes: '', details: {}, shots: {}, job: null };
  const calls = [];
  let polls = 0;
  const pub = () => ({ ...item, state: J.stateOf(item), thumb: J.thumbOf(item) });
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      calls.push({ m: req.method, p: u.pathname, ct: req.headers['content-type'] || '', len: body.length, body: body.length && /json/.test(req.headers['content-type'] || '') ? JSON.parse(body.toString()) : null });
      if (u.pathname === '/jewelry') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'jewelry.html'), 'utf8').replace('__STUDIO_TOKEN__', '')); }
      if (/\.(css|js)$/.test(u.pathname)) {
        const f = path.join(PUB, u.pathname);
        if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(f)); }
        res.writeHead(404); return res.end();
      }
      if (u.pathname === '/api/jewelry/items' && req.method === 'POST') return send(200, pub());
      if (u.pathname === '/api/jewelry/items' && req.method === 'GET') return send(200, { items: [{ id: 'old1', title: 'Earlier ring', state: 'sent to Etsy', thumb: '' }] });
      if (u.pathname === '/api/jewelry/items/it1/photo' && req.method === 'POST') {
        item.photos.push({ key: 'k' + item.photos.length, url: 'data:image/jpeg;base64,' + JPEG.toString('base64'), thumb: 'data:image/jpeg;base64,' + JPEG.toString('base64') });
        return send(200, { ok: true, item: pub() });
      }
      if (u.pathname === '/api/jewelry/items/it1/make') {
        item.job = { kind: 'make', status: 'running', label: 'Reading your photos…' }; item.status = 'working';
        return send(200, { ok: true, item: pub() });
      }
      if (u.pathname === '/api/jewelry/items/it1' && req.method === 'GET') {
        if (item.job && item.job.status === 'running') {
          polls++;
          if (polls === 1) { item.details = { title: 'Moonstone drop earrings', materials: ['silver', 'moonstone'], price: 42, description: 'Two words.', tags: ['moonstone earrings', 'silver drops'] }; item.job.label = 'Taking the sample photos…'; }
          if (polls === 2) { item.shots.main = { status: 'done', thumb: 'data:image/jpeg;base64,' + JPEG.toString('base64'), url: 'https://x/main.png', approved: null }; }
          if (polls >= 3) { for (const k of ['detail', 'styled', 'model']) item.shots[k] = { status: 'done', thumb: 'data:image/jpeg;base64,' + JPEG.toString('base64'), url: 'https://x/' + k + '.png', approved: null }; item.job.status = 'done'; item.status = 'review'; }
        }
        return send(200, pub());
      }
      if (u.pathname === '/api/jewelry/items/it1' && req.method === 'PATCH') { Object.assign(item.details, J.cleanDetails(calls[calls.length - 1].body.details)); return send(200, { ok: true, item: pub() }); }
      const m = u.pathname.match(/^\/api\/jewelry\/items\/it1\/shot\/(\w+)$/);
      if (m) { item.shots[m[1]].approved = calls[calls.length - 1].body.approved; return send(200, { ok: true, item: pub() }); }
      if (u.pathname === '/api/jewelry/items/it1/draft') { item.status = 'drafted'; return send(200, { ok: true, listing_id: 99, item: pub() }); }
      send(404, { error: 'no such route' });
    });
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: exe() });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => { failed++; console.log('  ✗ page error: ' + e.message); });
  await page.goto(base + '/jewelry');
  await page.waitForTimeout(300);

  ok(await page.$eval('#s1', el => el.classList.contains('open')), 'step 1 opens');
  ok(await page.$eval('#makeBtn', el => el.disabled), 'Make the listing is off with no photo');
  ok((await page.$eval('#notes', el => el.value + (el.getAttribute('placeholder') || ''))) === '', 'the notes box ships empty, no placeholder');
  ok(await page.$eval('#helpcard', el => el.hidden), 'the explanation is behind the ?');
  ok(await page.$eval('.tool .eyebrow', el => el.textContent.trim()) === 'JEWELRY', 'the title, once');
  const rect = await page.$eval('#addBtn', el => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(rect.w > 80 && rect.h > 80, 'the add-photos tile is a real tap target (' + Math.round(rect.w) + 'x' + Math.round(rect.h) + ')');
  ok((await page.$$eval('#earlierList .it', els => els.length)) === 1, 'earlier pieces are listed');
  if (process.env.JEWELRY_SHOTS) { fs.mkdirSync(process.env.JEWELRY_SHOTS, { recursive: true }); await page.click('#help'); await page.screenshot({ path: path.join(process.env.JEWELRY_SHOTS, 'step1-help.png') }); await page.mouse.click(10, 800); }

  // a photo goes in through the file input and arrives as JPEG bytes
  await page.setInputFiles('#file', { name: 'ring.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForFunction(() => document.querySelectorAll('#photos .cell img').length === 1, null, { timeout: 5000 });
  const up = calls.find(c => c.p === '/api/jewelry/items/it1/photo');
  ok(up && /image\/jpeg/.test(up.ct) && up.len > 100, 'the photo POSTs as a raw JPEG body');
  ok(calls.some(c => c.p === '/api/jewelry/items' && c.m === 'POST'), 'the piece was created first');
  ok(!(await page.$eval('#makeBtn', el => el.disabled)), 'Make the listing lights up');
  ok(await page.evaluate(() => localStorage.getItem('jewelry_item')) === 'it1', 'the piece id is remembered');

  // the job
  await page.fill('#notes', 'pendant is 2 cm');
  await page.click('#makeBtn');
  await page.waitForFunction(() => /Reading/.test(document.querySelector('#makeStatus').textContent), null, { timeout: 3000 });
  const mk = calls.find(c => c.p === '/api/jewelry/items/it1/make');
  ok(mk && mk.body && mk.body.notes === 'pendant is 2 cm', 'her notes ride the make call');
  ok(await page.$eval('#photos .x', el => !el) .catch(() => true), 'no remove buttons while it works');
  await page.waitForFunction(() => document.querySelector('#ftitle').value === 'Moonstone drop earrings', null, { timeout: 8000 });
  ok(await page.$eval('#s2', el => el.classList.contains('open')), 'step 2 opens when the words land');
  ok(await page.$eval('#s1', el => el.classList.contains('done')), 'step 1 is done');
  ok((await page.$eval('#sum1', el => el.textContent)) === '1 photo', 'step 1 says its photo count');
  ok((await page.$$eval('#ftags .chip', els => els.length)) === 2, 'the tags are chips');
  ok(await page.$eval('#draftBtn', el => el.disabled), 'Send to Etsy waits for an approval');
  await page.waitForFunction(() => document.querySelectorAll('#shots .shot img').length === 4, null, { timeout: 12000 });
  if (process.env.JEWELRY_SHOTS) { fs.mkdirSync(process.env.JEWELRY_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.JEWELRY_SHOTS, 'step2-review.png'), fullPage: true }); }
  ok(await page.$eval('#makeStatus', el => el.textContent === ''), 'the working line clears when the job is done');
  const labels = await page.$$eval('#shots .lab', els => els.map(e => e.textContent));
  ok(labels.join('|') === 'Main photo|Close-up|Styled|Worn', 'four labeled shots: ' + labels.join('|'));
  const two = await page.$eval('#shots', el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  ok(two === 2, 'shots sit two across');

  // node identity across a poll: the repaint must not rebuild the shots
  const before = await page.evaluate(() => { const i = document.querySelector('#shots .shot img'); i.__mark = 1; return true; });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(400);
  ok(before && await page.evaluate(() => document.querySelector('#shots .shot img').__mark === 1), 'a poll that changes nothing keeps the picture nodes');

  // approve, edit, draft
  await page.click('#shots .shot[data-k="main"] .btn:first-child');
  await page.waitForFunction(() => document.querySelector('#shots .shot[data-k="main"] .cell').classList.contains('ok'), null, { timeout: 3000 });
  ok(true, 'Looks good outlines the shot');
  ok(!(await page.$eval('#draftBtn', el => el.disabled)), 'Send to Etsy lights up');
  await page.fill('#fprice', '48');
  await page.waitForFunction(() => document.querySelector('#saveNote').textContent === 'saved', null, { timeout: 4000 });
  const pt = calls.filter(c => c.m === 'PATCH').pop();
  ok(pt && pt.body.details.price === 48, 'an edit saves itself');
  await page.click('#draftBtn');
  await page.waitForFunction(() => /Etsy drafts/.test(document.querySelector('#draftStatus').textContent), null, { timeout: 4000 });
  const dr = calls.find(c => c.p === '/api/jewelry/items/it1/draft');
  ok(dr && dr.body.details.price === 48, 'the draft carries her last edits');
  ok(await page.$eval('#draftStatus a', el => /etsy\.com/.test(el.href)), 'the done line links to Etsy');
  ok((await page.$eval('#sum2', el => el.textContent)) === 'sent to Etsy', 'step 2 says sent');
  ok(await page.$eval('#againBtn', el => el.getBoundingClientRect().height > 0), 'the way to the next piece is still on screen after sending');
  const SHOT = process.env.JEWELRY_SHOTS;
  if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'step2-sent.png'), fullPage: true }); }

  // reopen: the same piece comes back from localStorage, on step 2
  await page.goto(base + '/jewelry');
  await page.waitForFunction(() => document.querySelector('#ftitle').value === 'Moonstone drop earrings', null, { timeout: 5000 });
  ok(await page.$eval('#s2', el => el.classList.contains('open')), 'reopening lands on the piece she was on');
  await page.click('#againBtn');
  await page.waitForTimeout(200);
  ok(await page.$eval('#s1', el => el.classList.contains('open')) && await page.evaluate(() => !localStorage.getItem('jewelry_item')), 'Start another piece goes back to step 1 and forgets the id');

  await browser.close();
  server.close();
  console.log(`jewelry page: ${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('  ✗ ' + e.stack); process.exit(1); });
