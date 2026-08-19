#!/usr/bin/env node
// The shared Assets-tab lightbox (public/asset-lightbox.js), driven for real in
// headless Chromium — no server, no Firestore, no network.
//
// What it pins, both from Sophie's report (Aug 2026) on the live one:
//   • "it's hard to [get] out of lightbox. it shud just be anywhere not a
//     button or image or chat but if I tap for example, between the image and
//     the prompt, it doesn't let me out" — the ♥/✕ strip and the prompt row
//     each swallowed the tap for their WHOLE width, and the empty space beside
//     a button is most of the row. A tap on dead space CLOSES; a tap on a
//     button, the picture, the prompt card or the chat does NOT.
//   • "style content not centered" — Style|Content are flex:1, so they have a
//     width they did not ask for, and the house button rule sets no
//     justify-content. Their words must sit centred in their own halves.
//
// Playwright is optional — this skips cleanly without it.
//
//   node scripts/test-asset-lightbox.js

const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('asset lightbox: skipped (no playwright)'); process.exit(0); }

function exe() {
  const roots = ['/opt/pw-browsers'];
  for (const r of roots) {
    let kids = [];
    try { kids = fs.readdirSync(r); } catch (e) { continue; }
    for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(r, k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(`${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
}
function ok(name, cond) { is(name, Boolean(cond), true); }

// a wide, short picture so the ♥/✕ strip has plenty of empty space in it
const PX = 'data:image/svg+xml,'
  + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'>"
    + "<rect width='300' height='200' fill='#c9a'/></svg>");

// compare.css IS part of the harness, not decoration: its global `button` rule
// (display:inline-flex, align-items:center, NO justify-content) is what pushes
// a widened button's words to the left edge. Without it the centring check
// passes on the UA stylesheet alone and proves nothing.
const PAGE = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/compare.css">
<body style="margin:0;height:3000px"><script src="/asset-lightbox.js"></script>
<script>
window.__open = function () {
  window.__assetLightbox(${JSON.stringify(PX)}, {
    description: 'Penny — the blue Kleenex',
    prompt: 'gpt-image-2 · medium',
    promptStyle: 'wtr watercolor drawing, loose wet-on-wet wash',
    promptContent: 'a woman in a yellow raincoat feeding crows',
    vote: null,
    thread: [{ from: 'sophie', text: 'the hands are wrong', at: '2026-08-19T00:00:00Z' }],
    _cast: function () {},
    _noteSend: function (t, cb) { cb && cb(true); },
  });
};
</script>`;

(async () => {
  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (/asset-lightbox\.js/.test(url)) {
      return route.fulfill({ contentType: 'application/javascript',
        body: fs.readFileSync(path.join(__dirname, '..', 'public', 'asset-lightbox.js'), 'utf8') });
    }
    if (/compare\.css/.test(url)) {
      return route.fulfill({ contentType: 'text/css',
        body: fs.readFileSync(path.join(__dirname, '..', 'public', 'compare.css'), 'utf8') });
    }
    if (/\/$|index/.test(new URL(url).pathname)) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('https://forge.test/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__assetLightbox, { timeout: 5000 });

  const open = async () => {
    await page.evaluate(() => window.__open());
    await page.waitForTimeout(80);
  };
  const shown = () => page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  // tap a point, in CSS pixels, straight on whatever is topmost there
  const tapAt = async (x, y) => {
    await page.mouse.click(x, y);
    await page.waitForTimeout(80);
  };

  await open();
  ok('no page errors', errors.length === 0);
  ok('it opened', await shown());

  // ── the ♥/✕ strip: the buttons are at its two ends, so the middle of that
  //    row is dead space — exactly where she was tapping ──────────────────
  const strip = await page.evaluate(() => {
    const r = document.querySelector('#clightbox .lbtop').getBoundingClientRect();
    const hb = document.querySelector('#clightbox .vote.heart').getBoundingClientRect();
    const pb = document.querySelector('#clightbox .promptbtn').getBoundingClientRect();
    // the real dead space: between the ♥ and the Prompt button, which is where
    // she was tapping ("between the image and the prompt")
    const gap = { x: (hb.right + pb.left) / 2, y: r.top + r.height / 2 };
    const el = document.elementFromPoint(gap.x, gap.y);
    return { gap, heart: { x: hb.left + hb.width / 2, y: hb.top + hb.height / 2 },
      gapIs: el ? el.className : '' };
  });
  is('the gap really is the strip itself, not a control', strip.gapIs, 'lbtop');
  await tapAt(strip.heart.x, strip.heart.y);
  ok('a tap on the ♥ does NOT close it', await shown());
  await tapAt(strip.gap.x, strip.gap.y);
  ok('a tap in the empty space beside a button DOES close it', !(await shown()));

  // ── the picture, the prompt card and the chat all stay put ─────────────
  await open();
  const img = await page.evaluate(() => {
    const r = document.querySelector('#clightbox img').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await tapAt(img.x, img.y);
  ok('a tap on the picture does NOT close it', await shown());

  const talk = await page.evaluate(() => {
    const r = document.querySelector('#clightbox .lbtalk').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 4 };
  });
  await tapAt(talk.x, talk.y);
  ok('a tap on the chat does NOT close it', await shown());

  // open the prompt over the picture and read it — that must not close either
  await page.evaluate(() => document.querySelector('#clightbox .promptbtn').click());
  await page.waitForTimeout(80);
  ok('the prompt card opened', await page.evaluate(
    () => document.querySelector('#clightbox .lbp').style.display !== 'none'));
  const pt = await page.evaluate(() => {
    const r = document.querySelector('#clightbox .lbptext').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await tapAt(pt.x, pt.y);
  ok('a tap on the prompt words does NOT close it', await shown());

  // ── STYLE | CONTENT centred in their own halves ─────────────────────────
  {
    const off = await page.evaluate(() => {
      return [].map.call(document.querySelectorAll('#clightbox .lbptog button'), (b) => {
        const r = document.createRange(); r.selectNodeContents(b);
        const g = r.getBoundingClientRect(); const box = b.getBoundingClientRect();
        return Math.abs((g.left + g.right) / 2 - (box.left + box.right) / 2);
      });
    });
    is('both toggle labels drew', off.length, 2);
    ok(`Style and Content sit centred in their halves — got ${off.map((d) => d.toFixed(1)).join(' / ')}`,
      off.every((d) => d < 1.5));
  }

  // ── and the caption band below the picture is dead space, so it closes ──
  const cap = await page.evaluate(() => {
    const r = document.querySelector('#clightbox .clcap').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await tapAt(cap.x, cap.y);
  ok('a tap on the label under the picture closes it', !(await shown()));

  await browser.close();
  if (fails.length) {
    console.error(`asset lightbox: ${fails.length} FAILED, ${pass} passed\n`);
    fails.forEach((f) => console.error(`  ✗ ${f}\n`));
    process.exit(1);
  }
  console.log(`asset lightbox: all ${pass} passed`);
})().catch((e) => { console.error('asset lightbox: crashed —', e.message); process.exit(1); });
