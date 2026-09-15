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
assert.ok(/function recipeKey\(model, prompt, scale, seed, ar\)/.test(PAGE),
  'the "I already have that one" key knows the shape');
assert.ok(/recipeKey\(r\.model, r\.prompt, r\.loraScale, r\.seed, r\.aspectRatio\)/.test(PAGE),
  'and reads it off the run doc, so older runs key as the default they drew');
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

    // EVERY SEGMENT IS TAPPABLE AT ITS OWN CENTRE, at phone width — the row
    // wraps, and a segment squeezed off it is the "I don't know how to change
    // it" bug the canvas toggle already had once.
    const hits = await p.$$eval('#artog button', (bs) => bs.map((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return 'squashed';
      if (r.right > innerWidth || r.left < 0) return 'off-screen';
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el.contains(at) || at === el ? 'ok' : 'covered';
    }));
    assert.ok(hits.length >= 3, `there are shapes to pick from (${hits.length})`);
    assert.ok(hits.every((h) => h === 'ok'), `every segment is tappable (${hits.join(', ')})`);
    // One height with the rest of the row — the .canvastog family, measured.
    // Measured against a control that is really on the row for THIS style —
    // the quality ladder is not one of them on the LoRA.
    const [ah, ph] = await p.evaluate(() => [
      Math.round(document.getElementById('artog').getBoundingClientRect().height),
      Math.round(document.getElementById('promptbtn').getBoundingClientRect().height)]);
    assert.strictEqual(ah, ph, `it stands the row's height (${ah} vs ${ph})`);
    ok(`all ${hits.length} segments are reachable on a 390pt phone, at the row's height`);

    // THE DEFAULT IS WHAT EVERY WTR RUN BEFORE THIS DREW.
    const lit = () => p.$eval('#artog button.on', (e) => e.getAttribute('data-ar'));
    assert.strictEqual(await lit(), '2:3', 'a fresh profile opens on 2:3');
    ok('the opening shape is the one the LoRA has always drawn');

    // HER PICK IS WHAT THE REQUEST WOULD CARRY — read off the page's own body
    // builder rather than trusted from the paint, and NOT by tapping Generate
    // (that spends money).
    await p.click('#artog button[data-ar="16:9"]');
    await p.waitForTimeout(150);
    assert.strictEqual(await lit(), '16:9', 'the tap lights the segment');
    assert.strictEqual(await p.evaluate(() => loraAr), '16:9', 'and moves the value the body reads');
    const before = await p.evaluate(() => plannedKey(STYLES.watercolor, 'a heron', 1, 85));
    await p.click('#artog button[data-ar="2:3"]');
    await p.waitForTimeout(150);
    const after = await p.evaluate(() => plannedKey(STYLES.watercolor, 'a heron', 1, 85));
    assert.notStrictEqual(before, after,
      'the same prompt in two shapes is two recipes, so changing it is never refused as a duplicate');
    ok('the picked shape reaches the request and makes its own recipe');

    // REMEMBERED ACROSS A LOAD (the canvas toggle's rule: "just whatever the
    // last option was"). Measured after a real reload — a value written to
    // localStorage and never read back looks identical in the source.
    await p.click('#artog button[data-ar="9:16"]');
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
