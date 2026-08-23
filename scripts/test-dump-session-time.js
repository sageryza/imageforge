#!/usr/bin/env node
'use strict';

// The Dump's clock, and the three copies of the folder list.
//
// Sophie shared a 28-second clip at 5:53 pm Pacific on 2026-08-22 and it came
// back named `2026-08-23-0052` — the share extension and the server both
// stamped the session id in UTC, so every evening dump wore tomorrow's date
// and a chat looking for "the video from the 22nd" found nothing. These are
// the cases that were failing.
//
// Pure — no Firestore, no network.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const drop = require('../dropbox.js');

const ROOT = path.join(__dirname, '..');
let pass = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log('  ok  ' + name); } catch (e) {
    console.error('  FAIL ' + name + '\n       ' + e.message);
    process.exitCode = 1;
  }
};

console.log('\nthe session stamp is HER clock');

// The exact file that started this: 52,127,505 bytes, 28.2s, filed at
// 1787446386400 = Aug 22 2026, 5:53 pm PDT.
t('her 5:53 pm PDT dump is stamped Aug 22, not Aug 23', () => {
  assert.strictEqual(drop.newSession(1787446386400), '2026-08-22-1753');
});

t('the old UTC stamp is what it must never be again', () => {
  // The real id on that file is `2026-08-23-0052`: the share sheet mints the
  // id when it OPENS and the file was stamped a minute later at 00:53:06 UTC,
  // which is why this rebuilds the date rather than asserting the minute.
  const d = new Date(1787446386400);
  const p = (n) => String(n).padStart(2, '0');
  const utcDay = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  assert.strictEqual(utcDay, '2026-08-23', 'the bug reproduces — UTC calls it the 23rd');
  assert.ok(drop.newSession(1787446386400).startsWith('2026-08-22'),
    'her clock calls it the 22nd');
});

t('PST as well as PDT — a January evening does not roll over either', () => {
  // 2026-01-15, 6:30 pm PST = 2026-01-16 02:30 UTC.
  const ms = Date.UTC(2026, 0, 16, 2, 30);
  assert.strictEqual(drop.newSession(ms), '2026-01-15-1830');
});

t('midday, where UTC and Pacific share a date, is unchanged', () => {
  const ms = Date.UTC(2026, 7, 22, 19, 5);     // 12:05 pm PDT
  assert.strictEqual(drop.newSession(ms), '2026-08-22-1205');
});

t('the id still sorts chronologically as a plain string', () => {
  const a = drop.newSession(Date.UTC(2026, 7, 22, 19, 5));
  const b = drop.newSession(Date.UTC(2026, 7, 23, 0, 52));
  assert.ok(a < b, `${a} should sort before ${b}`);
  assert.ok(/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(a), 'shape unchanged: ' + a);
});

console.log('\nthe label the page shows');

t('12-hour Pacific, never 24-hour — house rule', () => {
  const label = drop.sessionLabel(1787446386400);
  assert.strictEqual(label, 'Aug 22 · 5:53 pm');
  assert.ok(!/17:53/.test(label), 'no military time');
});

t('it is built from the epoch, so a UTC-stamped old dump still reads right', () => {
  // The 31 dumps made before the fix keep their UTC id; only the label moves.
  assert.strictEqual(drop.sessionLabel(1787446386400), 'Aug 22 · 5:53 pm');
});

t('no timestamp means no label, never "Invalid Date"', () => {
  assert.strictEqual(drop.sessionLabel(0), null);
  assert.strictEqual(drop.sessionLabel(undefined), null);
});

console.log('\nname it / sort it at dump time');

t('both labels are trimmed, and absent means empty — never "undefined"', () => {
  assert.deepStrictEqual(drop.uploadLabels({}), { bundleName: '', track: '' });
  assert.deepStrictEqual(drop.uploadLabels(undefined), { bundleName: '', track: '' });
  assert.deepStrictEqual(
    drop.uploadLabels({ bundle: '  Moon milk  ', track: ' crystals ' }),
    { bundleName: 'Moon milk', track: 'crystals' });
});

t('a long name is cut, not refused', () => {
  const { bundleName, track } = drop.uploadLabels({ bundle: 'x'.repeat(200), track: 'y'.repeat(200) });
  assert.strictEqual(bundleName.length, 80);
  assert.strictEqual(track.length, 60);
});

t('/upload-file reads track and passes it as a default, only when set', () => {
  const src = fs.readFileSync(path.join(ROOT, 'dropbox.js'), 'utf8');
  const route = src.slice(src.indexOf("router.post('/upload-file'"));
  const body = route.slice(0, route.indexOf("router.post('/upload-zip'"));
  assert.ok(/uploadLabels\(req\.query\)/.test(body), 'route uses the shared parser');
  assert.ok(/defaults: track \? \{ track \} : null/.test(body),
    'an unpicked folder must leave the doc alone');
});

console.log('\nthe folders are offered in the order she uses them');

// Measured live 2026-08-23: NOT ONE of the five baked tracks is in use. Every
// folder she files into she typed herself, so leading the chips with the baked
// five would put five dead options in front of her six real ones.
const LIVE_COUNTS = [
  ['From ChatGPT', 16], ['dream upload from ChatGPT', 16], ['Crystals', 15],
  ['style references', 13], ['story room', 7], ['Inspiration', 3],
];

t('her own folders lead, the untouched known ones tail', () => {
  const out = drop.orderTracks(LIVE_COUNTS);
  const mine = LIVE_COUNTS.map((c) => c[0]);
  const lastMine = Math.max(...mine.map((m) => out.indexOf(m)));
  const firstKnown = Math.min(...['story-art', 'hoonies', 'reference', 'product']
    .map((k) => out.indexOf(k)));
  assert.ok(lastMine < firstKnown,
    'every folder she uses must come before every one she does not: ' + out.join(', '));
});

