#!/usr/bin/env node
// Verifies the clickable rows on the chats-sort Compare page, both paths:
//   1. EMBEDDED (the app): a row tap calls parent.__openThread(slug) with the
//      right slug and does NOT navigate the iframe.
//   2. STANDALONE (a browser): the same tap follows the href to
//      /chats?chat=<slug>.
//   3. The note "+" still gets its own tap — it must not open the chat.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.log('SKIP: playwright-core missing'); process.exit(0); }

const DIR = __dirname;
const REPO = '/home/user/imageforge/public';
const PAGE = fs.readFileSync(path.join(DIR, 'chat-sort-page-v2.html'), 'utf8');

const HOST = `<!doctype html><meta charset="utf-8"><title>host</title>
<body><iframe id="f" src="/page?embed=1" style="width:390px;height:700px;border:0"></iframe>
<script>
  window.__opened = [];
  window.__openThread = function (n) { window.__opened.push(n); return true; };
</script>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/host') { res.setHeader('content-type', 'text/html'); return res.end(HOST); }
  if (u === '/page') { res.setHeader('content-type', 'text/html'); return res.end(PAGE); }
  if (u === '/compare.css' || u === '/compare.js') {
    res.setHeader('content-type', u.endsWith('.css') ? 'text/css' : 'text/javascript');
    return res.end(fs.readFileSync(path.join(REPO, u.slice(1)), 'utf8'));
  }
  // the note prefill fetch + any verdict POST
  if (u.startsWith('/api/chatfeed/verdict')) {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ items: {}, texts: {} }));
  }
  if (u === '/chats') { res.setHeader('content-type', 'text/html'); return res.end('<title>chats page</title>ok'); }
  res.statusCode = 404; res.end('nope');
});

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  let fails = 0;
  const ok = (name, cond, extra) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra && !cond ? ' — ' + extra : ''));
    if (!cond) fails++;
  };

  // ---- 1. EMBEDDED ----------------------------------------------------
  await page.goto(base + '/host');
  const frame = page.frameLocator('#f');
  await frame.locator('.row').first().waitFor();
  const rows = await frame.locator('.row').count();
  ok('30 rows render', rows === 30, 'got ' + rows);

  const firstHref = await frame.locator('a.rlink').first().getAttribute('href');
  ok('row is a real link', firstHref === '/chats?chat=update-tab-messaging', firstHref);

  const beforeUrl = await page.frames()[1].url();
  await frame.locator('a.rlink').first().click();
  await page.waitForTimeout(250);
  const opened = await page.evaluate(() => window.__opened);
  ok('tap calls parent.__openThread with the slug',
    opened.length === 1 && opened[0] === 'update-tab-messaging', JSON.stringify(opened));
  const afterUrl = await page.frames()[1].url();
  ok('iframe did NOT navigate', afterUrl === beforeUrl, afterUrl);

  // a row further down (the one whose chat has no icon)
  await frame.locator('a.rlink[data-chat="chat-notifications-icons"]').click();
  await page.waitForTimeout(200);
  const opened2 = await page.evaluate(() => window.__opened);
  ok('second row opens its own chat',
    opened2.length === 2 && opened2[1] === 'chat-notifications-icons', JSON.stringify(opened2));

  // ---- 3. the note "+" is its own tap --------------------------------
  await page.evaluate(() => { window.__opened = []; });
  const plus = frame.locator('.row[data-item="update-tab-messaging"] .cmp-note-open');
  await plus.waitFor({ timeout: 4000 });
  await plus.click();
  await page.waitForTimeout(200);
  const afterPlus = await page.evaluate(() => window.__opened);
  ok('tapping the note + does not open the chat', afterPlus.length === 0, JSON.stringify(afterPlus));
  const boxVisible = await frame.locator('.row[data-item="update-tab-messaging"] .cmp-note-box').isVisible();
  ok('the note box opens on +', boxVisible);

  // ---- 2. STANDALONE --------------------------------------------------
  const p2 = await ctx.newPage();
  await p2.goto(base + '/page');
  await p2.locator('a.rlink').first().waitFor();
  await p2.locator('a.rlink[data-chat="deck-factory-notifications"]').click();
  await p2.waitForLoadState();
  ok('browser tap follows the href',
    p2.url() === base + '/chats?chat=deck-factory-notifications', p2.url());

  await browser.close();
  srv.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
