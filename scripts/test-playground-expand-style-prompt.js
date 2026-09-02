#!/usr/bin/env node
// EITHER HALF OF THE STYLE PROMPT OPENS BIGGER (2026-08-31, Sophie: "add
// extend textbox button to both halves of style prompt playground").
//
// The Prompt panel's two boxes — what goes BEFORE her words and what goes
// AFTER — hold the longest text on this page (Dreamy's tail is a paragraph),
// and the compact box showed about two lines of it. So each editable half now
// carries #prompt.big's corner toggle.
//
// EVERY ASSERTION HERE IS A MEASUREMENT, and that is the point: a `.big` class
// on a box whose CSS never landed, a button rendered under the autoscroll
// pill, and a restored box fitted while it was still detached all pass every
// markup assertion ever written about them while being exactly the bug.
//
// Drives the REAL public/promptlab.html in headless Chromium and asserts:
//   1. BOTH halves carry a button — a rounded square at the house 6px, inside
//      the box's bottom edge on the right, reachable at its own centre,
//   2. the compact box RESERVES that corner with padding, so her last line is
//      never typed under the button,
//   3. it clears the injected pill's column with the iPhone 13's real 47px
//      safe-area inset applied (the pill sits 33px higher without one, so a
//      plain headless check misses the collision) and the pill's ▼ still
//      takes its own tap,
//   4. one tap makes the SAME textarea big with its text still in it — never a
//      second field — and the two halves are INDEPENDENT,
//   5. it FITS THE WORDS: a short half and a long one open at different
//      heights, it stops at the cap, and it shrinks back,
//   6. the glyph and label swap, and the next tap comes back to compact even
//      after a hand-dragged resize left an inline height behind,
//   7. a REPAINT of the panel does not shut a box she is reading, while
//      closing the panel or changing style does (not sticky),
//   8. the LoRA's read-only trigger gets NO button — the control belongs to
//      the edit box.
//
//   npm install playwright --no-save && node scripts/test-playground-expand-style-prompt.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

// A long prefix and a much longer suffix, so "it fits the words" is a
// difference between two real numbers rather than a check against one: the
// prefix has to land strictly BETWEEN the floor and the cap (only a real
// measurement can), and the suffix has to stop at the cap.
const PREFIX = new Array(9).join('Copy the drawing style of the attached style reference. ');
const LINE = 'Loose wet-on-wet wash with visible paper grain and a soft deckle edge. ';
const SUFFIX = new Array(14).join(LINE);

const STYLES = {
  evan: {
    label: 'Sandy mirror', prefix: PREFIX, suffix: SUFFIX,
    characterLine: '', noText: null, photoLine: '', photoLineWithChars: '',
    sheet: null, refs: ['refs/sage-sandy-mirror.png'],
  },
};

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, … and
  // the root-level shared files (size-tier.js, pad-characters.js, …), which a
  // hand-listed harness silently 404s.
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab/styles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ styles: STYLES, photoLine: '', panels: null }));
  }
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: [], more: false }));
  }
  if (url.pathname === '/api/character') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ characters: [] }));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8')
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

