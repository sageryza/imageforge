#!/usr/bin/env node
// EVERY PICTURE EVER MADE IS FINDABLE — the filing root causes, pinned
// (2026-08-28, Sophie: "did you fix the root cause why they weren't filing in
// the first place?"). Three of them, each a source pin because the behaviour
// spans server boot and fire-and-forget jobs no unit harness can drive:
//   1. Freeform files its outputs (it never did — 27 invisible pictures);
//   2. a boot reconciliation re-files what a deploy restart killed (186
//      Playground outputs were lost that way), with the run's own timestamp;
//   3. the story placing doors file chat-seeded art (117 pictures only ever
//      lived on beats).
// The standing measurement is scripts/backfill-meta-coverage.js (dry run
// names every gap); this test is what keeps the mechanisms from being
// refactored away silently.
'use strict';
const assert = require('assert');
const fs = require('fs');

const server = fs.readFileSync(require.resolve('../server.js'), 'utf8');
const freeform = fs.readFileSync(require.resolve('../freeform.js'), 'utf8');
const scratchpad = fs.readFileSync(require.resolve('../scratchpad.js'), 'utf8');

// 1. Freeform: the writer is handed in, the done path files, the module
//    exports the filer so the reconcile can call it for an older run.
assert.ok(/fileCreation: fileCreationDoc\s*\}\)/.test(server.match(/require\('\.\/freeform'\)\.init\([^)]*\)/)[0] + ')'),
  'server hands freeform the My Creations writer');
assert.ok(/status: 'done', images, finishedAt[\s\S]{0,700}fileRunImages\(id\)/.test(freeform),
  'a finished freeform run files its images');
assert.ok(/module\.exports = \{[^}]*fileRunImages/.test(freeform),
  'fileRunImages is exported for the boot reconcile');
// …and it files the STORED record, never a rebuilt one.
assert.ok(/promptStyle: r\.promptStyle \|\| ''/.test(freeform),
  'the stored style half rides to the creation verbatim');

// 2. The boot reconciliation exists, is deploy-gated, and passes the run's
//    own time so a re-filed picture slots into history.
assert.ok(/async function reconcileCreationFiling\(\)/.test(server), 'reconcile sweep exists');
assert.ok(/RENDER_EXTERNAL_URL[\s\S]{0,200}reconcileCreationFiling\(\)/.test(server),
  'the sweep only runs where a real deploy runs');
assert.ok(/const createdMs = r\.createdAt && r\.createdAt\.toMillis/.test(server),
  'the reconcile derives the run’s own timestamp');
assert.ok(/createdMs\s*\?\s*admin\.firestore\.Timestamp\.fromMillis/.test(server),
  'fileRunToCreations honours it');

// 3. The story placing doors file what they place, best-effort.
assert.ok(/function fileBeatArt\(/.test(scratchpad), 'the placing filer exists');
assert.ok(/if \(url\) fileBeatArt\(url, src, ''\);/.test(scratchpad), '/add files a seeded picture');
assert.ok(/fileBeatArt\(url, src, \(placed && placed\.text\) \|\| ''\);/.test(scratchpad),
  '/image files with the beat’s words');
assert.ok(/\.catch\(\(\) => \{\}\);\n\}/.test(scratchpad.match(/function fileBeatArt\([\s\S]{0,900}/)[0]),
  'filing can never fail a placement');
assert.ok(/fileCreation: fileCreationDoc/.test(server.match(/scratchpadMod\.init\([^)]*\)/)[0]),
  'server hands scratchpad the writer');

// 4. Test Station and photostudio no longer race the kill-window: their
//    filings are AWAITED (Test Station is stateless — a lost filing there was
//    unrecoverable; photostudio's scene prompt exists nowhere else).
const photostudio = fs.readFileSync(require.resolve('../photostudio.js'), 'utf8');
assert.ok(/return Promise\.resolve\(\)/.test(server.match(/function fileGenerateRoute\([\s\S]{0,700}/)[0]),
  'fileGenerateRoute returns its promise');
assert.strictEqual((server.match(/await fileGenerateRoute\(/g) || []).length, 4,
  'all four generate routes await the filing');
assert.ok(/await Promise\.resolve\(\)\.then\(\(\) => fileCreation\(/.test(photostudio),
  'photostudio awaits its filing');

// 5. The reconcile files a panels run's pieces with their own words.
assert.ok(/Array\.isArray\(r\.panels\)[\s\S]{0,600}prompt: r\.panels\[i\]/.test(server),
  'a reconciled panel carries its own words');
assert.ok(/sizeSlot: cut/.test(server.match(/Array\.isArray\(r\.panels\)[\s\S]{0,900}/)[0]),
  'and the 1/N sheet size slot');

console.log('creation-filing: all pins hold — freeform files, the boot sweep re-files, the placing doors file');
