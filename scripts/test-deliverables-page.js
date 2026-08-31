#!/usr/bin/env node
// The deliverables PAGE — the real public/deliverables.html in headless
// Chromium, against a stub API.
//
// What it pins, and why each is a measurement rather than a markup assertion:
//   • ONE ROW PER WORK (2026-08-27, Sophie: "only put the latest version") —
//     counted off the REAL rows, since the grouping lives in the server's
//     rowsOf and the page only has to draw one row per group.
//   • THE EARLIER TAKES FOLD, and nothing is lost — a wrong merge must cost
//     her a tap, never a deliverable.
//   • THE TOGGLE TAKES ITS OWN TAP, asked with elementFromPoint. The row is
//     an <a> and the toggle is its SIBLING; a nested control would be eaten
//     by the link, and every markup assertion passes either way.
//   • NO PAGE ERRORS — a page-level `let` sharing a name with the injected
//     pill's own `var` kills the pill's script at parse time.
//
// Run: node scripts/test-deliverables-page.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');

// One work with two earlier takes (the Water reel's real shape), and one
// standing alone — the two cases the page draws differently.
const ITEMS = [
  { url: 'https://x/w16.mp4', title: 'Water reel v16 — ramps (1:31)', chat: 'a',
    chatName: 'Water notes', kind: 'video', at: '2026-08-27T07:00:00Z',
    updatedAt: '2026-08-27T07:00:00Z', versions: 1,
    older: [
      { url: 'https://x/w14.mp4', title: 'Water reel v14 ramp', chat: 'b', chatName: 'Water anim', kind: 'video', updatedAt: '2026-08-27T05:00:00Z' },
      { url: 'https://x/w8.mp4', title: 'Water reel v8 — her voice', chat: 'c', chatName: 'Water audio', kind: 'video', updatedAt: '2026-08-25T00:00:00Z' },
    ] },
  { url: 'https://x/ev.mp4', title: 'Evan — v17: your ten notes (4:24)', chat: 'd',
    chatName: 'Evan', kind: 'video', at: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z', versions: 1, older: [] },
];

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

// The sandbox's pre-installed chromium (the test-assembly.js pattern).
function chromiumExe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((x) => /^chromium-\d/.test(x))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { /* not installed here */ }
  if (!pw) { console.log('page tests skipped — playwright not installed'); return; }

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/deliverables')) {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: true, items: ITEMS }));
    }
    // express.static's job in production — a harness that hand-lists shared
    // files is one shared file away from a silent timeout.
    const f = req.url === '/' ? '/deliverables.html' : req.url.split('?')[0];
    try {
      const body = fs.readFileSync(path.join(PUB, f));
      res.setHeader('content-type', f.endsWith('.css') ? 'text/css'
        : f.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.end(body);
    } catch (e) { res.statusCode = 404; res.end(''); }
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const exe = chromiumExe();
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '/deliverables.html', { waitUntil: 'networkidle' });

  console.log('the page draws one row per work');
  ok('no page errors (the pill parses)', errs.length === 0, errs);
  ok('two top rows for two works', await page.locator('#list > a.dv').count() === 2);
  ok('the newest version leads', (await page.locator('#list > a.dv').first().innerText()).includes('v16'));
  ok('a row opens its own film', (await page.locator('#list > a.dv').first().getAttribute('href')) === 'https://x/w16.mp4');

  console.log('the earlier takes fold, and nothing is lost');
  const more = page.locator('.vmore');
  ok('only the group carries a toggle', await more.count() === 1);
  ok('it names how many', (await more.innerText()).trim() === '2 earlier takes', (await more.innerText()).trim());
  ok('they start folded', await page.locator('.vold').isHidden());

  // The only honest way to ask what a tap reaches: the toggle sits between
  // two <a> rows, and "visible" is true whichever element owns the point.
  const box = await more.boundingBox();
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.className || el.tagName) : null;
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  ok('the toggle takes its own tap', String(hit).includes('vmore'), hit);

  await more.click();
  ok('they open', await page.locator('.vold').isVisible());
  ok('…both of them', await page.locator('.vold a.dv').count() === 2);
  ok('…each opening its own take', (await page.locator('.vold a.dv').first().getAttribute('href')) === 'https://x/w14.mp4');
  ok('…and the label flips', (await more.innerText()).trim() === 'hide earlier takes');
  await more.click();
  ok('they close again', await page.locator('.vold').isHidden());
  ok('…with the count restored', (await more.innerText()).trim() === '2 earlier takes');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILING' : '\nall green');
  process.exit(fails ? 1 : 0);
})();
