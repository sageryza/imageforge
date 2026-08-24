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
assert.ok(/ct\.style\.display = gpt \? 'flex' : 'none'/.test(PAGE),
  'the canvas toggle stays gpt-only');
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
  catch { b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(base + '/playground', { waitUntil: 'networkidle' });
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
  } finally { await b.close(); }
  done();
})().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });

function done() { console.log(`\n${n} checks passed.\n`); }
