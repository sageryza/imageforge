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
//   • the two EXTRAS HOOKS (`actions`, `who`), which exist so Meta Assets
//     could stop keeping its own copy of this file — a copy is how both of
//     the bugs above reached her a second time, on that page.
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
    // THE TWO EXTRAS HOOKS, the reason Meta Assets no longer keeps its own
    // copy of this file: a row of icon buttons under the picture, and the
    // origin-chat line under the caption.
    who: 'Dating Book',
    actions: [
      { label: 'Open the chat', icon: '<svg viewBox="0 0 24 24"><path d="M2 2h20v14H8l-6 5z"/></svg>',
        onClick: function () { window.__tapped = 'chat'; } },
      { label: 'Save to Photos', icon: '<svg viewBox="0 0 24 24"><path d="M12 3v14M6 11l6 6 6-6"/></svg>',
        onClick: function () { window.__tapped = 'save'; } },
    ],
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

  // ── THE EXTRAS HOOKS (Aug 2026) — they exist so `public/assets.html` could
  //    stop being a third hand copy of this file. A copy is how both of the
  //    close bugs above reached Sophie a second time, in Meta Assets. ─────
  await open();
  const acts = await page.$$eval('#clightbox .lbacts button',
    (es) => es.map((e) => e.getAttribute('aria-label')));
  is('the actions row draws one button per action, in order', acts,
    ['Open the chat', 'Save to Photos']);
  is('`who` draws as the last line', await page.$eval('#clightbox .clwho', (e) => e.textContent),
    'Dating Book');
  // an action fires its own onClick and does NOT close — it is a button
  const abox = await page.$eval('#clightbox .lbacts button', (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await tapAt(abox.x, abox.y);
  is('tapping an action calls its onClick', await page.evaluate(() => window.__tapped), 'chat');
  ok('tapping an action does NOT close the lightbox', await shown());
  // …and the gap BETWEEN two action buttons is dead space, so it closes.
  // Scanned rather than guessed: elementFromPoint is the only honest way to
  // ask what a tap actually reaches.
  const agap = await page.evaluate(() => {
    const es = [...document.querySelectorAll('#clightbox .lbacts button')];
    const a = es[0].getBoundingClientRect(), b = es[1].getBoundingClientRect();
    const y = Math.round(a.top + a.height / 2);
    for (let x = Math.round(a.right); x <= Math.round(b.left); x++) {
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest && !hit.closest('button') && hit.closest('#clightbox')) return { x, y };
    }
    return null;
  });
  ok('there is real space between the action icons', !!agap);
  if (agap) {
    await tapAt(agap.x, agap.y);
    ok('a tap between the action icons closes it', !(await shown()));
  }
  // the picture yields room for that row — a lightbox carrying BOTH a thread
  // and an actions row must not push the note box off the bottom
  await open();
  const lbCls = await page.$eval('#clightbox', (e) => [...e.classList].sort().join(' '));
  // `hasmsgs` rides along here because this fixture's asset carries a thread —
  // the empty-thread case is its own check further down.
  is('both shrink classes are on', lbCls, 'hasacts hasmsgs hastalk');
  const fits = await page.evaluate(() => {
    const n = document.querySelector('#clightbox .lbnote');
    return n.getBoundingClientRect().bottom <= window.innerHeight + 1;
  });
  ok('the note box still fits on screen with the actions row above it', fits);
  // AN IMAGE WITH NO NOTES YET PAYS FOR NOTHING (Sophie, 2026-08-21, offered
  // and never answered until the audit): the peek used to be reserved even on
  // a picture nobody had ever written on. `hasmsgs` is what buys the room, and
  // it comes from the thread that was actually drawn — so the SAME picture
  // must come out taller with an empty thread than with letters in it.
  // A TALL picture, because `max-height` is what is being measured — the
  // wide fixture above never reaches its cap, so both states render identical.
  const TALL = 'data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1200'>"
    + "<rect width='800' height='1200' fill='#c9a'/></svg>");
  const openTall = (px, thread) => page.evaluate((a) => window.__assetLightbox(a.px, {
    description: 'Penny — the blue Kleenex',
    vote: null,
    thread: a.thread,
    _cast: function () {},
    _noteSend: function (t, cb) { cb && cb(true); },
  }), { px, thread });
  await openTall(TALL, [{ from: 'sophie', text: 'the hands are wrong', at: '2026-08-19T00:00:00Z' }]);
  await page.waitForTimeout(80);
  const withMsgs = await page.$eval('#clightbox img', (e) => e.getBoundingClientRect().height);
  await page.evaluate((px) => window.__assetLightbox(px, {
    description: 'Penny — the blue Kleenex',
    vote: null,
    thread: [],
    _cast: function () {},
    _noteSend: function (t, cb) { cb && cb(true); },
  }), TALL);
  await page.waitForTimeout(80);
  const empty = await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return {
      hastalk: lb.classList.contains('hastalk'),
      hasmsgs: lb.classList.contains('hasmsgs'),
      note: !!lb.querySelector('.lbnote'),
      h: lb.querySelector('img').getBoundingClientRect().height,
      fits: lb.querySelector('.lbnote').getBoundingClientRect().bottom <= window.innerHeight + 1,
    };
  });
  ok('an empty thread still gets the note box', empty.note && empty.hastalk);
  ok('…but not the thread\'s room', !empty.hasmsgs);
  ok('…so the picture is bigger than it is with letters in it', empty.h > withMsgs);
  ok('…and the note box still fits on screen', empty.fits);
  // and the first letter she sends takes that room back, live
  await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    lb.querySelector('.lbnote input').value = 'the hands are wrong';
    lb.querySelector('.lbnote .notesend').click();
  });
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return { hasmsgs: lb.classList.contains('hasmsgs'), h: lb.querySelector('img').getBoundingClientRect().height };
  });
  ok('her first letter takes the room back', after.hasmsgs && after.h < empty.h);

  // ── THE PLAYGROUND LAYOUT HOOKS (2026-08-26, Sophie: "put the heart where
  //    they were before exactly … the quality model etc. should go right
  //    under the picture not below the note area"): votesBelow puts ♥/✕ at
  //    the head of the under-picture row, capUnderImage files the tag and
  //    label directly under the picture, and the picture gets its room back. ──
  await page.evaluate((px) => window.__assetLightbox(px, {
    description: 'run 12',
    prompt: 'gpt-image-2 · medium · 2K',
    promptStyle: 'wtr wash', promptContent: 'crows at dusk',
    vote: null, thread: [],
    _cast: function () {}, _noteSend: function (t, cb) { cb && cb(true); },
    votesBelow: true, capUnderImage: true,
    actions: [{ label: 'Save to Photos',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 3v14"/></svg>', onClick: function () {} }],
  }), TALL);
  await page.waitForTimeout(120);
  const vb = await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    const img = lb.querySelector('img').getBoundingClientRect();
    const tag = lb.querySelector('.cltag').getBoundingClientRect();
    const cap = lb.querySelector('.clcap').getBoundingClientRect();
    const acts = lb.querySelector('.lbacts');
    const ab = acts.getBoundingClientRect();
    const note = lb.querySelector('.lbnote').getBoundingClientRect();
    return {
      topVotes: lb.querySelectorAll('.lbtop .vote').length,
      rowOrder: [...acts.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
      tagUnderImg: tag.top >= img.bottom - 1 && cap.bottom <= ab.top + 1,
      rowAboveNotes: ab.bottom <= note.top + 1,
      promptTop: !!lb.querySelector('.lbtop .promptbtn'),
      imgH: img.height,
      noteFits: note.bottom <= window.innerHeight + 1,
    };
  });
  is('votesBelow: no vote circles in the top band', vb.topVotes, 0);
  is('the under-picture row reads ♥ ✕ then the actions', vb.rowOrder,
    ['Heart', 'Reject', 'Save to Photos']);
  ok('the tag and label sit right under the picture, above the row', vb.tagUnderImg);
  ok('the row sits above the note box', vb.rowAboveNotes);
  ok('Prompt stays in the top band', vb.promptTop);
  // the old layout's cap here (hastalk+hasacts, no letters) is 56vh = 473px;
  // this fixture's natural height is ~531px, so clearing 0.6*844 = 506 proves
  // the cap really moved rather than the picture merely being small.
  ok('the picture gets its room back (taller than the step caps allowed)',
    vb.imgH > 0.6 * 844);
  ok('the note box still fits on screen', vb.noteFits);

  // an image opened with NO extras is untouched — every existing caller
  await page.evaluate(() => window.__assetLightbox('data:image/gif;base64,R0lGODlhAQABAAAAACw=', {}));
  await page.waitForTimeout(80);
  const bare = await page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return { acts: lb.querySelectorAll('.lbacts').length, who: lb.querySelectorAll('.clwho').length,
      hasacts: lb.classList.contains('hasacts') };
  });
  is('no extras passed → no actions row, no who line, no shrink class', bare,
    { acts: 0, who: 0, hasacts: false });

  await browser.close();
  if (fails.length) {
    console.error(`asset lightbox: ${fails.length} FAILED, ${pass} passed\n`);
    fails.forEach((f) => console.error(`  ✗ ${f}\n`));
    process.exit(1);
  }
  console.log(`asset lightbox: all ${pass} passed`);
})().catch((e) => { console.error('asset lightbox: crashed —', e.message); process.exit(1); });
