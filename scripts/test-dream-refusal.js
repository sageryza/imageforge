#!/usr/bin/env node
// Tests for the safety-refusal path added 2026-08-06 (the "Mommy Evaluates Kid"
// render): a refusal must be treated as terminal rather than retried, and a
// refused page must get exactly ONE softened redraw.
//   node scripts/test-dream-refusal.js
const assert = require('assert');
const M = require('../movies.js');

const REFUSAL = new Error('Your request was rejected by the safety system. If you believe '
  + 'this is an error, contact us at help.openai.com and include the request ID req_123. '
  + 'safety_violations=[sexual].');
const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(['ok', name]); }
  catch (err) { results.push(['FAIL', `${name} — ${err.message}`]); }
};

(async () => {
  await test('isSafetyRefusal recognises the real OpenAI refusal', () => {
    assert.strictEqual(M.isSafetyRefusal(REFUSAL), true);
    assert.strictEqual(M.isSafetyRefusal(new Error('content policy violation')), true);
    assert.strictEqual(M.isSafetyRefusal(new Error('moderation_blocked')), true);
  });

  await test('isSafetyRefusal leaves real hiccups alone', () => {
    for (const m of ['socket hang up', 'ETIMEDOUT', 'gpt-image-2 returned no image',
      'Rate limit reached', '500 Internal Server Error']) {
      assert.strictEqual(M.isSafetyRefusal(new Error(m)), false, m);
    }
  });

  await test('mergeSoftened keeps shape and falls back per string', () => {
    const orig = { context: 'a', text: 'b', captions: ['c', 'd'] };
    assert.deepStrictEqual(
      M.mergeSoftened(orig, { context: 'A', text: '  ', captions: ['C', ''] }),
      { context: 'A', text: 'b', captions: ['C', 'd'] });
    // wrong array length / missing keys / junk → original survives intact
    assert.deepStrictEqual(M.mergeSoftened(orig, { captions: ['x'] }), orig);
    assert.deepStrictEqual(M.mergeSoftened(orig, null), orig);
    assert.deepStrictEqual(M.mergeSoftened(orig, { context: 42 }), orig);
    // nested objects (the legacy 2x2 panel bundle)
    const panels = { panels: [{ scene: 's', caption: 'c' }] };
    assert.deepStrictEqual(
      M.mergeSoftened(panels, { panels: [{ scene: 'S', caption: null }] }),
      { panels: [{ scene: 'S', caption: 'c' }] });
  });

  await test('drawPagesResilient does not retry a refused page', async () => {
    let calls = 0;
    const drawOne = async () => { calls++; const e = new Error('refused'); e.terminal = true; throw e; };
    await assert.rejects(
      () => M.drawPagesResilient(1, drawOne, async () => {}, async () => {}),
      /1 of 1 page couldn't be drawn/);
    assert.strictEqual(calls, 1, `expected 1 attempt, got ${calls}`);
  });

  await test('drawPagesResilient still retries a real failure 3 rounds', async () => {
    let calls = 0;
    const drawOne = async () => { calls++; throw new Error('socket hang up'); };
    const started = Date.now();
    await assert.rejects(
      () => M.drawPagesResilient(1, drawOne, async () => {}, async () => {}),
      /after 3 rounds of retries/);
    assert.strictEqual(calls, 3, `expected 3 attempts, got ${calls}`);
    assert.ok(Date.now() - started > 60000, 'the real-failure path should still pause between rounds');
  });

  await test('a refused page still lets its siblings through', async () => {
    const drawOne = async i => {
      if (i === 2) { const e = new Error('refused'); e.terminal = true; throw e; }
      return { url: `page${i}` };
    };
    await assert.rejects(
      () => M.drawPagesResilient(3, drawOne, async () => {}, async () => {}),
      /1 of 3 pages couldn't be drawn/);
  });

  await test('a refused page is redrawn exactly once, with the softened words', async () => {
    const drawn = [];
    const draw = async b => {
      drawn.push(b.text);
      if (b.text.includes('breasts')) throw REFUSAL;
      return { url: 'page1' };
    };
    const soften = async b => ({ ...b, text: b.text.replace('milk from her breasts', 'nursing') });
    const out = await M.softenOnRefusal({ text: 'she fed it milk from her breasts' }, draw, soften);
    assert.deepStrictEqual(out, { url: 'page1', softened: true });
    assert.deepStrictEqual(drawn, ['she fed it milk from her breasts', 'she fed it nursing']);
  });

  await test('a second refusal gives up with a plain reason (no third draw)', async () => {
    let draws = 0;
    const draw = async () => { draws++; throw REFUSAL; };
    await assert.rejects(
      () => M.softenOnRefusal({ text: 'x' }, draw, async b => ({ ...b, text: 'y' })),
      /safety filter refused this part of the dream/);
    assert.strictEqual(draws, 2, `expected 2 draws, got ${draws}`);
  });

  await test('an unsoftenable page fails without a pointless redraw', async () => {
    let draws = 0;
    const draw = async () => { draws++; throw REFUSAL; };
    await assert.rejects(
      () => M.softenOnRefusal({ text: 'x' }, draw, async () => null),
      /safety filter refused/);
    assert.strictEqual(draws, 1, `expected 1 draw, got ${draws}`);
  });

  await test('a network error is NOT softened — it goes to the retry rounds', async () => {
    let softenCalls = 0;
    const draw = async () => { throw new Error('socket hang up'); };
    await assert.rejects(
      () => M.softenOnRefusal({ text: 'x' }, draw, async () => { softenCalls++; return { text: 'y' }; }),
      /socket hang up/);
    assert.strictEqual(softenCalls, 0, 'softening must not run for a network failure');
  });

  await test('the refusal error is marked terminal so rounds skip it', async () => {
    const err = await M.softenOnRefusal({ text: 'x' }, async () => { throw REFUSAL; },
      async () => null).catch(e => e);
    assert.strictEqual(err.terminal, true);
  });

  const failed = results.filter(r => r[0] !== 'ok');
  results.forEach(([s, n]) => console.log(`${s === 'ok' ? '  ok  ' : ' FAIL '} ${n}`));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
