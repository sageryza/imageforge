'use strict';
// video-refusals.js — every refusal a Seedance door has sent back, matched
// by the EXACT text on the log (2026-09-10 sweep of all 238 jobs) and by
// Atlas's error_code, each with a kind and a line in her words. Pure.
const v = require('../video-refusals');
const f = require('../footage');
let fails = 0;
function ok(n, c, x) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (x ? '\n       ' + x : '')); } }
console.log('video refusals — the one table');

// the texts as the doors really sent them, off the log
const ON_FILE = [
  ['Total duration of all reference videos must not exceed 15.2 seconds. Please shorten or remove some reference videos and try again.', 1013030, 'shape'],
  ['The generated video may be related to copyright restrictions and has been blocked. Try adjusting your prompt or reference media.', 1012004, 'output'],
  ['The generated video may contain sensitive content and has been blocked. Try adjusting your prompt or reference media.', 1012006, 'output'],
  ['The generated audio may be related to copyright restrictions and was blocked by the provider policy.', 1012009, 'output'],
  ["Generation failed: The request failed because the input image 'content[1]' may contain real person. Request id: abc", null, 'content'],
  ["Generation failed: The request failed because the input video 'content[2]' may contain real person. Request id: abc", null, 'content'],
  ['InputVideoSensitiveContentDetected.PrivacyInformation', null, 'content'],
  ['InputImageSensitiveContentDetected.PrivacyInformation', null, 'content'],
  ['The request failed because the output audio may be related to copyright restrictions. Request id: abc', null, 'output'],
  ['The request failed because the output video may be related to copyright restrictions. Request id: abc', null, 'output'],
  ['Generation failed: Async generation failed: Exception: The request failed because the output video may be related to copyright', null, 'output'],
  ['The parameter `ratio` specified in the request is not valid. Seedance identified your task as video extension', null, 'shape'],
  ['Generation failed: Error while downloading image, error: expected the aspect ratio to be between 0.40 and 2.50', null, 'shape'],
  ['InvalidParameter.PixelCountTooSmall: Pixel count must be between 407696 and 8295044', null, 'shape'],
  ['Duration must be between 4 and 15 seconds', null, 'shape'],
  ['Polling timed out after 1200s', null, 'down'],
  ['Atlas Cloud is not answering (no answer in 30s)', null, 'down'],
];
for (const [text, code, kind] of ON_FILE) {
  const e = v.explain(text, code);
  ok(`${kind}: ${text.slice(0, 60)}`, e && e.kind === kind && e.line.length > 20 && e.free === true, JSON.stringify(e));
}
ok('the code alone finds the row', v.explain('', 1013030).kind === 'shape' && v.explain('', 1012009).kind === 'output');
ok('a reason nothing has seen is other, with no line to paint', v.explain('boom').kind === 'other' && v.explain('boom').line === '' && v.explain('boom').free === null);
ok('no text, no code → null', v.explain('') === null && v.explain(null) === null);
ok('every row carries a line, a kind and where it was seen', v.ROWS.every((r) => r.line && r.kind && r.seen && r.re instanceof RegExp));
ok('the input video row is asked before the picture row (both say PrivacyInformation)', v.explain('InputVideoSensitiveContentDetected.PrivacyInformation').line.includes('VIDEO'));

// the footage card derives `why` on read, for a failed job only
const card = f.whyOf({ status: 'failed', error: ON_FILE[0][0] });
ok('a failed card carries the line', card === v.explain(ON_FILE[0][0]).line);
ok('a finished card carries none', f.whyOf({ status: 'done', error: 'stale' }) === '' && f.whyOf({ status: 'failed' }) === '');
ok('an unmet reason carries none — the raw text stands alone', f.whyOf({ status: 'failed', error: 'boom' }) === '');

// the pre-send total — Atlas only, only when every length is known
ok('two 12-15s references are refused before the door, with the total', /27\.1 seconds/.test(f.refVideoTotalRefusal([12.04, 15.04], 'atlascloud')) && /15\.2/.test(f.refVideoTotalRefusal([12.04, 15.04], 'atlascloud')));
ok('under the cap sends', f.refVideoTotalRefusal([4, 8], 'atlascloud') === '' && f.refVideoTotalRefusal([15.2], 'atlascloud') === '');
ok('an unknown length is not evidence', f.refVideoTotalRefusal([12, null], 'atlascloud') === '' && f.refVideoTotalRefusal([], 'atlascloud') === '');
ok('the other doors are unmeasured and untouched', f.refVideoTotalRefusal([12, 15], 'apiframe') === '' && f.refVideoTotalRefusal([12, 15], 'openrouter') === '');
ok('the cap is the table\'s one number', v.REF_VIDEO_TOTAL_MAX === 15.2);

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../atlascloud.js', 'utf8');
ok('atlascloud asks the table first', /videoRefusals\.kindOf\(/.test(src));
const fj = fs.readFileSync(__dirname + '/../footage.js', 'utf8');
ok('a refused POST answers why', /why: e\.why \|\| \(ex && ex\.line\)/.test(fj));
ok('the floor sidecar banks the length', /seconds: size\.seconds/.test(fj) && /format=duration/.test(fj));
const page = fs.readFileSync(__dirname + '/../public/footage.html', 'utf8');
ok('the card paints why over the raw text', /esc\(j\.why \|\| j\.error \|\| 'failed'\)/.test(page) && /class="st raw"/.test(page));
ok('a refused tap paints why', /if \(d && d\.why\) msg = d\.why/.test(page));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
