#!/usr/bin/env node
/*
 * test-sweep-asset-captions.js — the classifier behind scripts/sweep-asset-
 * captions.js, driven with fixture asset objects. No server, no network, no
 * key, nothing paid: the sweep's judgement is the only part that can be wrong
 * without anyone noticing, so it is the part pinned here.
 *
 *     node scripts/test-sweep-asset-captions.js
 *
 * The fixtures are shaped like the real GET /api/gallery/assets rows (checked
 * live 2026-08-13 against anthony-chene-nde-pipeline): url, prompt,
 * description, alts, thumb, created, vote, and promptStyle/promptContent when
 * a chat has filed them.
 */
'use strict';

const assert = require('assert');
const { classifyAsset, sweepChat } = require('./sweep-asset-captions.js');

const S = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app';
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

/* ── the fully-filed image: nothing missing ──────────────────────────────── */
const good = {
  url: `${S}/nde-styles/pastel/09-gabe.webp`,
  description: 'Realer — Gabe in the column of light over his skateboard',
  prompt: 'gpt-image-2 · medium',
  promptStyle: 'style ref: sage-sandy-mirror.png, no written style description',
  promptContent: 'a boy in a column of light standing over a skateboard',
  alts: [`${S}/nde-styles/pastel/09-gabe.webp`],
};

t('a fully filed image is missing nothing', () => {
  const r = classifyAsset(good);
  assert.deepStrictEqual(r.missing, []);
  assert.strictEqual(r.stray, false);
  assert.strictEqual(r.label, good.description);
});

/* ── the hook's own default caption is NOT a model · quality tag ─────────── */
t('"from <chat>" does not count as a caption', () => {
  const r = classifyAsset({ ...good, prompt: 'from anthony-chene-nde-pipeline' });
  assert.strictEqual(r.noCaption, true, 'the hook default has no middle dot');
  assert.deepStrictEqual(r.missing, ['caption']);
});

t('a missing / empty prompt field is a missing caption', () => {
  assert.strictEqual(classifyAsset({ ...good, prompt: '' }).noCaption, true);
  const bare = { ...good }; delete bare.prompt;
  assert.strictEqual(classifyAsset(bare).noCaption, true);
});

t('the middle dot is the test — an en dash is not one', () => {
  // A caption typed with the wrong separator reads right and searches wrong,
  // so the sweep must still flag it rather than pass on "looks captioned".
  assert.strictEqual(classifyAsset({ ...good, prompt: 'gpt-image-2 - medium' }).noCaption, true);
  assert.strictEqual(classifyAsset({ ...good, prompt: 'gpt-image-2 – medium' }).noCaption, true);
  assert.strictEqual(classifyAsset({ ...good, prompt: 'gpt-image-2 · high' }).noCaption, false);
  assert.strictEqual(classifyAsset({ ...good, prompt: 'flux wtr · replicate' }).noCaption, false);
});

/* ── labels ──────────────────────────────────────────────────────────────── */
t('no description is an unlabeled image', () => {
  const bare = { ...good }; delete bare.description;
  assert.strictEqual(classifyAsset(bare).noLabel, true);
  assert.strictEqual(classifyAsset({ ...good, description: '   ' }).noLabel, true,
    'whitespace is not a label');
});

/* ── the claude-deliveries hole ──────────────────────────────────────────── */
t('an unlabeled claude-deliveries copy is a STRAY', () => {
  const r = classifyAsset({
    url: `${S}/claude-deliveries/8f3c19aa2b.png`,
    prompt: 'from evan-film',
  });
  assert.strictEqual(r.stray, true);
  assert.deepStrictEqual(r.missing, ['label', 'caption', 'prompt']);
});

t('a LABELED claude-deliveries tile is not a stray', () => {
  // The stray is the unlabeled twin. A delivery the chat labeled is just an
  // image that happens to live at that path, and calling it a stray would
  // send a chat hunting a mess it already cleaned up.
  const r = classifyAsset({
    url: `${S}/claude-deliveries/8f3c19aa2b.png`,
    description: 'Penny — the blue Kleenex',
    prompt: 'gpt-image-2 · low',
    promptContent: 'a small dog asleep in a shoebox',
  });
  assert.strictEqual(r.stray, false);
  assert.deepStrictEqual(r.missing, []);
});

t('a stray is caught through alts, not only the primary url', () => {
  // The tab keeps the label-carrying url as `url` and the others as `alts`,
  // so a merged pair hides its delivery path there.
  const r = classifyAsset({
    url: `${S}/witch-school/assets/card-04.png`,
    alts: [`${S}/witch-school/assets/card-04.png`, `${S}/claude-deliveries/aa11bb.png`],
  });
  assert.strictEqual(r.stray, true);
});

