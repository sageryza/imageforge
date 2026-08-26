#!/usr/bin/env node
// THE BIGGER PROMPT BOX (2026-08-25, Sophie: "can you put a button so I can
// see the prompt in a bigger box as an option").
//
// Drives the REAL public/promptlab.html in headless Chromium and asserts:
//   1. the button sits INSIDE the prompt box's bottom edge, on the RIGHT
//      side — her call (2026-08-26, two rounds: "put it back exactly where it
//      was", then "i was able to click it before … now i cant") — slid 56px
//      in from the corner so it clears the injected autoscroll pill's column,
//      because the exact corner sits under the pill's ▼ on her phone and a
//      z-lift just kills the ▼ instead; a rounded square at the house 6px,
//      and a tap at its own centre reaches it (`elementFromPoint` — the only
//      honest way to ask),
//   1b. it stays CLEAR of the pill's column with the iPhone 13's real 47px
//      safe-area inset applied — the pill sits 33px higher without one, so a
//      plain headless check misses the collision — and the pill's ▼ still
//      takes its own tap,
//   2. one tap makes the SAME textarea big — over a third of the screen —
//      with her words still in it (never a second field to sync),
//   3. the glyph and label swap to "back to small",
//   4. the next tap shrinks it back, even after a hand-dragged resize left an
//      inline height behind,
//   5. the compact box reserves the button's corner with padding, so the last
//      line of her words is never typed under it.
//
//   npm install playwright --no-save && node scripts/test-playground-bigprompt.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: [], more: false }));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8')
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js'
      || url.pathname === '/playground-port.js') {
    const f = path.join(PUB, url.pathname.slice(1));
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.goto(base + '/playground');
  await page.waitForSelector('#bigprompt');

  console.log('THE CORNER BUTTON');
  const corner = await page.evaluate(() => {
    const b = document.getElementById('bigprompt');
    const t = document.getElementById('prompt');
    const bb = b.getBoundingClientRect(), tb = t.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
    const cs = getComputedStyle(t);
    return {
      inside: bb.right <= tb.right && bb.bottom <= tb.bottom && bb.top >= tb.top,
      nearCorner: bb.left > (tb.left + tb.width / 2) && (tb.bottom - bb.bottom) <= 12,
      radius: getComputedStyle(b).borderRadius,
      square: Math.round(bb.width) === Math.round(bb.height),
      reachable: !!(hit && hit.closest('#bigprompt')),
      padBottom: parseFloat(cs.paddingBottom),
      btnH: bb.height,
    };
  });
  ok(corner.inside && corner.nearCorner, 'it sits inside the box\'s bottom edge, on the right side (her 2026-08-26 call)');
  ok(corner.square && corner.radius === '6px', `a rounded square at the house 6px (${corner.radius})`);
  ok(corner.reachable, 'a tap at its own centre reaches it');
  ok(corner.padBottom >= corner.btnH + 6,
    `the box reserves the button's corner with padding (${corner.padBottom}px for a ${corner.btnH}px button)`);

  // THE PILL OWNS THE EXACT CORNER (2026-08-26, Sophie: "i was able to click
  // it before … now i cant"). The corner spot sits under the pill's ▼ on her
  // phone, and a z-lift measured the other way round — the ▼'s own centre
  // lands on this button. The inset is what makes it collide —
  // `top: max(14px, env(safe-area-inset-top))` puts the pill at 14 in headless
  // and at 47 on an iPhone 13 — so simulate it, and make the page scroll,
  // since the pill is conditional and never renders on a page that doesn't.
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
    const b = document.getElementById('bigprompt');
    const fb = f.getBoundingClientRect(), bb = b.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
    const vb = document.getElementById('vbot');
    const vbb = vb && vb.getBoundingClientRect();
    const vhit = vbb && document.elementFromPoint(vbb.x + vbb.width / 2, vbb.y + vbb.height / 2);
    return {
      overlaps: !(bb.right <= fb.left || bb.left >= fb.right
        || bb.bottom <= fb.top || bb.top >= fb.bottom),
      reachable: !!(hit && hit.closest('#bigprompt')),
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
  await page.fill('#prompt', 'a fox asleep on a radiator, and the whole apartment holding its breath');
  const small = await page.evaluate(() => document.getElementById('prompt').getBoundingClientRect().height);
  await page.click('#bigprompt');
  const big = await page.evaluate(() => ({
    h: document.getElementById('prompt').getBoundingClientRect().height,
    words: document.getElementById('prompt').value,
    label: document.getElementById('bigprompt').getAttribute('aria-label'),
  }));
  ok(big.h >= 844 * 0.35, `one tap: the box is big (${Math.round(small)} → ${Math.round(big.h)}px)`);
  ok(/fox asleep/.test(big.words), 'the same textarea — her words are still in it');
  ok(/small/i.test(big.label), `the label now offers the way back (${big.label})`);

  console.log('AND BACK');
  // A hand-dragged resize (desktop) leaves an inline height behind — the
  // toggle clears it, or "back to small" would not shrink anything.
  await page.evaluate(() => { document.getElementById('prompt').style.height = '500px'; });
  await page.click('#bigprompt');
  const back = await page.evaluate(() => ({
    h: document.getElementById('prompt').getBoundingClientRect().height,
    label: document.getElementById('bigprompt').getAttribute('aria-label'),
  }));
  ok(Math.abs(back.h - small) <= 2, `the next tap comes back to the compact box (${Math.round(back.h)}px)`);
  ok(/bigger/i.test(back.label), `and the label offers big again (${back.label})`);

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
