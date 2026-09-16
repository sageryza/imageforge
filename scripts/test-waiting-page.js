#!/usr/bin/env node
// The WAITING page — the real public/waiting.html in headless Chromium,
// against a stub API.
//
// Every assertion is a MEASUREMENT off the rendered page rather than an
// assertion about the source, because the failures this page can have all look
// fine in the markup: a change filed under no chat and silently dropped, a
// chat's own line rendered but the commit subject lost with it, a count that
// disagrees with the number on her phone, and a page-level `let` sharing a
// name with the injected pill's own `var` (which kills the pill at parse
// time).
//
// Run: node scripts/test-waiting-page.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');

const DATA = {
  ok: true,
  live: 'deadbee',
  ahead: 3,
  error: '',
  at: '2026-09-15T02:00:00Z',
  groups: [
    { chat: 'witch-reels-final', name: 'witch reels', at: '2026-09-14T18:00:00Z', items: [
      { sha: 'b'.repeat(40), title: 'Instagram: the house reel on the Witch tab', pr: 2424,
        session: 'x', at: '2026-09-14T18:00:00Z', line: 'the witch reel is on the Instagram page' },
      { sha: 'c'.repeat(40), title: 'test-instagram-grids: derived from the data', pr: 2423,
        session: 'x', at: '2026-09-14T17:00:00Z', line: '' },
    ] },
    { chat: '', name: '', at: '2026-09-14T19:00:00Z', items: [
      { sha: 'd'.repeat(40), title: 'a merge nobody signed', pr: 0, session: '', at: '2026-09-14T19:00:00Z', line: '' },
    ] },
  ],
  open: [
    { chat: 'ward-film', name: 'ward film', at: '2026-09-15T01:00:00Z', items: [
      { sha: '', title: 'Ward: the reshoot plan', pr: 2431, session: 'y',
        at: '2026-09-15T01:00:00Z', draft: true, line: '' },
    ] },
  ],
  deploys: [
    { sha: 'ae189c3', at: '2026-09-16T00:18:18Z', n: 2, groups: [
      { chat: 'chats-unread', name: 'chats unread', at: '2026-09-16T00:10:00Z', items: [
        { sha: 'e'.repeat(40), title: 'Chats: the unread count on the row on screen', pr: 2464,
          session: 'z', at: '2026-09-16T00:10:00Z', line: '' },
        { sha: 'f'.repeat(40), title: 'Waiting: one pile', pr: 2452,
          session: 'z', at: '2026-09-15T21:00:00Z', line: '' },
      ] },
    ] },
    { sha: 'bf70d78', at: '2026-09-15T21:18:46Z', n: 1, groups: [
      { chat: 'footage-log', name: 'footage log', at: '2026-09-15T06:00:00Z', items: [
        { sha: '1'.repeat(40), title: 'Footage: a dropped answer is not a refusal', pr: 2428,
          session: 'w', at: '2026-09-15T06:00:00Z', line: '' },
      ] },
    ] },
  ],
};

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}

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

  let payload = DATA;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/waiting')) {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(payload));
    }
    const f = req.url === '/' ? '/waiting.html' : req.url.split('?')[0];
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
  await page.goto(base + '/waiting.html', { waitUntil: 'networkidle' });

  console.log('it says the same number her phone did');
  ok('no page errors (the pill parses)', errs.length === 0, errs);
  const count = (await page.locator('.count').innerText()).trim();
  ok('the count is the push\'s own ahead', /^3 changes are merged and not live yet\.$/.test(count), count);

  console.log('each change sits under the chat that wrote it');
  const who = await page.locator('.sect').first().locator('xpath=following-sibling::*[1]').innerText();
  ok('the chat\'s display name heads its block', who.startsWith('witch reels'), who);
  ok('a chat with two changes says so', /2 changes/.test(who), who);
  // Three merged-and-not-live changes; the payload's open PR is not drawn.
  // Scoped OUT of the deploy log below, which draws the same `.ch` row for
  // what has already shipped — a bare `.ch` count would silently pass whatever
  // the top pile did once that section existed.
  const rows = page.locator('.ch:not(.depbody .ch)');
  ok('every change is drawn, unclaimed ones included', await rows.count() === 3, await rows.count());

  console.log('a chat\'s own line leads, and the commit subject is kept under it');
  const first = page.locator('.ch').first();
  ok('her words lead', (await first.locator('.said').innerText()).includes('witch reel is on the Instagram page'));
  ok('the commit subject is still there', (await first.locator('.t').innerText()).includes('house reel on the Witch tab'));
  // PHOTO'd and caught: both are spans, so without display:block her line and
  // the commit subject ran together mid-sentence ("…as one promptWard film:").
  const said = await first.locator('.said').boundingBox();
  const subj = await first.locator('.t').boundingBox();
  ok('…on its own line, not run together', subj.y >= said.y + said.height - 1, { said, subj });
  const second = page.locator('.ch').nth(1);
  ok('a change with no filed line shows its subject alone',
    await second.locator('.said').count() === 0 && (await second.locator('.t').innerText()).length > 0);

  console.log('a change opens its own pull request');
  ok('the PR link', (await first.getAttribute('href')) === 'https://github.com/sageryza/imageforge/pull/2424',
    await first.getAttribute('href'));
  const nopr = page.locator('.ch').nth(2);
  ok('a merge with no PR opens its commit instead',
    String(await nopr.getAttribute('href')).includes('/commit/dddd'), await nopr.getAttribute('href'));

  console.log('the unclaimed pile is named, never dropped');
  const heads = await page.locator('.who').allInnerTexts();
  ok('it says what it is', heads.some((h) => h.includes('not traced to a chat')), heads);
  ok('…and it is last in its section', heads[1].includes('not traced to a chat'), heads);

  // ONE PILE ONLY (2026-09-15, Sophie: "what's all the extra stuff at the
  // bottom · get rid of it"). The server still answers `open` — the stub above
  // sends one — so this is the assertion that the page draws none of it.
  console.log('the still-open pile is gone');
  const sects = await page.locator('.sect').allInnerTexts();
  ok('the waiting pile leads', /not live yet/i.test(sects[0]), sects);
  ok('and the only other section is the deploy log',
    sects.length === 2 && /last deployed/i.test(sects[1]), sects);
  ok('no open row is drawn, though the payload carries one',
    (await page.locator('.ch.draft').count()) === 0 &&
    !(await page.locator('body').innerText()).includes('Ward: the reshoot plan'));

  // ── THE LAST FIVE DEPLOYS (2026-09-16, Sophie: "can i have collapsed rows
  // under, up to five, showing what rode in the last 5 deployed"). MEASURED
  // rather than asserted in source: a row whose markup is perfect but whose
  // body was never hidden, and one whose tap handler never bound, both read
  // identically in the file.
  console.log('the last deploys are rows, and they start shut');
  const deps = page.locator('.dep');
  ok('one row per deploy', await deps.count() === 2, await deps.count());
  // 12-hour PACIFIC, the house time rule — the stub's 2026-09-16T00:18Z is
  // Sep 15, 5:18 pm where she is, and a row reading "Sep 16" would mean the
  // page had drifted to UTC.
  ok('it says when it went out, in her time',
    /Sep 15, 5:18 pm/.test(await deps.first().innerText()),
    await deps.first().innerText());
  ok('…and how many rode in it', /2 changes/.test(await deps.first().innerText()),
    await deps.first().innerText());
  ok('SHUT by default — she asked for collapsed rows',
    await page.locator('.depbody:visible').count() === 0);
  ok('so a deployed change is not on screen yet',
    !(await page.locator('body').innerText()).includes('the unread count on the row on screen'));

  console.log('tapping a row opens it, and only it');
  await deps.first().click();
  ok('its changes are on screen now',
    (await page.locator('body').innerText()).includes('the unread count on the row on screen'));
  ok('grouped under the chat that wrote them',
    (await page.locator('body').innerText()).includes('chats unread'));
  ok('the OTHER row stayed shut', await page.locator('.depbody:visible').count() === 1);
  await deps.first().click();
  ok('tapping again puts it away', await page.locator('.depbody:visible').count() === 0);

  // THE WAY OUT (2026-09-16, Sophie: "there's no way to exit the page"). The
  // page shipped with none — pagehead.js only draws its chevron when
  // `window.__forgeLeave` exists, so in Safari and on an older build there was
  // nothing at all. Measured as VISIBLE, not merely present: it shipped
  // `hidden` and is un-hidden by script.
  console.log('there is a way out');
  ok('the chevron is on screen', await page.locator('#back:visible').count() === 1);
  ok('it is the house 34px box, not a 26px round plate',
    (await page.locator('#back').boundingBox()).width === 34,
    await page.locator('#back').boundingBox());

  console.log('a box with no commit of its own says so rather than inventing one');
  payload = { ok: true, live: '', ahead: 0, error: 'no-commit', at: '2026-09-15T02:00:00Z', groups: [], open: [] };
  await page.reload({ waitUntil: 'networkidle' });
  const msg = (await page.locator('.count').innerText()).trim();
  ok('it is honest', /no commit of its own/i.test(msg), msg);
  ok('and it still draws', errs.length === 0, errs);

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILING' : '\nall green');
  process.exit(fails ? 1 : 0);
})();
