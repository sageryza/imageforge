#!/usr/bin/env node
// THE SCRIPT BOX (2026-09-08): the split rule pure, and a source pin that
// chatfeed.js serves GET + POST /script with a cap far above a verdict's.
//   node scripts/test-chat-script.js
const fs = require('fs'), path = require('path');
const { splitScenes } = require('../script-cut');
let fails = 0; const ok = (n, c) => { if (!c) { fails++; console.error('FAIL ' + n); } else console.log('ok   ' + n); };
const t = 'Scene one.\nShe walks.\ncut\n\nScene two: he cut the bread.\nCUT.\nScene three\n cut \n';
const s = splitScenes(t);
ok('three scenes off two separators', s.length === 3);
ok('a "cut" inside a sentence is her word', s[1] === 'Scene two: he cut the bread.');
ok('CUT. and " cut " both separate', s[2] === 'Scene three');
ok('empty text is no scenes', splitScenes('').length === 0 && splitScenes('cut\ncut').length === 0);
const src = fs.readFileSync(path.join(__dirname, '..', 'chatfeed.js'), 'utf8');
ok('GET /script exists', /router\.get\('\/script'/.test(src));
ok('POST /script exists', /router\.post\('\/script'/.test(src));
const m = src.match(/const SCRIPT_MAX = (\d+)/); ok('cap is far above a verdict text', m && +m[1] >= 50000);
ok('the previous text is kept as was', /patch\.was = \{ text: prev\.text/.test(src));
process.exit(fails ? 1 : 0);
