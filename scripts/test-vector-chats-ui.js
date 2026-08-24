#!/usr/bin/env node
// /vector wears the Chats app's UI — the pin against drift.
//
//   node scripts/test-vector-chats-ui.js
//
// Sophie, Aug 2026: "can you match the UI style, including buttons and
// placement and everything to the UI of the chat area?"
//
// The page used to run on `tool.css` (near-white paper, a tan accent, a
// numbered step rail, sans body text). It now speaks chats.html's own
// vocabulary, and the FIRST HALF of this file is what stops the two drifting:
// every palette token is READ OUT OF chats.html and compared, rather than
// copied into an expectation here — the mistake the `TAGS`/`TAG_LIST` and
// `PL_GPT_STYLES`/`STYLES` pins were written to prevent.
//
// The second half MEASURES the real page in headless Chromium (`setContent`,
// so it needs no server and spends nothing): the tab row's underline lands
// under the lit tab, the buttons hug their words, and nothing tappable sits in
// the corner the injected pill owns. It SKIPS when there is no Chromium.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VEC = fs.readFileSync(path.join(ROOT, 'public', 'vector.html'), 'utf8');
const CHATS = fs.readFileSync(path.join(ROOT, 'public', 'chats.html'), 'utf8');

let failed = 0;
const ok = (good, msg) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${msg}`); if (!good) failed++; };

// ── the palette, read out of BOTH files ────────────────────────────────────
// Every :root block, keyed by its selector text, so light AND dark AND both
// [data-theme] overrides are compared — a page that turns with her phone but
// not with her toggle is half-ported.
function palettes(src) {
  const out = {};
  const re = /(@media \(prefers-color-scheme: dark\)\{)?:root(\[data-theme="[a-z]+"\])?\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const key = (m[1] ? 'dark-media' : '') + (m[2] || '') || 'light';
    const vars = {};
    m[3].replace(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi, (_, k, v) => { vars[k] = v.trim(); return ''; });
    if (!Object.keys(vars).length) continue;
    if (!out[key]) out[key] = vars;          // the FIRST block wins, as CSS order does
  }
  return out;
}
const cp = palettes(CHATS), vp = palettes(VEC);
// The five the injected pill reads, plus the two the page paints with.
const TOKENS = ['paper', 'ink', 'ink2', 'line', 'rose', 'chg', 'barbg'];
for (const block of ['light', 'dark-media', '[data-theme="dark"]', '[data-theme="light"]']) {
  const c = cp[block], v = vp[block];
  if (!c) { ok(false, `chats.html has a ${block} block to compare against`); continue; }
  ok(!!v, `/vector carries the ${block} palette block`);
  if (!v) continue;
  const wrong = TOKENS.filter((t) => c[t] && v[t] !== c[t]);
  ok(wrong.length === 0,
    `${block}: every token is chats.html's own value${wrong.length ? ' — differs: ' + wrong.join(', ') : ''}`);
}

// ── it is off the old kit ──────────────────────────────────────────────────
ok(!/<link[^>]+tool\.css/.test(VEC), 'it no longer links tool.css');
ok(!/<body[^>]*class="[^"]*\btool\b/.test(VEC), 'and the body no longer wears .tool');
ok(/font-family:Georgia,serif/.test(VEC), 'the body text is the serif, like the chats app');

// ── the controls are the house ones, shape for shape ───────────────────────
// Each rule is compared against the SAME rule in chats.html on the properties
// that carry the look: a chip that quietly grew a different border or radius
// is exactly the drift this catches.
function rule(src, sel) {
  const i = src.indexOf('\n' + sel + '{');
  if (i < 0) return null;
  return src.slice(i + sel.length + 2, src.indexOf('}', i)).replace(/\s+/g, ' ');
}
const SHAPE = [/border:1\.5px solid var\(--line\)/, /border-radius:6px/,
  /font-size:11px/, /letter-spacing:\.08em/, /text-transform:uppercase/];
const chip = rule(VEC, '.catchip') || '';
ok(SHAPE.every((r) => r.test(chip)), 'the option chips ARE the house .catchip');
ok(/border-color:var\(--chg\)/.test(rule(VEC, '.catchip.on') || ''), 'and a lit chip takes the accent');
const icon = rule(VEC, '.iconbtn') || '';
ok(/width:34px/.test(icon) && /border-radius:6px/.test(icon), 'the "?" is the house 34px icon box');
const go = rule(VEC, '.gobtn') || '';
ok(/border-radius:6px/.test(go) && /text-transform:uppercase/.test(go),
  "the action button is the chats app's own (`.askrow button`)");
ok(/width:auto/.test(go) && /flex:0 0 auto/.test(go),
  'and it hugs its words — never stretched by a flex row it is dropped into');
ok(/background:var\(--ink\)/.test(rule(VEC, '.gobtn.go') || ''),
  'the one filled button is the ink-filled `.go`');

// NO PILLS — the house rule. A 999px radius is allowed only on a round dot.
const pills = (VEC.match(/border-radius:999px/g) || []).length;
ok(pills === 0, `no pill-shaped buttons (${pills} found)`);

// ── the hairline tabs, and the row that measures its own underline ─────────
ok(/\.acctabs\{[^}]*border-bottom:1px solid var\(--line\)/.test(VEC.replace(/\s+/g, ' ')),
  'the sections are a hairline .acctabs row');
ok(/var\(--tw,0\)/.test(VEC) && /var\(--tx,0\)/.test(VEC),
  'the underline reads --tw/--tx, so an unmeasured row draws NO line rather than a wrong one');
ok(/function tabLine/.test(VEC) && /getBoundingClientRect/.test(VEC),
  'and tabLine MEASURES the lit tab rather than counting the tabs');
