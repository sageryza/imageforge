#!/usr/bin/env node
// THE BIGGER WORDS BOX IN VOICE STUDIO (2026-08-27, Sophie: "add an expand
// text box button in the voice studio").
//
// Drives the REAL public/voice.html in headless Chromium, served the way
// serveGated serves it — WITH the injected autoscroll pill, since /voice is a
// `{ pill: true }` page and the pill's fixed column is what decides where the
// button can sit. Asserts:
//   1. the button sits INSIDE the box's bottom edge, on the right side; a
//      rounded square at the house 6px, and a tap at its own centre reaches
//      it (`elementFromPoint` — the only honest way to ask),
//   2. the compact box reserves that corner with padding, so her last line is
//      never typed under the button,
//   3. it stays CLEAR of the pill's column with the iPhone 13's real 47px
//      safe-area inset applied — the pill sits 33px higher without one, so a
//      plain headless check misses the collision — and the pill's ▼ still
//      takes its own tap,
//   4. one tap makes the SAME textarea big, with her words still in it (never
//      a second field to keep in sync),
//   5. the glyph and label swap to "back to small",
//   6. the next tap shrinks it back, even after a hand-dragged resize left an
//      inline height behind (the box is `resize:vertical`),
//   7. it is NOT sticky — a reload comes back to the compact box.
//
//   npm install playwright --no-save && node scripts/test-voicelab-bigbox.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const VOICES = [
  { voiceId: 'UTkHGl2ImiT6gwtAFCql', name: 'Sophie — morning', category: 'professional', color: '#e0a8c0' },
  { voiceId: 'ZOw6P0YnswJ6JNjpj9wF', name: 'Steve Ryza', category: 'cloned', color: '#6f8fa8' },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/voicelab/status') return json({ ok: true });
  if (url.pathname === '/api/voicelab/voices') return json({ voices: VOICES });
  if (url.pathname === '/api/voicelab/history') return json({ renders: [] });
  if (url.pathname === '/voice') {
    // Exactly what serveGated does for a `{ pill: true }` page: the page, then
    // pagehead.js, then the shared pill. Without the pill the one placement
    // rule this button has cannot be measured at all.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'voice.html'), 'utf8')
      + '<script src="/pagehead.js" defer></script>'
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  if (url.pathname === '/pagehead.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'pagehead.js'), 'utf8'));
  }
  res.writeHead(404); res.end('no');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  let browser;
  try { browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {}); }
  catch (e) {
    if (!fs.existsSync('/opt/pw-browsers/chromium')) throw e;
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(base + '/voice', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bigtext');
  await page.evaluate(() => { try { localStorage.removeItem('voicelab_text'); } catch (e) {} });
  await page.fill('#text', '');

  console.log('THE CORNER BUTTON');
  const corner = await page.evaluate(() => {
    const b = document.getElementById('bigtext');
    const t = document.getElementById('text');
    const bb = b.getBoundingClientRect(), tb = t.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
    return {
      inside: bb.right <= tb.right && bb.bottom <= tb.bottom && bb.top >= tb.top,
      nearBottomRight: bb.left > (tb.left + tb.width / 2) && (tb.bottom - bb.bottom) <= 12,
      radius: getComputedStyle(b).borderRadius,
      square: Math.round(bb.width) === Math.round(bb.height),
      reachable: !!(hit && hit.closest('#bigtext')),
      padBottom: parseFloat(getComputedStyle(t).paddingBottom),
      btnH: bb.height,
    };
  });
  ok(corner.inside && corner.nearBottomRight, 'it sits inside the box\'s bottom edge, on the right side');
  ok(corner.square && corner.radius === '6px', `a rounded square at the house 6px (${corner.radius})`);
  ok(corner.reachable, 'a tap at its own centre reaches it');
  ok(corner.padBottom >= corner.btnH + 6,
    `the box reserves the button's corner with padding (${corner.padBottom}px for a ${corner.btnH}px button)`);

  // THE PILL OWNS THE EXACT CORNER. `top: max(14px, env(safe-area-inset-top))`
  // puts the pill at 14 in headless and at 47 on her iPhone 13, so simulate
  // the inset — and make the page scroll, since the pill is conditional and
  // never renders on a page with nothing to scroll.
  console.log('CLEAR OF THE AUTOSCROLL PILL (iPhone 13 safe-area inset)');
  await page.addStyleTag({ content: '.float{top:47px !important}' });
  await page.evaluate(() => {
    const tall = document.createElement('div');
    tall.style.height = '2000px';
    document.body.appendChild(tall);
    if (window.__pillSync) window.__pillSync();
  });
  await page.waitForTimeout(300);
  const rail = await page.evaluate(() => {
    const f = document.querySelector('.float');
    if (!f) return { nopill: true };
    const b = document.getElementById('bigtext');
    const fb = f.getBoundingClientRect(), bb = b.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
    const vb = document.getElementById('vbot');
    const vbb = vb && vb.getBoundingClientRect();
    const vhit = vbb && document.elementFromPoint(vbb.x + vbb.width / 2, vbb.y + vbb.height / 2);
    return {
      overlaps: !(bb.right <= fb.left || bb.left >= fb.right
        || bb.bottom <= fb.top || bb.top >= fb.bottom),
      reachable: !!(hit && hit.closest('#bigtext')),
      hit: hit ? (hit.closest('.float') ? 'the pill' : (hit.id || hit.tagName)) : 'nothing',
      vbotOk: !!(vhit && vhit.closest('#vbot')),
      btn: [Math.round(bb.left), Math.round(bb.top), Math.round(bb.right), Math.round(bb.bottom)],
      pill: [Math.round(fb.left), Math.round(fb.top), Math.round(fb.right), Math.round(fb.bottom)],
    };
  });
  ok(!rail.nopill, 'the pill renders once there is something to scroll');
  ok(rail.nopill || !rail.overlaps,
    `the button clears the pill's column (button ${rail.btn}, pill ${rail.pill})`);
  ok(rail.nopill || rail.reachable, `a tap still reaches it, not the pill (hit: ${rail.hit})`);
  ok(rail.nopill || rail.vbotOk, 'and the pill\'s ▼ still takes its own tap');
  await page.evaluate(() => { window.scrollTo(0, 0); });

  console.log('BIG, WITH HER WORDS STILL IN IT');
  await page.fill('#text', 'the moon came up over the parking lot like it had somewhere else to be');
  const small = await page.evaluate(() => document.getElementById('text').getBoundingClientRect().height);
  await page.click('#bigtext');
  const big = await page.evaluate(() => ({
    h: document.getElementById('text').getBoundingClientRect().height,
    words: document.getElementById('text').value,
    label: document.getElementById('bigtext').getAttribute('aria-label'),
    fields: document.querySelectorAll('#pane-say textarea').length,
  }));
  ok(big.h >= 844 * 0.3, `one tap: the box is big (${Math.round(small)} → ${Math.round(big.h)}px)`);
  ok(big.fields === 1, 'still ONE textarea — never a second field to keep in sync');
  ok(/parking lot/.test(big.words), 'the same textarea — her words are still in it');
  ok(/small/i.test(big.label), `the label now offers the way back (${big.label})`);

  console.log('AND BACK');
  // A hand-dragged resize leaves an inline height behind (the box is
  // `resize:vertical`) — the toggle clears it, or "back to small" would leave
  // the box exactly where she dragged it.
  await page.evaluate(() => { document.getElementById('text').style.height = '500px'; });
  await page.click('#bigtext');
  const back = await page.evaluate(() => ({
    h: document.getElementById('text').getBoundingClientRect().height,
    label: document.getElementById('bigtext').getAttribute('aria-label'),
  }));
  ok(Math.abs(back.h - small) <= 2, `the next tap comes back to the compact box (${Math.round(back.h)}px)`);
  ok(/bigger/i.test(back.label), `and the label offers big again (${back.label})`);

  console.log('NOT STICKY');
  await page.click('#bigtext');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#bigtext');
  const fresh = await page.evaluate(() => ({
    big: document.getElementById('text').classList.contains('big'),
    words: document.getElementById('text').value,
  }));
  ok(!fresh.big, 'a reload comes back to the compact box — the big one is a moment, not a setting');
  ok(/parking lot/.test(fresh.words), 'and her words are still there (that half IS kept)');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