const HALVES = ['prefix', 'suffix'];
const box = (part) => `#promptpanel textarea[data-part="${part}"]`;
const btn = (part) => `#promptpanel textarea[data-part="${part}"] + .pbig`;

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13

  // Open on the gpt tile — that is the one with BOTH halves editable. The LoRA
  // shows its trigger read-only, which is step 8's own subject.
  await page.addInitScript(() => {
    try { localStorage.setItem('promptlab_style', 'chatgpt'); } catch (e) {}
  });
  await page.goto(base + '/playground');
  await page.waitForSelector('#promptbtn:not([hidden])');
  await page.click('#promptbtn');
  await page.waitForSelector(box('suffix'));

  console.log('BOTH HALVES CARRY THE BUTTON');
  const corners = await page.evaluate(() => {
    return ['prefix', 'suffix'].map((part) => {
      const t = document.querySelector(`#promptpanel textarea[data-part="${part}"]`);
      if (!t) return { missing: true, part };
      const b = t.parentElement.querySelector('.pbig');
      if (!b) return { nobtn: true, part };
      const bb = b.getBoundingClientRect(), tb = t.getBoundingClientRect();
      const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
      const cs = getComputedStyle(t);
      return {
        part,
        inside: bb.right <= tb.right + 1 && bb.bottom <= tb.bottom + 1 && bb.top >= tb.top - 1,
        rightSide: bb.left > tb.left + tb.width / 2,
        nearBottom: (tb.bottom - bb.bottom) <= 12,
        square: Math.round(bb.width) === Math.round(bb.height),
        radius: getComputedStyle(b).borderRadius,
        reachable: !!(hit && hit.closest('.pbig')),
        hit: hit ? (String(hit.className.baseVal != null ? hit.className.baseVal : hit.className) || hit.tagName) : 'nothing',
        padBottom: parseFloat(cs.paddingBottom),
        btnH: bb.height,
        // Two lines of her text still have room above the reserved band.
        contentH: tb.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
        lineH: parseFloat(cs.lineHeight),
      };
    });
  });
  for (const c of corners) {
    ok(!c.missing && !c.nobtn, `${c.part}: the half has a box and a button`);
    if (c.missing || c.nobtn) continue;
    ok(c.inside && c.rightSide && c.nearBottom,
      `${c.part}: it sits inside the box's bottom edge, on the right side`);
    ok(c.square && c.radius === '6px',
      `${c.part}: a rounded square at the house 6px (${c.radius})`);
    ok(c.reachable, `${c.part}: a tap at its own centre reaches it (hit: ${c.hit})`);
    ok(c.padBottom >= c.btnH + 6,
      `${c.part}: the box reserves the corner with padding (${c.padBottom}px for a ${c.btnH}px button)`);
    ok(c.contentH >= c.lineH * 2 - 2,
      `${c.part}: the compact box still shows two lines above the reserved band (${Math.round(c.contentH)}px)`);
  }

  // THE PILL OWNS THAT COLUMN. `top: max(14px, env(safe-area-inset-top))` puts
  // the pill at 14 in headless and at 47 on an iPhone 13, so simulate the
  // inset — and make the page scroll, since the pill is conditional and never
  // renders on a page that doesn't.
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
    const fb = f.getBoundingClientRect();
    const halves = ['prefix', 'suffix'].map((part) => {
      const t = document.querySelector(`#promptpanel textarea[data-part="${part}"]`);
      const b = t && t.parentElement.querySelector('.pbig');
      if (!b) return { part, nobtn: true };
      const bb = b.getBoundingClientRect();
      const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
      return {
        part,
        overlaps: !(bb.right <= fb.left || bb.left >= fb.right
          || bb.bottom <= fb.top || bb.top >= fb.bottom),
        reachable: !!(hit && hit.closest('.pbig')),
        hit: hit ? (hit.closest('.float') ? 'the pill' : (hit.className || hit.tagName)) : 'nothing',
        btn: [Math.round(bb.left), Math.round(bb.top), Math.round(bb.right), Math.round(bb.bottom)],
      };
    });
    const vb = document.getElementById('vbot');
    const vbb = vb && vb.getBoundingClientRect();
    const vhit = vbb && document.elementFromPoint(vbb.x + vbb.width / 2, vbb.y + vbb.height / 2);
    return {
      halves, vbotOk: !!(vhit && vhit.closest('#vbot')),
      pill: [Math.round(fb.left), Math.round(fb.top), Math.round(fb.right), Math.round(fb.bottom)],
    };
  });
  ok(!rail.nopill, 'the pill renders once there is something to scroll');
  if (!rail.nopill) {
    for (const h of rail.halves) {
      // A MISSING button must fail here rather than pass vacuously — nothing
      // overlaps the pill's column when nothing is drawn in it.
      ok(!h.nobtn, `${h.part}: there is a button to measure against the pill`);
      if (h.nobtn) continue;
      ok(!h.overlaps, `${h.part}: the button clears the pill's column (button ${h.btn}, pill ${rail.pill})`);
      ok(h.reachable, `${h.part}: a tap still reaches it, not the pill (hit: ${h.hit})`);
    }
    ok(rail.vbotOk, 'and the pill\'s ▼ still takes its own tap');
  }
  await page.evaluate(() => { window.scrollTo(0, 0); });

  console.log('BIG, WITH THE SAME TEXTAREA AND ITS TEXT');
  const heights = async () => page.evaluate(() => {
    const out = {};
    ['prefix', 'suffix'].forEach((part) => {
      const t = document.querySelector(`#promptpanel textarea[data-part="${part}"]`);
      out[part] = t ? t.getBoundingClientRect().height : 0;
    });
    return out;
  });
  const small = await heights();
  await page.click(btn('suffix'));
  const oneOpen = await heights();
  ok(oneOpen.suffix > small.suffix,
    `one tap: the tail is bigger (${Math.round(small.suffix)} → ${Math.round(oneOpen.suffix)}px)`);
  ok(Math.abs(oneOpen.prefix - small.prefix) <= 2,
    'and the OTHER half is untouched — the two are independent');
  const kept = await page.$eval(box('suffix'), (e) => e.value);
  ok(kept.indexOf('wet-on-wet') >= 0, 'the same textarea — its text is still in it');
  const lab = await page.$eval(btn('suffix'), (e) => e.getAttribute('aria-label'));
  ok(/small/i.test(lab), `the label now offers the way back (${lab})`);

  await page.click(btn('prefix'));
  const bothOpen = await heights();
  ok(bothOpen.prefix > small.prefix && bothOpen.suffix > small.suffix,
    'both halves can be open at once');

  console.log('IT FITS THE WORDS, IT IS NOT A FIXED SIZE');
  const CAP = Math.round(844 * 0.46), FLOOR = Math.round(844 * 0.24);
  ok(bothOpen.prefix > FLOOR + 2 && bothOpen.prefix < CAP - 8,
    `a shorter half opens FITTED, between the floor and the cap (${Math.round(bothOpen.prefix)}px, ${FLOOR}–${CAP})`);
  ok(bothOpen.prefix < bothOpen.suffix - 8,
    `and shorter than the long one (${Math.round(bothOpen.prefix)} vs ${Math.round(bothOpen.suffix)}px)`);
  ok(Math.abs(bothOpen.suffix - CAP) <= 2,
    `the long one stops at the cap rather than running off the screen (${Math.round(bothOpen.suffix)}px, cap ${CAP})`);
  const tiny = await page.evaluate(() => {
    const t = document.querySelector('#promptpanel textarea[data-part="prefix"]');
    t.value = 'wtr';
    t.dispatchEvent(new Event('input'));
    return t.getBoundingClientRect().height;
  });
  ok(tiny >= FLOOR - 2 && tiny <= FLOOR + 2,
    `a nearly-empty half still opens to the floor — this is a field she writes in (${Math.round(tiny)}px, floor ${FLOOR})`);

  // The `height:auto` reset is the whole of this one: scrollHeight on a box
  // already sized to its old height reports that height, so without it the box
  // can only ever grow.
  const shrunk = await page.evaluate(() => {
    const t = document.querySelector('#promptpanel textarea[data-part="suffix"]');
    t.value = 'a soft deckle edge.';
    t.dispatchEvent(new Event('input'));
    return t.getBoundingClientRect().height;
  });
  ok(shrunk < bothOpen.suffix - 20,
    `and it shrinks back when she deletes a paragraph (${Math.round(bothOpen.suffix)} → ${Math.round(shrunk)}px)`);

  console.log('A REPAINT DOES NOT SHUT A BOX SHE IS READING');
  // The panel is rebuilt whole whenever anything it prints changes. Attaching a
  // photo, picking a character or typing in the cast sheet all repaint it, and
  // springing an expanded box back to compact under her is the Story Room
  // caption's own complaint.
  const afterRepaint = await page.evaluate((line) => {
    const t = document.querySelector('#promptpanel textarea[data-part="suffix"]');
    t.value = new Array(9).join(line);
    t.dispatchEvent(new Event('input'));
    const was = t.getBoundingClientRect().height;
    // The Sophie card is the real-world one: her card adds a line to the
    // prompt, so tapping it repaints the whole panel underneath her.
    document.getElementById('charpick').click();
    return was;
  }, LINE);
  await page.waitForTimeout(150);
  const kept2 = await page.evaluate(() => {
    const t = document.querySelector('#promptpanel textarea[data-part="suffix"]');
    return t ? { big: t.classList.contains('big'), h: t.getBoundingClientRect().height } : null;
  });
  ok(!!kept2 && kept2.big, 'the expanded half is still expanded after a repaint');
  ok(!!kept2 && Math.abs(kept2.h - afterRepaint) <= 4,
    `and still fitted to its words rather than at the CSS floor (${Math.round(afterRepaint)} → ${kept2 ? Math.round(kept2.h) : '—'}px)`);

  console.log('AND BACK — NOT STICKY');
  // A hand-dragged resize (desktop) leaves an inline height behind; the toggle
  // clears it, or "back to the small box" would not shrink anything.
  await page.evaluate(() => {
    document.querySelector('#promptpanel textarea[data-part="suffix"]').style.height = '500px';
  });
  await page.click(btn('suffix'));
  const back = await page.evaluate(() => {
    const t = document.querySelector('#promptpanel textarea[data-part="suffix"]');
    const b = t.parentElement.querySelector('.pbig');
    return { h: t.getBoundingClientRect().height, label: b.getAttribute('aria-label') };
  });
  ok(Math.abs(back.h - small.suffix) <= 2,
    `the next tap comes back to the compact box (${Math.round(back.h)}px)`);
  ok(/bigger/i.test(back.label), `and the label offers big again (${back.label})`);

  // Closing the panel puts both halves back small — nothing is stored, so this
  // is a moment rather than a setting. (`prefix` is still open from above.)
  ok(await page.$eval(box('prefix'), (e) => e.classList.contains('big')),
    'the prefix half is still open before the panel closes');
  await page.click('#promptbtn');                       // close
  await page.waitForTimeout(100);
  await page.click('#promptbtn');                       // and reopen
  await page.waitForSelector(box('prefix'));
  const reopened = await page.evaluate(() => ['prefix', 'suffix'].map((part) => {
    const t = document.querySelector(`#promptpanel textarea[data-part="${part}"]`);
    return t.classList.contains('big');
  }));
  ok(reopened.every((b) => !b), 'closing the panel puts both halves back small');

  console.log('THE LoRA TRIGGER IS SHOWN, NOT OFFERED FOR EDITING');
  await page.selectOption('#stylepick', 'watercolor');
  await page.waitForTimeout(250);
  const lora = await page.evaluate(() => ({
    boxes: [...document.querySelectorAll('#promptpanel textarea')].map((t) => t.getAttribute('data-part')),
    buttons: document.querySelectorAll('#promptpanel .pbig').length,
    addedHasBtn: [...document.querySelectorAll('#promptpanel .added')]
      .some((d) => d.querySelector('.pbig')),
  }));
  ok(lora.boxes.length === 1 && lora.boxes[0] === 'suffix',
    `the LoRA draws one editable half (${JSON.stringify(lora.boxes)})`);
  ok(lora.buttons === 1, `and exactly one button, on that box (${lora.buttons})`);
  ok(!lora.addedHasBtn, 'the read-only trigger carries none — the control belongs to the edit box');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
