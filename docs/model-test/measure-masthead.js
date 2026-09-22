// Measures the Chats masthead: every visible .hctl control's rect, the title's rect,
// and what elementFromPoint answers at the end of the word "Chats".
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const PUB = path.join(__dirname, '..', '..', 'public');
const T0 = Date.now(); const iso = (t) => new Date(t).toISOString();
const MSGS = [{ id: 'm1', chat: 'one-a', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) }];
const CHATS = { 'one-a': { account: '1', lastSeen: MSGS[0].created } };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b', chats: CHATS, settings: { appAccount: '1' }, truncated: [], messages: since ? [] : MSGS, delta: !!since }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8')); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, todos: [], bookmarks: [] }));
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="one-a"]');
  const r2 = (n) => Math.round(n * 10) / 10;
  const read = () => page.evaluate(() => {
    const r2 = (n) => Math.round(n * 10) / 10;
    const t = document.getElementById('htxt').getBoundingClientRect();
    const c = document.querySelector('.hctl').getBoundingClientRect();
    const ctls = [...document.querySelectorAll('.hctl > *')].filter(n => getComputedStyle(n).display !== 'none').map(n => {
      const r = n.getBoundingClientRect(); return n.id + ' x' + r2(r.left) + '-' + r2(r.right) + ' w' + r2(r.width);
    });
    const at = (x) => { const n = document.elementFromPoint(x, t.top + t.height / 2); return n ? (n.closest('.hctl') ? 'CONTROL:' + (n.closest('button') || n).id : (n.id || n.tagName)) : 'nothing'; };
    return { w: innerWidth, title: 'x' + r2(t.left) + '-' + r2(t.right), ctl: 'x' + r2(c.left) + '-' + r2(c.right) + ' w' + r2(c.width), ctls, atEnd: at(t.right - 3), atMid: at(t.left + t.width / 2) };
  });
  for (const mode of ['lists', 'accounts']) {
    if (mode === 'accounts') { await page.click('#rowtog'); await page.waitForSelector('#accrow .acctab'); }
    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(100);
      console.log(mode, JSON.stringify(await read()));
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: process.argv[2] || '/dev/null', clip: { x: 0, y: 0, width: 390, height: 120 } }).catch(() => {});
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
