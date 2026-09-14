'use strict';
// verdict-text.js — the text a verdict write replaces is kept one step back.
// Pure; no network. Plus a source pin that the route really calls it and
// answers `textsWas` on the read.
const fs = require('fs');
const { keptOver, TEXT_MAX } = require('../verdict-text');
let fails = 0;
function ok(name, cond, extra) { if (cond) console.log('  ok   ' + name); else { fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : '')); } }
console.log('verdict-text — keptOver');
ok('first write keeps nothing', keptOver({}, 'b1', 'x') === null);
ok('an empty slot keeps nothing', keptOver({ texts: { b1: '' } }, 'b1', 'x') === null);
ok('the same text again keeps nothing', keptOver({ texts: { b1: 'same' } }, 'b1', 'same') === null);
const w = keptOver({ texts: { b1: 'HER EDIT of the scene' } }, 'b1', '— me: go');
ok('a note replacing her edit keeps the edit', w && w.text === 'HER EDIT of the scene' && /^\d{4}-/.test(w.at), JSON.stringify(w));
ok('clearing a text keeps it too', keptOver({ texts: { b1: 'words' } }, 'b1', '') && keptOver({ texts: { b1: 'words' } }, 'b1', '').text === 'words');
ok('it never keeps more than TEXT_MAX chars', keptOver({ texts: { b1: 'x'.repeat(9000) } }, 'b1', 'y').text.length === TEXT_MAX);
ok('a whole scene fits — TEXT_MAX is at least 4000', TEXT_MAX >= 4000);
ok('the route caps on the same constant', /slice\(0, verdictText\.TEXT_MAX\)/.test(require('fs').readFileSync(__dirname + '/../chatfeed.js', 'utf8')));
const src = fs.readFileSync(__dirname + '/../chatfeed.js', 'utf8');
ok('the verdict route calls keptOver before writing', /verdictText\.keptOver\(/.test(src) && /patch\.textsWas\s*=/.test(src));
ok('GET /verdict answers textsWas', /textsWas:\s*d\.textsWas\s*\|\|\s*\{\}/.test(src));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
