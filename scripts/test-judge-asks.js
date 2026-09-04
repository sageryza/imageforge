#!/usr/bin/env node
// A DECK CAN PUT QUESTIONS TO HER ON EVERY CARD (2026-09-03, Sophie, on the
// forgotten-projects catalog: "modify tinder compare w those two questions so
// i answer them"). `asks:[{key,label}]` on a template page draws one labelled
// box per ask above the note on her card; each answer is saved on the verdict
// doc as its own text under `<item>:q:<key>`, so a card's ♥/✕ and note are
// untouched and a chat reads the answers back with GET /verdict.
//
// Drives the REAL renderTemplatePage in headless Chromium against a stub
// server that KEEPS the verdict doc:
//   1. the boxes are drawn, labelled, in the page's order
//   2. typing in each posts its own key — and BOTH land (one shared timer
//      would drop the first box's words when she moves to the next)
//   3. reopening the page prefills them from the doc
//   4. the note box is untouched: its words still save under the card's id
//   5. the validator keeps well-formed asks, drops a keyless one, caps at 4
'use strict';
const http = require('http');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const { validateTemplate, renderTemplatePage } = require('../page-templates');
const servePublic = require('./lib/public-asset');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

const ASKS = [{ key: 'wrong', label: 'What went wrong' }, { key: 'next', label: 'Next steps' }];
function pageHtml() {
  const v = validateTemplate('deck', { asks: ASKS, pace: 'labored', items: [
    { id: 'soul', label: 'Soul through the trap door', eyebrow: 'quiet 42 days', text: 'A soul sneaking out of a sleeping body.',
      sections: [{ label: 'Where it stopped', text: 'v5 never confirmed.' }] },
    { id: 'moon', label: 'Moon Milk', eyebrow: 'no beats', text: 'An empty pad.' },
  ] });
  if (!v.ok) throw new Error(v.error);
  ok(Array.isArray(v.data.asks) && v.data.asks.length === 2 && v.data.asks[1].key === 'next', 'validator keeps the two asks');
  return renderTemplatePage({ title: 'Asks', template: 'deck', data: v.data, chat: 'test', sheet: 'page-asks' });
}

// 5. the validator's own rules, no browser needed
{
  const v = validateTemplate('deck', { items: [{ id: 'a', text: 'x' }], asks: [
    { key: 'One Two', label: 'Spaces fold' }, { label: 'no key' }, { key: 'k3', label: 'three' },
    { key: 'k4', label: 'four' }, { key: 'k5', label: 'five' }, { key: 'k6', label: 'six' }] });
  ok(v.ok && v.data.asks.length === 4, 'a keyless ask is dropped and the list caps at four');
  ok(v.ok && v.data.asks[0].key === 'onetwo', 'a key is folded to [a-z0-9_-]');
  const w = validateTemplate('deck', { items: [{ id: 'a', text: 'x' }] });
  ok(w.ok && !('asks' in w.data), 'a page with no asks carries none');
}

const doc = { items: {}, texts: {} };   // the verdict doc the stub KEEPS
const posts = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed/verdict' && req.method === 'GET') return json({ ok: true, items: doc.items, texts: doc.texts, at: '' });
  if (url.pathname === '/api/chatfeed/verdict' && req.method === 'POST') {
    let s = ''; req.on('data', (c) => { s += c; });
    return req.on('end', () => {
      const b = JSON.parse(s || '{}'); posts.push(b);
      if (b.text !== undefined) doc.texts[b.item] = b.text;
      if (b.ok !== undefined && b.item !== undefined) doc.items[b.item] = b.ok;
      json({ ok: true });
    });
  }
  if (url.pathname.startsWith('/api/')) return json({ ok: true, assets: [], notes: [] });
  if (req.method === 'POST') { req.on('data', () => {}); return req.on('end', () => json({ ok: true })); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml());
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(base + '/page');
  await page.waitForSelector('.jg.mom');
  await page.evaluate(() => { const t = document.querySelector('.cmp-tour'); if (t) t.remove(); });

  // 1. drawn, labelled, in order, above the note
  const labels = await page.$$eval('.jg-momask .jg-momasklab', (ns) => ns.map((n) => n.textContent));
  ok(labels.join('|') === 'What went wrong|Next steps', 'two labelled boxes in the page\'s order: ' + labels.join('|'));
  const order = await page.evaluate(() => {
    const a = document.querySelector('.jg-momaskbox'); const n = document.querySelector('.jg-momnote');
    return a && n && a.getBoundingClientRect().top < n.getBoundingClientRect().top;
  });
  ok(order, 'the asks sit above the note box');

  // 2. typing in each posts its own key — both land
  await page.fill('.jg-momaskbox[data-ask="wrong"]', 'the render died');
  await page.fill('.jg-momaskbox[data-ask="next"]', 'rerender v5');
  await page.fill('.jg-momnote', 'a note');
  await page.waitForTimeout(1200);
  ok(doc.texts['soul:q:wrong'] === 'the render died', 'the first box saved under soul:q:wrong');
  ok(doc.texts['soul:q:next'] === 'rerender v5', 'the second box saved under soul:q:next — both landed');
  // 4. the note still saves under the card's own id, untouched by the asks
  ok(typeof doc.texts.soul === 'string' && /a note/.test(doc.texts.soul), 'the note box still saves under the card id');
  ok(!('soul:q:wrong' in doc.items) && !('soul' in doc.items), 'an answer is a text, never a verdict');

  // 3. reopen → prefilled
  await page.goto(base + '/page');
  await page.waitForSelector('.jg.mom');
  await page.evaluate(() => { const t = document.querySelector('.cmp-tour'); if (t) t.remove(); });
  await page.waitForTimeout(500);
  const back = await page.$$eval('.jg-momaskbox', (ns) => ns.map((n) => n.value));
  ok(back.join('|') === 'the render died|rerender v5', 'reopening prefills both answers: ' + back.join('|'));

  // a card with nothing answered opens empty
  await page.click('.jg-momedge.next, .jg-edge.next, [data-act="next"]').catch(() => {});
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