const tabCount = (VEC.match(/class="acctab/g) || []).length;
ok(!new RegExp(`repeat\\(${tabCount}`).test(VEC), 'no rule anywhere declares how many tabs there are');

// ── the rules that survived the port ───────────────────────────────────────
ok(!/placeholder="[^"]+"/.test(VEC), 'text boxes ship EMPTY — no placeholder fills one');
ok(/<textarea id="cells"[^>]*><\/textarea>/.test(VEC), 'and the drawings box has nothing inside it');
ok(/<h1 class="tool-eyebrow">/.test(VEC),
  'the title is a `tool-eyebrow` h1 — hidden on the old build, un-hidden and centred by pagehead.js');
ok(/\[hidden\]\{display:none !important\}/.test(VEC),
  '[hidden] wins over the author display rules');
// The house star, byte-for-byte — the one glyph any control that spends wears.
const star = (CHATS.match(/GEN_STAR='<svg[^']*'/) || [''])[0];
const head = (star.match(/d="M 55\.8 31\.9[^"]{0,60}/) || [''])[0];
ok(head && VEC.includes(head), 'the paid button wears the house generate star, verbatim');

// ── the page half ──────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('SKIP (page half) — playwright is not installed');
  return done();
}
const CHROMES = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'].filter(Boolean);
let chrome = CHROMES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } });
if (!chrome) {
  try {
    const hit = fs.readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-'));
    const p = hit && path.join('/opt/pw-browsers', hit, 'chrome-linux', 'chrome');
    if (p && fs.existsSync(p)) chrome = p;
  } catch (_) { /* none */ }
}
if (!chrome) { console.log('SKIP (page half) — no Chromium found'); return done(); }

(async () => {
  const b = await chromium.launch({ executablePath: chrome });
  // Her phone. Every number below is measured at this width on purpose.
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.setContent(VEC, { waitUntil: 'load' });
  await pg.waitForTimeout(250);

  ok(errs.length === 0, 'the page runs clean' + (errs.length ? ': ' + errs[0] : ''));

  // THE UNDERLINE IS UNDER THE WORD. A wrong count, a padding change or a tab
  // whose badge grew a digit all show up here and nowhere else.
  const line = await pg.evaluate(() => {
    const row = document.getElementById('tabs');
    const on = row.querySelector('.acctab.on');
    const r = row.getBoundingClientRect(), t = on.getBoundingClientRect();
    return {
      tw: parseFloat(getComputedStyle(row).getPropertyValue('--tw')),
      tx: parseFloat(getComputedStyle(row).getPropertyValue('--tx')),
      w: t.width, x: t.left - r.left,
    };
  });
  ok(Math.abs(line.tw - line.w) < 1, `the underline is exactly the lit tab's width (${line.tw.toFixed(1)})`);
  ok(Math.abs(line.tx - line.x) < 1, 'and sits exactly under it');

  // GATED, the way the old step rail was: nothing to open until there is
  // something behind it.
  ok(await pg.locator('.acctab[data-tab="2"]').evaluate((el) => el.disabled), 'the drawings tab is shut with no drawings');
  ok(await pg.locator('.acctab[data-tab="3"]').evaluate((el) => el.disabled), 'the colours tab is shut with nothing picked');
  await pg.locator('.acctab[data-tab="2"]').click({ force: true });
  ok(await pg.locator('#p1').isVisible(), 'and tapping a shut tab leaves her where she was');

  // A BUTTON IS ONLY AS WIDE AS ITS WORDS — never a slab.
  const wide = await pg.evaluate(() => {
    const box = document.querySelector('.wrap').getBoundingClientRect().width;
    return ['#draw', '#trace', '#again', '#apply', '#reset'].map((s) => {
      const el = document.querySelector(s);
      return { s, frac: el ? el.getBoundingClientRect().width / box : 0 };
    });
  });
  const slab = wide.filter((w) => w.frac > 0.62);
  ok(slab.length === 0, `no button is a full-width slab${slab.length ? ' — ' + slab.map((w) => w.s).join(', ') : ''}`);

  // THE PILL OWNS THE TOP-RIGHT CORNER (x 326-374 at 390pt). Nothing tappable
  // may sit under it — `elementFromPoint` is the only honest way to ask, and
  // the reserve here is the header row's own padding, not a guess.
  const corner = await pg.evaluate(() => {
    const help = document.getElementById('help').getBoundingClientRect();
    return { right: help.right, hit: (document.elementFromPoint(350, 40) || {}).id || '' };
  });
  ok(corner.right <= 326, `the "?" stops clear of the pill's column (right edge ${corner.right.toFixed(0)})`);
  ok(corner.hit !== 'help', 'and nothing tappable answers at the pill\'s own centre');

  // The mode chips swap the panes, and the help card floats rather than
  // pushing the page down under her thumb.
  await pg.locator('#mTrace').click();
  ok(await pg.locator('#paneTrace').isVisible() && !(await pg.locator('#paneDraw').isVisible()),
    'the mode chips swap what she is writing into');
  const before = await pg.locator('#tabs').evaluate((el) => el.getBoundingClientRect().top);
  await pg.locator('#help').click();
  await pg.waitForTimeout(80);
  ok(await pg.locator('#helpcard').isVisible(), 'the "?" opens the card');
  const after = await pg.locator('#tabs').evaluate((el) => el.getBoundingClientRect().top);
  ok(Math.abs(after - before) < 1, 'and it FLOATS — nothing under it moved');

  await b.close();
  done();
})();

function done() {
  console.log(failed ? `\n${failed} check${failed > 1 ? 's' : ''} failed` : '\n/vector wears the chats UI');
  process.exit(failed ? 1 : 0);
}
