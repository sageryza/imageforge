#!/usr/bin/env node
// THE CLIPS STRIP (2026-09-07, Sophie: "a list with all the clips I could
// download as a video most recent first and lights up when there's a new one
// until I click it"). Drives the REAL public/chats.html against a stub feed:
//   1. a chat with no clips draws no strip,
//   2. a chat with clips draws them newest first under the header, each with
//      a save link (a sibling, never nested),
//   3. every row is LIT (rose dot, measured) until tapped; the head counts them,
//   4. tapping a row opens the pinned player and puts that row out — and the
//      light stays out across a reload (the phone remembers),
//   5. the strip is tappable where it is drawn (elementFromPoint — the pill
//      owns the top-right corner).
//   node scripts/test-chats-clips.js
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = require('playwright-core')); } catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now(); const iso = (ms) => new Date(ms).toISOString();
const CLIPS = [
  { url: 'http://127.0.0.1:0/c3.mp4', title: 'Newest — the office (0:04)', id: 'abc3', at: iso(T0 - 1000) },
  { url: 'http://127.0.0.1:0/c2.mp4', title: 'Middle — the hall (0:04)', id: 'abc2', at: iso(T0 - 60000) },
  { url: 'http://127.0.0.1:0/c1.mp4', title: 'Oldest — intake A (0:25)', id: '', at: iso(T0 - 120000) },
];
const MSGS = [
  { id: 'm1', chat: 'has-clips', from: 'claude', text: 'three landed', tldr: 'landed', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'no-clips', from: 'claude', text: 'nothing here', tldr: 'none', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: { 'has-clips': { lastSeen: MSGS[0].created, clips: CLIPS }, 'no-clips': { lastSeen: MSGS[1].created } } }));
  }
  if (/\.mp4$/.test(url.pathname)) { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.alloc(0)); }
  if (url.pathname === '/' || url.pathname === '/chats') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8')); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/chats'); await page.waitForSelector('#grid [data-chat="has-clips"]');
  // 1
  await page.click('#grid .crow[data-chat="no-clips"]'); await page.waitForSelector('#thread header');
  if (await page.$('.clips')) fail('a chat with no clips drew a strip');
  await page.goto(base + '/chats'); await page.waitForSelector('#grid [data-chat="has-clips"]');
  // 2
  await page.click('#grid .crow[data-chat="has-clips"]');
  await page.waitForSelector('.clips', { timeout: 4000 }).catch(() => fail('clips strip never rendered'));
  const titles = await page.$$eval('.cliprow .ti', ns => ns.map(n => n.textContent.trim()));
  if (titles.length !== 3 || !/^Newest/.test(titles[0]) || !/^Oldest/.test(titles[2])) fail('rows are not newest first: ' + titles.join(' | '));
  const saves = await page.$$eval('.cliprow', rs => rs.map(r => { const a = r.querySelector('a.clipsave'); return a ? a.getAttribute('href') : null; }));
  if (saves[0] !== '/api/drop/file/abc3' || saves[2] !== null) fail('save links wrong: ' + JSON.stringify(saves));
  if (await page.$('.cliprow button a')) fail('the save link is nested inside the row button');
  // 3 — lit, measured
  const lit = await page.$$eval('.cliprow', rs => rs.map(r => r.classList.contains('new') && getComputedStyle(r.querySelector('.dot')).backgroundColor !== 'rgba(0, 0, 0, 0)'));
  if (!lit.every(Boolean)) fail('not every untapped row is lit: ' + lit);
  const head = await page.$eval('.clipshead', n => n.textContent);
  if (!/3 new/.test(head)) fail('head does not count 3 new: ' + head);
  // 5 — tappable where drawn
  const box = await page.$eval('.cliprow .clip', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const hit = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.clip')); }, box);
  if (!hit) fail('the first clip row is buried under something');
  // 4 — tap → player, row out, remembered
  await page.click('.cliprow .clip');
  await page.waitForSelector('#pinfull', { timeout: 3000 }).catch(() => fail('tapping a clip did not open the player'));
  await page.click('#pinfull .x'); await page.waitForFunction(() => !document.querySelector('#pinfull'), null, { timeout: 3000 }).catch(() => {});
  if (await page.$eval('.cliprow', r => r.classList.contains('new'))) fail('the tapped row is still lit');
  if (!/2 new/.test(await page.$eval('.clipshead', n => n.textContent))) fail('head did not drop to 2 new');
  await page.goto(base + '/chats'); await page.waitForSelector('#grid [data-chat="has-clips"]');
  await page.click('#grid .crow[data-chat="has-clips"]'); await page.waitForSelector('.clips');
  const after = await page.$$eval('.cliprow', rs => rs.map(r => r.classList.contains('new')));
  if (after[0] !== false || after[1] !== true) fail('seen state did not survive a reload: ' + after);
  await browser.close(); server.close();
  if (!process.exitCode) console.log('PASS: the clips strip — newest first, lit until tapped, save links, remembered');
})();
