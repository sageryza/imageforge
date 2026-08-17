#!/usr/bin/env node
/* Tests page-templates.js — the stock deck/grid templates — pure, no network.
 *
 *   node scripts/test-page-templates.js
 *
 * Pins the contract:
 *   1. validation: forced structure (no HTML through, ids stable + unique,
 *      states cleaned, storage img becomes the item's asset identity)
 *   2. rendering: the stock page carries the whole Compare kit by
 *      construction, data inlined safely (no </script> escape)
 *   3. grouping: exact-prompt ladders auto-group (sorted low→high) and
 *      near-prompts are only FLAGGED as variant candidates — never grouped
 *      into a ladder (the dream-feed rule: the chat decides those)
 */
const assert = require('assert');
const {
  validateTemplate, renderTemplatePage, groupAssetVariants, parseCaption,
  assignVoiceSegments,
} = require('../page-templates');

let n = 0;
function ok(name, fn) { fn(); n += 1; console.log(`PASS: ${name}`); }

const SG = 'https://storage.googleapis.com/deckfactory-43176.appspot.com';

// ── validation ──────────────────────────────────────────────────────────────
ok('deck: items required', () => {
  assert.strictEqual(validateTemplate('deck', {}).ok, false);
  assert.strictEqual(validateTemplate('nope', { items: [] }).ok, false);
});

ok('deck: ids derive from the storage filename and stay unique', () => {
  const v = validateTemplate('deck', { items: [
    { label: 'one', img: `${SG}/witch-school/assets/penny-01.png` },
    { label: 'two', img: `${SG}/other/penny-01.png` },
    { label: 'three', text: 'buy the blue kleenex' },
  ] });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.data.items[0].id, 'penny-01');
  assert.strictEqual(v.data.items[1].id, 'penny-01-2');   // same filename, still unique
  assert.strictEqual(v.data.items[2].id, 'three');        // label fallback
});

ok('a storage img becomes the asset identity; an external one does not', () => {
  const v = validateTemplate('deck', { items: [
    { label: 'a', img: `${SG}/x/a.png` },
    { label: 'b', img: 'https://example.com/b.png' },
  ] });
  assert.strictEqual(v.data.items[0].url, `${SG}/x/a.png`);
  assert.strictEqual(v.data.items[1].url, undefined);
});

ok('duplicate explicit ids are refused, not silently renamed', () => {
  const v = validateTemplate('deck', { items: [
    { id: 'a', label: 'x', text: 't' }, { id: 'a', label: 'y', text: 't' },
  ] });
  assert.strictEqual(v.ok, false);
  assert.match(v.error, /duplicate/);
});

ok('states clean to key+label pairs; fewer than 2 means default buttons', () => {
  const v = validateTemplate('deck', {
    items: [{ label: 'a', text: 't' }],
    states: [{ key: 'done', label: 'done' }, { key: 'progress', label: 'in progress' },
      { key: '', label: 'dropped' }],
  });
  assert.deepStrictEqual(v.data.states, [
    { key: 'done', label: 'done' }, { key: 'progress', label: 'in progress' }]);
  const v2 = validateTemplate('deck', {
    items: [{ label: 'a', text: 't' }], states: [{ key: 'done', label: 'done' }],
  });
  assert.strictEqual(v2.data.states, undefined);
});

ok('the aspect menu rides through validation; off-menu shapes are dropped', () => {
  const v = validateTemplate('deck', { aspect: 'square', items: [{ label: 'a', text: 't' }] });
  assert.strictEqual(v.data.aspect, 'square');
  const vp = validateTemplate('deck', { aspect: 'portrait', items: [{ label: 'a', text: 't' }] });
  assert.strictEqual(vp.data.aspect, 'portrait');
  const v2 = validateTemplate('grid', { aspect: 'wide', groups: [{ items: [{ label: 'a', text: 't' }] }] });
  assert.strictEqual(v2.data.aspect, undefined);
  // one card may pick its own shape off the same menu
  const vi = validateTemplate('deck', { aspect: 'square', items: [
    { label: 'a', text: 't', aspect: 'portrait' }, { label: 'b', text: 't', aspect: 'oval' }] });
  assert.strictEqual(vi.data.items[0].aspect, 'portrait');
  assert.strictEqual(vi.data.items[1].aspect, undefined);
});

ok('grid: groups validate and items count against one cap', () => {
  const v = validateTemplate('grid', { groups: [
    { label: 'Penny — which quality?', items: [
      { label: 'medium', img: `${SG}/a/p-med.png`, model: 'gpt-image-2', quality: 'medium' },
      { label: 'high', img: `${SG}/a/p-high.png`, model: 'gpt-image-2', quality: 'high' },
    ] },
  ] });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.data.groups[0].items.length, 2);
  assert.strictEqual(validateTemplate('grid', { groups: [{ items: [] }] }).ok, false);
});

