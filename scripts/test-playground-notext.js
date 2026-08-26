#!/usr/bin/env node
/*
 * test-playground-notext.js — the Dreamy "No text" toggle (Aug 2026, Sophie:
 * "for the dreamy style in the playground, could you add a no text line to the
 * prompt that can be toggled on and off with a little toggle").
 *
 * Two halves. The first is source-only and always runs:
 *   1. the SWAP rule. Dreamy's tail carries its own text clause (her
 *      2026-08-22 wording says "no text."; before that it said "Minimal text
 *      only"), so the toggle replaces that clause instead of appending a
 *      second sentence arguing with it. The clause is matched VERBATIM, so
 *      this pins the tail and the toggle's `from` to each other: reword one
 *      without the other and the toggle silently falls back to appending,
 *      which is the failure nobody would notice.
 *   2. off is the default and changes nothing, and no other style grew one.
 * The second drives the real promptlab.html in headless Chromium: the button
 * shows only where the server says the style has the toggle, it survives a
 * reload, and the flag actually rides the POST.
 *
 *   node scripts/test-playground-notext.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// The style literal, evaluated — the only honest read of what reaches the model.
function styleObj(id) {
  const i = serverSrc.indexOf('\n  ' + id + ': {');
  const b = serverSrc.slice(i + ('\n  ' + id + ': ').length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                     // eslint-disable-line no-eval
}

// The server's own helper, lifted out of server.js by source so this tests the
// real implementation rather than a second copy of the rule.
const helperSrc = serverSrc.slice(serverSrc.indexOf('function applyNoText('));
const applyNoText = eval('(' + helperSrc.slice(0, helperSrc.indexOf('\n}\n') + 2) + ')'); // eslint-disable-line no-eval

console.log('the swap rule');
const dream = styleObj('dreamy');
ok(dream.noText && dream.noText.from && dream.noText.to, 'Dreamy carries a noText line');
// THE PIN: the clause it swaps must actually be in the tail it swaps it into.
ok(dream.suffix.indexOf(dream.noText.from) >= 0,
  'the clause it replaces is VERBATIM in the baked suffix');
ok(/no text/i.test(dream.noText.to) && !/minimal/i.test(dream.noText.to),
  'and what it puts there bans text outright');

// OFF changes nothing at all — a run with the toggle off is byte-for-byte what
// it always was.
ok(applyNoText(dream.suffix, dream, false) === dream.suffix, 'off: the tail is untouched');
const on = applyNoText(dream.suffix, dream, true);
ok(on.indexOf(dream.noText.to) >= 0, 'on: the ban is in the sent tail');
ok(on.indexOf(dream.noText.from) < 0, 'and the tail\'s own text clause is GONE, not contradicted');
ok(on.indexOf('do not draw its content') >= 0,
  'the bookended anti-content rule still closes the tail');

// Her own edited tail: if her wording no longer carries the clause, the line is
// appended rather than silently doing nothing.
ok(applyNoText('My own tail.', dream, true).indexOf(dream.noText.to) >= 0,
  'an edited tail with no clause gets the line appended');
ok(applyNoText('', dream, true) === dream.noText.to, 'an emptied tail becomes the line alone');
// A style with no noText can never be switched, whatever the page sends.
ok(applyNoText('X', styleObj('pastel'), true) === 'X',
  'a style with no noText is untouched even when asked');
// Read these as SOURCE, not as objects: `evan`'s literal names PL_GPT, which
// does not exist out here.
['evan', 'scarry', 'pastel', 'hoonies'].forEach((k) => {
  const b = serverSrc.slice(serverSrc.indexOf('\n  ' + k + ': {'));
  ok(!/noText:/.test(b.slice(0, b.indexOf('\n  },'))),
    k + ' grew no toggle (its tail already bans text)');
});

console.log('the wiring');
ok(/const noText = Boolean\(req\.body\.noText\) && !!st\.noText/.test(serverSrc),
  'the route only honours the flag on a style that has the line');
// The toggle is a switch on the HOUSE tail, not a rewrite by her — so it must
// not be counted as her edit, or the Prompt button would mark itself.
const route = serverSrc.slice(serverSrc.indexOf('const edited = prefix !== st.prefix'));
ok(route.indexOf('const edited') < route.indexOf('const noText'),
  '`edited` is decided BEFORE the toggle is applied — the switch is not her wording');
ok(/promptEdited: edited, noText/.test(serverSrc), 'the run records whether it was on');
ok(/noText: st\.noText \?/.test(serverSrc), 'the styles route says which styles offer it');
// The page must hold no copy of the line — same rule as the prefixes.
ok(!new RegExp(dream.noText.to.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(pageSrc),
  'promptlab.html holds NO copy of the no-text wording');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

(async () => {
  const posted = [];
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { posted.push(JSON.parse(body)); } catch { posted.push(null); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'x1' }));
      });
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {
        // the shape the real route serves, with the real Dreamy wording
        dreamy: { label: 'Dreamy', prefix: dream.prefix, suffix: dream.suffix,
          noText: dream.noText, refs: ['dream-mystery.jpg'] },
        pastel: { label: 'Pastel', prefix: 'P', suffix: 'P TAIL', noText: null, refs: [] },
      } }));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage();

  console.log('the toggle on the real page');
  await page.goto(base + '/playground?prompt=a%20cat&style=dreamy');
  await page.waitForFunction(() => {
    const b = document.getElementById('notextbtn');
    return b && !b.hidden;
  });
  ok(await page.isVisible('#notextbtn'), 'the toggle shows on Dreamy');
  ok(await page.getAttribute('#notextbtn', 'aria-pressed') === 'false', 'and starts OFF');

  // A style whose tail already bans text must show no switch that changes nothing.
  await page.selectOption('#stylepick', 'pastel');
  ok(!(await page.isVisible('#notextbtn')), 'no toggle on a style the server gave no line');
  await page.selectOption('#stylepick', 'dreamy');
  ok(await page.isVisible('#notextbtn'), 'back on Dreamy, back on screen');

  await page.click('#notextbtn');
  ok(await page.getAttribute('#notextbtn', 'aria-pressed') === 'true', 'tapping it turns it on');
  const cls = await page.getAttribute('#notextbtn', 'class');
  ok(/\bon\b/.test(cls), 'and it reads as on (dark), never a switch you cannot see');

  // The Prompt panel must say what the switch does — nothing is added to a
  // prompt of hers unannounced.
  await page.click('#promptbtn');
  await page.waitForSelector('#promptpanel textarea');
  const swapped = await page.textContent('#promptpanel .swapped').catch(() => '');
  ok(/No text is on/.test(swapped || ''), 'the panel says the toggle is on');
  ok((swapped || '').indexOf(dream.noText.to) >= 0, 'and shows the exact line being sent');
  // …and it is not stored as HER edit.
  ok(/House wording/.test(await page.textContent('#promptpanel .pnote')),
    'the toggle is not counted as her own wording');

  // It rides the POST.
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 0);
  ok(posted.length === 1 && posted[0].noText === true, 'the run carries noText:true');
  ok(posted[0].style === 'dreamy', 'on the Dreamy style');

  // It survives a reload — it costs nothing, unlike quality and the canvas.
  await page.goto(base + '/playground?style=dreamy');
  await page.waitForFunction(() => {
    const b = document.getElementById('notextbtn');
    return b && !b.hidden;
  });
  ok(await page.getAttribute('#notextbtn', 'aria-pressed') === 'true', 'it is remembered on reload');
  await page.click('#notextbtn');
  ok(await page.getAttribute('#notextbtn', 'aria-pressed') === 'false', 'and turns back off');
  await page.fill('#prompt', 'a cat');
  await page.click('#go');
  await page.waitForFunction(() => window.__posted !== undefined || true);
  await page.waitForTimeout(300);
  ok(posted.length === 2 && posted[1].noText === false, 'off sends noText:false');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
