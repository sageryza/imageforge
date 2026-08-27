#!/usr/bin/env node
/**
 * THE PROMPT PANEL IS FOR EVERY STYLE, INCLUDING THE LoRA.
 *
 * Sophie, 2026-08-24: "there's no way to see the style prompt in the
 * playground". She was right, and the reason was structural: the panel, the
 * button and the stored override all keyed off `S.gptStyle`, so the WTR LoRA —
 * which the page OPENS ON — fell through to null and the whole panel was
 * hidden. WTR does wrap her words (a trigger in front, a tail after) and both
 * were invisible on the one tile she sees first.
 *
 * Needs a server: PORT=3111 node server.js. Skips cleanly without one, and
 * without playwright. Makes NO model call — it never taps Generate.
 *
 *   node scripts/test-playground-prompt-panel.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let n = 0;
const ok = (name) => { n++; console.log('  ok  ' + name); };
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'public', 'promptlab.html'), 'utf8');

console.log('\nplayground — the prompt panel\n');

// ---- static contracts, no browser needed -------------------------------
assert.ok(/function overKey\(k\)/.test(PAGE), 'there is one key helper');
assert.ok(/S\.gptStyle \|\| k/.test(PAGE),
  'a style with no gptStyle is keyed by its own key, so a LoRA can carry an edit');
ok('an edit has somewhere to live for every style');

assert.ok(!/if \(!promptOpen \|\| !isGpt\(styleKey\)\)/.test(PAGE),
  'the panel is no longer gated on isGpt');
assert.ok(/if \(!promptOpen \|\| !bakedFor\(styleKey\)\)/.test(PAGE),
  'it is gated on having a wrapper to show');
assert.ok(!/pb\.hidden = !gpt/.test(PAGE), 'the button is no longer hidden on the LoRA');
ok('the panel and its button are gated on having a wrapper, not on the engine');

// The canvas and tier toggles are still gpt-only — the LoRA has one output
// size and rides aspect_ratio, so those would be controls that change nothing.
// Same reasoning now covers a PANELS grid that PINS its cell shape (the 2
// option is landscape): a control that decides nothing comes off.
assert.ok(/ct\.style\.display = \(gpt && canvasApplies\(\)\) \? 'flex' : 'none'/.test(PAGE),
  'the canvas toggle stays gpt-only');
assert.ok(/function canvasApplies\(\) \{ return !\(onPanels\(\) && gridPin\(curGrid\(\)\)\); \}/.test(PAGE),
  'and stands down on a grid that pins its own cell shape');
ok('the size controls stay gpt-only — they would change nothing on a LoRA');

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
    // The bundled browser lives in a VERSIONED directory here, so the path is
    // found rather than spelled — the old hardcoded one names a folder, not
    // an executable, and never launched anything.
    const fs2 = require('fs');
    const root2 = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    const dir = fs2.readdirSync(root2).filter((d) => d.startsWith('chromium-')).sort().pop();
    b = await chromium.launch({ executablePath: `${root2}/${dir}/chrome-linux/chrome` });
  }
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    // NOT networkidle: the feed keeps polling, so idle never arrives and the
    // whole page half times out instead of running.
    await p.goto(base + '/playground', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('#stylepick option').length > 1,
      { timeout: 15000 });

    // THE TILE THE PAGE OPENS ON is the one that was broken — assert it by
    // name rather than assuming, because the default is hers to change.
    const opened = await p.$eval('#stylepick', (e) => e.value);
    const btn = () => p.$eval('#promptbtn', (e) => e.offsetParent !== null);
    assert.strictEqual(await btn(), true,
      `the Prompt button is visible on the style the page opens on (${opened})`);
    ok(`the button is there on open (${opened})`);

    const styles = await p.$$eval('#stylepick option', (o) => o.map((x) => x.value));
    for (const st of styles) {
      await p.selectOption('#stylepick', st);
      await p.waitForTimeout(250);
      assert.strictEqual(await btn(), true, `Prompt button visible on ${st}`);
    }
    ok(`the button is there on all ${styles.length} styles`);

    // and the panel actually SAYS something for the LoRA
    await p.fill('#prompt', 'a heron on a fence post');
    await p.selectOption('#stylepick', 'watercolor');
    await p.waitForTimeout(250);
    await p.click('#promptbtn');
    await p.waitForTimeout(300);
    const panel = await p.$eval('#promptpanel', (el) => ({
      labels: [...el.querySelectorAll('.plab')].map((x) => x.textContent.trim()),
      added: [...el.querySelectorAll('.added')].map((x) => x.textContent.trim()),
      areas: [...el.querySelectorAll('textarea')].map((x) => x.value.trim()),
      yours: [...el.querySelectorAll('.yours')].map((x) => x.textContent.trim()),
    }));
    assert.ok(panel.labels.includes('Before your words'), 'it shows what goes in front');
    assert.ok(panel.labels.includes('After your words'), 'and what goes after');
    assert.ok(panel.added.includes('wtr'),
      `the LoRA trigger is shown: ${JSON.stringify(panel.added)}`);
    assert.ok(panel.areas.some((v) => /white background/i.test(v)),
      `the LoRA tail is shown and editable: ${JSON.stringify(panel.areas)}`);
    assert.ok(panel.yours.some((v) => v.includes('heron')), 'her words sit between them');
    ok('the LoRA panel shows its trigger, her words, and its editable tail');

    // The trigger is NOT editable — changing it would quietly stop the LoRA
    // being selected at all.
    assert.ok(!panel.areas.some((v) => v === 'wtr'), 'the trigger is not an editable field');
    ok('the trigger is shown, not offered for editing');

    // TYPING IN IT MUST NOT CLOSE IT, AND THE EDIT MUST SURVIVE A RELOAD
    // (2026-08-24, Sophie: "can you make sure that the style prompts are
    // saving in playground now?"). syncControls runs on every save, and it
    // carried a gpt-only line that shut the panel — on WTR, the tile the page
    // opens on, the box vanished on the first character. The value was stored
    // the whole time, which is exactly what makes this read as "not saving":
    // nothing on screen says otherwise. So the test TYPES, which the old one
    // never did.
    const tail = () => p.$eval('#promptpanel textarea[data-part="suffix"]', (e) => e.value)
      .catch(() => null);
    const house = await tail();
    await p.fill('#promptpanel textarea[data-part="suffix"]', `${house}, my own tail`);
    await p.waitForTimeout(250);
    assert.strictEqual(await p.$eval('#promptpanel', (e) => e.className), 'on',
      'the panel is still open after typing in it');
    assert.strictEqual(await tail(), `${house}, my own tail`, 'and still holds what she typed');
    ok('typing in the style prompt leaves the panel open');

    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('#stylepick option').length > 1,
      { timeout: 15000 });
    await p.waitForTimeout(500);
    await p.click('#promptbtn');
    await p.waitForTimeout(300);
    assert.strictEqual(await tail(), `${house}, my own tail`, 'her wording came back after a reload');
    assert.ok(await p.$eval('#promptbtn', (e) => e.classList.contains('edited')),
      'and the style button says it is carrying her wording');
    ok('an edited style prompt survives a reload');

    // Back to the house text on every box she HAS = not an edit at all. A LoRA
    // draws one box, so a comparison that reads the missing half as undefined
    // can never be equal and the override would stick forever.
    await p.fill('#promptpanel textarea[data-part="suffix"]', house);
    await p.waitForTimeout(250);
    assert.strictEqual(
      await p.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('promptlab_prompt_') === 0).length),
      0, 'typing the house wording back drops the override rather than storing a twin');
    ok('the house wording is not stored as an edit of hers');
  } finally { await b.close(); }
  done();
})().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });

function done() { console.log(`\n${n} checks passed.\n`); }
