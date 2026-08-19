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

ok('clean drops the h1 — the Review Queue opens straight onto the cards', () => {
  const data = validateTemplate('deck', { items: [{ label: 'a', text: 'x' }] }).data;
  const clean = renderTemplatePage({ template: 'deck', title: 'Batch 2', chat: 'c',
    sheet: 's', data, clean: true });
  assert.ok(!/<h1>/.test(clean), 'no h1 in a clean render');
  assert.match(clean, /<title>Batch 2<\/title>/, 'the <title> still names it');
  assert.match(clean, /__judge\(window\.__pageData\)/, 'the deck itself is intact');
  // a clean GRID loses its h1 the same way (it keeps its pill — it scrolls)
  const g = validateTemplate('grid', { groups: [{ items: [{ label: 'a', img: `${SG}/a/a.png` }] }] });
  assert.ok(!/<h1>/.test(renderTemplatePage({ template: 'grid', title: 't', chat: 'c',
    sheet: 's', data: g.data, clean: true })));
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

ok('a style-differing ladder labels each tile with the line that CHANGED', () => {
  const { ladders } = groupAssetVariants([
    { url: 's1', prompt: 'gpt-image-2 · medium', promptContent: CONTENT,
      promptStyle: 'loose watercolor wash. visible paper grain.', description: 'watercolor take' },
    { url: 's2', prompt: 'gpt-image-2 · medium', promptContent: CONTENT,
      promptStyle: 'clean linocut relief print. visible paper grain.', description: 'linocut take' },
  ]);
  assert.strictEqual(ladders.length, 1);
  // never "medium · medium" — the differing style segment is what changed
  assert.deepStrictEqual(ladders[0].items.map((i) => i.label).sort(),
    ['clean linocut relief print', 'loose watercolor wash']);
});

ok('a verbose filed description shortens to its name on an auto tile', () => {
  const out = groupAssetVariants([
    { url: 'd1', prompt: 'gpt-image-2 · medium', promptStyle: 'the house dream style',
      promptContent: 'the monkey dream',
      description: 'Monkeys, Money, and Bananas (343 chars verbatim) — same prompt, only the dream changed — dream mystery' },
    { url: 'd2', prompt: 'gpt-image-2 · medium', promptStyle: 'the house dream style',
      promptContent: 'the museum dream',
      description: 'Museum with mom' },
  ]);
  assert.deepStrictEqual(out.contentSets[0].items.map((i) => i.label).sort(),
    ['Monkeys, Money, and Bananas', 'Museum with mom']);
});

// ── same style, different subjects (her dream-illustration case) ────────────
const STYLE = 'diary-comic ink, dream mystery ref attached, 1024x1024';
ok('same style + different content groups into a contentSet', () => {
  const out = groupAssetVariants([
    { url: 'd1', prompt: 'gpt-image-2 · medium', promptStyle: STYLE,
      promptContent: 'the monkey money dream', description: 'Monkey money', ms: 3 },
    { url: 'd2', prompt: 'gpt-image-2 · medium', promptStyle: STYLE,
      promptContent: 'the museum dream with mom, much longer text here',
      description: 'Museum with mom', ms: 2 },
  ]);
  assert.strictEqual(out.contentSets.length, 1);
  assert.strictEqual(out.contentSets[0].items.length, 2);
  assert.deepStrictEqual(out.contentSets[0].items.map((i) => i.label).sort(),
    ['Monkey money', 'Museum with mom']);
  // the group label is the style's first line, not the whole block
  assert.ok(out.contentSets[0].label.startsWith('diary-comic ink'));
});

ok('a contentSet needs a filed style and two DISTINCT contents', () => {
  // no style filed → "same style" is unprovable → nothing groups
  assert.strictEqual(groupAssetVariants([
    { url: 'a', prompt: 'x · low', promptContent: 'dream one' },
    { url: 'b', prompt: 'x · low', promptContent: 'dream two' },
  ]).contentSets.length, 0);
  // same style + same content is a re-roll (or a ladder rung), not a subject
  assert.strictEqual(groupAssetVariants([
    { url: 'a', prompt: 'x · low', promptStyle: STYLE, promptContent: 'dream one' },
    { url: 'b', prompt: 'x · high', promptStyle: STYLE, promptContent: 'dream one' },
  ]).contentSets.length, 0);
});

// ── the same prompt drawn twice (her grainy-vs-clean pairs) ────────────────
ok('the SAME prompt at the same settings, drawn twice, is its own group', () => {
  const S = 'the house dream style';
  const out = groupAssetVariants([
    { url: 'clean', prompt: 'gpt-image-2 · medium', promptStyle: S, promptContent: CONTENT,
      description: 'Mountain Summit — drawn again with no webp compression — dream mystery', ms: 2 },
    { url: 'grainy', prompt: 'gpt-image-2 · medium', promptStyle: S, promptContent: CONTENT,
      description: 'Mountain Summit — salient clause prompt, drawn square at medium — dream mystery', ms: 1 },
  ]);
  // nothing filed differs, so it is NOT a ladder — that rule stands
  assert.strictEqual(out.ladders.length, 0);
  assert.strictEqual(out.reruns.length, 1);
  // in the order they were drawn, labelled by the half the chat wrote to tell
  // them apart (the name is identical on both by construction)
  assert.deepStrictEqual(out.reruns[0].items.map((i) => i.label), [
    'salient clause prompt, drawn square at medium',
    'drawn again with no webp compression',
  ]);
});

ok('a rerun group with nothing written to tell the takes apart numbers them', () => {
  const out = groupAssetVariants([
    { url: 'a', prompt: 'x · low', promptStyle: 'S', promptContent: CONTENT, description: 'Penny', ms: 1 },
    { url: 'b', prompt: 'x · low', promptStyle: 'S', promptContent: CONTENT, description: 'Penny', ms: 2 },
  ]);
  assert.deepStrictEqual(out.reruns[0].items.map((i) => i.label), ['Draw 1', 'Draw 2']);
});

ok('one take of a prompt is never a rerun group', () => {
  assert.strictEqual(groupAssetVariants([
    { url: 'a', prompt: 'x · low', promptStyle: 'S', promptContent: CONTENT },
    { url: 'b', prompt: 'x · high', promptStyle: 'S', promptContent: CONTENT },
  ]).reruns.length, 0);
});

ok('a five-way ladder gives every tile a label of its OWN', () => {
  // the live bug (2026-08-19): "differs from SOMEONE" is too weak a test in a
  // group of many — three variants sharing a first paragraph all got handed it
  const mk = (u, style, desc) => ({ url: u, prompt: 'gpt-image-2 · medium',
    promptContent: CONTENT, promptStyle: style, description: desc });
  const SHARED = 'ref paragraph, shared by most.';
  const { ladders } = groupAssetVariants([
    mk('a', `${SHARED}\nDraw it as one image.`, 'Party — her line — dream mystery'),
    mk('b', 'a DIFFERENT ref paragraph.\nDraw it as one image.', 'Party — her line — sage sandy mirror'),
    mk('c', `${SHARED}\nChoose one salient image.`, 'Party — salient — dream mystery'),
    mk('d', `${SHARED}\nAmorphous panels, v2.`, 'Party — amorphous v2 — dream mystery'),
    mk('e', `${SHARED}\nAmorphous panels.`, 'Party — amorphous — dream mystery'),
  ]);
  const labels = ladders[0].items.map((i) => i.label);
  assert.strictEqual(new Set(labels).size, 5, `all five distinct — got ${JSON.stringify(labels)}`);
  assert.ok(!labels.includes('medium'), 'and never a bare quality word among style lines');
});

// ── planAutoPages — what the server files by itself ─────────────────────────
ok('planAutoPages: a ladder and a subject set become the two auto pages', () => {
  const { planAutoPages } = require('../page-templates');
  const plans = planAutoPages([
    { url: 'u-high', prompt: 'gpt-image-2 · high', promptContent: CONTENT, promptStyle: '' },
    { url: 'u-low', prompt: 'gpt-image-2 · low', promptContent: CONTENT, promptStyle: '' },
    { url: 'd1', prompt: 'gpt-image-2 · medium', promptStyle: STYLE,
      promptContent: 'a much much longer dream about the corporate procedure office',
      description: 'Corporate dream', ms: 2 },
    { url: 'd2', prompt: 'gpt-image-2 · medium', promptStyle: STYLE,
      promptContent: 'short dream', description: 'Short dream', ms: 1 },
  ]);
  assert.deepStrictEqual(plans.map((p) => p.kind), ['ladders', 'subjects']);
  // subjects read shortest content first — her threshold-ladder order
  const subj = plans.find((p) => p.kind === 'subjects');
  assert.deepStrictEqual(subj.data.groups[0].items.map((i) => i.label),
    ['Short dream', 'Corporate dream']);
  // both plans validate as grid pages exactly as the runner will post them
  for (const p of plans) assert.strictEqual(validateTemplate('grid', p.data).ok, true);
});

ok('planAutoPages: an over-long subject group keeps the NEWEST and says so', () => {
  const { planAutoPages } = require('../page-templates');
  const assets = [];
  for (let i = 0; i < 30; i += 1) {
    assets.push({ url: `d${i}`, prompt: 'gpt-image-2 · medium', promptStyle: STYLE,
      promptContent: `dream number ${i} ${'x'.repeat(i)}`, description: `Dream ${i}`, ms: i });
  }
  const subj = planAutoPages(assets).find((p) => p.kind === 'subjects');
  const g = subj.data.groups[0];
  assert.strictEqual(g.items.length, 24);
  // the cap is still NAMED — on the row's short tag, never silently
  assert.ok(/newest 24 of 30/.test(g.label), g.label);
  assert.ok(!/dream number/.test(g.label), 'the prompt itself never sits on the row');
  // the six dropped are the six OLDEST (lowest ms)
  assert.ok(!g.items.some((i) => i.label === 'Dream 0'));
  assert.ok(g.items.some((i) => i.label === 'Dream 29'));
});

ok('planAutoPages: the tab keeps "Auto-compare", the PAGE heading drops it', () => {
  const { planAutoPages, renderTemplatePage } = require('../page-templates');
  const plans = planAutoPages([
    { url: 'u-high', prompt: 'gpt-image-2 · high', promptContent: CONTENT },
    { url: 'u-low', prompt: 'gpt-image-2 · low', promptContent: CONTENT },
  ]);
  const p = plans[0];
  assert.ok(/^Auto-compare — /.test(p.title));
  assert.strictEqual(p.heading, 'Same prompt, settings changed');
  const html = renderTemplatePage({ template: 'grid', title: p.title,
    heading: p.heading, chat: 'c', sheet: 's', data: p.data });
  assert.ok(html.includes('<h1>Same prompt, settings changed</h1>'));
  assert.ok(!/<h1>[^<]*Auto-compare/.test(html));
  assert.ok(html.includes('<title>Auto-compare — '), 'the browser tab keeps the full name');
  // and with no heading given, the title is still the h1 (every other page)
  const plain = renderTemplatePage({ template: 'grid', title: 'Penny v2',
    chat: 'c', sheet: 's', data: p.data });
  assert.ok(plain.includes('<h1>Penny v2</h1>'));
});

ok('planAutoPages: rows wear SHORT tags and the prompts go behind the "?"', () => {
  const { planAutoPages, validateTemplate } = require('../page-templates');
  const plans = planAutoPages([
    { url: 'a1', prompt: 'x · low', promptStyle: 'style ONE <b>with markup</b>',
      promptContent: 'dream one', description: 'One' },
    { url: 'a2', prompt: 'x · low', promptStyle: 'style ONE <b>with markup</b>',
      promptContent: 'dream two', description: 'Two' },
    { url: 'b1', prompt: 'x · low', promptStyle: 'style TWO entirely',
      promptContent: 'dream three', description: 'Three' },
    { url: 'b2', prompt: 'x · low', promptStyle: 'style TWO entirely',
      promptContent: 'dream four', description: 'Four' },
  ]);
  const subj = plans.find((p) => p.kind === 'subjects');
  assert.deepStrictEqual(subj.data.groups.map((g) => g.label), ['Style 1', 'Style 2']);
  // the real text is in the help, tagged to match, and ESCAPED (help is HTML)
  assert.ok(subj.data.help.includes('<b>Style 1</b> — style ONE'));
  assert.ok(subj.data.help.includes('&lt;b&gt;with markup&lt;/b&gt;'));
  assert.strictEqual(validateTemplate('grid', subj.data).ok, true);
});

ok('planAutoPages: ONE group needs no tag at all', () => {
  const { planAutoPages } = require('../page-templates');
  const subj = planAutoPages([
    { url: 'a1', prompt: 'x · low', promptStyle: 'the one style', promptContent: 'dream one' },
    { url: 'a2', prompt: 'x · low', promptStyle: 'the one style', promptContent: 'dream two' },
  ]).find((p) => p.kind === 'subjects');
  assert.strictEqual(subj.data.groups.length, 1);
  assert.strictEqual(subj.data.groups[0].label, undefined);
  assert.ok(subj.data.help.includes('<b>Style</b> — the one style'));
});

ok('planAutoPages: the reruns page is its own, and says only what it knows', () => {
  const { planAutoPages, validateTemplate } = require('../page-templates');
  const S = 'the house dream style';
  const plans = planAutoPages([
    { url: 'clean', prompt: 'gpt-image-2 · medium', promptStyle: S, promptContent: CONTENT,
      description: 'Mountain — drawn again with no webp compression — dream mystery', ms: 2 },
    { url: 'grainy', prompt: 'gpt-image-2 · medium', promptStyle: S, promptContent: CONTENT,
      description: 'Mountain — the first take — dream mystery', ms: 1 },
  ]);
  const rr = plans.find((p) => p.kind === 'reruns');
  assert.strictEqual(rr.title, 'Auto-compare — same prompt, drawn again');
  assert.strictEqual(rr.heading, 'Same prompt, drawn again');
  // it must not claim to know WHY two takes differ — nothing on record says
  assert.ok(!/compress/i.test(rr.data.help));
  assert.ok(/one prompt drawn more than once/i.test(rr.data.help));
  assert.strictEqual(validateTemplate('grid', rr.data).ok, true);
});

ok('planAutoPages: nothing groupable, no plans — and ms never survives validation', () => {
  const { planAutoPages } = require('../page-templates');
  assert.deepStrictEqual(planAutoPages([
    { url: 'a', prompt: 'x · low', promptContent: 'one thing' },
  ]), []);
  const plans = planAutoPages([
    { url: 'd1', prompt: 'x · low', promptStyle: STYLE, promptContent: 'a', ms: 5 },
    { url: 'd2', prompt: 'x · low', promptStyle: STYLE, promptContent: 'bb', ms: 6 },
  ]);
  const v = validateTemplate('grid', plans[0].data);
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.data.groups[0].items[0].ms, undefined);
});

// ── the moment card (her Decision Deck design) ──────────────────────────────
ok('a moment card validates on its PARTS alone — no single text needed', () => {
  const v = validateTemplate('deck', { items: [
    { id: 'm1', who: 'Maya', eyebrow: 'Moment · Ch. 1',
      sections: [{ label: 'The illustration', text: 'A grid of selfies.' }] },
  ] });
  assert.strictEqual(v.ok, true);
  const it = v.data.items[0];
  assert.strictEqual(it.who, 'Maya');
  assert.strictEqual(it.eyebrow, 'Moment · Ch. 1');
  assert.deepStrictEqual(it.sections, [{ label: 'The illustration', text: 'A grid of selfies.' }]);
});

ok('a moment card may carry BOTH words and a picture', () => {
  const v = validateTemplate('deck', { items: [
    { id: 'm', who: 'Theo', text: 'The quiet Sunday.', img: `${SG}/a/sunday.png` },
  ] });
  assert.strictEqual(v.data.items[0].text, 'The quiet Sunday.');
  assert.strictEqual(v.data.items[0].img, `${SG}/a/sunday.png`);
});

ok('sections drop the bodyless ones and survive without a label', () => {
  const v = validateTemplate('deck', { items: [
    { id: 'm', who: 'Sam', sections: [
      { label: 'Kept', text: 'has a body' }, { label: 'Dropped', text: '  ' }, { text: 'no label' }] },
  ] });
  assert.deepStrictEqual(v.data.items[0].sections,
    [{ label: 'Kept', text: 'has a body' }, { text: 'no label' }]);
});

ok("style:'moment' rides through; an unknown style is dropped", () => {
  assert.strictEqual(validateTemplate('deck', { style: 'moment',
    items: [{ label: 'a', text: 't' }] }).data.style, 'moment');
  assert.strictEqual(validateTemplate('deck', { style: 'fancy',
    items: [{ label: 'a', text: 't' }] }).data.style, undefined);
});

ok('an item with nothing at all is still refused', () => {
  const v = validateTemplate('deck', { items: [{ label: 'empty' }] });
  assert.strictEqual(v.ok, false);
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