t('most-used first', () => {
  const out = drop.orderTracks([['rare', 1], ['common', 40], ['middling', 9]]);
  assert.deepStrictEqual(out.slice(0, 3), ['common', 'middling', 'rare']);
});

t('the dead lowercase twin of a folder she uses is dropped', () => {
  // `Crystals` holds 15 albums; the baked `crystals` holds none. Offering both
  // puts a real folder next to an empty one keystroke-identical to it.
  const out = drop.orderTracks(LIVE_COUNTS);
  assert.ok(out.includes('Crystals'), 'her spelling stays');
  assert.ok(!out.includes('crystals'), 'the unused twin must not be offered');
});

t('when two spellings are BOTH in use, the busier one wins', () => {
  const out = drop.orderTracks([['Crystals', 15], ['crystals', 2]]);
  assert.deepStrictEqual(out.filter((x) => x.toLowerCase() === 'crystals'), ['Crystals']);
});

t('nothing filed yet still offers the baked five', () => {
  assert.deepStrictEqual(drop.orderTracks([]), drop.KNOWN_TRACKS);
});

console.log('\none folder list, three readers');

// A track is a project, not a tag cloud — and a second hardcoded copy is how
// the share sheet would start offering folders the page has never heard of.
t('the /dump page fallback matches the server', () => {
  const page = fs.readFileSync(path.join(ROOT, 'public/dump.html'), 'utf8');
  const m = page.match(/let TRACKS=\[([^\]]+)\]/);
  assert.ok(m, 'TRACKS not found in dump.html');
  const list = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
  assert.deepStrictEqual(list, drop.KNOWN_TRACKS);
});

t('the iOS share sheet fallback matches the server', () => {
  const swift = fs.readFileSync(path.join(ROOT, 'ios/DumpShare/ShareViewController.swift'), 'utf8');
  const m = swift.match(/bakedFolders = \[([^\]]+)\]/);
  assert.ok(m, 'bakedFolders not found in ShareViewController.swift');
  const list = m[1].split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
  assert.deepStrictEqual(list, drop.KNOWN_TRACKS);
});

t('the page reads the served list before painting its chips', () => {
  const page = fs.readFileSync(path.join(ROOT, 'public/dump.html'), 'utf8');
  assert.ok(/api\('\/tracks'\)/.test(page), 'dump.html must fetch /tracks');
});

console.log('\nthe share sheet stamps Pacific too');

t('ShareViewController.newSessionID is no longer UTC', () => {
  const swift = fs.readFileSync(path.join(ROOT, 'ios/DumpShare/ShareViewController.swift'), 'utf8');
  const fn = swift.slice(swift.indexOf('private static func newSessionID'));
  const body = fn.slice(0, fn.indexOf('\n    }'));
  assert.ok(/America\/Los_Angeles/.test(body), 'must stamp Pacific');
  assert.ok(!/identifier: "UTC"/.test(body), 'must not stamp UTC');
  assert.ok(/en_US_POSIX/.test(body), 'a fixed-format DateFormatter needs a POSIX locale');
});

t('every session stamp in the tree is Pacific — all three copies', () => {
  // There are three: the server fallback, the share sheet, and the in-app
  // album uploader. Fixing two of three leaves the bug alive on one door.
  const swiftFiles = [
    'ios/DumpShare/ShareViewController.swift',
    'ios/ImageForge/DumpUploader.swift',
  ];
  for (const f of swiftFiles) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const i = src.indexOf('func newSessionID');
    assert.ok(i > 0, 'newSessionID not found in ' + f);
    const body = src.slice(i, src.indexOf('\n    }', i));
    assert.ok(/America\/Los_Angeles/.test(body), f + ' must stamp Pacific');
    assert.ok(!/identifier: "UTC"/.test(body), f + ' must not stamp UTC');
  }
  assert.ok(!/getUTCHours/.test(fs.readFileSync(path.join(ROOT, 'dropbox.js'), 'utf8')),
    'dropbox.js must not build a session id out of UTC parts');
});

t('the share sheet sends the name and the folder it collected', () => {
  const swift = fs.readFileSync(path.join(ROOT, 'ios/DumpShare/ShareViewController.swift'), 'utf8');
  const fn = swift.slice(swift.indexOf('private func dumpRequest'));
  const body = fn.slice(0, fn.indexOf('\n    }'));
  assert.ok(/name: "bundle", value: name/.test(body), 'the typed name rides as ?bundle=');
  assert.ok(/name: "track", value: folder/.test(body), 'the picked folder rides as ?track=');
  assert.ok(/if !name\.isEmpty/.test(body), 'an untyped name must send nothing');
});

t('the name box ships EMPTY — the placeholder names it, never fills it', () => {
  const swift = fs.readFileSync(path.join(ROOT, 'ios/DumpShare/ShareViewController.swift'), 'utf8');
  assert.ok(/nameField\.placeholder = "Name"/.test(swift), 'placeholder must be the field NAME');
  assert.ok(!/nameField\.text = "/.test(swift), 'nothing may be pre-filled');
});

t('nothing in the sheet is a pill', () => {
  const swift = fs.readFileSync(path.join(ROOT, 'ios/DumpShare/ShareViewController.swift'), 'utf8');
  const radii = [...swift.matchAll(/cornerRadius = ([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(radii.length >= 3, 'expected the card, the field and the chips');
  // 12 is the card; a chip or a text button must be the house 6.
  assert.ok(radii.every((r) => r <= 12), 'a pill would be half the control height: ' + radii);
});

console.log(`\n${pass} passing\n`);
