#!/usr/bin/env node
/* Headless test for the "Triset — versions compared" page (run the two gen
   scripts first; reads /tmp/tripage.html + /tmp/tricards.json). Asserts the
   groups render side by side, each toggle really narrows/reveals, a vote tap
   posts the right chat+url, the lightbox opens the ORIGINAL (data-full),
   and the injected pill's script survives the page. */
const http = require('http'); const fs = require('fs');
const { chromium } = require('playwright');
const html = fs.readFileSync('/tmp/tripage.html', 'utf8');
const groups = JSON.parse(fs.readFileSync('/tmp/tricards.json', 'utf8'));
const pill = fs.existsSync('public/pill-inject.html') ? fs.readFileSync('public/pill-inject.html', 'utf8') : '';
const PNG = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const newest0 = groups[0].versions[groups[0].versions.length - 1];
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/page') { res.setHeader('Content-Type', 'text/html'); return res.end(html + pill); }
  if (u === '/compare.css' || u === '/compare.js') { res.setHeader('Content-Type', u.endsWith('css') ? 'text/css' : 'text/javascript'); return res.end(fs.readFileSync('public' + u)); }
  if (u === '/api/story/thumb') { res.setHeader('Content-Type', 'image/webp'); return res.end(PNG); }
  if (u === '/api/gallery/assets') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ assets: [
      { url: newest0.url, vote: 'like', thread: [{ from: 'sophie', text: 'hm' }] },
    ] }));
  }
  if (u === '/api/gallery/assets/vote' || u === '/api/gallery/assets/note') { res.setHeader('Content-Type', 'application/json'); return res.end('{"ok":true}'); }
  res.statusCode = 404; res.end('');
});
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const p = await b.newPage({ viewport: { width: 390, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('https://storage.googleapis.com/**', r => r.fulfill({ contentType: 'image/webp', body: PNG }));
  await p.goto(base + '/page'); await p.waitForTimeout(700);
  const nGroups = await p.$$eval('#wall .grp', els => els.length);
  const figs0 = await p.$eval('#wall .grp', el => el.querySelectorAll('figure').length);
  const sideBySide = await p.$eval('#wall .grp .vrow', el => {
    const f = el.querySelectorAll('figure'); return f.length < 2 || f[0].getBoundingClientRect().top === f[1].getBoundingClientRect().top;
  });
  const fullRes = await p.$eval('#wall .grp img', el => (el.getAttribute('data-full') || '').includes('storage.googleapis'));
  const pillOk = await p.evaluate(() => !!document.querySelector('.float') && typeof window.__scrollTap === 'function');
  await p.click('#fheart'); await p.waitForTimeout(100);
  const shownH = await p.$eval('#count', el => el.textContent);   // only group 0's newest is hearted
  await p.click('#fheart');
  const notesHidden = await p.$eval('body', b => b.classList.contains('noNotes'));
  await p.click('#fnotes'); await p.waitForTimeout(100);
  const noteText = await p.evaluate(() => { const t = document.querySelector('.vnotes .nm'); return t ? t.textContent : ''; });
  let voted = null; p.on('request', r => { if (r.url().includes('/assets/vote')) voted = r.postDataJSON(); });
  await p.$$eval('#wall .grp', els => els[3].querySelector('.v-like').click()); await p.waitForTimeout(150);
  const ok = nGroups === groups.length && sideBySide && fullRes && pillOk && shownH === '1 of ' + nGroups
    && notesHidden && noteText.includes('hm') && voted && voted.chat && errs.length === 0;
  console.log(JSON.stringify({ nGroups, figs0, sideBySide, fullRes, pillOk, shownH, notesHidden, noteText, voted, errs }, null, 1));
  console.log(ok ? 'ok' : 'FAIL');
  await b.close(); srv.close(); process.exit(ok ? 0 : 1);
});
