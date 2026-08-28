#!/usr/bin/env node
// THE DELIVERED TAB'S FEED (2026-08-28) — films and picture bursts, newest
// first. Pure, no network: buildFeed decides what the list says.
//
// Asserts:
//   1. films and pictures interleave by TIME — one list, not two stacked,
//   2. a chat's pictures split into BURSTS: "as they're delivered" means the
//      morning's nine and the evening's three are two rows, not one card,
//   3. a row shows three and SAYS how many there were,
//   4. the md5 twin collapses, and the LABELED copy wins the url — the
//      unlabeled one is always the hook's, and the label is what the row reads
//      as,
//   5. her SOURCE LIBRARIES are not deliveries (the Dump, crystals, ingest),
//   6. a DERIVED thumbnail is not a delivery,
//   7. an audio file in the assets is not a picture row,
//   8. display names come off the registry,
//   9. an UNLABELED picture is not a delivery — the house rule that a chat
//      labels every image it hands over, which is what tells a hand-over from
//      the hook's background catch (a chat icon, a film's cover frame).
const assert = require('assert');
const { buildFeed, burstsFor } = require('../deliverables-feed');

const T = Date.parse('2026-08-28T20:00:00Z');
const MIN = 60 * 1000, HOUR = 60 * MIN;
const at = (ms) => new Date(T - ms).toISOString();
let n = 0;
const t = (why, fn) => { fn(); n++; console.log('  ok  ' + why); };

const pic = (o) => Object.assign({ chat: 'panels', kind: 'image' }, o);

const assets = [
  // this morning's burst of four, one of them filed twice
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/a.png', description: 'The rat',    created: at(30 * MIN), md5: 'aa' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/claude-deliveries/zz9.png',          created: at(30 * MIN), md5: 'aa' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/b.png', description: 'The alley',  created: at(32 * MIN), md5: 'bb' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/c.png', description: 'The window', created: at(34 * MIN), md5: 'cc' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/d.png', description: 'The door',   created: at(36 * MIN), md5: 'dd' }),
  // …and last night's, hours earlier — a separate hand-over
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/e.png', description: 'Old one',    created: at(9 * HOUR), md5: 'ee' }),
  // things that are not deliveries
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/phone-photo.jpg',              created: at(20 * MIN), md5: 'ff' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/crystals/rock.jpg',                  created: at(21 * MIN), md5: 'gg' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/thumbs/deadbeef.webp',               created: at(22 * MIN), md5: 'hh' }),
  // a generated chat icon and a film's cover frame — filed by the hook, named
  // by nobody. Measured live: every unlabeled row was one of these.
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/chat-feed/icons/Voice_Memos.png', created: at(24 * MIN), md5: 'jj' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/covers/c.webp', created: at(25 * MIN), md5: 'kk', prompt: 'from pwc' }),
  pic({ url: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/take.m4a', kind: 'audio',          created: at(23 * MIN), md5: 'ii' }),
];

const deliverables = [
  { kind: 'video', chat: 'filmy', title: 'Evan v18', url: 'https://s/f.mp4',
    updatedAt: at(10 * MIN), versions: 2, older: [] },
  { kind: 'audio', chat: 'cuts', title: 'Her VO', url: 'https://s/v.m4a',
    updatedAt: at(5 * HOUR), versions: 1, older: [] },
];

const chats = { panels: { displayName: 'Rat panels' }, filmy: {}, cuts: {} };
const { items } = buildFeed({ deliverables, assets, chats });

t('films and pictures are ONE list in time order', () => {
  // the film (10m), this morning's pictures (30m), the cut (5h), last
  // night's pictures (9h) — interleaved, one list
  assert.deepStrictEqual(items.map((i) => i.kind), ['video', 'images', 'audio', 'images']);
});

t('a chat\'s pictures split into bursts', () => {
  const im = items.filter((i) => i.kind === 'images');
  assert.strictEqual(im.length, 2, 'two hand-overs, two rows');
  assert.strictEqual(im[0].count, 4);
  assert.strictEqual(im[1].count, 1);
});

t('a row shows three and says how many there were', () => {
  const first = items.find((i) => i.kind === 'images');
  assert.strictEqual(first.images.length, 3);
  assert.strictEqual(first.count, 4);
});

t('the md5 twin collapses and the LABELED copy keeps the url', () => {
  const urls = items.filter((i) => i.kind === 'images')
    .reduce((a, i) => a.concat(i.images.map((p) => p.url)), []);
  assert.ok(!urls.some((u) => /claude-deliveries/.test(u)), 'the hook\'s unlabeled twin is on the row');
  const burst = burstsFor(assets.filter((a) => /assets\/[abcd]\.png|claude-deliveries/.test(a.url)))[0];
  const rat = burst.find((p) => p.label === 'The rat');
  assert.strictEqual(rat.url, 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/a.png');
});

t('her source libraries are not deliveries', () => {
  const urls = JSON.stringify(items);
  assert.ok(!/drops\//.test(urls), 'a Dump photo is on the list');
  assert.ok(!/crystals\//.test(urls), 'a crystal photo is on the list');
});

t('a derived thumbnail is not a delivery', () => {
  assert.ok(!/thumbs\//.test(JSON.stringify(items)));
});

t('an audio asset is not a picture row', () => {
  assert.ok(!/take\.m4a/.test(JSON.stringify(items)));
});

t('names come off the registry', () => {
  assert.strictEqual(items.find((i) => i.kind === 'images').chatName, 'Rat panels');
  assert.strictEqual(items[0].chatName, 'filmy', 'no display name → the slug');
});

t('an unlabeled picture is not a delivery', () => {
  const all = JSON.stringify(items);
  assert.ok(!/chat-feed\/icons/.test(all), 'a generated chat icon is on the list');
  assert.ok(!/covers\//.test(all), 'a film cover frame is on the list');
});

t('an empty world is an empty list, never a throw', () => {
  assert.deepStrictEqual(buildFeed({}).items, []);
});

console.log('OK — ' + n + ' checks');
