#!/usr/bin/env node
/**
 * WTR HAS SHAPE OPTIONS (2026-09-15, Sophie: "add aspect ratio options to wtr
 * in playground").
 *
 * The LoRA route has accepted `aspect_ratio` since it was written and has
 * always defaulted it to 2:3 — so every WTR picture in her feed is portrait
 * because the PAGE never offered the choice. The toggle is the missing half.
 *
 * Every page check is a MEASUREMENT, because the three ways this ships broken
 * all look identical in the source: a toggle that paints but sends the old
 * default, a toggle that sends the shape but is refused as "you already have
 * that one" the moment she changes it, and a toggle that forgets her pick on
 * the next load.
 *
 * Needs a server: PORT=3111 node server.js. Skips cleanly without one, and
 * without playwright. Makes NO model call — it never taps Generate.
 *
 *   node scripts/test-playground-lora-shape.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let n = 0;
const ok = (name) => { n++; console.log('  ok  ' + name); };
const root = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(root, 'public', 'promptlab.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

console.log('\nplayground — the LoRA\'s shape\n');

// ---- static contracts, no browser needed -------------------------------

// The ratio really rides the request. A toggle that paints and sends nothing
// is the failure this file exists for.
assert.ok(/aspect_ratio: loraAr,/.test(PAGE), 'the replicate body carries the picked ratio');
assert.ok(!/engine: 'replicate', count: OUTPUTS, seed: seed, key: key, ar: '2:3'/.test(PAGE),
  'and the waiting slots no longer hardcode 2:3');
// A DROP DOWN (2026-09-15, Sophie: "drop down") — it shipped as a segmented
// toggle for one turn. Pinned so nothing walks it back to five segments on
// the row, and so the select really wears the style picker's box rather than
// the browser's default one.
assert.ok(/<select id="artog"/.test(PAGE), 'the shape control is a select');
assert.ok(/#stylepick, #artog \{ appearance: none/.test(PAGE),
  'and it wears the style picker\'s own box, one rule not two');
ok('the shape she picked is what is sent, and what the placeholders wear');

// The shape word map is ONE map in two files (the panels test pins them equal
// — this one pins that the new ratios really got words, or her search stops
// finding those runs by name).
const shapeWord = (src) => {
  const m = /PL_SHAPE_WORD = (\{[\s\S]*?\})/.exec(src);
  return m ? eval('(' + m[1] + ')') : null;                // eslint-disable-line no-eval
};
const swPage = shapeWord(PAGE), swServer = shapeWord(SERVER);
assert.ok(swPage && swServer, 'both copies parse');
assert.strictEqual(JSON.stringify(swPage), JSON.stringify(swServer),
  'PL_SHAPE_WORD is the same map in server.js and promptlab.html');
assert.strictEqual(swPage['16:9'], 'wide', 'the wide one has a word');
assert.strictEqual(swPage['9:16'], 'tall', 'and so does the tall one');
ok('every shape on the toggle is searchable by a word as well as its ratio');

// An unknown ratio must never reach Replicate — it fails the prediction, which
// costs a round trip and files a failed run where the default would have drawn.
const ars = /const PL_LORA_ARS = (\[[^\]]*\])/.exec(SERVER);
assert.ok(ars, 'the server keeps the accepted list');
const ACCEPTED = eval('(' + ars[1] + ')');                 // eslint-disable-line no-eval
assert.ok(/PL_LORA_ARS\.includes\(wantAr\) \? wantAr : '2:3'/.test(SERVER),
  'and checks the body against it, falling back to the default');
const offered = eval('(' + /var LORA_ARS = (\[[^\]]*\])/.exec(PAGE)[1] + ')'); // eslint-disable-line no-eval
offered.forEach((a) => assert.ok(ACCEPTED.includes(a), `the server accepts ${a}`));
ok(`every one of the ${offered.length} shapes on offer is one the server accepts`);

// The recipe key: changing the shape must make a new picture, not a refusal.
assert.ok(/function recipeKey\(model, prompt, scale, seed, ar, suffix\)/.test(PAGE),
  'the "I already have that one" key knows the shape and the tail');
assert.ok(/recipeKey\(r\.model, r\.prompt, r\.loraScale, r\.seed, r\.aspectRatio,/.test(PAGE),
  'and reads it off the run doc, so older runs key as the default they drew');
// The tail (2026-09-23): taking "White background" off her words is a new
// picture, so the key must differ — run the page's own two functions.
{
  const grab = (name) => new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}').exec(PAGE)[0];
  const rk = new Function('LORA_AR_DEFAULT', grab('sameRunKey') + grab('recipeKey') + 'return recipeKey;')('2:3');
  const a = rk('m', 'mailman on a ladder', 1, 91, '2:3', 'White background');
  assert.notStrictEqual(a, rk('m', 'mailman on a ladder', 1, 91, '2:3', ''), 'removing the tail is a new recipe');
  assert.strictEqual(a, rk('m', 'mailman on a ladder.', 1, 91, '2:3', ' White background '), 'same recipe still dedupes');
}
ok('a shape change is a different recipe, not a duplicate');

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.log('  --  page: skipped (no playwright)\n'); return done(); }
  const base = process.env.PLAYGROUND_TEST_URL || 'http://localhost:3111';
  try {
    const r = await fetch(base + '/api/promptlab/styles');
    if (!r.ok) throw new Error(String(r.status));
  } catch (e) {
    console.log(`  --  page: skipped (no server at ${base})\n`); return done();
  }

  let b;
  try { b = await chromium.launch(); }
  catch {
    const root2 = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    const dir = fs.readdirSync(root2).filter((d) => d.startsWith('chromium-')).sort().pop();
    b = await chromium.launch({ executablePath: `${root2}/${dir}/chrome-linux/chrome` });
  }
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(base + '/playground', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('#stylepick option').length > 1,
      { timeout: 15000 });
    await p.selectOption('#stylepick', 'watercolor');
    await p.waitForTimeout(300);

    // IT IS ON SCREEN ON WTR AND OFF EVERYWHERE ELSE — the canvas toggle is
    // gpt-image-2's tier canvases and this is the LoRA's shape; a page showing
    // both at once is offering one shape twice.
    assert.strictEqual(await p.isVisible('#artog'), true, 'the shape toggle is on WTR');
    assert.strictEqual(await p.isVisible('#canvastog'), false, 'and the canvas toggle is not');
    await p.selectOption('#stylepick', 'chatgpt');
    await p.waitForTimeout(250);
    assert.strictEqual(await p.isVisible('#artog'), false, 'it comes off a gpt style');
    assert.strictEqual(await p.isVisible('#canvastog'), true, 'where the canvas toggle takes over');
    ok('exactly one shape control is on screen for the style she is on');

    await p.selectOption('#stylepick', 'watercolor');
    await p.waitForTimeout(250);

    // THE BOX IS REACHABLE AT PHONE WIDTH — the row wraps, and a control
    // squeezed off it is the "I don't know how to change it from portrait to
    // square" bug the canvas toggle already had once.
    const hit = await p.evaluate(() => {
      const el = document.getElementById('artog');
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return 'squashed';
      if (r.right > innerWidth || r.left < 0) return 'off-screen';
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el.contains(at) || at === el ? 'ok' : 'covered';
    });
    assert.strictEqual(hit, 'ok', `the dropdown is tappable at its own centre (${hit})`);
    // Measured against a control that is really on the row for THIS style —
    // the quality ladder is not one of them on the LoRA.
    const [ah, ph] = await p.evaluate(() => [
      Math.round(document.getElementById('artog').getBoundingClientRect().height),
      Math.round(document.getElementById('promptbtn').getBoundingClientRect().height)]);
    assert.strictEqual(ah, ph, `it stands the row's height (${ah} vs ${ph})`);
    // AN OPTION IS THE RATIO AND NOTHING ELSE (2026-09-15, Sophie: "no wide",
    // then "noooo just 9:16"). They carried the word beside the number for one
    // turn. Pinned as an exact list, so neither the words nor a dropped shape
    // can creep back in.
    const opts = await p.$$eval('#artog option', (os) => os.map((o) => o.textContent.trim()));
    assert.deepStrictEqual(opts, ['9:16', '2:3', '1:1', '3:2', '16:9'],
      `the options are bare ratios (${opts.join(' | ')})`);
    ok(`the dropdown offers ${opts.length} shapes as bare ratios, reachable at the row's height`);

    // THE DEFAULT IS WHAT EVERY WTR RUN BEFORE THIS DREW.
    const lit = () => p.$eval('#artog', (e) => e.value);
    assert.strictEqual(await lit(), '2:3', 'a fresh profile opens on 2:3');
    ok('the opening shape is the one the LoRA has always drawn');

    // HER PICK IS WHAT THE REQUEST WOULD CARRY — read off the page's own body
    // builder rather than trusted from the paint, and NOT by tapping Generate
    // (that spends money).
    await p.selectOption('#artog', '16:9');
    await p.waitForTimeout(150);
    assert.strictEqual(await lit(), '16:9', 'the pick sticks in the box');
    assert.strictEqual(await p.evaluate(() => loraAr), '16:9', 'and moves the value the body reads');
    const before = await p.evaluate(() => plannedKey(STYLES.watercolor, 'a heron', 1, 85));
    await p.selectOption('#artog', '2:3');
    await p.waitForTimeout(150);
    const after = await p.evaluate(() => plannedKey(STYLES.watercolor, 'a heron', 1, 85));
    assert.notStrictEqual(before, after,
      'the same prompt in two shapes is two recipes, so changing it is never refused as a duplicate');
    ok('the picked shape reaches the request and makes its own recipe');

    // REMEMBERED ACROSS A LOAD (the canvas toggle's rule: "just whatever the
    // last option was"). Measured after a real reload — a value written to
    // localStorage and never read back looks identical in the source.
    await p.selectOption('#artog', '9:16');
    await p.waitForTimeout(150);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('#stylepick option').length > 1,
      { timeout: 15000 });
    await p.waitForTimeout(400);
    assert.strictEqual(await lit(), '9:16', 'her shape came back after a reload');
    ok('the shape she last picked is the one she comes back to');
  } finally { await b.close(); }
  done();
})().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });

function done() { console.log(`\n${n} checks passed.\n`); }
