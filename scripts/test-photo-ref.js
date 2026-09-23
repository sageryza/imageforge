#!/usr/bin/env node
// THE PHOTO REFERENCE TRAVELS WITH THE PICTURE (2026-09-22, Sophie, sending a
// picture from its tile to the Playground: "did not include original
// reference"). The run doc always held `photoRef`; nothing downstream carried
// it, so the Playground door ported the words and lost the photo. This pins
// the whole road: the creation filed from a run carries it, the two asset
// reads pass it through, the union keeps it whichever copy knew, the door adds
// one `photo=` per reference, and the Playground reads every `photo=`.
//
//   node scripts/test-photo-ref.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = (p) => path.join(__dirname, '..', p);
let n = 0; const ok = (c, m) => { n += 1; if (!c) { console.error('FAIL ' + m); process.exitCode = 1; } else console.log('ok   ' + m); };

// ── the union, pure ──
const au = require('../asset-union');
const t = au.unionAssets([
  au.assetRecord({ url: 'https://storage.googleapis.com/b/a.png', created: '2026-09-22T00:00:00Z', description: 'x' }),
  au.creationRecord({ url: 'https://storage.googleapis.com/b/a.png', prompt: 'p', photoRef: 'https://storage.googleapis.com/b/ref.jpg',
    photoRefs: ['https://storage.googleapis.com/b/ref.jpg', 'https://storage.googleapis.com/b/ref2.jpg'], createdAt: { toMillis: () => 1 } }),
]);
ok(t.length === 1, 'one picture, two records → one tile');
ok(t[0].photoRef === 'https://storage.googleapis.com/b/ref.jpg', 'the tile carries the reference the creation knew');
ok(Array.isArray(t[0].photoRefs) && t[0].photoRefs.length === 2, '…and the whole list');
const t2 = au.unionAssets([au.assetRecord({ url: 'https://storage.googleapis.com/b/c.png', created: '2026-09-22T00:00:00Z' })]);
ok(t2[0].photoRef === '' && t2[0].photoRefs.length === 0, 'a picture nothing knows a reference for carries none');

// ── source pins ──
const srv = fs.readFileSync(root('server.js'), 'utf8');
ok(/async function fileRunToCreations\([^)]*photoRef, photoRefs/.test(srv), 'fileRunToCreations takes the run\'s photo(s)');
ok(/Object\.assign\(doc, photoRefFields\(photoRef, photoRefs\)\);\s*await col\.add\(doc\);/.test(srv), '…and writes them on the creation');
ok(/photoRef: cfg\.photoUrl, photoRefs: cfg\.photoUrls,/.test(srv), 'the gpt job passes the photo it attached');
ok(/photoRef: r\.photoRef, photoRefs: r\.photoRefs,/.test(srv), 'the reconcile sweep passes the run doc\'s');
ok(/if \(a\.photoRef\) o\.photoRef = a\.photoRef;/.test(srv), 'GET /api/gallery/assets sends it');
ok(/Object\.assign\(wipDoc, photoFields\);/.test(srv) && /if \(photoFields\.photoRef && !existing\.data\(\)\.photoRef\)/.test(srv), 'POST /api/gallery files one a chat names, never over one on file');
const ma = fs.readFileSync(root('meta-assets.js'), 'utf8');
ok(/photoRef: String\(c\.photoRef \|\| ''\)/.test(ma), 'Meta Assets rows carry it');
const act = fs.readFileSync(root('public/asset-actions.js'), 'utf8');
ok(/refs\.forEach\(function\(u\)\{ q\+='&photo='\+encodeURIComponent\(u\); \}\);/.test(act), 'the Playground door adds one photo= per reference');
const pl = fs.readFileSync(root('public/promptlab.html'), 'utf8');
ok(/getAll\('photo'\)/.test(pl) && /restorePhoto\(\{ photoRef: ps\[0\], photoRefs: ps \}\)/.test(pl), 'the Playground reads every photo= and restores them');
const grid = fs.readFileSync(root('public/grid.js'), 'utf8');
ok(/if \(as\.photoRef && !it\.photoRef\) \{ it\.photoRef = as\.photoRef;/.test(grid), 'a grid page fills it from the Assets read');

// ── the door, driven ──
const vm = require('vm');
const ctx = { window: {}, document: { createElement: () => ({ style: {} }) }, location: { pathname: '/assets', search: '', origin: 'x' }, navigator: {}, fetch: () => Promise.resolve({}), URL: URL, encodeURIComponent, console };
ctx.window.ForgePlaygroundPort = { matchStyle: () => ({ style: 'plain', matched: false }), matchQuality: () => 'medium' };
vm.createContext(ctx);
vm.runInContext(act, ctx);
const q = ctx.window.ForgeAssetActions.playgroundQuery({ promptContent: 'hi', photoRef: 'https://storage.googleapis.com/b/ref.jpg', photoRefs: ['https://storage.googleapis.com/b/ref.jpg', 'javascript:alert(1)'] });
ok(/prompt=hi/.test(q), 'the door still ports the prompt');
ok((q.match(/&photo=/g) || []).length === 1 && /photo=https%3A%2F%2Fstorage/.test(q), 'the door adds the https reference and drops the bad scheme');
const q2 = ctx.window.ForgeAssetActions.playgroundQuery({ promptContent: 'hi' });
ok(!/photo=/.test(q2), 'no reference on the record → no photo= on the link');

console.log(process.exitCode ? 'FAILED' : `all ${n} passed`);
