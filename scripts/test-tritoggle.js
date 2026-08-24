#!/usr/bin/env node
// THE THREE-WAY TOGGLE SHELL — /tritoggle.css (Aug 2026, Sophie: "for things
// with three options, it shud be a three way toggle. add the toggle as a
// likely pattern where it applies. make a reusable three toggle shell so we
// can change the styling all at once. make color a per instance option. apply
// it to the few instances that already exists").
//
// The geometry had been hand-copied THREE times and had already drifted —
// `.swi` in chats.html, `.swtog` in promptlab.html, `.swtog` again in
// panels.html whose own comment said it was "LIFTED VERBATIM". The only thing
// that ever noticed was a test comparing two files property by property. This
// replaces that: ONE file, and the checks are (1) nobody keeps a second copy,
// (2) every page that uses the class actually links the file, and (3) the
// geometry CLOSES — measured in a real browser at every stop, for the shell's
// own defaults and for each page's override.
//
//   node scripts/test-tritoggle.js
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const CSS = fs.readFileSync(path.join(PUB, 'tritoggle.css'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// Pull one rule's body out of a stylesheet or a page's inline CSS.
function rule(src, selector) {
  const at = src.indexOf(selector);
  if (at < 0) return '';
  const open = src.indexOf('{', at);
  return src.slice(open + 1, src.indexOf('}', open));
}
const decl = (body, prop) => {
  const m = new RegExp('(?:^|[;{\\s])' + prop.replace(/-/g, '\\-') + '\\s*:\\s*([^;}]+)').exec(body || '');
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
};

// The pages that carry one. Each names the class it uses in markup and the
// per-instance rule it is allowed to keep.
const PAGES = [
  { file: 'chats.html', instance: 'the account switcher' },
  { file: 'promptlab.html', instance: 'quality + size' },
  { file: 'panels.html', instance: 'quality + size' },
];

console.log('one file, and nobody keeps a second copy');
const base = rule(CSS, '.tri {');
ok(base, 'the shell declares .tri');
ok(/\.tri\[data-n="1"\]::after \{ transform: translateX\(var\(--tri-gap\)\)/.test(CSS),
  'the middle stop is one --tri-gap along');
ok(/\.tri\[data-n="2"\]::after \{ transform: translateX\(calc\(var\(--tri-gap\) \* 2\)\)/.test(CSS),
  'the last stop is two --tri-gaps along');
// DERIVED, NOT TYPED — the lesson the hairline tab rows already carry. Both
// hand-copied versions had eyeballed their gap, and one had the knob half a
// pixel off centre vertically.
ok(/^calc\(/.test(decl(base, '--tri-gap') || ''), 'the travel between stops is calc\'d from the track, never typed');
ok(/^calc\(/.test(decl(base, '--tri-h') || ''), 'the height is calc\'d from the knob, never typed');
ok(/^calc\(/.test(decl(base, 'border-radius') || ''), 'and the capsule radius comes off the height');
// COLOUR IS THE PER-INSTANCE OPTION she named.
ok(/var\(--chg,/.test(decl(base, '--tri-track') || ''), 'the default track is the house token, with a fallback for a page that has none');
ok(decl(base, 'background') === 'var(--tri-track)', 'the track paints from --tri-track, so an instance recolours it with one line');
ok(decl(rule(CSS, '.tri::after {'), 'background') === 'var(--tri-knob)', 'and the knob from --tri-knob');
ok(decl(rule(CSS, '.tri::after {'), 'content') === 'attr(data-i)',
  'the knob draws its word from data-i — absent means a blank knob, which is the account switcher');

PAGES.forEach((p) => {
  const src = fs.readFileSync(path.join(PUB, p.file), 'utf8');
  p.src = src;
  ok(/class="tri"/.test(src) || /class="tri /.test(src) || /className='tri'/.test(src),
    p.file + ' uses the shared class (' + p.instance + ')');
  ok(/<link rel="stylesheet" href="\/tritoggle\.css">/.test(src),
    p.file + ' links the shell');
  ok(!/\.swtog|\.swi\{|\.swi::after/.test(src),
    p.file + ' has no leftover hand-copy of the old rule');
  // A page may keep its COLOUR and its SIZE. It may not keep the machinery:
  // an absolutely-positioned round knob with a transition is the geometry.
  const own = rule(src, '.tri {') || rule(src, '.tri{');
  const kept = Object.keys({ position: 1, transition: 1, 'border-radius': 1 })
    .filter((k) => decl(own, k));
  ok(kept.length === 0,
    p.file + ' keeps only its colour/size overrides, not the geometry'
    + (kept.length ? ' — still declares ' + kept.join(', ') : ''));
});

// ── the real browser ─────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch {
    console.log('SKIP the measured half: playwright not installed');
    console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
    process.exit(fails ? 1 : 0);
  }
}

// Each instance as the browser actually resolves it: the real stylesheet, then
// the page's own override rule verbatim, then the tokens that page defines.
const CASES = [
  { name: 'the shell on its own (the account switcher)', css: ':root{--chg:#b3443f;--paper:#f6f2e9}' },
  { name: 'the Playground / Panels override', css: rule(PAGES[1].src, '.tri {') ? '.tri {' + rule(PAGES[1].src, '.tri {') + '}' : '' },
  { name: 'the search filter at rest', css: ':root{--chg:#b3443f;--paper:#f6f2e9;--ink2:#8a8377}.tri{--tri-track:var(--ink2)}' },
];

const server = http.createServer((req, res) => {
  if (req.url === '/tritoggle.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    return res.end(CSS);
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><meta charset=utf-8>'
    + '<link rel="stylesheet" href="/tritoggle.css">'
    + '<style id="inst"></style>'
    + '<body style="margin:0;padding:20px"><button class="tri" id="t" data-n="0"></button>');
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);

  console.log('the geometry closes, measured');
  for (const c of CASES) {
    if (!c.css) { ok(false, c.name + ': no override rule found to measure'); continue; }
    await page.evaluate((css) => { document.getElementById('inst').textContent = css; }, c.css);
    const m = await page.evaluate(() => {
      const el = document.getElementById('t');
      const cs = getComputedStyle(el);
      const track = el.getBoundingClientRect();
      return { stops: [], trackW: track.width, trackH: track.height,
        bw: parseFloat(cs.borderTopWidth), radius: parseFloat(cs.borderTopLeftRadius) };
    });
    // READ AFTER THE .18s SLIDE, or every stop reads as the identity matrix it
    // is still transitioning away from — the same trap the account switcher's
    // own test hit.
    for (const n of ['0', '1', '2']) {
      await page.evaluate((v) => document.getElementById('t').setAttribute('data-n', v), n);
      await page.waitForTimeout(260);
      m.stops.push(await page.evaluate(() => {
        const a = getComputedStyle(document.getElementById('t'), '::after');
        const mm = /matrix\(([^)]*)\)/.exec(a.transform);
        return { x: mm ? parseFloat(mm[1].split(',')[4]) : 0,
          w: parseFloat(a.width), h: parseFloat(a.height),
          left: parseFloat(a.left), top: parseFloat(a.top) };
      }));
    }
    await page.evaluate(() => document.getElementById('t').setAttribute('data-n', '0'));
    const k = m.stops[0];
    const near = (a, b, t) => Math.abs(a - b) < (t || 0.6);
    ok(new Set(m.stops.map((s) => Math.round(s.x))).size === 3,
      c.name + ': three stops that actually sit apart (' + m.stops.map((s) => Math.round(s.x)).join(', ') + 'px)');
    ok(near(m.stops[1].x * 2, m.stops[2].x),
      c.name + ': the stops are evenly spaced');
    // THE ONE THAT MATTERS: the last stop parks the knob SYMMETRICALLY — the
    // space left on its right equals the inset it starts with on the left. A
    // typed gap that is a pixel out shows as a knob overshooting its track or
    // stopping short, and nothing but a measurement catches it.
    // The tolerance is 1.5px rather than a hair, and that is not slack: the
    // CSS calc works in the SPECIFIED 1.5px border while Chromium lays out
    // with a border snapped to whole device pixels, so the two disagree by up
    // to a pixel at any DPR. Anything bigger than that is a real error.
    const rightGap = m.trackW - 2 * m.bw - k.left - k.w - m.stops[2].x;
    ok(near(rightGap, k.left, 1.5),
      c.name + ': the last stop parks symmetrically (' + k.left.toFixed(1)
      + 'px in on the left, ' + rightGap.toFixed(1) + ' on the right)');
    ok(rightGap >= 0, c.name + ': and the knob never overshoots its track');
    ok(near(k.left, (m.trackH - 2 * m.bw - k.h) / 2),
      c.name + ': the knob is vertically centred');
    ok(near(k.w, k.h), c.name + ': the knob is square, so it cannot go oval when the track grows');
    ok(near(m.radius, m.trackH / 2), c.name + ': the track is a full capsule');
  }

  // COLOUR IS PER INSTANCE — the same shell, three different tracks.
  const paints = [];
  for (const c of CASES) {
    await page.evaluate((css) => { document.getElementById('inst').textContent = css; }, c.css);
    paints.push(await page.evaluate(() => getComputedStyle(document.getElementById('t')).backgroundColor));
  }
  ok(new Set(paints).size === 3,
    'each instance paints its own track colour off one rule (' + paints.join(' | ') + ')');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nPASS: one shell, derived geometry that closes at every stop, colour per instance');
  process.exit(fails ? 1 : 0);
})();
