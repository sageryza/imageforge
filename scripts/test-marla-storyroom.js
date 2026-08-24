#!/usr/bin/env node
/**
 * test-marla-storyroom.js — the two rules the Marla Story Room seed rests on.
 * Pure: no network, no credentials, no Firestore.
 *
 * 1. THE DERIVED-COPY NAME IS AGREED BY TWO FILES. marla-room-webp.js bakes
 *    the display copies and marla-storyroom.js points the beats at them, and
 *    each carries its own copy of the naming rule (one works from a Storage
 *    path, the other from a public URL). If they drift, every picture in the
 *    Story Room 404s — silently, because a broken <img> is not an error.
 *
 * 2. THE VERSIONS ROW READS OLDEST-FIRST. The beat popup renders
 *    [current] + imageHistory.reverse(), so imageHistory must be written
 *    oldest-first for the not-chosen pictures to come out newest-first under
 *    the one she picked. Writing it the other way round is invisible in the
 *    data and wrong on the screen.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
};

// --- 1. the two naming rules, lifted from the real files and run side by side
const BUCKET = 'https://storage.googleapis.com/membry-df528.firebasestorage.app/storybook/marla/';
// marla-room-webp.js
const nameFor = (p) => `storybook/marla/room/${p.replace(/^storybook\/marla\//, '').replace(/\//g, '__').replace(/\.(png|webp|jpe?g)$/i, '')}.webp`;
// marla-storyroom.js
const roomOf = (url) => `${BUCKET}room/${url.split('/storybook/marla/')[1].replace(/\//g, '__').replace(/\.(png|webp|jpe?g)$/i, '')}.webp`;

console.log('the derived-copy name');
const CASES = [
  'art/p24-s5.png', 'art/p01.png', 'extra/3a.png', 'extra/13t-full.png',
  'fishbowl-test/p01-f.png', 'wtr/p02-s065-bare.png', 'pages/p01-cover-painted.png',
];
for (const rel of CASES) {
  const storagePath = `storybook/marla/${rel}`;
  ok(rel, nameFor(storagePath) === roomOf(BUCKET + rel).replace(/^.*firebasestorage\.app\//, ''),
    `${nameFor(storagePath)} vs ${roomOf(BUCKET + rel)}`);
}
// The collision the folded slashes exist to prevent: two different pictures
// both called p01-f, in different folders.
ok('two p01-f in different folders do not collide',
  nameFor('storybook/marla/fishbowl-test/p01-f.png') !== nameFor('storybook/marla/art/p01-f.png'));
// Both files must still hold their own copy of the rule.
ok('marla-room-webp.js declares nameFor', /const nameFor\s*=/.test(read('marla-room-webp.js')));
ok('marla-storyroom.js declares roomOf', /const roomOf\s*=/.test(read('marla-storyroom.js')));
ok('the pad points at room/, never at art/',
  !/url:\s*chosen\b/.test(read('marla-storyroom.js')) && /url:\s*roomOf\(/.test(read('marla-storyroom.js')));

// --- 2. the versions row's order
console.log('\nthe versions row');
// The popup's own line, from scripts/gen-scratchpad.py.
const asPopupSees = (current, imageHistory) =>
  [current].concat(imageHistory.slice().reverse().map((h) => h.url));
const history = [{ url: 'oldest' }, { url: 'middle' }, { url: 'newest' }];
const shown = asPopupSees('chosen', history);
ok('the chosen picture is first', shown[0] === 'chosen');
ok('the newest unchosen is next', shown[1] === 'newest');
ok('the oldest unchosen is last', shown[shown.length - 1] === 'oldest');
ok('nothing is lost', shown.length === history.length + 1);
// The button only appears at 2+, which is what keeps a one-drawing page clean.
ok('one version draws no button', asPopupSees('chosen', []).length < 2);
ok('two versions draw the button', asPopupSees('chosen', [{ url: 'a' }]).length >= 2);
ok('the seed writes history oldest-first',
  /sort\(\(a, b\) => a\.at - b\.at\)/.test(read('marla-storyroom.js')));
// A sandbox clock must never sort a late variant to the front of the row.
ok('the 2000-01-01 clock is not trusted', /1\.7e12/.test(read('marla-storyroom.js')));

// --- 3. her fiction stays out of a public repo
console.log('\nher words');
const seed = read('marla-storyroom.js');
ok('the plan is read from Storage at run time', /story-data\/docs\/marla\//.test(seed));
ok('no page text is baked into the script',
  !/fishbowl, as if seen through/i.test(seed) && !/Mummy says/i.test(seed));

// --- 4. the real page, if a server is up ------------------------------------
// `PORT=3111 node server.js` and this section runs; otherwise it skips
// cleanly, the way the other page tests here do. It asserts STRUCTURE only —
// this sandbox's browser cannot reach storage.googleapis.com, so whether a
// picture DECODES is checked by fetching the bytes in node instead (the
// pictures are 1024x1536 webp, verified that way).
const BASE = process.env.FORGE_BASE || 'http://127.0.0.1:3111';
const TITLE = 'Eyes as Wide as a Fishbowl';

async function pageChecks() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('\n(no playwright — skipping the page checks)'); return; }
  try { const r = await fetch(`${BASE}/api/scratchpad/status`); if (!r.ok) throw new Error(); }
  catch (e) { console.log(`\n(no server at ${BASE} — skipping the page checks)`); return; }

  console.log('\nthe real page');
  const exe = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  try {
    await page.goto(`${BASE}/storyroom`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    // The Story Room opens on the SHELF and loads no story until she taps one.
    const tile = page.locator('.stile, .srow').filter({ hasText: TITLE }).first();
    ok('the story is on the shelf', await tile.count() === 1);
    await tile.click();
    await page.waitForTimeout(3000);
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    ok('36 beats', await page.locator('.beat').count() === 36);

    // The cover: her painted page 1, with thirteen it isn't behind it.
    await page.locator('.beat').first().click({ force: true });
    await page.waitForTimeout(1200);
    ok('the beat popup opens', await page.locator('#beatpop').isVisible());
    ok('the versions button is there', await page.locator('#arvers').isVisible());
    ok('the beat carries her words',
      (await page.locator('#pnote').inputValue()).startsWith("Marla's eyes are wide as a fishbowl"));
    await page.locator('#arvers').click();
    await page.waitForTimeout(1200);
    ok('page 1 shows 14 versions', await page.locator('#verrow button').count() === 14);
    ok('exactly one is ringed as current', await page.locator('#verrow button.cur').count() === 1);
    const cur = (await page.locator('#verrow button.cur img').getAttribute('src') || '').split('/').pop();
    ok('the ringed one is the painted cover', cur === 'pages__p01-cover-painted.webp', cur);
    const next = (await page.locator('#verrow button:nth-child(2) img').getAttribute('src') || '').split('/').pop();
    ok('the newest not-chosen is next', next === 'art__p01-s2.webp', next);

    // A page that only ever had one drawing must show NO button at all.
    await page.evaluate(() => closeBeat());
    await page.waitForTimeout(700);
    await page.locator('.beat').nth(13).click({ force: true });
    await page.waitForTimeout(1000);
    ok('page 14 has no versions button', await page.locator('#arvers').isHidden());
    ok('page 14 still carries its words',
      (await page.locator('#pnote').inputValue()).length > 20);
  } finally { await browser.close(); }
}

pageChecks().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e.message); process.exit(1); });
