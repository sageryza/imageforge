/* Two-panel animation gallery — page check.
 * Serves the POSTED page locally (the sandbox can't reach Storage or the
 * live host from a browser, so images and the verdict read are intercepted)
 * and audits it the way the house rules care about: one <h1>, no horizontal
 * overflow, a note box on every row, the "?" present, and a clip tap opening
 * the shared video overlay with the page locked.
 *   curl <host>/api/chatfeed/page/<id> -o /tmp/lp/index.html
 *   curl <host>/compare.css -o /tmp/lp/compare.css
 *   curl <host>/compare.js  -o /tmp/lp/compare.js
 *   node scripts/two-panel-gallery/verify.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const S = '/tmp/claude-0/-home-user/cbc34ef8-0e83-56d4-bab6-6f7f2e7e7a49/scratchpad';
const srv = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const f = p === '/' ? '/index.html' : p;
  try {
    const b = fs.readFileSync('/tmp/lp' + f);
    res.setHeader('content-type', f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(b);
  } catch (e) { res.statusCode = 404; res.end('x'); }
}).listen(8199);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  // storage images + verdict API can't be reached from the sandbox: stub them
  const pngPortrait = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAABS3WWCAAAAF0lEQVR4AWP4z8Dwn4EBiBn/MzD8BwAeAgMB1a1mgQAAAABJRU5ErkJggg==', 'base64');
  const SC = process.env.TPG_SCRATCH || S;
  await p.route('**://storage.googleapis.com/**', (r) => {
    const u = r.request().url();
    const name = u.split('/').pop().replace(/\.(webp|png)$/, '');
    const cand = [SC + '/' + name + '.webp', SC + '/' + name + '-poster.webp'];
    // pair pages / stills aren't local — fall back to a poster of the same row
    for (const c of cand) if (fs.existsSync(c)) return r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(c) });
    const any = fs.readdirSync(SC).find((f) => f.endsWith('-poster.webp'));
    return r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(SC + '/' + any) });
  });
  await p.route('**/api/chatfeed/verdict**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"items":{},"texts":{}}' }));
  await p.goto('http://127.0.0.1:8199/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({
    cards: document.querySelectorAll('.card[data-item]').length,
    clips: document.querySelectorAll('button.clip').length,
    trios: document.querySelectorAll('.trio').length,
    notes: document.querySelectorAll('.cmp-note').length,
    help: !!document.querySelector('.cmp-help'),
    h1: document.querySelectorAll('h1').length,
    overflowX: document.body.scrollWidth > window.innerWidth,
    scrollW: document.body.scrollWidth, win: window.innerWidth,
    height: document.body.scrollHeight,
  }));
  console.log(JSON.stringify(info));
  // exercise a clip tap
  await p.evaluate(() => document.querySelector('button.clip').click());
  await p.waitForTimeout(400);
  const lb = await p.evaluate(() => {
    const v = document.querySelector('.cmp-vlb');
    return { opened: !!v && !v.hasAttribute('hidden'), src: v && v.querySelector('video') && v.querySelector('video').src.slice(-40), locked: document.body.style.overflow };
  });
  console.log('video overlay:', JSON.stringify(lb));
  await p.evaluate(() => { const x = document.querySelector('.cmp-vlb-x'); if (x) x.click(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: S + '/shot-top.png' });
  await p.evaluate(() => window.scrollTo(0, 620));
  await p.waitForTimeout(400);
  await p.screenshot({ path: S + '/shot-row.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})();
