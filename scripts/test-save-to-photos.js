#!/usr/bin/env node
/**
 * test-save-to-photos.js — the Save button really saves, and never lies.
 *
 * WHY. Sophie, 2026-08-20: "the safe button doesn't work in the playground. I
 * haven't checked Meta assets." She was right about both — the two web-wrapped
 * tools each carried their own copy of the `forgeSave` bridge, and both copies
 * were the same two lines:
 *
 *     UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
 *     ok = true
 *
 * which (1) never asks for add-only permission, so one past "Don't Allow" makes
 * every tap a permanent no-op, (2) reports success on the next line with a nil
 * completion selector, so the page toasts "Saved to Photos" whatever happened —
 * the exact bug she saw, (3) calls UIKit off the main thread, and (4) hands
 * Photos a decoded UIImage instead of the original bytes. The Dream page viewer
 * had the third copy of it.
 *
 * All four were already solved once, in `PhotoSaver` (CreationsView.swift), for
 * the native gallery — and MetaAssetsView has since taken that gallery's slot,
 * so the app's only working saver had stopped being reachable at all. The fix
 * routes everything through it. This pins that: a new web tool that copies its
 * neighbour's save fails HERE, not on her phone.
 *
 * Pure, no network, no Xcode.
 *
 *   node scripts/test-save-to-photos.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IOS = path.join(ROOT, 'ios', 'ImageForge');
const read = p => fs.readFileSync(p, 'utf8');
const swiftFiles = dir => fs.readdirSync(dir).filter(f => f.endsWith('.swift'));

let failed = 0;
function ok(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name); return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? '\n       ' + detail : ''));
}

console.log('\nThe one saver');
const bridge = read(path.join(IOS, 'ForgeSaveBridge.swift'));
ok('ForgeSaveBridge routes through PhotoSaver', /PhotoSaver\.shared\.save\(/.test(bridge));
ok('success is reported from the completion, never before it',
   /case \.saved:[\s\S]{0,140}Saved to Photos/.test(bridge));
ok('a denied library is its own outcome, with the Settings door behind it',
   /case \.denied:/.test(bridge) && /openSettingsURLString/.test(bridge));
ok('a failure carries Photos’ own words', /case \.failed\(let why\)/.test(bridge));
ok('the toast text is JSON-encoded, not interpolated between quotes',
   /JSONSerialization\.data\(withJSONObject/.test(bridge) && !/__saveResult\(\\\(ok\), '/.test(bridge));

console.log('\nA clip goes to VideoSaver, not to PhotoSaver');
// 2026-09-10, Sophie on the Footage page's save link: "shud save directly to
// my photos". Photos takes a video only as a FILE added as a `.video`
// resource, so raw Data through PhotoSaver can never save one — the bridge
// has to route it. WHICH it is is asked of the url and then of the server,
// never of the page: the body stays a plain String, so an older page posting
// an image url is unchanged.
ok('the bridge routes a video through VideoSaver', /VideoSaver\.shared\.save\(from:/.test(bridge));
ok('it decides by extension, then by the server\u2019s Content-Type',
   /videoExts/.test(bridge) && /httpMethod = "HEAD"/.test(bridge) &&
   /hasPrefix\("video\/"\)/.test(bridge));
ok('a HEAD it cannot read answers "not a video" (the picture path reports Photos\u2019 own words)',
   /else \{ return false \}/.test(bridge));
ok('the video path reports its own outcome, denied and failed included',
   /VideoSaver\.shared\.save\(from: url\)[\s\S]{0,600}case \.denied:[\s\S]{0,200}offerPhotosSettings/.test(bridge));

console.log('\nEvery web tool with a Save icon uses it');
// The two wrappers whose page draws a Save icon. Named, not sniffed: after the
// fix neither file contains the string "forgeSave" at all, so a sweep keyed on
// that name would have silently checked nothing.
for (const f of ['PlaygroundView.swift', 'MetaAssetsView.swift']) {
  const src = read(path.join(IOS, f));
  ok(f + ' installs the shared bridge', /ForgeSaveBridge\.install\(into: config\)/.test(src));
  ok(f + ' retains the handler (addScriptMessageHandler does not)',
     /var saveHandler: ForgeSaveHandler\?/.test(src) &&
     /coordinator\.saveHandler = ForgeSaveBridge\.install/.test(src));
}
// AND EVERY GATED WEB TOOL GETS IT FROM ONE PLACE (2026-09-10). Installing it
// per tool is what left /footage — and every other page under this wrapper —
// with nothing better than a download link.
{
  const src = read(path.join(IOS, 'GatedWebTool.swift'));
  ok('GatedWebTool installs the shared bridge for every page it hosts',
     /ForgeSaveBridge\.install\(into: config\)/.test(src));
  ok('GatedWebTool retains the handler (addScriptMessageHandler does not)',
     /var saveHandler: ForgeSaveHandler\?/.test(src) &&
     /coordinator\.saveHandler = ForgeSaveBridge\.install/.test(src));
}

// And nobody may register the name by hand again — that is how the two copies
// drifted apart in the first place.
const handRolled = swiftFiles(IOS)
  .filter(f => f !== 'ForgeSaveBridge.swift')
  .filter(f => /\.add\([^)]*,\s*name:\s*"forgeSave"\)/.test(read(path.join(IOS, f))));
ok('nobody hand-rolls the registration', handRolled.length === 0, handRolled.join(', '));

console.log('\nThe write-and-hope call is gone from the whole app');
// Fire-and-forget: no completion target, so nothing can ever know it failed.
// CODE lines only — this file and the fixed call sites name it in prose on
// purpose, and a comment explaining the bug must not read as the bug.
const CALL = /UIImageWriteToSavedPhotosAlbum\([^)]*,\s*nil\s*,\s*nil\s*,\s*nil\s*\)/;
const offenders = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith('.swift')) continue;
    const hit = read(p).split('\n').some(l => !/^\s*(\/\/|\*)/.test(l) && CALL.test(l));
    if (hit) offenders.push(path.relative(ROOT, p));
  }
})(path.join(ROOT, 'ios'));
ok('no UIImageWriteToSavedPhotosAlbum(_, nil, nil, nil)', offenders.length === 0, offenders.join(', '));

console.log('\nThe page half');
// THE FOOTAGE PAGE saves a CLIP the same three ways (native bridge → the
// share sheet with the bytes already in hand → a plain download).
{
  const src = read(path.join(ROOT, 'public', 'footage.html'));
  ok('footage.html prefers the native bridge', /nativeSaver\(\)/.test(src) && /postMessage\(url\)/.test(src));
  ok('footage.html says what happened on every path', /window\.__saveResult\s*=/.test(src));
  ok('save is a button, never a bare link to the clip',
     /class="save"/.test(src) && !/>save<\/a>/.test(src));
  ok('the share sheet is only offered with the bytes already fetched',
     /primeSave\(/.test(src) && /pointerdown/.test(src));
}

// assets.html's own copy moved into the SHARED /asset-actions.js (2026-08-31,
// the one doors row) — this had been red on main ever since, which is the
// "a test left behind by a move" shape. It follows the code.
for (const name of ['promptlab.html', 'asset-actions.js']) {
  const src = read(path.join(ROOT, 'public', name));
  ok(name + ' prefers the native bridge', /nativeSaver\(\)/.test(src) && /postMessage\(url\)/.test(src));
  // A .webp name on png bytes is what the share sheet saves it as, and Photos
  // rejects webp outright.
  ok(name + ' names the share file after the BYTES, not a fixed extension',
     /\.split\('\/'\)\[1\]/.test(src));
  ok(name + ' never hard-codes .webp on the download',
     !/download\s*=\s*'[^']*\.webp'/.test(src) && !/download='[^']*\.webp'/.test(src));
  ok(name + ' says what happened on every path', /window\.__saveResult\s*=/.test(src));
}

console.log(failed ? '\n' + failed + ' failing\n' : '\nall good\n');
process.exit(failed ? 1 : 0);
