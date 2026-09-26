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
  ahead: 5,
  forYou: 3,
  classified: true,
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
  // NOTHING CHANGES FOR YOU (2026-09-25): a Compare page's template and an
  // iOS-only change — merged, counted in `ahead`, and neither is what the
  // Deploy button would change for her.
  quiet: [
    { chat: 'pattern-tool', name: 'pattern tool', at: '2026-09-14T16:00:00Z', items: [
      { sha: 'a'.repeat(40), title: 'Pattern v14: Scatter is an even lattice', pr: 2655,
        session: 'p', at: '2026-09-14T16:00:00Z', line: '', kind: 'record' },
      { sha: '9'.repeat(40), title: 'The Dump: Save to Photos on the tile', pr: 2648,
        session: 'p', at: '2026-09-14T15:00:00Z', line: '', kind: 'ios' },
    ] },
  ],
  open: [
    { chat: 'ward-film', name: 'ward film', at: '2026-09-15T01:00:00Z', items: [
      { sha: '', title: 'Ward: the reshoot plan', pr: 2431, session: 'y',
        at: '2026-09-15T01:00:00Z', draft: true, line: '' },
    ] },
  ],
  deploy: { key: true, cooling: 0 },
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
  // What POST /api/waiting/deploy answers, and every one it was sent. The
  // count is what proves the SECOND tap is the one that sends.
  let deployReply = { code: 200, body: { ok: true, id: 'dep-1', ahead: 3 } };
  const fired = [];
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/waiting/deploy')) {
      fired.push(req.method);
      res.statusCode = deployReply.code;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(deployReply.body));
    }
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
  // THE COUNT IS THE CHANGES SHE WOULD NOTICE (2026-09-25, Sophie: "only have
  // the 'waiting to deploy' mean changes that would change something for
  // me") — `forYou` (3), never the raw `ahead` (5).
  ok('the count is the changes a deploy would change for her', /^3 changes waiting to deploy\.$/.test(count), count);

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
  ok('the waiting pile leads', /changes something for you/i.test(sects[0]), sects);
  ok('and the only other section is the deploy log (the quiet row wears none)',
    sects.length === 2 && /last deployed/i.test(sects[1]), sects);
  ok('no open row is drawn, though the payload carries one',
    (await page.locator('.ch.draft').count()) === 0 &&
    !(await page.locator('body').innerText()).includes('Ward: the reshoot plan'));

  // ── THE LAST FIVE DEPLOYS (2026-09-16, Sophie: "can i have collapsed rows
  // under, up to five, showing what rode in the last 5 deployed"). MEASURED
  // rather than asserted in source: a row whose markup is perfect but whose
  // body was never hidden, and one whose tap handler never bound, both read
  // identically in the file.
  // ── NOTHING CHANGES FOR YOU (2026-09-25). One shut row; MEASURED, since a
  // row that is drawn open and one that never folds read alike in the source.
  console.log('the merges a deploy would not change for her sit shut under the pile');
  const qrow = page.locator('.quietrow');
  ok('one row', await qrow.count() === 1);
  ok('it counts them', /2 merges change nothing for you/.test(await qrow.innerText()), await qrow.innerText());
  ok('shut by default', await page.locator('#quietbody:visible').count() === 0);
  ok('so the Pattern template is not on screen',
    !(await page.locator('body').innerText()).includes('Scatter is an even lattice'));
  await qrow.click();
  ok('a tap opens it', (await page.locator('body').innerText()).includes('Scatter is an even lattice'));
  ok('the iOS change says it waits on a build, not a deploy',
    /iOS · a build, not a deploy/.test(await page.locator('#quietbody').innerText()), await page.locator('#quietbody').innerText());
  await qrow.click();
  ok('and a tap shuts it', await page.locator('#quietbody:visible').count() === 0);
  // PHOTO'd at 390pt: the first cut's row wrapped to two lines.
  const qb = await qrow.boundingBox();
  ok('the row is one line', qb.height < 46, qb);

  console.log('the last deploys are rows, and they start shut');
  const deps = page.locator('.dep:not(.quietrow)');
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

  // ── THE DEPLOY BUTTON (2026-09-16, Sophie: "add a button at top of merged
  // changes that deploys to render so i can do it myself and chats can stop
  // asking"). MEASURED, not asserted in source: a button that fires on the
  // FIRST tap, one whose arm never gives itself up, and one drawn on a page
  // with nothing to ship all look correct in the markup — and the first of
  // those restarts her server by mis-scroll.
  console.log('the deploy button leads the page');
  ok('it is on screen', await page.locator('#go:visible').count() === 1);
  ok('it reads Deploy', (await page.locator('#go').innerText()).trim() === 'Deploy',
    await page.locator('#go').innerText());
  ok('it says how many go live', /3 changes go live/.test(await page.locator('#gonote').innerText()),
    await page.locator('#gonote').innerText());
  // ABOVE the count — "at top of merged changes" is the ask, and a button
  // under the list is a button she has to scroll back up to.
  const goBox = await page.locator('#go').boundingBox();
  const cntBox = await page.locator('.count').boundingBox();
  ok('…above everything it would ship', goBox.y + goBox.height <= cntBox.y + 1, { goBox, cntBox });
  // It hugs its words (the house button rule) — never a full-width slab.
  ok('it hugs its words', goBox.width < 200, goBox);

  console.log('one tap arms it, it does not deploy');
  await page.locator('#go').click();
  ok('NOTHING was sent on the first tap', fired.length === 0, fired);
  ok('it asks again', /tap again/i.test(await page.locator('#go').innerText()),
    await page.locator('#go').innerText());

  console.log('the second tap sends');
  await page.locator('#go').click();
  await page.waitForFunction(() => /Deploying/.test(document.getElementById('go').textContent));
  ok('one POST, and only one', fired.length === 1 && fired[0] === 'POST', fired);
  ok('it says it is going out', /Deploying/.test(await page.locator('#go').innerText()),
    await page.locator('#go').innerText());
  ok('…and that the guard waits on a draw by itself',
    /drawing/.test(await page.locator('#gonote').innerText()),
    await page.locator('#gonote').innerText());

  console.log('the arm gives itself up');
  await page.reload({ waitUntil: 'networkidle' });
  fired.length = 0;
  await page.locator('#go').click();
  ok('armed', /tap again/i.test(await page.locator('#go').innerText()));
  await page.waitForFunction(() => !/tap again/i.test(document.getElementById('go').textContent),
    null, { timeout: 12000 });
  ok('…after a few seconds it is a plain Deploy again',
    (await page.locator('#go').innerText()).trim() === 'Deploy', await page.locator('#go').innerText());
  await page.locator('#go').click();
  ok('so the next tap only re-arms — it does not send', fired.length === 0, fired);

  console.log('a routine door opens a chat, and hands her the chat');
  // (2026-09-26, Sophie: "deploy waiting button opens a random opus chat w
  // deploy preseeded if possible".) MEASURED: the link is a real anchor with
  // the chat's url, shown only once the fire has answered with one, and the
  // page is still here — a tap that navigated away would lose the count.
  payload = Object.assign({}, DATA, { deploy: { key: true, how: 'chat', cooling: 0 } });
  deployReply = { code: 200, body: { ok: true, how: 'chat', ahead: 3,
    session: 'session_01AbCdEfGhIjKlMnOpQrSt', url: 'https://claude.ai/code/session_01AbCdEfGhIjKlMnOpQrSt' } };
  await page.reload({ waitUntil: 'networkidle' });
  fired.length = 0;
  ok('it still reads Deploy', (await page.locator('#go').innerText()).trim() === 'Deploy');
  ok('…and says it goes through a chat', /Opus chat/.test(await page.locator('#gonote').innerText()),
    await page.locator('#gonote').innerText());
  ok('no link before anything was opened', await page.locator('#golink:visible').count() === 0);
  await page.locator('#go').click();
  ok('the arm says a chat opens', /opens an Opus chat/.test(await page.locator('#gonote').innerText()),
    await page.locator('#gonote').innerText());
  ok('and nothing was sent yet', fired.length === 0, fired);
  await page.locator('#go').click();
  await page.waitForFunction(() => /Chat opened/.test(document.getElementById('go').textContent));
  ok('one POST', fired.length === 1, fired);
  ok('it says a chat is deploying', /Opus chat is deploying/.test(await page.locator('#gonote').innerText()),
    await page.locator('#gonote').innerText());
  ok('the link to the chat is on screen', await page.locator('#golink:visible').count() === 1);
  ok('…and it is the chat\'s own url',
    (await page.locator('#golink').getAttribute('href')) === 'https://claude.ai/code/session_01AbCdEfGhIjKlMnOpQrSt',
    await page.locator('#golink').getAttribute('href'));
  ok('…while the page is still the page', await page.locator('.count').count() === 1 && page.url().includes('/waiting'));
  // A fire that answered with no id: the note alone, no link to nowhere.
  deployReply = { code: 200, body: { ok: true, how: 'chat', ahead: 3, session: '', url: '' } };
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#go').click();
  await page.locator('#go').click();
  await page.waitForFunction(() => /Chat opened/.test(document.getElementById('go').textContent));
  ok('no url on the answer → no link', await page.locator('#golink:visible').count() === 0);
  payload = DATA;

  console.log('a refusal is said in words, and the button comes back');
  deployReply = { code: 429, body: { error: 'cooling', cooling: 120000 } };
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#go').click();
  await page.locator('#go').click();
  await page.waitForFunction(() => /try again/.test(document.getElementById('gonote').textContent));
  ok('it says how long is left', /try again in 2 min/.test(await page.locator('#gonote').innerText()),
    await page.locator('#gonote').innerText());
  ok('and she can tap it again', await page.locator('#go').isEnabled());

  console.log('no button when there is nothing to ship, and none with no key');
  deployReply = { code: 200, body: { ok: true, id: 'dep-2' } };
  payload = Object.assign({}, DATA, { ahead: 0, forYou: 0, groups: [], quiet: [] });
  await page.reload({ waitUntil: 'networkidle' });
  ok('nothing waiting → no button at all', await page.locator('#go:visible').count() === 0);
  // Five merged and none of them hers: the button would deploy nothing she
  // could notice, so it is not drawn, and the count says why it is zero.
  payload = Object.assign({}, DATA, { ahead: 5, forYou: 0, groups: [] });
  await page.reload({ waitUntil: 'networkidle' });
  ok('only bookkeeping waiting → no button either', await page.locator('#go:visible').count() === 0);
  ok('and the count says so', /^0 changes waiting to deploy — nothing a deploy would change for you\.$/.test((await page.locator('.count').innerText()).trim()),
    await page.locator('.count').innerText());
  ok('…while the quiet row still shows them', await page.locator('.quietrow').count() === 1);
  payload = Object.assign({}, DATA, { deploy: { key: false, cooling: 0 } });
  await page.reload({ waitUntil: 'networkidle' });
  ok('no Render key on the server → no dead control either',
    await page.locator('#go:visible').count() === 0);
  payload = DATA;

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