t('a path merely containing the word is not a delivery path', () => {
  const r = classifyAsset({ url: `${S}/nde/claude-deliveries-notes/x.png` });
  assert.strictEqual(r.stray, false, 'the match is on the /claude-deliveries/ folder');
});

/* ── her own source libraries: no model, no prompt, so neither is a finding ─ */
t('a Dump photo WITH a label is clean — nobody typed a prompt for it', () => {
  // A phone photo was not generated from words and no model drew it, so
  // counting a missing prompt or MODEL · QUALITY caption against it sent a
  // chat off to file something that does not exist.
  const r = classifyAsset({
    url: `${S}/drops/_/aa11bb22cc33dd44.jpg`,
    description: 'Dump — Dinner party #3',
  });
  assert.strictEqual(r.library, true);
  assert.deepStrictEqual(r.missing, []);
  assert.strictEqual(r.noCaption, false);
  assert.strictEqual(r.noPrompt, false);
});

t('a Dump photo with NO label is short of exactly one thing', () => {
  const r = classifyAsset({ url: `${S}/drops/_/aa11bb22cc33dd44.jpg`, prompt: 'from dinner-party' });
  assert.deepStrictEqual(r.missing, ['label'], 'a nameless tile is still a finding');
});

t('every source library counts, and only those', () => {
  for (const p of ['drops/_/a.jpg', 'crystals/aug/pink/1-0-x.jpg', 'ingest/b/kw__1.png']) {
    assert.strictEqual(classifyAsset({ url: `${S}/${p}`, description: 'x' }).library, true, p);
  }
  // the Cutting Room writes real deliverables into audio/, so it is not one
  assert.strictEqual(classifyAsset({ url: `${S}/audio/cutting-room/01-clip.m4a` }).library, false);
  assert.strictEqual(classifyAsset({ ...good }).library, false);
});

t('a library photo is recognised through alts as well as url', () => {
  const r = classifyAsset({
    url: `${S}/claude-deliveries/aa11bb.jpg`,
    alts: [`${S}/drops/_/aa11bb22cc33dd44.jpg`],
    description: 'Dump — Dinner party #3',
  });
  assert.strictEqual(r.library, true, 'one phone photo whichever copy leads the tile');
  assert.deepStrictEqual(r.missing, []);
});

/* ── prompts ─────────────────────────────────────────────────────────────── */
t('either half of the prompt counts as filed', () => {
  assert.strictEqual(classifyAsset({ ...good, promptStyle: '', promptContent: 'a crow' }).noPrompt, false);
  assert.strictEqual(classifyAsset({ ...good, promptStyle: 'wtr watercolor', promptContent: '' }).noPrompt, false);
  assert.strictEqual(classifyAsset({ ...good, promptStyle: '', promptContent: '  ' }).noPrompt, true);
});

/* ── junk in, no throw out ───────────────────────────────────────────────── */
t('a malformed row is reported, never thrown on', () => {
  for (const junk of [undefined, null, {}, { url: 42, alts: 'nope', description: 7 }]) {
    const r = classifyAsset(junk);
    assert.strictEqual(typeof r.url, 'string');
    assert.deepStrictEqual(r.missing, ['label', 'caption', 'prompt']);
  }
});

/* ── the per-chat roll-up ────────────────────────────────────────────────── */
t('sweepChat counts each question independently', () => {
  const r = sweepChat('evan-film', [
    good,                                                   // clean
    { ...good, prompt: 'from evan-film' },                  // caption only
    { url: `${S}/claude-deliveries/1.png` },                // everything + stray
    { url: `${S}/claude-deliveries/2.png` },                // everything + stray
    { ...good, description: '', promptStyle: '', promptContent: '' },
  ]);
  assert.strictEqual(r.chat, 'evan-film');
  assert.strictEqual(r.images, 5);
  assert.strictEqual(r.noLabel, 3);
  assert.strictEqual(r.noCaption, 3);
  assert.strictEqual(r.noPrompt, 3);
  assert.strictEqual(r.strays, 2);
});

t('a fully filed chat rolls up to all zeroes', () => {
  const r = sweepChat('tidy', [good, good, good]);
  assert.deepStrictEqual(
    [r.noLabel, r.noCaption, r.noPrompt, r.strays], [0, 0, 0, 0]);
});

/* ── the sweep must never write ──────────────────────────────────────────── */
t('the script contains no write call', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'sweep-asset-captions.js'), 'utf8');
  for (const bad of ["method: 'POST'", 'method:"POST"', 'method: \'PATCH\'', 'method: \'DELETE\'']) {
    assert.ok(!src.includes(bad), `sweep-asset-captions.js must stay read-only (found ${bad})`);
  }
});

console.log(`\n${n} checks passed.\n`);
