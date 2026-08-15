#!/usr/bin/env node
/**
 * Drives docs/image-pipeline-map.html in headless Chromium against the repo's
 * OWN public/compare.css + compare.js.
 *
 *   node scripts/test-image-pipeline-map.js
 *
 * No network beyond the cut-out drawings (which are allowed to 404 — the test
 * never looks at pixels). It is the GEOMETRY that a copy-paste of the audio
 * map would silently drift, and geometry is what this pins:
 *
 *   - the stops do not collide (the S puts them close near the pinches)
 *   - the two tributaries reach THE SPLIT without crossing the road
 *   - THE LAP — the return arc from REWRITE to FOUR-UP — stays off the road.
 *     This is the one thing the audio map has no equivalent of, so it has no
 *     proven numbers behind it; moving any stop's `at` can put the arc under
 *     the road, where it reads as a smudge rather than a loop.
 *   - four tabs, each showing exactly one view, underline measuring /4
 *   - nothing overflows sideways on a 390px phone
 *
 * Skips (exit 0) if Playwright is not installed, the way the other page tests do.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('skip — playwright not installed'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PAGE = path.join(ROOT, 'docs', 'image-pipeline-map.html');
const PORT = 8741;

const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/map') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(fs.readFileSync(PAGE));
  }
  const f = path.join(PUB, url.replace(/^\//, ''));
  if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404).end('no');
});

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failed++; };

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  // A container's pre-installed Chromium can be a different build number from
  // the one the installed Playwright expects, and then launch() fails asking
  // for `npx playwright install` (which cannot run offline). PW_CHROME points
  // at the binary that is actually there; without it, the default is used.
  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // the cut-out drawings live in Storage; the test is about where things sit,
  // not what they look like, so an offline run must not hang on them
  await page.route('**storage.googleapis.com/**', (r) => r.abort());
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#path image');

  // ── geometry, read out of the live SVG ────────────────────────────────
  const g = await page.evaluate(() => {
    const svg = document.getElementById('path');
    const road = svg.querySelectorAll('path')[2];        // the invisible track
    const sample = (p, n) => {
      const L = p.getTotalLength(); const out = [];
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength((i / n) * L); out.push({ x: q.x, y: q.y }); }
      return out;
    };
    const nodes = [...svg.querySelectorAll('g')].map((el) => {
      const im = el.querySelector('image');
      if (!im) return null;
      const x = +im.getAttribute('x'), y = +im.getAttribute('y');
      const w = +im.getAttribute('width'), h = +im.getAttribute('height');
      return { x: x + w / 2, y: y + h / 2, r: Math.max(w, h) / 2, go: el.getAttribute('data-go') || '' };
    }).filter(Boolean);
    // by CLASS, never by shape — the source feeders are quadratics too, and
    // matching on the `d` string measured one of those instead (they approach
    // the road by design, so it "failed" for a reason that was not the lap's)
    const lap = svg.querySelector('path.lap');
    const labels = [...svg.querySelectorAll('text')].map((t) => {
      const b = t.getBBox();
      return {
        txt: t.textContent, x: +t.getAttribute('x'), y: +t.getAttribute('y'),
        box: { x: b.x, y: b.y, w: b.width, h: b.height },
      };
    });
    return {
      roadPts: sample(road, 400),
      lapPts: lap ? sample(lap, 120) : [],
      nodes, labels,
      vb: svg.getAttribute('viewBox'),
    };
  });

  // stops are the big nodes (R=22 -> 46.2px box); sources/tributaries are 31.5px
  const stops = g.nodes.filter((n) => n.r > 20);
  const small = g.nodes.filter((n) => n.r <= 20);
  ok(stops.length === 8, `eight stops on the road (${stops.length})`);
  ok(small.length === 6, `four sources + two tributaries (${small.length})`);

  let tightest = 1e9;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const d = Math.hypot(stops[i].x - stops[j].x, stops[i].y - stops[j].y);
      if (d < tightest) tightest = d;
    }
  }
  /* 85, not the audio map's 103, and the difference is the lap: the two stops
     it joins bracket one bowl, so they are 88px apart (2B) and CANNOT be pushed
     further without either flattening the road or moving a stop off the road's
     extremes. 88 against a 46px node leaves 42px of clear board, and what
     actually decides whether that reads is the LABELS — checked below. */
  ok(tightest >= 85, `no two stops closer than 85px (tightest ${tightest.toFixed(0)}px, node is 46px)`);

  // the real crowding test: no label may touch another label or another node
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const nodeBox = (n) => ({ x: n.x - n.r, y: n.y - n.r, w: n.r * 2, h: n.r * 2 });
  let clashes = [];
  g.labels.forEach((t, i) => {
    g.labels.forEach((u, j) => { if (j > i && hit(t.box, u.box)) clashes.push(`${t.txt}/${u.txt}`); });
    g.nodes.forEach((n) => {
      // a label sits directly under its OWN node by design, so only judge the
      // ones it does not belong to — anything more than a node away
      const own = Math.abs(n.x - t.x) < 30 && Math.abs(n.y - t.y) < 40;
      if (!own && hit(t.box, nodeBox(n))) clashes.push(`${t.txt}/node@${Math.round(n.x)},${Math.round(n.y)}`);
    });
  });
  ok(!clashes.length, `no label touches another label or a node${clashes.length ? ' — ' + clashes.join(', ') : ''}`);

  const distToRoad = (p) => Math.min(...g.roadPts.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
  const feedClear = Math.min(...small.map((n) => distToRoad(n) - n.r));
  ok(feedClear >= 30, `every feeder icon clears the road by 30px (tightest ${feedClear.toFixed(0)}px)`);

  /* THE LAP: its middle must stay off the road. Both ends are ON a node's
     edge, and a node sits on the road — so the last quarter at each end is
     within a node-radius of the road BY CONSTRUCTION and says nothing about
     whether the loop reads. Only the middle half is judged. */
  ok(g.lapPts.length > 0, 'the lap arc is drawn');
  const mid = g.lapPts.slice(30, -30);
  const lapClear = Math.min(...mid.map(distToRoad));
  ok(lapClear >= 25, `the lap clears the road by 25px along its span (tightest ${lapClear.toFixed(0)}px)`);

  const [, , vw, vh] = (g.vb || '').split(/\s+/).map(Number);
  const inside = g.labels.every((t) => t.x >= 0 && t.x <= vw && t.y >= 0 && t.y <= vh);
  ok(inside, `every label sits inside the ${vw}x${vh} board`);
  ok(g.labels.some((t) => t.txt === 'ROUND AGAIN'), 'the lap is labelled ROUND AGAIN');

  // ── the tabs ──────────────────────────────────────────────────────────
  const views = ['view-map', 'view-stops', 'view-costs', 'view-holes'];
  const tabs = await page.$$('.tab');
  ok(tabs.length === 4, `four tabs (${tabs.length})`);
  for (let i = 0; i < tabs.length; i++) {
    await tabs[i].click();
    const shown = await page.evaluate((vs) => vs.filter((v) => !document.getElementById(v).hidden), views);
    ok(shown.length === 1 && shown[0] === views[i], `tab ${i} shows only #${views[i]} (${shown.join(',') || 'none'})`);
  }
  // the sliding underline must measure /4, not a hardcoded three
  const uw = await page.evaluate(() => {
    const r = document.getElementById('tabs');
    return { line: +getComputedStyle(r, '::after').width.replace('px', ''), box: r.clientWidth };
  });
  ok(Math.abs(uw.line - (uw.box - 56) / 4) < 1.5,
    `the underline measures (row - 56) / 4 (${uw.line.toFixed(1)} vs ${((uw.box - 56) / 4).toFixed(1)})`);

  // ── the lists actually built ──────────────────────────────────────────
  await tabs[1].click();
  const stopRows = await page.$$eval('#stoplist .stop', (n) => n.length);
  ok(stopRows === 10, `stops tab lists eight stops plus two tributaries (${stopRows})`);
  const lapRows = await page.$$eval('#stoplist .stop.lap', (n) => n.length);
  ok(lapRows === 3, `three rows carry the lap spine (${lapRows})`);
  await tabs[2].click();
  const costRows = await page.$$eval('#costlist .cost', (n) => n.length);
  ok(costRows >= 10, `costs tab lists every rung (${costRows})`);
  await tabs[3].click();
  const picks = await page.$$eval('#holelist .pick', (n) => n.length);
  ok(picks === 4, `four candidate icons on the holes tab (${picks})`);

  // every reviewable thing must be notable — data-item is what the note box keys on
  const items = await page.$$eval('[data-item]', (n) => n.length);
  ok(items >= 20, `${items} things carry data-item, so a note can be left on each`);

  // ── no sideways scroll on a phone, on any tab ─────────────────────────
  for (let i = 0; i < 4; i++) {
    await tabs[i].click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 1, `tab ${i} does not overflow sideways (${over}px)`);
  }

  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} failed` : '\nall good');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