// ── rendering ───────────────────────────────────────────────────────────────
ok('the stock page carries the whole kit and inlines data safely', () => {
  const v = validateTemplate('grid', { groups: [{ items: [
    { label: 'a</script><b>', img: `${SG}/a/a.png` }] }] });
  const html = renderTemplatePage({
    template: 'grid', title: 'Penny <quality> v1', chat: 'c', sheet: 'page-x', data: v.data,
  });
  assert.match(html, /\/compare\.css/);
  assert.match(html, /\/compare\.js/);
  assert.match(html, /\/grid\.js/);
  assert.match(html, /__grid\(window\.__pageData\)/);
  assert.match(html, /Penny &lt;quality&gt; v1<\/h1>/);
  assert.ok(!/<\/script><b>/.test(html), 'a </script> in data cannot break out');
  const deck = renderTemplatePage({ template: 'deck', title: 't', chat: 'c', sheet: 's',
    data: validateTemplate('deck', { items: [{ label: 'a', text: 'x' }] }).data });
  assert.match(deck, /\/judge\.js/);
  assert.match(deck, /__judge\(window\.__pageData\)/);
});

// ── grouping ────────────────────────────────────────────────────────────────
ok('caption parses MODEL · QUALITY and nothing else', () => {
  assert.deepStrictEqual(parseCaption('gpt-image-2 · medium'),
    { model: 'gpt-image-2', quality: 'medium' });
  assert.strictEqual(parseCaption('from some-chat'), null);
  assert.strictEqual(parseCaption(''), null);
});

const CONTENT = 'a woman in a yellow raincoat feeding crows on a park bench at dusk';
ok('same prompt + differing quality auto-groups into a ladder, low→high', () => {
  const { ladders } = groupAssetVariants([
    { url: 'u-high', prompt: 'gpt-image-2 · high', promptContent: CONTENT },
    { url: 'u-low', prompt: 'gpt-image-2 · low', promptContent: CONTENT },
    { url: 'u-med', prompt: 'gpt-image-2 · medium', promptContent: CONTENT },
  ]);
  assert.strictEqual(ladders.length, 1);
  assert.deepStrictEqual(ladders[0].items.map((i) => i.quality), ['low', 'medium', 'high']);
  assert.strictEqual(ladders[0].items[0].url, 'u-low');
});

ok('identical everything is a re-roll, not a ladder', () => {
  const { ladders } = groupAssetVariants([
    { url: 'u1', prompt: 'gpt-image-2 · medium', promptContent: CONTENT },
    { url: 'u2', prompt: 'gpt-image-2 · medium', promptContent: CONTENT },
  ]);
  assert.strictEqual(ladders.length, 0);
});

ok('near-identical prompts are FLAGGED as variants, never laddered', () => {
  const out = groupAssetVariants([
    { url: 'v1', prompt: 'gpt-image-2 · medium', promptContent: CONTENT },
    { url: 'v2', prompt: 'gpt-image-2 · medium',
      promptContent: CONTENT + ', handwritten diary text floating in the sky' },
  ]);
  assert.strictEqual(out.ladders.length, 0);
  assert.strictEqual(out.variants.length, 1);
  assert.strictEqual(out.variants[0].items.length, 2);
});

ok('unrelated prompts group nothing', () => {
  const out = groupAssetVariants([
    { url: 'a', prompt: 'gpt-image-2 · low', promptContent: 'a red fox in the snow' },
    { url: 'b', prompt: 'gpt-image-2 · low', promptContent: 'a lighthouse over a green sea at night' },
  ]);
  assert.strictEqual(out.ladders.length, 0);
  assert.strictEqual(out.variants.length, 0);
});

ok('audio and promptless assets never group', () => {
  const out = groupAssetVariants([
    { url: 'a', kind: 'audio', promptContent: CONTENT, prompt: 'x · low' },
    { url: 'b', prompt: 'gpt-image-2 · high' },
  ]);
  assert.strictEqual(out.ladders.length, 0);
});

// ── hands-free attribution ──────────────────────────────────────────────────
ok('a sentence lands on the card showing when the sentence STARTED', () => {
  // card a up at 0, card b at 5s, card c at 11s
  const tl = [{ item: 'a', at: 0 }, { item: 'b', at: 5000 }, { item: 'c', at: 11000 }];
  const per = assignVoiceSegments([
    { start: 0.4, text: 'love this one.' },
    { start: 4.6, text: 'the hat is wrong though.' },   // starts on a, finishes over b
    { start: 6.2, text: 'this one is better.' },
    { start: 12.0, text: 'skip it.' },
  ], tl);
  assert.strictEqual(per.a, 'love this one. the hat is wrong though.');
  assert.strictEqual(per.b, 'this one is better.');
  assert.strictEqual(per.c, 'skip it.');
});

ok('cards she said nothing on are absent; empty segments drop', () => {
  const per = assignVoiceSegments([
    { start: 0.2, text: '  ' }, { start: 7, text: 'only this.' },
  ], [{ item: 'a', at: 0 }, { item: 'b', at: 5000 }, { item: 'c', at: 9000 }]);
  assert.deepStrictEqual(per, { b: 'only this.' });
});

ok('speech before the deck (negative clock skew) still lands on the first card', () => {
  const per = assignVoiceSegments([{ start: 0, text: 'hello.' }],
    [{ item: 'x', at: 250 }]);
  assert.deepStrictEqual(per, { x: 'hello.' });
});

ok('an empty timeline attributes nothing rather than guessing', () => {
  assert.deepStrictEqual(assignVoiceSegments([{ start: 1, text: 'words' }], []), {});
});

console.log(`all ${n} checks passed`);
