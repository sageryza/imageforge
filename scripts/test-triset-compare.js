const http = require('http'); const fs = require('fs');
const { chromium } = require('playwright');
const html = fs.readFileSync('/tmp/tripage.html', 'utf8');
const pill = fs.existsSync('public/pill-inject.html') ? fs.readFileSync('public/pill-inject.html', 'utf8') : '';
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/page') { res.setHeader('Content-Type', 'text/html'); return res.end(html + pill); }
  if (u === '/compare.css' || u === '/compare.js') { res.setHeader('Content-Type', u.endsWith('css') ? 'text/css' : 'text/javascript'); return res.end(fs.readFileSync('public' + u)); }
  if (u === '/api/gallery/assets') {
    res.setHeader('Content-Type', 'application/json');
    const m = JSON.parse(fs.readFileSync('/tmp/tricards.json', 'utf8')).filter(c => c.chat === 'triset-multilevel-patterns').slice(0, 3);
    return res.end(JSON.stringify({ assets: [
      { url: m[0].url, vote: 'like', thread: [{ from: 'sophie', text: 'hm' }] },
      { url: m[1].url, vote: 'dislike' },
    ] }));
  }
  if (u === '/api/gallery/assets/vote' || u === '/api/gallery/assets/note') { res.setHeader('Content-Type', 'application/json'); return res.end('{"ok":true}'); }
  res.statusCode = 404; res.end('');
});
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })); const p = await b.newPage({ viewport: { width: 390, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('https://storage.googleapis.com/**', r => r.fulfill({ contentType: 'image/webp', body: Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64') }));
  await p.goto(base + '/page'); await p.waitForTimeout(700);
  const n = await p.$$eval('#wall .tcell', els => els.length);
  const shown0 = await p.$eval('#count', el => el.textContent);
  const pillOk = await p.evaluate(() => !!document.querySelector('.float') && typeof window.__scrollTap === 'function');
  // hearted-only filter
  await p.click('#fheart'); await p.waitForTimeout(100);
  const shownH = await p.$eval('#count', el => el.textContent);
  const heartLit = await p.$eval('#fheart', el => el.classList.contains('on'));
  await p.click('#fheart');
  // hide-x
  await p.click('#fx'); await p.waitForTimeout(100);
  const shownX = await p.$eval('#count', el => el.textContent);
  await p.click('#fx');
  // notes toggle: thread visible only when on
  const notesHidden = await p.$eval('body', b => b.classList.contains('noNotes'));
  await p.click('#fnotes'); await p.waitForTimeout(100);
  const noteText = await p.evaluate(() => { const t = document.querySelector('.tnotes .nm'); return t && getComputedStyle(t.parentElement).display !== 'none' ? t.textContent : ''; });
  // a vote tap posts and lights
  let voted = null; p.on('request', r => { if (r.url().includes('/assets/vote')) voted = r.postDataJSON(); });
  await p.$$eval('#wall .tcell', els => els[5].querySelector('.v-like').click()); await p.waitForTimeout(150);
  console.log(JSON.stringify({ n, shown0, pillOk, shownH, heartLit, shownX, notesHidden, noteText, voted, errs }, null, 1));
  await b.close(); srv.close();
});
